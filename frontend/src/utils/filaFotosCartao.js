// utils/filaFotosCartao.js — etapa E1: 📸 fila das fotos com cartão NO APARELHO (IndexedDB)
//   A foto é guardada antes de qualquer envio → sem sinal no parque eólico nada se perde. Reenvia ao voltar a conexão ("online"),
//   ao abrir a tela e depois de cada foto. O servidor não duplica (cliente_uid), então reenviar é seguro.
//   Sem IndexedDB: Map em memória (vale enquanto a página estiver aberta).
const DB = "quotaflow-fotos-cartao"; const LOJA = "fotos"; const memoria = new Map(); let dbP = null;
function abrir() {
  if (dbP) return dbP;
  dbP = new Promise((ok) => { try { if (typeof indexedDB === "undefined") return ok(null); const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(LOJA, { keyPath: "uid" }); }; r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch { ok(null); } });
  return dbP;
}
const tx = async (modo, fn) => { const db = await abrir(); if (!db) return fn(null); return new Promise((ok) => { try { const t = db.transaction(LOJA, modo); const st = t.objectStore(LOJA); const r = fn(st); t.oncomplete = () => ok(r?.result ?? r); t.onerror = () => ok(null); } catch { ok(fn(null)); } }); };
/** grava e CONFERE (lê de volta). Devolve false se o aparelho não guardou (memória cheia, modo privado…) */
export async function salvar(item) {
  try { await tx("readwrite", (st) => (st ? st.put(item) : memoria.set(item.uid, item))); } catch { return false; }
  const db = await abrir(); if (!db) return memoria.has(item.uid);
  return new Promise((ok) => { try { const r = db.transaction(LOJA, "readonly").objectStore(LOJA).get(item.uid); r.onsuccess = () => ok(!!r.result); r.onerror = () => ok(false); } catch { ok(false); } });
}
/** E1.1: pede ao navegador para não apagar estes dados sozinho (Chrome concede; no iPhone, só com o app na Tela de Início) */
export async function pedirPersistencia() { try { if (!navigator.storage?.persist) return null; if (await navigator.storage.persisted()) return true; return await navigator.storage.persist(); } catch { return null; } }
export async function remover(uid) { await tx("readwrite", (st) => (st ? st.delete(uid) : memoria.delete(uid))); }
export async function listar(tenant) {
  const db = await abrir(); let l;
  if (!db) l = [...memoria.values()];
  else l = await new Promise((ok) => { try { const r = db.transaction(LOJA, "readonly").objectStore(LOJA).getAll(); r.onsuccess = () => ok(r.result || []); r.onerror = () => ok([]); } catch { ok([]); } });
  return l.filter((x) => !tenant || x.tenant === tenant).sort((a, b) => a.criado - b.criado);
}
export const novoUid = () => { try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch { /* ok */ } return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; };

let enviando = false;
/** envia o que está na fila; erro de validação (400/409) marca 'erro' e não tenta de novo sozinho. Devolve { enviadas, pendentes, erros } */
export async function sincronizar(tenant, enviarFn) {
  if (enviando) return null; enviando = true; let enviadas = 0;
  try {
    for (const it of await listar(tenant)) {
      if (it.status === "erro") continue;
      try { await enviarFn(it.corpo); await remover(it.uid); enviadas++; }
      catch (e) { const st = e?.response?.status; if (st && st >= 400 && st < 500 && st !== 408 && st !== 429) await salvar({ ...it, status: "erro", erro: e?.response?.data?.erro || e.message }); else break; }
    }
  } finally { enviando = false; }
  const resto = await listar(tenant);
  return { enviadas, pendentes: resto.filter((x) => x.status !== "erro").length, erros: resto.filter((x) => x.status === "erro").length };
}
