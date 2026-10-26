// frontend/src/components/compliance/TelaMonitorCnpj.jsx — etapa 14e
// 🛡 Monitor de CNPJs (admin, gestor, comprador):
//   • Sua base — fornecedores locais e clientes, com a situação na Receita (ciclos dia 01 e 15).
//   • Fornecedores da plataforma — só os irregulares que estão num processo seu (cotação aberta / OC em andamento).
//   • Justificativas registradas — OC e nota liberadas com CNPJ irregular (quem, quando, situação, motivo).
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

const fmt = (d) => (String(d || "").length === 14 ? String(d).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d || "—");
const dt = (d, h) => (d ? new Date(d).toLocaleString("pt-BR", h ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }) : "—");
const diaBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");

export default function TelaMonitorCnpj({ C, s }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState(null);
  const [aba, setAba] = useState("base");
  const [filtro, setFiltro] = useState("irregulares");
  const [verificando, setVerificando] = useState(null);

  const carregar = () => apiService.get("/monitor-cnpj").then((r) => { setD(r); setErro(null); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  async function verificar(doc) {
    setVerificando(doc);
    try { await apiService.post(`/monitor-cnpj/verificar/${doc}`, {}); await carregar(); } catch (e) { setErro(e.message); } finally { setVerificando(null); }
  }

  const tag = (b) => b.situacao == null
    ? <span style={s.tag(C.muted)}>AINDA NÃO VERIFICADO</span>
    : b.irregular ? <span style={s.tag(C.danger)}>⚠ {b.situacao}</span> : <span style={s.tag(C.success)}>✓ {b.situacao}</span>;
  if (erro && !d) return <div style={{ padding: 24, color: C.danger }}>⚠ {erro}</div>;
  if (!d) return <div style={{ padding: 24, color: C.muted }}>Carregando…</div>;

  const irrBase = d.base.filter((b) => b.irregular);
  const lista = filtro === "irregulares" ? irrBase : d.base;
  const pct = d.ciclo.total ? Math.round((d.ciclo.verificados / d.ciclo.total) * 100) : 100;
  const abas = [["base", `Sua base (${d.base.length})`], ["plataforma", `Fornecedores da plataforma em processos seus (${d.globais.length})`], ["justificativas", `Justificativas (${d.liberacoes.length})`]];

  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>🛡 Monitor de CNPJs</div>
      <div style={{ fontSize: 12, color: C.muted, margin: "4px 0 16px", lineHeight: 1.6, maxWidth: 820 }}>
        Situação cadastral na Receita Federal, verificada nos ciclos de <b>dia 01 e 15</b> e na hora de enviar cotação, emitir OC ou lançar nota.
        CNPJ irregular <b>não recebe cotação</b>; OC e nota só seguem com <b>justificativa registrada</b>.
      </div>
      {erro && <div style={{ color: C.danger, fontSize: 12, marginBottom: 10 }}>⚠ {erro}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 18 }}>
        {[["Ciclo atual", `${diaBR(d.ciclo.inicio)}`, `${d.ciclo.verificados} de ${d.ciclo.total} verificados (${pct}%)`, C.text],
          ["Sua base irregular", irrBase.length, irrBase.length ? "veja a lista" : "nenhum", irrBase.length ? C.danger : C.success],
          ["Plataforma em processos seus", d.globais.length, d.globais.length ? "atenção antes de pagar" : "nenhum", d.globais.length ? C.danger : C.success],
          ["Justificativas", d.liberacoes.length, "OC / nota liberadas", C.text]].map(([t, v, sub, cor]) => (
          <div key={t} style={{ ...s.card, padding: "12px 14px" }}><div style={{ fontSize: 11, color: C.muted }}>{t}</div><div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{v}</div><div style={{ fontSize: 11, color: C.muted }}>{sub}</div></div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 14, flexWrap: "wrap" }}>
        {abas.map(([id, l]) => <button key={id} onClick={() => setAba(id)} style={{ background: "transparent", border: "none", borderBottom: aba === id ? `2px solid ${C.accent}` : "2px solid transparent", color: aba === id ? C.text : C.muted, fontWeight: aba === id ? 600 : 400, padding: "8px 14px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, marginBottom: -1 }}>{l}</button>)}
      </div>

      {aba === "base" && <>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[["irregulares", `Só irregulares (${irrBase.length})`], ["todos", `Todos (${d.base.length})`]].map(([id, l]) => <button key={id} onClick={() => setFiltro(id)} style={{ ...s.btn(filtro === id), padding: "6px 12px", fontSize: 12 }}>{l}</button>)}
        </div>
        {lista.length === 0 && <div style={{ ...s.card, padding: 18, color: C.muted, fontSize: 13 }}>{filtro === "irregulares" ? "✓ Nenhum CNPJ da sua base com situação irregular." : "Nenhum fornecedor local ou cliente com CNPJ."}</div>}
        {lista.map((b) => (
          <div key={`${b.tipo}${b.id}`} style={{ ...s.card, padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px" }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{b.nome} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>· {b.tipo === "cliente" ? "cliente" : "fornecedor local"}</span></div>
              <div style={{ fontSize: 11, color: C.muted }}>CNPJ {fmt(b.documento)} · verificado {dt(b.verificado_em, true)}{b.mudou_em && b.situacao_anterior ? ` · era ${b.situacao_anterior} até ${dt(b.mudou_em)}` : ""}</div>
            </div>
            {tag(b)}
            <button type="button" disabled={verificando === b.documento} onClick={() => verificar(b.documento)} style={{ ...s.btn(false), padding: "5px 10px", fontSize: 11 }}>{verificando === b.documento ? "Consultando…" : "↻ Verificar agora"}</button>
          </div>
        ))}
      </>}

      {aba === "plataforma" && <>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Fornecedores da plataforma QuotaFlow aparecem aqui só quando estão com CNPJ irregular <b>e</b> têm cotação aberta ou OC em andamento com você.</div>
        {d.globais.length === 0 && <div style={{ ...s.card, padding: 18, color: C.muted, fontSize: 13 }}>✓ Nenhum fornecedor da plataforma com CNPJ irregular nos seus processos.</div>}
        {d.globais.map((g) => (
          <div key={g.id} style={{ ...s.card, padding: "12px 14px", marginBottom: 8, borderColor: `${C.danger}66` }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{g.nome} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>· CNPJ {fmt(g.documento)}</span></div>{tag(g)}
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>{g.processos.map((p) => `${p.tipo === "oc" ? "OC" : "Cotação"} ${p.numero}`).join(" · ")}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Novas cotações para ele estão bloqueadas. OC e nota pedem justificativa. Antes de pagar, confira a certidão.</div>
          </div>
        ))}
      </>}

      {aba === "justificativas" && <>
        {d.liberacoes.length === 0 && <div style={{ ...s.card, padding: 18, color: C.muted, fontSize: 13 }}>Nenhuma OC ou nota liberada com CNPJ irregular.</div>}
        {d.liberacoes.map((l) => (
          <div key={l.id} style={{ ...s.card, padding: "10px 14px", marginBottom: 6, fontSize: 12 }}>
            <div><b>{l.fornecedor_nome || fmt(l.documento)}</b> · {l.contexto === "nota" ? "lançamento da nota" : "emissão de OC"} ({l.referencia}) · situação <b style={{ color: C.danger }}>{l.situacao}</b></div>
            <div style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}>“{l.justificativa}”</div>
            <div style={{ fontSize: 11, color: C.muted }}>{dt(l.criado_em, true)} · {l.usuario_nome || "—"}</div>
          </div>
        ))}
      </>}
    </div>
  );
}
