// TelaATPublica.jsx — etapa 16c: 📲 página do MOTORISTA (#at?t=TOKEN) — pública, sem login, SEM valores, feita para o celular.
// Rota (com atalho para o Google Maps), datas, conjunto, carga, observações e o KIT DE DOCUMENTOS
// (CNH, CRLV do conjunto, NF-e/CT-e/MDF-e) para abrir/salvar no celular durante a viagem.
// 16e: 🧭 FLUXO DA VIAGEM — as etapas na ordem da programação: a próxima só abre com a anterior feita (o servidor confere).
//   Marcação (saída, chegada…) = um toque (+ GPS). Inspeção = a mesma tela de inspeção do app (funciona sem internet: fica no celular).
//   Sem internet: a etapa fica "guardada no celular" e a seguinte já abre; tudo é enviado na ordem quando o sinal voltar.
import { useState, useEffect, useCallback } from "react";
import { C as CE, s as SE } from "./App";
import ExecutarInspecao from "./components/inspecoes/ExecutarInspecao";
import * as Fila from "./utils/filaInspecoes";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
const COR = { ok: "#16a34a", vence: "#d97706", vencido: "#dc2626", ausente: "#dc2626" };
const TXT = { ok: "", vence: "vence em breve", vencido: "VENCIDO — leve o documento em mãos", ausente: "não está no sistema — leve em mãos" };
const maps = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const rota = (a, b) => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a)}&destination=${encodeURIComponent(b)}&travelmode=driving`;
const celula = (c, v) => (v == null || v === "" ? "" : c.tipo === "sim_nao" ? ({ sim: "Sim", nao: "Não", na: "N/A" }[v] || v) : c.tipo === "data" ? dBR(v) : `${v}${c.unidade ? ` ${c.unidade}` : ""}`);

const lerLS = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? padrao; } catch { return padrao; } };
const gravarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage: segue */ } };
const pegarGps = () => new Promise((ok) => { try { navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }), () => ok(null), { timeout: 6000, maximumAge: 60000 }); } catch { ok(null); } });

export default function TelaATPublica() {
  const token = new URLSearchParams(String(window.location.hash || "").split("?")[1] || "").get("t") || "";
  const [d, setD] = useState(() => lerLS(`qf-at-${token}-ultima`, null)); const [erro, setErro] = useState(null);
  const [pend, setPend] = useState(() => lerLS(`qf-at-${token}-pend`, {})); // { etapaId: { tipo, em, gps } } — feito sem internet, aguardando envio
  const [inspLocal, setInspLocal] = useState({}); // { etapaId: 'pendente'|'rascunho'|'erro' } — fila de inspeções do celular
  const [exec, setExec] = useState(null); const [aviso, setAviso] = useState(null); const [ocupado, setOcupado] = useState(false);
  const [quem, setQuem] = useState(() => lerLS(`qf-at-quem`, { outro: false, nome: "", cpf: "" }));
  const chamar = async (metodo, caminho, corpo) => {
    let r; try { r = await fetch(`${API}/at-link/${token}${caminho}`, { method: metodo, headers: { "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined }); }
    catch { throw new Error("Sem internet"); }
    const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.erro || `Erro ${r.status}`); e.body = j; throw e; } return j;
  };
  const carregar = useCallback(async () => {
    try { const j = await chamar("GET", ""); setD(j); gravarLS(`qf-at-${token}-ultima`, j); setErro(null); }
    catch (e) { if (e.body || !lerLS(`qf-at-${token}-ultima`, null)) setErro(e.body ? e.message : "Sem internet para abrir o link."); }
  }, [token]); // eslint-disable-line
  const lerFila = useCallback(async (fluxo) => {
    const m = {}; for (const x of fluxo || []) if (x.tipo === "inspecao") { const l = await Fila.listar(`at-${token}-${x.id}`); if (l[0]) m[x.id] = l[0].situacao; } setInspLocal(m);
  }, [token]);
  // envia o que ficou no celular, NA ORDEM do fluxo (para na 1ª que não passar)
  const sincronizar = useCallback(async () => {
    const atual = lerLS(`qf-at-${token}-ultima`, null); if (!atual?.fluxo) return;
    let p = lerLS(`qf-at-${token}-pend`, {});
    for (const x of atual.fluxo) {
      if (x.status !== "pendente") continue;
      if (x.tipo === "marco" && p[x.id]) {
        try { await chamar("POST", `/etapa/${x.id}/marcar`, p[x.id]); delete p[x.id]; gravarLS(`qf-at-${token}-pend`, p); setPend({ ...p }); setAviso("✓ O que ficou guardado no celular foi enviado."); }
        catch { break; }
      } else if (x.tipo === "inspecao") {
        const l = await Fila.listar(`at-${token}-${x.id}`); if (!l.some((i) => i.situacao === "pendente")) break;
        const r = await Fila.sincronizar(`at-${token}-${x.id}`, (corpo) => chamar("POST", `/etapa/${x.id}/inspecao`, corpo));
        if (!r.enviadas) break; setAviso("✓ O que ficou guardado no celular foi enviado.");
      } else break;
    }
    await carregar();
  }, [token, carregar]); // eslint-disable-line
  useEffect(() => { carregar().then(sincronizar); const on = () => sincronizar(); window.addEventListener("online", on); return () => window.removeEventListener("online", on); }, []); // eslint-disable-line
  useEffect(() => { if (d?.fluxo) lerFila(d.fluxo); }, [d, lerFila]);
  const caixa = { background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px #0001" };
  const rot = { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700, marginBottom: 4 };
  if (erro) return <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: 24, fontFamily: "system-ui, sans-serif", color: "#0f172a" }}><div style={caixa}><b>🚛 {erro}</b></div></div>;
  if (!d) return <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: 24, fontFamily: "system-ui, sans-serif", color: "#64748b" }}>Carregando…</div>;
  const cols = d.colunas || [];
  if (exec) {
    const tenant = `at-${token}-${exec.id}`;
    return <div style={{ background: CE.bg, minHeight: "100vh" }}><ExecutarInspecao C={CE} s={SE} tenant={tenant} equipamento={{ id: exec.equipamento_id || exec.id }} chavePrep={exec.id}
      rascunho={exec.rascunho || null} carregarPrep={async () => (await chamar("GET", `/etapa/${exec.id}/preparar`)).prep}
      enviarFn={(corpo) => chamar("POST", `/etapa/${exec.id}/inspecao`, corpo)}
      extraCorpo={quem.outro ? { terceiro: { nome: quem.nome.trim(), cpf: String(quem.cpf).replace(/\D/g, "") } } : {}}
      onFechar={() => { setExec(null); lerFila(d.fluxo); }}
      onConcluida={async (r) => { setExec(null); setAviso(r.offline ? "💾 Inspeção guardada no celular — será enviada quando o sinal voltar. Pode seguir para a próxima etapa." : r.bloqueou ? "⛔ Inspeção REPROVADA — não siga. A programação foi avisada; aguarde a liberação." : `✓ Inspeção ${r.numero || ""} enviada.`); await carregar(); await lerFila(d.fluxo); }} /></div>;
  }
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a" }}>
      <div style={{ background: "#0f172a", color: "#fff", padding: "14px 16px" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{d.empresa?.nome}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>🚛 {d.numero}</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{d.status_nome} · {d.cliente_nome}</div>
        {d.ref && <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 2 }}>🔗 {d.ref}</div>}
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 12 }}>
        {d.status === "cancelada" && <div style={{ ...caixa, background: "#fee2e2", color: "#991b1b" }}><b>Esta viagem foi CANCELADA.</b>{d.cancelada_motivo ? ` ${d.cancelada_motivo}` : ""}</div>}
        {(d.fluxo || []).length > 0 && (() => {
          // situação de cada etapa: o servidor + o que ficou guardado no celular
          const feitaLocal = (x) => !!pend[x.id] || inspLocal[x.id] === "pendente";
          const efetiva = d.fluxo.map((x) => ({ ...x, local: x.status === "pendente" && feitaLocal(x) }));
          let prox = -1; let travada = null;
          for (let i = 0; i < efetiva.length; i++) { const x = efetiva[i]; if (x.status === "reprovada" && !x.liberacao) { travada = x; break; } if (x.status === "pendente" && !x.local) { prox = i; break; } }
          const nomeQuem = quem.outro ? quem.nome : d.motorista_nome;
          const fazer = async (x, i) => {
            if (i !== prox) { const ant = efetiva.find((y) => y.status === "pendente" && !y.local); setAviso(travada ? `⛔ Aguardando o gestor liberar: ${travada.rotulo}.` : `Etapa ainda não liberada — conclua primeiro: ${ant?.rotulo}`); return; }
            setAviso(null);
            if (quem.outro && (quem.nome.trim().length < 3 || String(quem.cpf).replace(/\D/g, "").length !== 11)) { setAviso("Informe seu nome e CPF (você marcou que é outro motorista)."); return; }
            if (x.tipo === "marco") {
              setOcupado(true); const corpo = { em: new Date().toISOString(), gps: await pegarGps(), por: nomeQuem };
              try { await chamar("POST", `/etapa/${x.id}/marcar`, corpo); await carregar(); }
              catch (e) { if (e.body) setAviso(e.message); else { const p = { ...pend, [x.id]: corpo }; gravarLS(`qf-at-${token}-pend`, p); setPend(p); setAviso("💾 Sem internet — marcado no celular; será enviado quando o sinal voltar."); } }
              finally { setOcupado(false); }
            } else { // retoma a inspeção começada neste celular (rascunho ou recusada) — não começa outra por cima
              const l = await Fila.listar(`at-${token}-${x.id}`); let r = l.find((y) => y.situacao !== "pendente") || null;
              if (r && r.situacao === "erro") { r = { ...r, situacao: "rascunho" }; await Fila.salvar(r); }
              if (r && !r.prep?.inicial?._opcoes_local) { // 16e.2.1: inspeção começada antes do preenchimento — completa os campos vazios com o que a AT sabe
                try { const pr = (await chamar("GET", `/etapa/${x.id}/preparar`)).prep; const ini = pr?.inicial || {};
                  const corpo = { ...r.corpo }; for (const k of ["local", "cliente"]) if (ini[k] && !String(corpo[k] ?? "").trim()) corpo[k] = ini[k];
                  r = { ...r, prep: { ...r.prep, inicial: ini }, corpo }; await Fila.salvar(r); } catch { /* sem internet: segue com o que tem */ }
              }
              setExec({ ...x, rascunho: r });
            }
          };
          return <div style={{ ...caixa, border: "2px solid #2563eb" }}>
            <div style={rot}>🧭 Fluxo da viagem — siga na ordem</div>
            {!d.motorista_id && !quem.outro ? null : <div style={{ fontSize: 13, marginBottom: 8 }}>
              {!quem.outro ? <>Motorista: <b>{d.motorista_nome}</b> · <button type="button" onClick={() => { const q = { ...quem, outro: true }; setQuem(q); gravarLS("qf-at-quem", q); }} style={{ background: "none", border: "none", color: "#2563eb", padding: 0, fontSize: 13, textDecoration: "underline" }}>não sou eu</button></>
                : <div style={{ display: "grid", gap: 6 }}><b>Outro motorista</b>
                  <input value={quem.nome} onChange={(e) => { const q = { ...quem, nome: e.target.value }; setQuem(q); gravarLS("qf-at-quem", q); }} placeholder="Seu nome completo" style={{ padding: 10, fontSize: 15, borderRadius: 8, border: "1px solid #cbd5e1" }} />
                  <input value={quem.cpf} inputMode="numeric" onChange={(e) => { const q = { ...quem, cpf: e.target.value }; setQuem(q); gravarLS("qf-at-quem", q); }} placeholder="CPF" style={{ padding: 10, fontSize: 15, borderRadius: 8, border: "1px solid #cbd5e1" }} />
                  {d.motorista_id && <button type="button" onClick={() => { const q = { outro: false, nome: "", cpf: "" }; setQuem(q); gravarLS("qf-at-quem", q); }} style={{ background: "none", border: "none", color: "#2563eb", padding: 0, fontSize: 13, textAlign: "left" }}>sou {d.motorista_nome}</button>}</div>}
            </div>}
            {efetiva.map((x, i) => {
              const ok = x.status === "feita" || x.local; const rep = x.status === "reprovada"; const ativa = i === prox;
              const cor = rep && !x.liberacao ? "#dc2626" : ok || rep ? "#16a34a" : ativa ? "#2563eb" : "#94a3b8";
              return <div key={x.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderTop: i ? "1px solid #e2e8f0" : "none", opacity: !ok && !rep && !ativa ? 0.55 : 1 }}>
                <span style={{ width: 26, height: 26, borderRadius: 13, flex: "0 0 26px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", background: cor }}>{ok ? "✓" : rep && !x.liberacao ? "!" : i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: ativa ? 800 : 600, fontSize: 14.5 }}>{x.rotulo}</div>
                  {x.tipo === "inspecao" && x.modelo_nome && <div style={{ fontSize: 12, color: "#64748b" }}>{x.modelo_nome}{x.equipamento_tag ? ` · ${x.equipamento_tag}` : ""}</div>}
                  {x.status !== "pendente" && <div style={{ fontSize: 12, color: "#64748b" }}>{dataHora(x.feita_em)}{x.inspecao_numero ? ` · ${x.inspecao_numero} (${x.resultado})` : ""}</div>}
                  {x.local && <div style={{ fontSize: 12, color: "#d97706" }}>💾 guardado no celular — envia quando tiver internet</div>}
                  {inspLocal[x.id] === "erro" && <div style={{ fontSize: 12, color: "#dc2626" }}>Não foi aceita — abra de novo para corrigir.</div>}
                  {rep && !x.liberacao && <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 700, marginTop: 2 }}>⛔ Reprovada — NÃO siga. Aguarde o gestor liberar{d.empresa?.telefone ? ` (ligue: ${d.empresa.telefone})` : ""}.</div>}
                  {rep && x.liberacao && <div style={{ fontSize: 12, color: "#d97706" }}>🔓 liberada pelo gestor</div>}
                  {ativa && <button type="button" disabled={ocupado} onClick={() => fazer(x, i)} style={{ marginTop: 8, width: "100%", background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 700 }}>
                    {ocupado ? "Enviando…" : x.tipo === "inspecao" ? (inspLocal[x.id] === "rascunho" || inspLocal[x.id] === "erro" ? "🔍 Continuar a inspeção" : "🔍 Fazer a inspeção") : `✓ Confirmar: ${x.rotulo.replace(/^\S+\s/, "")}`}</button>}
                  {!ok && !rep && !ativa && x.status === "pendente" && <button type="button" onClick={() => fazer(x, i)} style={{ marginTop: 4, background: "none", border: "1px solid #cbd5e1", color: "#64748b", borderRadius: 8, padding: "5px 10px", fontSize: 12 }}>🔒 {x.tipo === "inspecao" ? "inspeção" : "etapa"} bloqueada</button>}
                </div></div>; })}
            {aviso && <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "#fef3c7", color: "#92400e", fontSize: 13 }}>{aviso}</div>}
            {prox < 0 && !travada && <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "#dcfce7", color: "#166534", fontSize: 13.5, fontWeight: 700 }}>✓ Fluxo concluído. Boa viagem de volta!</div>}
          </div>;
        })()}
        <div style={caixa}>
          <div style={rot}>📍 Coleta · {dataHora(d.inicio_previsto)}</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{d.origem || "—"}</div>
          {d.origem && <a href={maps(d.origem)} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#2563eb" }}>Abrir no mapa</a>}
          <div style={{ ...rot, marginTop: 12 }}>🏁 Entrega{d.fim_previsto ? ` · ${dataHora(d.fim_previsto)}` : ""}</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{d.destino || "—"}</div>
          {d.destino && <a href={maps(d.destino)} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#2563eb" }}>Abrir no mapa</a>}
          {d.origem && d.destino && <a href={rota(d.origem, d.destino)} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", marginTop: 12, background: "#2563eb", color: "#fff", borderRadius: 10, padding: "12px", fontWeight: 700, textDecoration: "none" }}>🧭 Abrir a rota no Google Maps</a>}
        </div>
        <div style={caixa}>
          <div style={rot}>📄 Documentos da viagem</div>
          {(d.kit || []).map((k, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i ? "1px solid #e2e8f0" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{k.rotulo}</div>
                {(k.status !== "ok" || k.vence_em) && <div style={{ fontSize: 12, color: COR[k.status] || "#64748b" }}>{TXT[k.status]}{k.vence_em ? `${TXT[k.status] ? " · " : ""}validade ${dBR(k.vence_em)}` : ""}</div>}
              </div>
              {k.url ? <a href={k.url} target="_blank" rel="noreferrer" style={{ background: "#0f172a", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>Abrir</a>
                : <span style={{ fontSize: 12, color: "#94a3b8" }}>sem arquivo</span>}
            </div>))}
          {!(d.kit || []).length && <div style={{ fontSize: 13, color: "#64748b" }}>Nenhum documento ainda.</div>}
          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 8 }}>Dica: abra cada documento e salve no celular antes de pegar a estrada (sem sinal, o link não abre).</div>
        </div>
        <div style={caixa}>
          <div style={rot}>👤 Motorista e conjunto</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{d.motorista_nome || "—"}</div>
          {(d.conjunto || []).map((c) => <div key={c.id} style={{ fontSize: 14 }}>{c.papel === "cavalo" ? "🚛 Cavalo" : "🔗 Implemento"}: <b>{c.tag}</b> {c.nome}</div>)}
        </div>
        <div style={caixa}>
          <div style={rot}>📦 Carga — {d.grupo_titulo}</div>
          {(d.itens || []).map((i) => <div key={i.id} style={{ fontSize: 14, padding: "4px 0" }}>{i.n ? <div style={{ fontWeight: 700 }}>Item {i.n}</div> : null}<div style={{ fontWeight: 700, color: i.serie ? "#0f172a" : "#d97706" }}>Nº de série: {i.serie || "confira na nota fiscal"}</div>{cols.map((c) => { const v = celula(c, i.valores?.[c.chave]); return v ? <div key={c.chave}><span style={{ color: "#64748b" }}>{c.rotulo}:</span> {v}</div> : null; })}{Number(i.quantidade || 1) !== 1 ? <div>Quantidade: {i.quantidade}</div> : null}<div style={{ fontWeight: 700 }}>Volumes: {i.volumes || 1}</div></div>)}
        </div>
        {d.observacoes && <div style={caixa}><div style={rot}>📝 Observações</div><div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{d.observacoes}</div></div>}
        {d.empresa?.telefone && <a href={`tel:${String(d.empresa.telefone).replace(/\D/g, "")}`} style={{ ...caixa, display: "block", textAlign: "center", fontWeight: 700, color: "#0f172a", textDecoration: "none" }}>📞 Falar com a programação — {d.empresa.telefone}</a>}
        <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", padding: "8px 0 20px" }}>Pedido {d.pv_numero} · QuotaFlow</div>
      </div>
    </div>
  );
}
