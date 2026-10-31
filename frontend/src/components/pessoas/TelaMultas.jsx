// components/pessoas/TelaMultas.jsx — etapa 12g
// Aba "🚦 Multas" de Pessoas. Cadastro do auto (veículo da frota ou placa, motorista, infração, gravidade → pontos e
// valor sugeridos, prazos), situação recebida → condutor indicado → em recurso → final: paga | descontada | cancelada.
// Descontada: valor e parcelas; "Aceite do colaborador requerido" (desmarcado por padrão) → o colaborador assina o termo
// na tela (fica guardado para cálculo trabalhista/rescisão). Quem monitora → tarefa automática no ✅ Plano.
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import AssinaturaTela from "../shared/AssinaturaTela";
import { abrirTermo, prepararJanela } from "../../utils/gerarTermoDesconto";
import { prepararArquivo } from "../../utils/comprimirImagem"; // 14c.1: foto comprimida antes de enviar

const ST_COR = { recebida: "#f59e0b", condutor_indicado: "#3b82f6", em_recurso: "#a855f7", paga: "#22c55e", descontada: "#14b8a6", cancelada: "#64748b" };
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const somaDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const brl = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const lerArquivo = (file) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => falha(new Error("Não foi possível ler o arquivo")); r.readAsDataURL(file); });
const prazoTxt = (p) => (!p ? null : p.dias < 0 ? `${p.nome}: venceu há ${-p.dias} d` : p.dias === 0 ? `${p.nome}: HOJE` : `${p.nome}: ${dataBR(p.data)} (${p.dias} d)`);
const prazoCor = (p) => (!p ? "#64748b" : p.dias < 0 ? "#ef4444" : p.dias <= 5 ? "#f59e0b" : "#3b82f6");

export default function TelaMultas({ C, s, modal, campo, colabs = [], onAviso, onErro }) {
  const [d, setD] = useState(null);
  const [semMigration, setSemMigration] = useState(false);
  const [filtro, setFiltro] = useState("abertas");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(null);
  const [ver, setVer] = useState(null);       // multa aberta no detalhe
  const [acao, setAcao] = useState(null);     // { status, ... } mudança de situação
  const [assinatura, setAssinatura] = useState(null);
  const [termo, setTermo] = useState("");
  const [confirmar, setConfirmar] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try { const r = await apiService.get("/pessoas/multas"); setD(r); setSemMigration(false); if (ver) setVer(r.multas.find((m) => m.id === ver.id) || null); }
    catch (e) { if (/036/.test(e.message || "")) setSemMigration(true); else onErro(e.message); }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  // 17b: 🚦 provável condutor — a programação diz quem estava com o veículo na data/hora da infração
  const [cond, setCond] = useState(null);
  useEffect(() => {
    if (!form || !form.data_infracao || !(form.equipamento_id || String(form.veiculo || "").trim())) { setCond(null); return undefined; }
    const tm = setTimeout(() => apiService.get("/pessoas/multas/condutor-provavel", { equipamento_id: form.equipamento_id || "", veiculo: form.equipamento_id ? "" : form.veiculo, data: form.data_infracao, hora: form.hora_infracao || "" })
      .then((r) => setCond(r.atas || [])).catch(() => setCond(null)), 350);
    return () => clearTimeout(tm);
  }, [form?.equipamento_id, form?.veiculo, form?.data_infracao, form?.hora_infracao]); // eslint-disable-line
  const vePrograma = (() => { try { const u = JSON.parse(localStorage.getItem("usuario") || "{}"); const p = Array.isArray(u.perfis) && u.perfis.length ? u.perfis : [u.perfil]; return p.some((x) => ["admin", "gestor", "operacao"].includes(x)); } catch { return false; } })();
  const dh = (v) => (v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");

  const multas = d?.multas || [];
  const editar = !!d?.pode_editar;
  const ativos = colabs.filter((c) => c.situacao !== "desligado");
  const resumo = useMemo(() => ({
    abertas: multas.filter((m) => m.aberta).length,
    indicar: multas.filter((m) => m.prazo?.tipo === "indicacao" && m.prazo.dias <= 5).length,
    vencendo: multas.filter((m) => m.prazo?.tipo === "vencimento" && m.prazo.dias <= 5).length,
    descontado: multas.filter((m) => m.status === "descontada" && String(m.finalizada_em || "").slice(0, 4) === hoje().slice(0, 4)).reduce((t, m) => t + Number(m.valor_descontado || 0), 0),
  }), [multas]);
  const b = semAcento(busca.trim());
  const lista = multas.filter((m) => (filtro === "todas" || (filtro === "abertas" ? m.aberta : !m.aberta))
    && (!b || semAcento(`${m.auto_numero} ${m.veiculo} ${m.colaborador_nome} ${m.infracao_descricao} ${m.infracao_codigo}`).includes(b)));

  const nova = () => setForm({ equipamento_id: "", veiculo: "", colaborador_id: "", data_infracao: "", hora_infracao: "", local: "", auto_numero: "", orgao: "", infracao_codigo: "", infracao_descricao: "",
    gravidade: "", pontos: "", valor: "", recebida_em: hoje(), prazo_indicacao: somaDias(hoje(), d?.prazo_indicacao_dias || 15), prazo_manual: false, vencimento: "", responsavel_id: "", obs: "", arquivo: null });
  const editarMulta = (m) => setForm({ id: m.id, equipamento_id: m.equipamento_id || "", veiculo: m.equipamento_id ? "" : m.veiculo || "", colaborador_id: m.colaborador_id || "", data_infracao: m.data_infracao || "", hora_infracao: m.hora_infracao || "",
    local: m.local || "", auto_numero: m.auto_numero || "", orgao: m.orgao || "", infracao_codigo: m.infracao_codigo || "", infracao_descricao: m.infracao_descricao || "", gravidade: m.gravidade || "", pontos: m.pontos ?? "", valor: m.valor ?? "",
    recebida_em: m.recebida_em || "", prazo_indicacao: m.prazo_indicacao || "", prazo_manual: true, vencimento: m.vencimento || "", responsavel_id: m.responsavel_id || "", obs: m.obs || "", arquivo: null });

  const salvar = async () => {
    setSalvando(true);
    try {
      const f = form;
      const corpo = { equipamento_id: f.equipamento_id || null, veiculo: f.equipamento_id ? null : f.veiculo, colaborador_id: f.colaborador_id || null, data_infracao: f.data_infracao, hora_infracao: f.hora_infracao,
        local: f.local, auto_numero: f.auto_numero, orgao: f.orgao, infracao_codigo: f.infracao_codigo, infracao_descricao: f.infracao_descricao, gravidade: f.gravidade || null, pontos: f.pontos, valor: f.valor,
        recebida_em: f.recebida_em, prazo_indicacao: f.prazo_indicacao, vencimento: f.vencimento || null, responsavel_id: f.responsavel_id || null, obs: f.obs };
      if (f.arquivo) {
        if (f.arquivo.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10 MB");
        corpo.arquivo_base64 = await lerArquivo(f.arquivo); corpo.arquivo_mime = f.arquivo.type; corpo.arquivo_nome = f.arquivo.name;
      }
      if (f.id) await apiService.put(`/pessoas/multas/${f.id}`, corpo); else await apiService.post("/pessoas/multas", corpo);
      setForm(null); onAviso(f.id ? "Multa atualizada." : `Multa cadastrada${f.responsavel_id ? " — tarefa criada no ✅ Plano para quem monitora" : ""}.`); await carregar();
    } catch (e) { onErro(e.message); }
    finally { setSalvando(false); }
  };

  const abrirAcao = async (m, status) => {
    setAssinatura(null); setTermo("");
    setAcao({ multa: m, status, obs: "", valor_pago: m.valor ?? "", valor_descontado: m.valor ?? "", parcelas: 1, aceite_requerido: !!m.aceite_requerido, motivo_cancelamento: "", finalizada_em: hoje() });
  };
  useEffect(() => { // prévia do termo (o mesmo texto que o backend grava)
    if (!acao || acao.status !== "descontada" || !acao.aceite_requerido) return;
    const t = setTimeout(async () => { try { setTermo((await apiService.get(`/pessoas/multas/${acao.multa.id}/previa-termo?valor=${Number(String(acao.valor_descontado).replace(",", ".")) || 0}&parcelas=${acao.parcelas || 1}`))?.termo || ""); } catch { /* ok */ } }, 300);
    return () => clearTimeout(t);
  }, [acao?.status, acao?.aceite_requerido, acao?.valor_descontado, acao?.parcelas]); // eslint-disable-line
  const salvarAcao = async () => {
    setSalvando(true);
    try {
      const a = acao;
      const corpo = { status: a.status, obs: a.obs, finalizada_em: a.finalizada_em };
      if (a.status === "paga") corpo.valor_pago = a.valor_pago;
      if (a.status === "descontada") Object.assign(corpo, { valor_descontado: a.valor_descontado, parcelas: a.parcelas, aceite_requerido: a.aceite_requerido, aceite_png: a.aceite_requerido ? assinatura : undefined });
      if (a.status === "cancelada") corpo.motivo_cancelamento = a.motivo_cancelamento;
      await apiService.post(`/pessoas/multas/${a.multa.id}/status`, corpo);
      setAcao(null); setAssinatura(null); onAviso(`Multa: ${d.status[a.status]}.`); await carregar();
    } catch (e) { onErro(e.message); }
    finally { setSalvando(false); }
  };
  const verArquivo = async (m) => { try { const r = await apiService.get(`/pessoas/multas/${m.id}/arquivo`); if (r?.url) window.open(r.url, "_blank", "noopener"); } catch (e) { onErro(e.message); } };
  const imprimirTermo = async (m) => {
    const j = prepararJanela();
    try { abrirTermo(await apiService.get(`/pessoas/multas/${m.id}/termo`), j); } catch (e) { try { j?.close(); } catch { /* ok */ } onErro(e.message); }
  };

  if (semMigration) return <div style={{ ...s.card, padding: 24, color: C.textSub }}>Rode a migration <b>036_multas.sql</b> no Supabase para usar as multas.</div>;
  if (!d) return <div style={{ color: C.muted }}>Carregando…</div>;

  const proximos = (m) => ({ recebida: ["condutor_indicado", "em_recurso", "paga", "descontada", "cancelada"], condutor_indicado: ["em_recurso", "paga", "descontada", "cancelada"], em_recurso: ["paga", "descontada", "cancelada"] }[m.status] || []);
  const btnSt = (k) => ({ condutor_indicado: "👤 Condutor indicado", em_recurso: "⚖ Em recurso", paga: "💳 Paga", descontada: "📉 Descontada", cancelada: "✖ Cancelada" }[k]);

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {[["Multas abertas", resumo.abertas, C.accent], ["Indicar condutor (≤ 5 d / vencido)", resumo.indicar, "#ef4444"], ["Vencendo (≤ 5 d / vencida)", resumo.vencendo, "#f59e0b"], [`Descontado em ${hoje().slice(0, 4)}`, brl(resumo.descontado), "#14b8a6"]].map(([l, n, cor]) => (
          <div key={l} style={{ ...s.card, padding: "10px 16px" }}><div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{n}</div><div style={{ fontSize: 11, color: C.textSub }}>{l}</div></div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {[["abertas", "Abertas"], ["finalizadas", "Finalizadas"], ["todas", "Todas"]].map(([k, l]) => <button key={k} onClick={() => setFiltro(k)} style={{ ...s.btn(filtro === k), cursor: "pointer", padding: "6px 14px", fontSize: 12, ...(filtro !== k ? { color: C.text } : {}) }}>{l}</button>)}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Auto, placa, motorista, infração…" style={{ ...s.input, maxWidth: 280, padding: "7px 10px", fontSize: 12 }} />
        <div style={{ flex: 1 }} />
        {editar && <button onClick={nova} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Nova multa</button>}
      </div>
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>O prazo mais crítico é a <b style={{ color: C.text }}>indicação do condutor</b> (padrão: {d.prazo_indicacao_dias} dias do recebimento) — perdido, a empresa paga multa maior. Prazos no 📅 calendário e no e-mail diário do gestor; quem monitora recebe uma tarefa no ✅ Plano.</div>
      {lista.length === 0 ? <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.textSub }}>{multas.length ? "Nada neste filtro." : "Nenhuma multa cadastrada."}</div> : (
        <div style={{ ...s.card, overflow: "hidden" }}>
          {lista.map((m, i) => (
            <div key={m.id} onClick={() => setVer(m)} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", borderBottom: i < lista.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", opacity: m.status === "cancelada" ? 0.55 : 1 }}>
              <div style={{ flex: "0 0 80px", fontSize: 12, fontWeight: 600 }}>{dataBR(m.data_infracao)}</div>
              <div style={{ flex: "2 1 240px" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.infracao_descricao || m.infracao_codigo || "Infração"}{m.gravidade ? <span style={{ color: C.muted, fontWeight: 400 }}> · {d.gravidades.find((g) => g.codigo === m.gravidade)?.nome}{m.pontos != null ? ` · ${m.pontos} pts` : ""}</span> : ""}</div>
                <div style={{ fontSize: 12, color: C.textSub }}>🚛 {m.veiculo || "—"} · 👤 {m.colaborador_nome || <span style={{ color: "#f59e0b" }}>sem motorista</span>}{m.auto_numero ? ` · auto ${m.auto_numero}` : ""}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{brl(m.valor)}</div>
              {m.prazo && <span style={s.tag(prazoCor(m.prazo))}>⏳ {prazoTxt(m.prazo)}</span>}
              <span style={s.tag(ST_COR[m.status])}>{m.status_nome}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── detalhe ─── */}
      {ver && !acao && !form && modal(<>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>🚦 Multa {ver.auto_numero ? `— auto ${ver.auto_numero}` : ""}</div>
          <span style={s.tag(ST_COR[ver.status])}>{ver.status_nome}</span>
        </div>
        {ver.prazo && <div style={{ ...s.tag(prazoCor(ver.prazo)), display: "inline-block", marginTop: 8, fontSize: 12 }}>⏳ {prazoTxt(ver.prazo)}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px 14px", fontSize: 12, marginTop: 12 }}>
          {[["Veículo", ver.veiculo], ["Motorista", ver.colaborador_nome], ["Data / hora", `${dataBR(ver.data_infracao)}${ver.hora_infracao ? ` ${ver.hora_infracao}` : ""}`], ["Local", ver.local], ["Órgão", ver.orgao],
            ["Infração", [ver.infracao_codigo, ver.infracao_descricao].filter(Boolean).join(" — ")], ["Gravidade / pontos", [d.gravidades.find((g) => g.codigo === ver.gravidade)?.nome, ver.pontos != null ? `${ver.pontos} pts` : null].filter(Boolean).join(" · ")],
            ["Valor", brl(ver.valor)], ["Recebida em", dataBR(ver.recebida_em)], ["Prazo de indicação", dataBR(ver.prazo_indicacao)], ["Vencimento", dataBR(ver.vencimento)], ["Monitora", ver.responsavel_nome ? `${ver.responsavel_nome}${ver.tarefa_id ? " (✅ tarefa no Plano)" : ""}` : null],
            ...(ver.status === "paga" ? [["Pago", `${brl(ver.valor_pago)} em ${dataBR(ver.finalizada_em)}`]] : []),
            ...(ver.status === "descontada" ? [["Descontado", `${brl(ver.valor_descontado)}${ver.parcelas_desconto > 1 ? ` em ${ver.parcelas_desconto}x` : ""} em ${dataBR(ver.finalizada_em)}`], ["Aceite do colaborador", ver.tem_aceite ? `✍ assinado em ${new Date(ver.aceite_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : "não exigido"]] : []),
            ...(ver.status === "cancelada" ? [["Motivo do cancelamento", ver.motivo_cancelamento]] : []),
          ].map(([l, v]) => <div key={l}><div style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>{l.toUpperCase()}</div>{v || "—"}</div>)}
        </div>
        {ver.obs && <div style={{ fontSize: 12, color: C.textSub, marginTop: 10, whiteSpace: "pre-wrap" }}>{ver.obs}</div>}
        {(ver.historico || []).length > 0 && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 4 }}>HISTÓRICO</div>
            {ver.historico.map((h, k) => <div key={k} style={{ fontSize: 11, color: C.textSub }}>{new Date(h.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {d.status[h.status] || h.status}{h.por ? ` · ${h.por}` : ""}{h.obs ? ` · “${h.obs}”` : ""}</div>)}
          </div>
        )}
        {editar && ver.aberta && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 6 }}>MUDAR A SITUAÇÃO</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {proximos(ver).map((k) => <button key={k} onClick={() => abrirAcao(ver, k)} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px", fontSize: 12, color: ST_COR[k], borderColor: ST_COR[k] }}>{btnSt(k)}</button>)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {ver.tem_arquivo && <button onClick={() => verArquivo(ver)} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>📎 Notificação</button>}
          {ver.tem_aceite && <button onClick={() => imprimirTermo(ver)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>🖨 Termo de desconto assinado</button>}
          {editar && ver.aberta && <button onClick={() => editarMulta(ver)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Editar</button>}
          {editar && ver.status === "recebida" && <button onClick={() => setConfirmar({ titulo: "Excluir multa", texto: "Excluir este cadastro? Use só para cadastro errado — para multa anulada/recurso deferido, use “Cancelada”.", acao: async () => { await apiService.delete(`/pessoas/multas/${ver.id}`); setVer(null); return "Multa excluída."; } })} style={{ ...s.btn(false), cursor: "pointer", color: C.danger }}>Excluir</button>}
          <div style={{ flex: 1 }} />
          <button onClick={() => setVer(null)} style={{ ...s.btn(true), cursor: "pointer", minWidth: 120 }}>Fechar</button>
        </div>
      </>, () => setVer(null), 680)}

      {/* ─── mudança de situação ─── */}
      {acao && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{btnSt(acao.status)}</div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 14px" }}>{acao.multa.infracao_descricao || "Multa"} · {acao.multa.veiculo} · {acao.multa.colaborador_nome || "sem motorista"} · {brl(acao.multa.valor)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {acao.status === "paga" && <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("VALOR PAGO (R$)", <input type="number" step="0.01" min={0} value={acao.valor_pago} onChange={(e) => setAcao({ ...acao, valor_pago: e.target.value })} style={s.input} />, "1 1 150px")}
            {campo("PAGO EM", <input type="date" value={acao.finalizada_em} max={hoje()} onChange={(e) => setAcao({ ...acao, finalizada_em: e.target.value })} style={s.input} />, "1 1 150px")}
          </div>}
          {acao.status === "descontada" && (<>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {campo("VALOR DESCONTADO (R$)", <input type="number" step="0.01" min={0} value={acao.valor_descontado} onChange={(e) => setAcao({ ...acao, valor_descontado: e.target.value })} style={s.input} />, "1 1 150px")}
              {campo("PARCELAS", <input type="number" min={1} max={24} value={acao.parcelas} onChange={(e) => setAcao({ ...acao, parcelas: e.target.value })} style={s.input} />, "0 1 100px")}
              {campo("DATA", <input type="date" value={acao.finalizada_em} max={hoje()} onChange={(e) => setAcao({ ...acao, finalizada_em: e.target.value })} style={s.input} />, "1 1 150px")}
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={acao.aceite_requerido} onChange={(e) => { setAcao({ ...acao, aceite_requerido: e.target.checked }); setAssinatura(null); }} />
              Aceite do colaborador requerido <span style={{ fontSize: 11, color: C.textSub }}>— ele assina o termo de desconto na tela</span>
            </label>
            {acao.aceite_requerido && (<>
              <div style={{ fontSize: 12, padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, lineHeight: 1.5, textAlign: "justify" }}>{termo || "Montando o termo…"}</div>
              <AssinaturaTela C={C} s={s} onChange={setAssinatura} />
            </>)}
          </>)}
          {acao.status === "cancelada" && campo("MOTIVO", <input value={acao.motivo_cancelamento} onChange={(e) => setAcao({ ...acao, motivo_cancelamento: e.target.value })} placeholder="Recurso deferido, auto anulado, duplicidade…" style={s.input} />)}
          {campo("OBSERVAÇÃO (VAI NO HISTÓRICO)", <input value={acao.obs} onChange={(e) => setAcao({ ...acao, obs: e.target.value })} placeholder={acao.status === "condutor_indicado" ? "Indicado pelo site do DETRAN em…" : acao.status === "em_recurso" ? "Recurso protocolado nº…" : ""} style={s.input} />)}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => { setAcao(null); setAssinatura(null); }} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          {(() => { const ok = !salvando && (acao.status !== "descontada" || !acao.aceite_requerido || assinatura) && (acao.status !== "cancelada" || acao.motivo_cancelamento.trim()); return <button disabled={!ok} onClick={salvarAcao} style={{ ...s.btn(!!ok, ST_COR[acao.status]), flex: 2 }}>{salvando ? "Salvando…" : "Confirmar"}</button>; })()}
        </div>
      </>, () => !salvando && setAcao(null), 620)}

      {/* ─── cadastro ─── */}
      {form && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>{form.id ? "Editar multa" : "＋ Nova multa"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("VEÍCULO DA FROTA", <select value={form.equipamento_id} onChange={(e) => setForm({ ...form, equipamento_id: e.target.value })} style={s.input}>
              <option value="">— outro (digitar a placa) —</option>{d.equipamentos.map((e) => <option key={e.id} value={e.id}>{[e.tag, e.nome].filter(Boolean).join(" — ")}</option>)}</select>, "2 1 220px")}
            {!form.equipamento_id && campo("PLACA / VEÍCULO", <input value={form.veiculo} onChange={(e) => setForm({ ...form, veiculo: e.target.value.toUpperCase() })} placeholder="ABC1D23" style={s.input} />, "1 1 140px")}
          </div>
          {campo("MOTORISTA RESPONSÁVEL", <select value={form.colaborador_id} onChange={(e) => setForm({ ...form, colaborador_id: e.target.value })} style={s.input}>
            <option value="">A definir</option>{ativos.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.funcao_nome || c.funcao ? ` · ${c.funcao_nome || c.funcao}` : ""}</option>)}</select>)}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("DATA DA INFRAÇÃO", <input type="date" value={form.data_infracao} max={hoje()} onChange={(e) => setForm({ ...form, data_infracao: e.target.value })} style={s.input} />, "1 1 150px")}
            {campo("HORA", <input type="time" value={form.hora_infracao} onChange={(e) => setForm({ ...form, hora_infracao: e.target.value })} style={s.input} />, "0 1 110px")}
            {campo("LOCAL", <input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="BR-116 km 230, Guarulhos" style={s.input} />, "2 1 200px")}
          </div>
          {cond && <div style={{ ...s.card, padding: "10px 12px", marginBottom: 12, borderColor: cond.length ? C.accent : C.border, background: cond.length ? `${C.accent}10` : "transparent" }}>
            {!cond.length ? <div style={{ fontSize: 12.5, color: C.muted }}>🚛 Nenhuma AT com este veículo em operação {form.hora_infracao ? "nesta data e hora" : "neste dia"} (🚛 Programação).</div> : <>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>🚛 {cond.length > 1 ? `${cond.length} viagens com este veículo ${form.hora_infracao ? "neste horário" : "neste dia"}` : "Provável motorista em operação"}</div>
              {cond.map((a) => <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, padding: "4px 0", borderTop: `1px solid ${C.border}` }}>
                <div style={{ flex: "1 1 280px" }}><b>{a.motorista_nome || "motorista a definir"}</b> — {a.numero}{a.ref ? ` · ${a.ref}` : ""}<div style={{ color: C.textSub }}>{a.origem || "—"} ➜ {a.destino || "—"} · {dh(a.de)} → {dh(a.ate)} <span style={{ color: a.base === "real" ? C.success : C.warn }}>({a.base === "real" ? "horário real da viagem" : "horário previsto"})</span></div></div>
                {a.motorista_id && String(form.colaborador_id) !== String(a.motorista_id) && <button type="button" onClick={() => setForm({ ...form, colaborador_id: a.motorista_id })} style={{ ...s.btn(true), padding: "5px 10px", fontSize: 12 }}>Usar como motorista</button>}
                {a.motorista_id && String(form.colaborador_id) === String(a.motorista_id) && <span style={{ color: C.success, fontSize: 12 }}>✓ é o motorista responsável</span>}
                {vePrograma && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("qf-abrir-at", { detail: a.id }))} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>abrir {a.numero} ↗</button>}
              </div>)}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Sugestão pela programação — confira antes de indicar o condutor ao órgão.</div></>}
          </div>}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("Nº DO AUTO", <input value={form.auto_numero} onChange={(e) => setForm({ ...form, auto_numero: e.target.value.toUpperCase() })} style={s.input} />, "1 1 140px")}
            {campo("ÓRGÃO AUTUADOR", <input value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} placeholder="PRF, DETRAN-SP, DER…" list="qf-orgaos" style={s.input} />, "1 1 160px")}
            <datalist id="qf-orgaos">{["PRF", "DETRAN-SP", "DER-SP", "ARTESP", "DNIT", "CET-SP", "Prefeitura"].map((x) => <option key={x} value={x} />)}</datalist>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("CÓDIGO (CTB)", <input value={form.infracao_codigo} onChange={(e) => setForm({ ...form, infracao_codigo: e.target.value })} placeholder="745-50" style={s.input} />, "0 1 110px")}
            {campo("INFRAÇÃO", <input value={form.infracao_descricao} onChange={(e) => setForm({ ...form, infracao_descricao: e.target.value })} placeholder="Transitar em velocidade superior à máxima em até 20%" style={s.input} />, "3 1 260px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("GRAVIDADE", <select value={form.gravidade} onChange={(e) => { const g = d.gravidades.find((x) => x.codigo === e.target.value); setForm({ ...form, gravidade: e.target.value, pontos: g ? g.pontos : form.pontos, valor: g && !form.valor ? g.valor : form.valor }); }} style={s.input}>
              <option value="">—</option>{d.gravidades.map((g) => <option key={g.codigo} value={g.codigo}>{g.nome} ({g.pontos} pts · {brl(g.valor)})</option>)}</select>, "1 1 200px")}
            {campo("PONTOS", <input type="number" min={0} max={40} value={form.pontos} onChange={(e) => setForm({ ...form, pontos: e.target.value })} style={s.input} />, "0 1 90px")}
            {campo("VALOR (R$)", <input type="number" step="0.01" min={0} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} style={s.input} />, "1 1 130px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("RECEBIDA EM", <input type="date" value={form.recebida_em} max={hoje()} onChange={(e) => setForm({ ...form, recebida_em: e.target.value, prazo_indicacao: form.prazo_manual || !e.target.value ? form.prazo_indicacao : somaDias(e.target.value, d.prazo_indicacao_dias) })} style={s.input} />, "1 1 140px")}
            {campo("PRAZO P/ INDICAR CONDUTOR", <input type="date" value={form.prazo_indicacao} onChange={(e) => setForm({ ...form, prazo_indicacao: e.target.value, prazo_manual: true })} style={s.input} />, "1 1 160px")}
            {campo("VENCIMENTO", <input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} style={s.input} />, "1 1 140px")}
          </div>
          {campo("QUEM MONITORA (CRIA TAREFA NO ✅ PLANO)", <select value={form.responsavel_id} onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })} style={s.input}>
            <option value="">Ninguém</option>{d.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>)}
          {campo("NOTIFICAÇÃO (PDF OU FOTO, ATÉ 10 MB)", <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={async (e) => { const arq = await prepararArquivo(e.target.files?.[0]); setForm((v0) => ({ ...v0, arquivo: arq })); }} style={{ ...s.input, padding: 7 }} />)}
          {campo("OBSERVAÇÕES", <textarea rows={2} value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} style={{ ...s.input, resize: "vertical" }} />)}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => setForm(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          {(() => { const ok = !salvando && form.data_infracao && form.recebida_em && (form.equipamento_id || form.veiculo.trim()); return <button disabled={!ok} onClick={salvar} style={{ ...s.btn(!!ok), flex: 2 }}>{salvando ? "Salvando…" : "Salvar"}</button>; })()}
        </div>
      </>, () => !salvando && setForm(null), 680)}

      {confirmar && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.danger }}>⚠ {confirmar.titulo}</div>
        <div style={{ fontSize: 13, color: C.textSub, marginTop: 10, lineHeight: 1.5 }}>{confirmar.texto}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={() => setConfirmar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          <button onClick={async () => { const c = confirmar; setConfirmar(null); try { onAviso(await c.acao()); await carregar(); } catch (e) { onErro(e.message); } }} style={{ ...s.btn(true, C.danger), cursor: "pointer", flex: 1 }}>Confirmar</button>
        </div>
      </>, () => setConfirmar(null), 460)}
    </>
  );
}
