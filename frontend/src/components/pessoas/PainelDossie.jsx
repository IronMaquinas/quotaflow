// components/pessoas/PainelDossie.jsx — etapa 12f
// Botão "📑 Gerar dossiê" na Ficha do colaborador → período (ano, 12 meses, todo o histórico ou intervalo), seções,
// finalidade (LGPD) → o backend registra quem gerou e devolve os dados → abre o HTML para imprimir/salvar em PDF.
// Embaixo, a lista dos dossiês já emitidos (quem, quando, período, finalidade, código).
import { useState } from "react";
import apiService from "../../services/apiService";
import { abrirDossie, prepararJanela } from "../../utils/gerarDossie";

const SECOES = [["dados", "Dados e selo"], ["funcoes", "Função e histórico"], ["documentos", "Documentos"], ["epi", "EPIs"], ["treinamentos", "Treinamentos"], ["competencias", "Competências"]];
const MOTIVOS = [["auditoria", "Auditoria (ISO / cliente)"], ["trabalhista", "Processo trabalhista"], ["colaborador", "Pedido do colaborador"], ["desligamento", "Desligamento"], ["outro", "Outro"]];
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

// rodape = botão em destaque ao lado do "Fechar"; o painel abre por cima do rodapé (ocupa a linha inteira)
export default function PainelDossie({ C, s, colaboradorId, onErro, onAviso, rodape = false }) {
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({ tipo: "ano", de: "", ate: hoje(), secoes: SECOES.map(([k]) => k), motivo: "auditoria", motivo_obs: "" });
  const [regs, setRegs] = useState(null);
  const [gerando, setGerando] = useState(false);
  const carregarRegs = async () => { try { setRegs((await apiService.get(`/pessoas/colaboradores/${colaboradorId}/dossies`))?.registros || []); } catch { setRegs([]); } };
  const abrir = () => { setAberto(true); carregarRegs(); };
  const gerar = async () => {
    const janela = prepararJanela();
    setGerando(true);
    try {
      const d = await apiService.post(`/pessoas/colaboradores/${colaboradorId}/dossie`, f);
      abrirDossie(d, janela); onAviso?.(`Dossiê emitido — código ${d.codigo}.`); await carregarRegs();
    } catch (e) { try { janela?.close(); } catch { /* ok */ } onErro(e.message); }
    finally { setGerando(false); }
  };
  if (!aberto) return rodape
    ? <button onClick={abrir} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>📑 Gerar dossiê</button>
    : <button onClick={abrir} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 12px", fontSize: 12, color: C.text }}>📑 Gerar dossiê</button>;
  const ok = !gerando && f.secoes.length > 0 && (f.tipo !== "intervalo" || (f.de && f.ate && f.de <= f.ate));
  const op = (k, l) => <label key={k} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="radio" checked={f.tipo === k} onChange={() => setF({ ...f, tipo: k })} />{l}</label>;
  return (
    <div style={{ border: `1px dashed ${C.accent}`, borderRadius: 8, padding: 12, marginTop: rodape ? 0 : 12, fontSize: 12, ...(rodape ? { flex: "1 1 100%", order: -1 } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <b style={{ flex: 1, fontSize: 13 }}>📑 Dossiê do colaborador</b>
        <button onClick={() => setAberto(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>×</button>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>{op("ano", `Ano de ${hoje().slice(0, 4)}`)}{op("12m", "Últimos 12 meses")}{op("tudo", "Todo o histórico")}{op("intervalo", "Intervalo")}</div>
      {f.tipo === "intervalo" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} style={{ ...s.input, width: 160, padding: "5px 8px", fontSize: 12 }} />
          <span style={{ alignSelf: "center" }}>a</span>
          <input type="date" value={f.ate} max={hoje()} onChange={(e) => setF({ ...f, ate: e.target.value })} style={{ ...s.input, width: 160, padding: "5px 8px", fontSize: 12 }} />
        </div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        {SECOES.map(([k, l]) => { const on = f.secoes.includes(k); return <label key={k} style={{ ...s.tag(on ? C.accent : C.muted), cursor: "pointer", padding: "5px 9px", display: "flex", gap: 5, alignItems: "center" }}><input type="checkbox" checked={on} onChange={() => setF({ ...f, secoes: on ? f.secoes.filter((x) => x !== k) : [...f.secoes, k] })} />{l}</label>; })}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <select value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} style={{ ...s.input, width: 220, padding: "5px 8px", fontSize: 12 }}>{MOTIVOS.map(([k, l]) => <option key={k} value={k}>Finalidade: {l}</option>)}</select>
        <input value={f.motivo_obs} onChange={(e) => setF({ ...f, motivo_obs: e.target.value })} placeholder="Detalhe (opcional — ex.: auditoria ISO 9001, processo nº…)" style={{ ...s.input, flex: "1 1 220px", padding: "5px 10px", fontSize: 12 }} />
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Contém dados pessoais (LGPD): a emissão fica registrada — quem gerou, quando, o período e a finalidade.</div>
      <button disabled={!ok} onClick={gerar} style={{ ...s.btn(ok), padding: "7px 16px", fontSize: 12 }}>{gerando ? "Montando…" : "📑 Gerar e abrir"}</button>
      {regs && regs.length > 0 && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4 }}>EMITIDOS</div>
          {regs.slice(0, 10).map((r) => (
            <div key={r.id} style={{ fontSize: 11, color: C.textSub, padding: "2px 0" }}>
              {new Date(r.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {r.gerado_por_nome || "—"} · {r.periodo_de ? `${dataBR(r.periodo_de)} a ${dataBR(r.periodo_ate)}` : `tudo até ${dataBR(r.periodo_ate)}`} · {r.motivo || "—"} · <span style={{ fontFamily: "monospace" }}>{r.codigo}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
