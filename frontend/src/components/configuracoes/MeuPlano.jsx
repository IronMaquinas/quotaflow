// components/configuracoes/MeuPlano.jsx — etapa 18j: ⭐ Meu plano
//   O que a empresa tem (✓) e o que pode contratar (🔒 → Fale conosco), por área: Comercial · Suprimentos · Operações ·
//   Qualidade · Pessoas · Inteligência e IA. Vitrine para contratar módulos depois — quem liga é o Console da Plataforma.
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

export default function MeuPlano({ C, s }) {
  const [d, setD] = useState(null); const [erro, setErro] = useState(null);
  const [ass, setAss] = useState(null); // 18w: assinatura e planos (só admin/gestor — para os outros a API diz não e a seção não aparece)
  useEffect(() => { apiService.get("/configuracoes/modulos").then(setD).catch((e) => setErro(e.message)); }, []);
  const carregarAss = () => apiService.get("/configuracoes/assinatura").then(setAss).catch(() => setAss(null));
  useEffect(() => { carregarAss(); }, []);
  if (erro) return <div style={{ padding: 24, color: C.danger }}>{erro}</div>;
  if (!d) return <div style={{ padding: 24, color: C.muted }}>Carregando…</div>;
  const contatar = (m) => {
    const assunto = encodeURIComponent(`Quero conhecer o módulo ${m ? m.nome : "QuotaFlow"}`);
    if (d.contato) window.location.href = `mailto:${d.contato}?subject=${assunto}`;
  };
  const ativosN = d.areas.reduce((n, a) => n + a.modulos.filter((m) => m.ativo).length, 0);
  return <div style={{ padding: "22px 24px", maxWidth: 980 }}>
    <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>MEU PLANO</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>⭐ {d.plano_nome}</div>
      <div style={{ fontSize: 13, color: C.textSub }}>{ativosN} módulo(s) ativo(s)</div>
    </div>
    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 18, maxWidth: 720 }}>O QuotaFlow é montado por módulos: você usa só o que precisa e liga outros quando quiser. Os marcados com 🔒 estão disponíveis para contratar.
      {d.contato ? <> Fale com a gente em <a href={`mailto:${d.contato}`} style={{ color: C.accent }}>{d.contato}</a>.</> : " Fale com o seu consultor QuotaFlow."}</div>
    {ass && <Assinatura C={C} s={s} d={ass} contato={d.contato} onPedido={carregarAss} />}{/* 18w */}
    <div style={{ fontSize: 15, fontWeight: 700, margin: "18px 0 10px" }}>🧩 Módulos do seu plano</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 12 }}>
      {d.areas.map((a) => { const n = a.modulos.filter((m) => m.ativo).length;
        return <div key={a.id} style={{ ...s.card, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 8 }}><b style={{ fontSize: 15, flex: 1 }}>{a.nome}</b><span style={{ fontSize: 12, color: n ? (C.success || "#22c55e") : C.muted }}>{n ? `${n}/${a.modulos.length} ativo(s)` : "não contratado"}</span></div>
          {a.modulos.map((m) => <div key={m.id} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: `1px solid ${C.border}`, opacity: m.ativo ? 1 : 0.8 }}>
            <span style={{ width: 20, flex: "0 0 20px", textAlign: "center", fontSize: 13, color: m.ativo ? (C.success || "#22c55e") : C.muted }}>{m.ativo ? "✓" : "🔒"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: m.ativo ? C.text : C.textSub }}>{m.nome}{m.futuro && <span style={{ marginLeft: 6, fontSize: 10.5, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 8, padding: "0 6px" }}>em breve</span>}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>{m.desc}</div>
            </div>
            {!m.ativo && d.contato && <button type="button" onClick={() => contatar(m)} style={{ background: "none", border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 6, padding: "3px 9px", fontSize: 11.5, cursor: "pointer", alignSelf: "center", whiteSpace: "nowrap" }}>Fale conosco</button>}
          </div>)}
        </div>; })}
    </div>
  </div>;
}

// ─── 18w: 💳 Minha assinatura + planos disponíveis ("Quero este") ─────────────────
const SIMB = { BRL: "R$", USD: "US$", EUR: "€", DKK: "kr" };
const din = (v, m = "BRL") => (v == null ? "—" : `${SIMB[m] || m} ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const dt = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const SITUACAO = { teste: "🧪 Em teste", ativa: "✅ Ativa", inadimplente: "⚠️ Pagamento pendente", suspensa: "⏸ Suspensa", cancelada: "✖ Cancelada" };
const METRICA = { usuario: "por usuário", equipamento: "por veículo/equipamento", uso: "por uso" };
const MOD_CURTO = { mensal: "Mensal", anual_mensal: "Anual (pago por mês)", anual_prepago: "Anual pré-pago" };
const precoNa = (p, m) => (m === "anual_prepago" ? p.preco_anual : m === "anual_mensal" ? p.preco_anual_mensal ?? p.preco_mensal : p.preco_mensal);

function Assinatura({ C, s, d, contato, onPedido }) {
  const [mod, setMod] = useState("mensal"); const [conf, setConf] = useState(null); const [obs, setObs] = useState(""); const [env, setEnv] = useState(false); const [msg, setMsg] = useState(null);
  const a = d.assinatura; const pend = d.pedido_pendente;
  const temAnualMensal = d.planos.some((p) => p.preco_anual_mensal != null); const temPrepago = d.planos.some((p) => p.preco_anual != null);
  const pedir = async () => { setEnv(true); setMsg(null); try { await apiService.post("/configuracoes/assinatura/pedido", conf.personalizado ? { personalizado: true, obs } : { plano_id: conf.id, modalidade: mod, obs }); setConf(null); setObs(""); setMsg("✅ Pedido enviado! A equipe QuotaFlow confirma e você recebe um e-mail."); onPedido?.(); } catch (e) { setMsg(`⚠ ${e.message}`); } finally { setEnv(false); } };
  const linha = (rot, val) => <div style={{ minWidth: 140 }}><div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.05em" }}>{rot}</div><div style={{ fontSize: 14, fontWeight: 600 }}>{val}</div></div>;
  return <>
    <div style={{ ...s.card, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}><b style={{ fontSize: 15 }}>💳 Minha assinatura</b><span style={{ fontSize: 13 }}>{SITUACAO[d.situacao] || d.situacao}</span>
        {d.situacao === "teste" && d.teste_ate && <span style={{ fontSize: 12.5, color: d.somente_leitura ? C.danger : C.textSub }}>{d.somente_leitura ? `terminou em ${dt(d.teste_ate)} — sistema só para consulta` : `até ${dt(d.teste_ate)} (faltam ${d.dias_teste} dia(s))`}</span>}</div>
      {a ? <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
        {linha("PLANO", a.plano_nome || "—")}{linha("MODALIDADE", MOD_CURTO[a.modalidade] || a.modalidade)}
        {linha(a.modalidade === "anual_prepago" ? "VALOR (ANO)" : "VALOR (MÊS)", <>{din(a.valor_liquido ?? a.valor, a.moeda)}{a.desconto_pct ? <span style={{ fontSize: 11.5, color: C.success || "#22c55e" }}> · {a.desconto_pct}% off</span> : null}</>)}
        {linha("PRÓXIMA COBRANÇA", dt(a.proxima_cobranca))}{linha("COMPROMISSO ATÉ", a.modalidade === "mensal" ? "sem fidelidade" : dt(a.fim_compromisso))}
      </div> : <div style={{ fontSize: 13, color: C.textSub }}>{d.situacao === "teste" ? "Você está no teste grátis com todos os módulos. Escolha um plano abaixo para continuar depois do teste." : "Plano combinado com a equipe QuotaFlow."}</div>}
      {pend && <div style={{ marginTop: 10, fontSize: 13, color: C.warning || "#f59e0b" }}>⏳ Pedido em análise: <b>{pend.plano_nome}</b> · {MOD_CURTO[pend.modalidade] || pend.modalidade} · {pend.valor != null ? din(pend.valor, pend.moeda) : "a combinar"} — pedido por {pend.pedido_por || "—"} em {dt(pend.em)}.</div>}
      {msg && <div style={{ marginTop: 8, fontSize: 13 }}>{msg}</div>}
    </div>
    {d.planos.length > 0 && <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}><b style={{ fontSize: 15, flex: 1 }}>📦 Planos disponíveis</b>
        <div role="group" aria-label="Modalidade" style={{ display: "flex", gap: 4, background: C.surface || C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3 }}>
          {[["mensal", true], ["anual_mensal", temAnualMensal], ["anual_prepago", temPrepago]].filter((x) => x[1]).map(([k]) => <button key={k} type="button" aria-pressed={mod === k} onClick={() => setMod(k)}
            style={{ border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: mod === k ? C.accent : "transparent", color: mod === k ? "#fff" : C.textSub, fontFamily: "inherit" }}>{MOD_CURTO[k]}</button>)}
        </div></div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{mod === "mensal" ? "Cobrança todo mês, cancela quando quiser." : mod === "anual_mensal" ? "Compromisso de 12 meses com preço menor, cobrado todo mês." : "Paga o ano de uma vez, com o maior desconto. Renova em 12 meses."}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}>
        {d.planos.map((p) => { const v = precoNa(p, mod); const atual = p.atual && a?.modalidade === mod;
          return <div key={p.id} style={{ ...s.card, padding: 16, display: "flex", flexDirection: "column", borderColor: p.atual ? C.accent : C.border }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><b style={{ fontSize: 16, flex: 1 }}>{p.nome}</b>{p.atual && <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>SEU PLANO</span>}</div>
            {p.descricao && <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{p.descricao}</div>}
            <div style={{ fontSize: 22, fontWeight: 800, margin: "10px 0 2px" }}>{v != null ? din(v, p.moeda) : "—"}<span style={{ fontSize: 12, fontWeight: 500, color: C.muted }}>{v != null ? (mod === "anual_prepago" ? "/ano" : "/mês") : " nesta modalidade"}</span></div>
            {p.metrica !== "empresa" && p.preco_unidade != null && <div style={{ fontSize: 12, color: C.textSub }}>+ {din(p.preco_unidade, p.moeda)} {METRICA[p.metrica]}{p.franquia ? ` (acima de ${p.franquia} incluídos)` : ""}</div>}
            <div style={{ fontSize: 11.5, color: C.muted, margin: "8px 0 12px", flex: 1 }}>{p.modulos.slice(0, 8).map((m) => `✓ ${m}`).join("  ·  ")}{p.modulos.length > 8 ? `  · +${p.modulos.length - 8}` : ""}</div>
            <button type="button" disabled={v == null || atual} onClick={() => setConf({ ...p, valor: v })} style={{ ...s.btn(true), opacity: v == null || atual ? 0.5 : 1, cursor: v == null || atual ? "default" : "pointer" }}>{atual ? "Plano atual" : p.atual ? "Mudar modalidade" : a ? "Mudar para este" : "Quero este"}</button>
          </div>; })}
        <div style={{ ...s.card, padding: 16, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 8, borderStyle: "dashed" }}>
          <b style={{ fontSize: 15 }}>🤝 Plano personalizado</b><div style={{ fontSize: 12.5, color: C.textSub }}>Precisa de outra combinação de módulos, volume grande ou cobrança por uso? A gente monta com você.</div>
          <button type="button" onClick={() => setConf({ personalizado: true, nome: "Plano personalizado" })} style={{ ...s.btn(false), padding: "8px 14px" }}>Fale conosco</button>
          {contato && <a href={`mailto:${contato}`} style={{ fontSize: 12, color: C.accent }}>{contato}</a>}
        </div>
      </div></div>}
    {conf && <div onClick={() => !env && setConf(null)} style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Confirmar pedido" style={{ ...s.card, width: 440, maxWidth: "100%", padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{conf.personalizado ? "🤝 Plano personalizado" : `${a ? "Mudar para" : "Contratar"} ${conf.nome}`}</div>
        {!conf.personalizado && <div style={{ fontSize: 13.5, marginBottom: 6 }}>{MOD_CURTO[mod]} · <b>{din(conf.valor, conf.moeda)}{mod === "anual_prepago" ? "/ano" : "/mês"}</b></div>}
        <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 10, lineHeight: 1.5 }}>A equipe QuotaFlow confirma o pedido e você recebe um e-mail. {conf.personalizado ? "Conte o que precisa:" : "Os módulos do plano entram no menu assim que confirmado."}{a && !conf.personalizado ? " Ajustes de valor no meio do mês combinamos com você." : ""}</div>
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder={conf.personalizado ? "ex.: 40 veículos, módulos de transporte e fiscal…" : "Observação (opcional)"} style={{ ...s.input, width: "100%", resize: "vertical", fontFamily: "inherit", marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" disabled={env} onClick={() => setConf(null)} style={{ ...s.btn(false), padding: "8px 16px" }}>Cancelar</button>
          <button type="button" disabled={env || (conf.personalizado && !obs.trim())} onClick={pedir} style={{ ...s.btn(true), padding: "8px 16px" }}>{env ? "Enviando…" : "Enviar pedido"}</button></div>
      </div></div>}
  </>;
}
