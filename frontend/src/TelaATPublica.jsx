// TelaATPublica.jsx — etapa 16c: 📲 página do MOTORISTA (#at?t=TOKEN) — pública, sem login, SEM valores, feita para o celular.
// Rota (com atalho para o Google Maps), datas, conjunto, carga, observações e o KIT DE DOCUMENTOS
// (CNH, CRLV do conjunto, NF-e/CT-e/MDF-e) para abrir/salvar no celular durante a viagem.
import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
const COR = { ok: "#16a34a", vence: "#d97706", vencido: "#dc2626", ausente: "#dc2626" };
const TXT = { ok: "", vence: "vence em breve", vencido: "VENCIDO — leve o documento em mãos", ausente: "não está no sistema — leve em mãos" };
const maps = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const rota = (a, b) => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a)}&destination=${encodeURIComponent(b)}&travelmode=driving`;
const celula = (c, v) => (v == null || v === "" ? "" : c.tipo === "sim_nao" ? ({ sim: "Sim", nao: "Não", na: "N/A" }[v] || v) : c.tipo === "data" ? dBR(v) : `${v}${c.unidade ? ` ${c.unidade}` : ""}`);

export default function TelaATPublica() {
  const token = new URLSearchParams(String(window.location.hash || "").split("?")[1] || "").get("t") || "";
  const [d, setD] = useState(null); const [erro, setErro] = useState(null);
  useEffect(() => {
    fetch(`${API}/at-link/${token}`).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || "Não foi possível abrir"); setD(j); }).catch((e) => setErro(e.message));
  }, [token]);
  const caixa = { background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px #0001" };
  const rot = { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700, marginBottom: 4 };
  if (erro) return <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: 24, fontFamily: "system-ui, sans-serif", color: "#0f172a" }}><div style={caixa}><b>🚛 {erro}</b></div></div>;
  if (!d) return <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: 24, fontFamily: "system-ui, sans-serif", color: "#64748b" }}>Carregando…</div>;
  const cols = d.colunas || [];
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a" }}>
      <div style={{ background: "#0f172a", color: "#fff", padding: "14px 16px" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{d.empresa?.nome}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>🚛 {d.numero}</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{d.status_nome} · {d.cliente_nome}</div>
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 12 }}>
        {d.status === "cancelada" && <div style={{ ...caixa, background: "#fee2e2", color: "#991b1b" }}><b>Esta viagem foi CANCELADA.</b>{d.cancelada_motivo ? ` ${d.cancelada_motivo}` : ""}</div>}
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
          {(d.itens || []).map((i) => <div key={i.id} style={{ fontSize: 14, padding: "4px 0" }}>{cols.map((c) => { const v = celula(c, i.valores?.[c.chave]); return v ? <div key={c.chave}><span style={{ color: "#64748b" }}>{c.rotulo}:</span> {v}</div> : null; })}{Number(i.quantidade || 1) !== 1 ? <div>Quantidade: {i.quantidade}</div> : null}</div>)}
        </div>
        {d.observacoes && <div style={caixa}><div style={rot}>📝 Observações</div><div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{d.observacoes}</div></div>}
        {d.empresa?.telefone && <a href={`tel:${String(d.empresa.telefone).replace(/\D/g, "")}`} style={{ ...caixa, display: "block", textAlign: "center", fontWeight: 700, color: "#0f172a", textDecoration: "none" }}>📞 Falar com a programação — {d.empresa.telefone}</a>}
        <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", padding: "8px 0 20px" }}>Pedido {d.pv_numero} · QuotaFlow</div>
      </div>
    </div>
  );
}
