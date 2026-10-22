// utils/filaInspecoes.js — etapa 14a
// Guarda a inspeção NO APARELHO (IndexedDB) enquanto é feita (rascunho) e depois de concluída, até conseguir enviar.
// Sem internet: fica na fila e reenvia sozinha quando a conexão volta (evento "online") ou ao abrir a tela.
// O envio é idempotente no servidor (cliente_uid), então reenviar nunca duplica.
// Sem IndexedDB (aba anônima antiga): cai num Map em memória — funciona enquanto a página estiver aberta.

const DB = "quotaflow-inspecoes";
const LOJA = "itens";
const memoria = new Map();
let dbP = null;

function abrir() {
  if (dbP) return dbP;
  dbP = new Promise((ok) => {
    try {
      if (typeof indexedDB === "undefined") return ok(null);
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(LOJA, { keyPath: "uid" }); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    } catch { ok(null); }
  });
  return dbP;
}
async function tx(modo, fn) {
  const db = await abrir();
  if (!db) return fn(null);
  return new Promise((ok, falha) => {
    try {
      const t = db.transaction(LOJA, modo); const st = t.objectStore(LOJA);
      const r = fn(st);
      t.oncomplete = () => ok(r && "result" in r ? r.result : undefined);
      t.onerror = () => falha(t.error);
    } catch (e) { falha(e); }
  });
}

/** item: { uid, tenant, situacao: 'rascunho'|'pendente'|'erro', corpo, rotulo, atualizado_em, erro } */
export async function salvar(item) {
  const x = { ...item, atualizado_em: new Date().toISOString() };
  const db = await abrir();
  if (!db) { memoria.set(x.uid, x); return; }
  await tx("readwrite", (st) => st.put(x));
}
export async function remover(uid) {
  const db = await abrir();
  if (!db) { memoria.delete(uid); return; }
  await tx("readwrite", (st) => st.delete(uid));
}
export async function listar(tenant) {
  const db = await abrir();
  let todos;
  if (!db) todos = [...memoria.values()];
  else todos = (await tx("readonly", (st) => st.getAll())) || [];
  return todos.filter((x) => !tenant || String(x.tenant) === String(tenant)).sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em)));
}

export const novoUid = () => {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch { /* ok */ }
  return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

/** Envia tudo que está "pendente"/"erro" de rede. enviarFn(corpo) → resposta. Erro de validação (400) fica marcado como 'erro'. */
let enviando = false;
export async function sincronizar(tenant, enviarFn) {
  if (enviando) return { enviadas: 0 };
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { enviadas: 0, offline: true };
  enviando = true;
  let enviadas = 0;
  try {
    for (const it of await listar(tenant)) {
      if (it.situacao !== "pendente") continue;
      try { await enviarFn(it.corpo); await remover(it.uid); enviadas++; }
      catch (e) {
        const rede = !e?.body; // sem corpo de resposta = não chegou no servidor
        if (rede) break; // sem internet de novo — tenta depois
        await salvar({ ...it, situacao: "erro", erro: String(e?.message || "Erro ao enviar") });
      }
    }
  } finally { enviando = false; }
  return { enviadas };
}

/** Comprime uma foto (File) para JPEG ~1280px — fotos de celular têm 4–8 MB. → { base64, mime, previa } */
export function comprimirFoto(file, lado = 1280, qualidade = 0.72) {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onerror = () => falha(new Error("Não foi possível ler a foto"));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => falha(new Error("Formato de foto não suportado"));
      img.onload = () => {
        const k = Math.min(1, lado / Math.max(img.width, img.height));
        const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        const url = cv.toDataURL("image/jpeg", qualidade);
        ok({ base64: url.split(",")[1], mime: "image/jpeg", previa: url });
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
