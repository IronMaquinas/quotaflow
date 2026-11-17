// components/home/SalaControle.jsx — etapa SC1: 🛰 SALA DE CONTROLE — o Início de cada pessoa
//   "Bom dia! A empresa está assim hoje": estado (🟢🟡🔴), 🚨 alertas, 🎯 prioridades (máx. 7), 📅 agenda de hoje,
//   e para a gestão 📊 números do dia + 👥 equipe (consolidado → clica e vê por pessoa). Atualiza sozinha a cada 60 s.
//   Só mostra o que o perfil/plano abre (podeAbrir(tela)). Cada item leva direto aonde se resolve.
import { useEffect, useRef, useState } from "react";
import apiService from "../../services/apiService";
import { COR_SINAL, fmtValor } from "../metas/TelaMetas"; // SC2

const ESTADO = {
  estavel: { cor: "#22c55e", fundo: "#0f2a1f", rot: "Tudo sob controle", ic: "🟢" },
  atencao: { cor: "#f59e0b", fundo: "#2a210f", rot: "Pede atenção", ic: "🟡" },
  critico: { cor: "#ef4444", fundo: "#2a1212", rot: "Situação crítica", ic: "🔴" },
};
const KPIS = [
  ["ats_hoje", "🚛", "ATs hoje", "programacao"], ["ats_em_execucao", "🛣", "em execução", "programacao"], ["equipamentos_bloqueados", "⛔", "equip. bloqueados", "inspecoes"],
  ["documentos_vencidos", "📄", "docs vencidos", "documentos"], ["documentos_7d", "📅", "vencem em 7 dias", "documentos"], ["ncs_abertas", "⚠️", "NCs abertas", "nao_conformidades"],
  ["acoes_nc_atrasadas", "⏰", "ações de NC atrasadas", "nao_conformidades"], ["tarefas_atrasadas", "📌", "tarefas atrasadas", "plano"],
];
const saud = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };

export default function SalaControle({ C, s, podeAbrir = () => true, topo = null }) {
  const [d, setD] = useState(null); const [erro, setErro] = useState(null); const [em, setEm] = useState(null);
  const [todasP, setTodasP] = useState(false); const [verEquipe, setVerEquipe] = useState(false); const t = useRef(null);
  const carregar = () => apiService.get("/sala-controle").then((r) => { setD(r); setErro(null); setEm(new Date()); }).catch(() => setErro("Não consegui atualizar a sala agora."));
  // SC2.6: atualiza a cada 5 min SÓ com a aba visível; ao voltar para a aba (se passou 1 min) atualiza na hora; ↻ manual
  const ultimo = useRef(0);
  const carregarSe = (minMs) => { if (document.visibilityState === "visible" && Date.now() - ultimo.current >= minMs) { ultimo.current = Date.now(); carregar(); } };
  useEffect(() => {
    ultimo.current = Date.now(); carregar(); t.current = setInterval(() => carregarSe(5 * 60000 - 1000), 5 * 60000);
    const volta = () => carregarSe(60000); document.addEventListener("visibilitychange", volta); window.addEventListener("focus", volta);
    return () => { clearInterval(t.current); document.removeEventListener("visibilitychange", volta); window.removeEventListener("focus", volta); };
  }, []); // eslint-disable-line
  const ir = (l) => { if (!l?.tela) return; if (l.tela === "documentos" && l.aba === "gestao") { window.qfDocsAba = "gestao"; if (l.id) window.qfAbrirGestaoDoc = l.id; } window.dispatchEvent(new CustomEvent("qf-navegar", { detail: { tela: l.tela, titulo: l.titulo } })); };
  const ok = (x) => !x.link?.tela || podeAbrir(x.link.tela);
  if (!d) return <div style={{ ...s.card, padding: 40, textAlign: "center", color: C.muted }}>{erro || "Montando a sua sala de controle…"}</div>;
  const alertas = d.alertas.filter(ok); const prior = d.prioridades.filter(ok); const agenda = d.agenda.filter(ok);
  // SC2.6 (Marcony): o estado olha o PAINEL TODO — alertas, prioridades, metas fora do alvo e os números ruins da gestão (não só os indicadores)
  const saudeVis = d.gestor && Array.isArray(d.saude) && podeAbrir("metas") ? d.saude : [];
  const k = d.gestor ? d.kpis || {} : {};
  const ruins = [["tarefas_atrasadas", "tarefa(s) atrasada(s) na equipe", "plano"], ["acoes_nc_atrasadas", "ação(ões) de NC atrasada(s)", "nao_conformidades"], ["documentos_vencidos", "documento(s) vencido(s)", "documentos"], ["equipamentos_bloqueados", "equipamento(s) bloqueado(s)", "inspecoes"]]
    .filter(([c, , tela]) => k[c] > 0 && podeAbrir(tela)).map(([c, rot]) => `${k[c]} ${rot}`);
  const metasVerm = saudeVis.filter((m) => m.sinal === "vermelho").length; const metasAm = saudeVis.filter((m) => m.sinal === "amarelo").length;
  const critico = alertas.some((a) => a.nivel === "critico") || metasVerm > 0;
  const atencao = alertas.length || prior.length || metasAm || ruins.length;
  const est = ESTADO[critico ? "critico" : atencao ? "atencao" : "estavel"];
  const frase = [alertas.length && `${alertas.length} alerta(s)`, metasVerm && `${metasVerm} meta(s) no vermelho`, metasAm && `${metasAm} meta(s) no amarelo`, ...ruins.filter((r) => !/vencido|bloqueado/.test(r) || !alertas.length), prior.length && `${prior.length} prioridade(s) suas`, agenda.length && `${agenda.length} compromisso(s) hoje`].filter(Boolean).join(" · ") || "nada pendente — bom trabalho!";
  const kpis = d.gestor ? KPIS.filter(([k, , , tela]) => d.kpis[k] != null && podeAbrir(tela)) : [];
  const card = { ...s.card, padding: 16, textAlign: "left" };
  const linha = (x, i, cor) => (
    <div key={i} onClick={() => ir(x.link)} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 4px", borderTop: i ? `1px solid ${C.border}` : "none", cursor: x.link ? "pointer" : "default" }}>
      <span style={{ fontSize: 17, width: 24, textAlign: "center" }}>{x.icone}</span>
      <span style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: cor || C.text }}>{x.titulo}</div>{x.detalhe && <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis" }}>{x.detalhe}</div>}</span>
      {x.link && <span style={{ color: C.accent, fontSize: 12, paddingTop: 2 }}>›</span>}
    </div>);
  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ ...card, padding: "18px 20px", marginBottom: 12, background: `linear-gradient(135deg, ${C.surface}, ${est.fundo})`, borderColor: est.cor + "66", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{saud()}, {d.nome || "tudo bem"}!</div>
          <div style={{ fontSize: 13, color: C.textSub, marginTop: 2 }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · {d.gestor ? "a empresa está assim agora" : "estas são as suas prioridades"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: est.cor }}>{est.ic} {est.rot}</div>
          <div style={{ fontSize: 12, color: C.textSub }}>{frase}</div>
        </div>
      </div>
      {topo}
      {alertas.length > 0 && <div style={{ ...card, marginBottom: 12, borderColor: "#ef444466" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#f87171", marginBottom: 4 }}>🚨 ALERTAS AGORA</div>
        {alertas.map((a, i) => linha(a, i, a.nivel === "critico" ? "#fca5a5" : "#fcd34d"))}
      </div>}
      {d.gestor && Array.isArray(d.saude) && podeAbrir("metas") && (d.saude.length === 0
        ? <div onClick={() => ir({ tela: "metas" })} style={{ ...card, marginBottom: 12, cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 26 }}>🎯</span><span style={{ flex: 1 }}><b>Defina as metas da empresa</b><div style={{ fontSize: 12.5, color: C.muted }}>Com as metas, esta tela mostra a saúde do negócio por área — 🟢🟡🔴 e a tendência do mês.</div></span><span style={{ color: C.accent, fontSize: 12.5 }}>começar ›</span></div>
        : <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: C.textSub }}>📊 SAÚDE DO NEGÓCIO</span>
              <span style={{ fontSize: 12, color: C.muted }}>{["verde", "amarelo", "vermelho"].map((k) => { const n = d.saude.filter((m) => m.sinal === k).length; return n ? <span key={k} style={{ marginLeft: 8, color: COR_SINAL[k] }}>● {n}</span> : null; })}</span>
              <button type="button" onClick={() => ir({ tela: "metas" })} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, marginLeft: 10 }}>metas ›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
              {[...d.saude].sort((a, b) => ({ vermelho: 0, amarelo: 1, verde: 2 }[a.sinal] ?? 3) - ({ vermelho: 0, amarelo: 1, verde: 2 }[b.sinal] ?? 3)).map((m) => (
                <div key={m.id} title={m.descricao || ""} onClick={() => ir({ tela: m.tela && podeAbrir(m.tela) ? m.tela : "metas" })} style={{ background: C.bg, border: `1px solid ${C.border}`, borderLeft: `4px solid ${COR_SINAL[m.sinal] || C.border}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, color: C.muted }}>{m.area_nome}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ fontSize: 22, fontWeight: 800, color: COR_SINAL[m.sinal] || C.text }}>{fmtValor(m.valor, m.unidade)}</span>
                    {m.tendencia && m.tendencia.dif !== 0 && <span style={{ fontSize: 11.5, color: m.tendencia.melhorou ? "#4ade80" : "#f87171" }}>{m.tendencia.dif > 0 ? "▲" : "▼"}</span>}</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>{m.nome}</div>
                </div>))}
            </div>
          </div>)}
      {kpis.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 10, marginBottom: 12 }}>
        {kpis.map(([k, ic, rot, tela]) => { const v = d.kpis[k]; const ruim = ["equipamentos_bloqueados", "documentos_vencidos", "acoes_nc_atrasadas", "tarefas_atrasadas"].includes(k) && v > 0; return (
          <div key={k} onClick={() => ir({ tela })} style={{ ...card, padding: "12px 14px", cursor: "pointer" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: ruim ? "#f87171" : C.text }}>{v}</div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{ic} {rot}</div>
          </div>); })}
      </div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: C.textSub, marginBottom: 4 }}>🎯 PRIORIDADES</div>
          {prior.length === 0 ? <div style={{ fontSize: 13, color: C.muted, padding: "10px 0" }}>✅ Nada pendente para você agora.</div>
            : <>{(todasP ? prior : prior.slice(0, 7)).map((p, i) => linha(p, i))}
              {prior.length > 7 && <button type="button" onClick={() => setTodasP(!todasP)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12.5, marginTop: 6 }}>{todasP ? "mostrar só as 7 principais" : `+${prior.length - 7} outras`}</button>}</>}
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: C.textSub, marginBottom: 4 }}>📅 HOJE</div>
          {agenda.length === 0 ? <div style={{ fontSize: 13, color: C.muted, padding: "10px 0" }}>Sem compromissos na agenda de hoje.</div>
            : agenda.map((a, i) => linha({ ...a, titulo: `${a.hora ? a.hora + " · " : ""}${a.titulo}` }, i))}
        </div>
        {d.gestor && d.equipe && podeAbrir("plano") && <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: C.textSub, marginBottom: 6 }}>👥 EQUIPE</div>
          <div onClick={() => setVerEquipe(!verEquipe)} style={{ cursor: "pointer" }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: d.equipe.atrasadas ? "#f87171" : C.text }}>{d.equipe.atrasadas}</span>
            <span style={{ fontSize: 12.5, color: C.muted }}> tarefa(s) atrasada(s) de {d.equipe.abertas} aberta(s) · {verEquipe ? "▾" : "▸"} por pessoa</span>
          </div>
          {verEquipe && (d.equipe.pessoas.length ? d.equipe.pessoas.map((p, i) => linha({ icone: "👤", titulo: p.nome, detalhe: `${p.atrasadas} atrasada(s)`, link: { tela: "plano" } }, i)) : <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6 }}>Ninguém com tarefa atrasada. 👏</div>)}
        </div>}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 10, textAlign: "right" }}>{erro ? `⚠ ${erro} · ` : ""}atualizado às {em?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · atualiza sozinho a cada 5 min (com a tela aberta) · <button type="button" onClick={() => { ultimo.current = Date.now(); carregar(); }} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, padding: 0 }}>↻ atualizar agora</button></div>
    </div>
  );
}
