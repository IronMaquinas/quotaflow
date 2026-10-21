// components/naoConformidades/TelaAutuacoes.jsx — etapa 12i
// ⚠️ Não Conformidades → aba "🏛 Autuações" (requisito legal da EMPRESA): INEA, IBAMA, ANTT, vigilância sanitária,
// Receita, MTE, bombeiros, prefeitura… Prazo de defesa (o crítico), recurso e vencimento → calendário, e-mail do gestor
// e tarefa no ✅ Plano. Liga à licença/documento da empresa e abre uma NC de causa raiz (5 porquês e plano de ação lá).
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";

const ST_COR = { recebida: "#f59e0b", defesa_apresentada: "#3b82f6", em_recurso: "#a855f7", paga: "#22c55e", cancelada: "#64748b" };
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const brl = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const lerArquivo = (file) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => falha(new Error("Não foi possível ler o arquivo")); r.readAsDataURL(file); });
const prazoTxt = (p) => (!p ? null : p.dias < 0 ? `${p.nome}: venceu há ${-p.dias} d` : p.dias === 0 ? `${p.nome}: HOJE` : `${p.nome}: ${dataBR(p.data)} (${p.dias} d)`);
const prazoCor = (p) => (!p ? "#64748b" : p.dias < 0 ? "#ef4444" : p.dias <= 5 ? "#f59e0b" : "#3b82f6");

export default function TelaAutuacoes({ C, s, onAbrirNC }) {
  const [d, setD] = useState(null);
  const [aviso, setAviso] = useState(null); // { tipo, texto }
  const [semMigration, setSemMigration] = useState(false);
  const [filtro, setFiltro] = useState("abertas");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(null);
  const [ver, setVer] = useState(null);
  const [acao, setAcao] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const ok = (t) => setAviso({ tipo: "ok", texto: t });
  const err = (t) => setAviso({ tipo: "erro", texto: t });

  const carregar = async () => {
    try { const r = await apiService.get("/autuacoes"); setD(r); setSemMigration(false); if (ver) setVer(r.autuacoes.find((a) => a.id === ver.id) || null); }
    catch (e) { if (/039/.test(e.message || "")) setSemMigration(true); else err(e.message); }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 6000); return () => clearTimeout(t); }, [aviso]);

  const lista0 = d?.autuacoes || [];
  const editar = !!d?.pode_editar;
  const resumo = useMemo(() => ({
    abertas: lista0.filter((a) => a.aberta).length,
    defesa: lista0.filter((a) => a.prazo && a.prazo.tipo !== "vencimento" && a.prazo.dias <= 5).length,
    vencendo: lista0.filter((a) => a.prazo?.tipo === "vencimento" && a.prazo.dias <= 5).length,
    pago: lista0.filter((a) => a.status === "paga" && String(a.finalizada_em || "").slice(0, 4) === hoje().slice(0, 4)).reduce((t, a) => t + Number(a.valor_pago || 0), 0),
  }), [lista0]);
  const b = semAcento(busca.trim());
  const lista = lista0.filter((a) => (filtro === "todas" || (filtro === "abertas" ? a.aberta : !a.aberta)) && (!b || semAcento(`${a.orgao} ${a.auto_numero} ${a.descricao} ${a.documento_nome}`).includes(b)));

  // ─── UI helpers (a tela de NC não tem modal/campo próprios) ───
  const modal = (conteudo, fechar, largura = 640) => (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 20, overflowY: "auto" }} onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: largura, maxWidth: "100%", padding: "20px 22px", margin: "auto 0", boxShadow: "0 24px 48px #00000060" }}>{conteudo}</div>
    </div>
  );
  const campo = (rot, el, flex) => <label style={{ display: "block", flex: flex || "1 1 100%", minWidth: 0 }}><span style={s.label}>{rot}</span>{el}</label>;

  const nova = () => setForm({ orgao: "", esfera: "", auto_numero: "", data_autuacao: "", recebida_em: hoje(), descricao: "", base_legal: "", local: "", valor: "", prazo_defesa: "", prazo_recurso: "", vencimento: "", documento_id: "", equipamento_id: "", veiculo: "", responsavel_id: "", obs: "", arquivo: null });
  const editarAut = (a) => setForm({ id: a.id, orgao: a.orgao, esfera: a.esfera, auto_numero: a.auto_numero || "", data_autuacao: a.data_autuacao || "", recebida_em: a.recebida_em || "", descricao: a.descricao || "", base_legal: a.base_legal || "", local: a.local || "", valor: a.valor ?? "",
    prazo_defesa: a.prazo_defesa || "", prazo_recurso: a.prazo_recurso || "", vencimento: a.vencimento || "", documento_id: a.documento_id || "", equipamento_id: a.equipamento_id || "", veiculo: a.equipamento_id ? "" : a.veiculo || "", responsavel_id: a.responsavel_id || "", obs: a.obs || "", arquivo: null });
  const salvar = async () => {
    setSalvando(true);
    try {
      const f = form;
      const corpo = { orgao: f.orgao, esfera: f.esfera, auto_numero: f.auto_numero, data_autuacao: f.data_autuacao, recebida_em: f.recebida_em, descricao: f.descricao, base_legal: f.base_legal, local: f.local, valor: f.valor,
        prazo_defesa: f.prazo_defesa || null, prazo_recurso: f.prazo_recurso || null, vencimento: f.vencimento || null, documento_id: f.documento_id || null, equipamento_id: f.equipamento_id || null, veiculo: f.equipamento_id ? null : f.veiculo, responsavel_id: f.responsavel_id || null, obs: f.obs };
      if (f.arquivo) { if (f.arquivo.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10 MB"); corpo.arquivo_base64 = await lerArquivo(f.arquivo); corpo.arquivo_mime = f.arquivo.type; corpo.arquivo_nome = f.arquivo.name; }
      if (f.id) await apiService.put(`/autuacoes/${f.id}`, corpo); else await apiService.post("/autuacoes", corpo);
      setForm(null); ok(f.id ? "Autuação atualizada." : `Autuação cadastrada${f.responsavel_id ? " — tarefa criada no ✅ Plano" : ""}.`); await carregar();
    } catch (e) { err(e.message); }
    finally { setSalvando(false); }
  };
  const salvarAcao = async () => {
    setSalvando(true);
    try {
      const a = acao;
      const corpo = { status: a.status, obs: a.obs, finalizada_em: a.finalizada_em };
      if (a.status === "defesa_apresentada" || a.status === "em_recurso") corpo.prazo_recurso = a.prazo_recurso || null;
      if (a.status === "paga") corpo.valor_pago = a.valor_pago;
      if (a.status === "cancelada") corpo.motivo_cancelamento = a.motivo_cancelamento;
      if (a.arquivo) { if (a.arquivo.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10 MB"); corpo.defesa_base64 = await lerArquivo(a.arquivo); corpo.defesa_mime = a.arquivo.type; corpo.defesa_nome = a.arquivo.name; }
      await apiService.post(`/autuacoes/${a.aut.id}/status`, corpo);
      setAcao(null); ok(`Autuação: ${d.status[a.status]}.`); await carregar();
    } catch (e) { err(e.message); }
    finally { setSalvando(false); }
  };
  const abrirNC = async (a) => {
    setSalvando(true);
    try {
      const r = await apiService.post("/nao-conformidades", { origem: "inspecao", data_ocorrencia: a.data_autuacao,
        descricao_problema: `Autuação ${a.orgao}${a.auto_numero ? ` nº ${a.auto_numero}` : ""} (${a.esfera_nome}) de ${dataBR(a.data_autuacao)}: ${a.descricao}${a.base_legal ? ` — base legal: ${a.base_legal}` : ""}${a.documento_nome ? ` — documento: ${a.documento_nome}` : ""}. Requisito legal: tratar causa raiz e ação corretiva.` });
      const nc = r?.nc;
      if (!nc?.id) throw new Error("A NC não foi criada");
      await apiService.put(`/autuacoes/${a.id}`, { nc_id: nc.id, nc_numero: nc.numero_nc || null });
      ok(`NC ${nc.numero_nc || ""} aberta e ligada à autuação.`); await carregar();
      if (onAbrirNC) { setVer(null); onAbrirNC(nc.id); }
    } catch (e) { err(e.message); }
    finally { setSalvando(false); }
  };
  const verArquivo = async (a, qual) => { try { const r = await apiService.get(`/autuacoes/${a.id}/arquivo?qual=${qual}`); if (r?.url) window.open(r.url, "_blank", "noopener"); } catch (e) { err(e.message); } };

  if (semMigration) return <div style={{ ...s.card, padding: 24, color: C.textSub }}>Rode a migration <b>039_autuacoes.sql</b> no Supabase para usar as autuações.</div>;
  if (!d) return <div style={{ color: C.muted }}>Carregando…</div>;
  const proximos = (a) => ({ recebida: ["defesa_apresentada", "paga", "cancelada"], defesa_apresentada: ["em_recurso", "paga", "cancelada"], em_recurso: ["paga", "cancelada"] }[a.status] || []);
  const btnSt = (k) => ({ defesa_apresentada: "📝 Defesa apresentada", em_recurso: "⚖ Em recurso", paga: "💳 Paga", cancelada: "✖ Cancelada / anulada" }[k]);

  return (
    <>
      {aviso && <div style={{ ...s.card, padding: "10px 14px", marginBottom: 12, fontSize: 13, borderColor: aviso.tipo === "erro" ? "#ef4444" : "#22c55e", color: aviso.tipo === "erro" ? "#ef4444" : "#22c55e" }}>{aviso.texto}</div>}
      {editar && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}><button onClick={nova} style={{ ...s.btn(true), padding: "9px 20px", fontSize: 12, cursor: "pointer" }}>＋ Nova autuação</button></div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {[["Autuações abertas", resumo.abertas, C.accent], ["Defesa / recurso (≤ 5 d / vencido)", resumo.defesa, "#ef4444"], ["Vencendo (≤ 5 d / vencida)", resumo.vencendo, "#f59e0b"], [`Pago em ${hoje().slice(0, 4)}`, brl(resumo.pago), "#14b8a6"]].map(([l, n, cor]) => (
          <div key={l} style={{ ...s.card, padding: "10px 16px" }}><div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{n}</div><div style={{ fontSize: 11, color: C.textSub }}>{l}</div></div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {[["abertas", "Abertas"], ["finalizadas", "Finalizadas"], ["todas", "Todas"]].map(([k, l]) => <button key={k} onClick={() => setFiltro(k)} style={{ ...s.btn(filtro === k), cursor: "pointer", padding: "6px 14px", fontSize: 12, ...(filtro !== k ? { color: C.text } : {}) }}>{l}</button>)}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Órgão, auto, infração, licença…" style={{ ...s.input, maxWidth: 280, padding: "7px 10px", fontSize: 12 }} />
      </div>
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>Autuações da <b style={{ color: C.text }}>empresa</b> (multas de trânsito e medidas de pessoas ficam em 👷 Pessoas). O prazo mais crítico é o da <b style={{ color: C.text }}>defesa</b>. Prazos no 📅 calendário e no e-mail diário do gestor; quem monitora recebe tarefa no ✅ Plano. "Abrir NC de causa raiz" cria a NC para o tratamento (5 porquês, plano de ação).</div>
      {lista.length === 0 ? <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.textSub }}>{lista0.length ? "Nada neste filtro." : "Nenhuma autuação cadastrada."}</div> : (
        <div style={{ ...s.card, overflow: "hidden" }}>
          {lista.map((a, i) => (
            <div key={a.id} onClick={() => setVer(a)} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", borderBottom: i < lista.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", opacity: a.status === "cancelada" ? 0.55 : 1 }}>
              <div style={{ flex: "0 0 80px", fontSize: 12, fontWeight: 600 }}>{dataBR(a.data_autuacao)}</div>
              <div style={{ flex: "2 1 260px" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>🏛 {a.orgao}{a.auto_numero ? ` · auto ${a.auto_numero}` : ""}<span style={{ color: C.muted, fontWeight: 400 }}> · {a.esfera_nome}</span></div>
                <div style={{ fontSize: 12, color: C.textSub }}>{a.descricao.length > 100 ? `${a.descricao.slice(0, 100)}…` : a.descricao}{a.documento_nome ? ` · 📄 ${a.documento_nome}` : ""}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{brl(a.valor)}</div>
              {a.nc_numero && <span style={s.tag("#a855f7")}>NC {a.nc_numero}</span>}
              {a.prazo && <span style={s.tag(prazoCor(a.prazo))}>⏳ {prazoTxt(a.prazo)}</span>}
              <span style={s.tag(ST_COR[a.status])}>{a.status_nome}</span>
            </div>
          ))}
        </div>
      )}

      {ver && !acao && !form && !confirmar && modal(<>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>🏛 {ver.orgao}{ver.auto_numero ? ` — auto ${ver.auto_numero}` : ""}</div>
          <span style={s.tag(ST_COR[ver.status])}>{ver.status_nome}</span>
        </div>
        {ver.prazo && <div style={{ ...s.tag(prazoCor(ver.prazo)), display: "inline-block", marginTop: 8, fontSize: 12 }}>⏳ {prazoTxt(ver.prazo)}</div>}
        <div style={{ fontSize: 13, marginTop: 10, whiteSpace: "pre-wrap" }}>{ver.descricao}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px 14px", fontSize: 12, marginTop: 12 }}>
          {[["Esfera", ver.esfera_nome], ["Base legal", ver.base_legal], ["Local / unidade", ver.local], ["Data da autuação", dataBR(ver.data_autuacao)], ["Recebida em", dataBR(ver.recebida_em)], ["Valor", brl(ver.valor)],
            ["Prazo de defesa", dataBR(ver.prazo_defesa)], ["Prazo de recurso", dataBR(ver.prazo_recurso)], ["Vencimento", dataBR(ver.vencimento)], ["Licença / documento", ver.documento_nome], ["Veículo", ver.veiculo],
            ["Monitora", ver.responsavel_nome ? `${ver.responsavel_nome}${ver.tarefa_id ? " (✅ tarefa no Plano)" : ""}` : null], ["NC de causa raiz", ver.nc_numero || (ver.nc_id ? "ligada" : null)],
            ...(ver.status === "paga" ? [["Pago", `${brl(ver.valor_pago)} em ${dataBR(ver.finalizada_em)}`]] : []), ...(ver.status === "cancelada" ? [["Motivo", ver.motivo_cancelamento]] : []),
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
              {proximos(ver).map((k) => <button key={k} onClick={() => setAcao({ aut: ver, status: k, obs: "", prazo_recurso: ver.prazo_recurso || "", valor_pago: ver.valor ?? "", motivo_cancelamento: "", finalizada_em: hoje(), arquivo: null })} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px", fontSize: 12, color: ST_COR[k], borderColor: ST_COR[k] }}>{btnSt(k)}</button>)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {ver.tem_arquivo && <button onClick={() => verArquivo(ver, "auto")} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>📎 Auto</button>}
          {ver.tem_defesa && <button onClick={() => verArquivo(ver, "defesa")} style={{ ...s.btn(false), cursor: "pointer", color: C.accent }}>📎 Defesa</button>}
          {ver.nc_id && onAbrirNC && <button onClick={() => { setVer(null); onAbrirNC(ver.nc_id); }} style={{ ...s.btn(false), cursor: "pointer", color: "#a855f7" }}>⚠️ Ver NC {ver.nc_numero || ""}</button>}
          {editar && !ver.nc_id && <button disabled={salvando} onClick={() => abrirNC(ver)} style={{ ...s.btn(false), cursor: "pointer", color: "#a855f7" }}>⚠️ Abrir NC de causa raiz</button>}
          {editar && ver.aberta && <button onClick={() => editarAut(ver)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Editar</button>}
          {editar && ver.status === "recebida" && <button onClick={() => setConfirmar({ titulo: "Excluir autuação", texto: "Excluir este cadastro? Use só para cadastro errado — para auto anulado/defesa deferida, use “Cancelada”.", acao: async () => { await apiService.delete(`/autuacoes/${ver.id}`); setVer(null); return "Autuação excluída."; } })} style={{ ...s.btn(false), cursor: "pointer", color: C.danger || "#ef4444" }}>Excluir</button>}
          <div style={{ flex: 1 }} />
          <button onClick={() => setVer(null)} style={{ ...s.btn(true), cursor: "pointer", minWidth: 120 }}>Fechar</button>
        </div>
      </>, () => setVer(null), 700)}

      {acao && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{btnSt(acao.status)}</div>
        <div style={{ fontSize: 12, color: C.textSub, margin: "4px 0 14px" }}>{acao.aut.orgao}{acao.aut.auto_numero ? ` · auto ${acao.aut.auto_numero}` : ""} · {brl(acao.aut.valor)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(acao.status === "defesa_apresentada" || acao.status === "em_recurso") && (<>
            {campo("PRAZO DE RECURSO / RESPOSTA (SE HOUVER)", <input type="date" value={acao.prazo_recurso} onChange={(e) => setAcao({ ...acao, prazo_recurso: e.target.value })} style={{ ...s.input, maxWidth: 200 }} />)}
            {campo(acao.status === "em_recurso" ? "RECURSO (PDF OU FOTO, OPCIONAL)" : "DEFESA PROTOCOLADA (PDF OU FOTO, OPCIONAL)", <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setAcao({ ...acao, arquivo: e.target.files?.[0] || null })} style={{ ...s.input, padding: 7 }} />)}
          </>)}
          {acao.status === "paga" && <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("VALOR PAGO (R$)", <input type="number" step="0.01" min={0} value={acao.valor_pago} onChange={(e) => setAcao({ ...acao, valor_pago: e.target.value })} style={s.input} />, "1 1 150px")}
            {campo("PAGO EM", <input type="date" value={acao.finalizada_em} max={hoje()} onChange={(e) => setAcao({ ...acao, finalizada_em: e.target.value })} style={s.input} />, "1 1 150px")}
          </div>}
          {acao.status === "cancelada" && campo("MOTIVO", <input value={acao.motivo_cancelamento} onChange={(e) => setAcao({ ...acao, motivo_cancelamento: e.target.value })} placeholder="Defesa deferida, auto anulado, convertida em advertência…" style={s.input} />)}
          {campo("OBSERVAÇÃO (VAI NO HISTÓRICO)", <input value={acao.obs} onChange={(e) => setAcao({ ...acao, obs: e.target.value })} placeholder={acao.status === "defesa_apresentada" ? "Protocolo nº… em…" : ""} style={s.input} />)}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => setAcao(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          {(() => { const okk = !salvando && (acao.status !== "cancelada" || acao.motivo_cancelamento.trim()); return <button disabled={!okk} onClick={salvarAcao} style={{ ...s.btn(!!okk, ST_COR[acao.status]), flex: 2 }}>{salvando ? "Salvando…" : "Confirmar"}</button>; })()}
        </div>
      </>, () => !salvando && setAcao(null), 600)}

      {form && modal(<>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>{form.id ? "Editar autuação" : "＋ Nova autuação da empresa"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("ÓRGÃO", <input value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} list="qf-orgaos-aut" placeholder="INEA, IBAMA, ANTT…" style={s.input} />, "2 1 200px")}
            <datalist id="qf-orgaos-aut">{d.orgaos.map((x) => <option key={x} value={x} />)}</datalist>
            {campo("ESFERA", <select value={form.esfera} onChange={(e) => setForm({ ...form, esfera: e.target.value })} style={s.input}><option value="">Escolha…</option>{d.esferas.map((x) => <option key={x.codigo} value={x.codigo}>{x.nome}</option>)}</select>, "1 1 180px")}
            {campo("Nº DO AUTO", <input value={form.auto_numero} onChange={(e) => setForm({ ...form, auto_numero: e.target.value })} style={s.input} />, "1 1 140px")}
          </div>
          {campo("INFRAÇÃO / FATO", <textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: armazenamento de óleo usado sem bacia de contenção na oficina" style={{ ...s.input, resize: "vertical" }} />)}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("BASE LEGAL", <input value={form.base_legal} onChange={(e) => setForm({ ...form, base_legal: e.target.value })} placeholder="Lei 9.605/98, Res. CONAMA 362…" style={s.input} />, "2 1 220px")}
            {campo("LOCAL / UNIDADE", <input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} style={s.input} />, "1 1 160px")}
            {campo("VALOR (R$)", <input type="number" step="0.01" min={0} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} style={s.input} />, "1 1 130px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("DATA DA AUTUAÇÃO", <input type="date" value={form.data_autuacao} max={hoje()} onChange={(e) => setForm({ ...form, data_autuacao: e.target.value })} style={s.input} />, "1 1 140px")}
            {campo("RECEBIDA EM", <input type="date" value={form.recebida_em} max={hoje()} onChange={(e) => setForm({ ...form, recebida_em: e.target.value })} style={s.input} />, "1 1 140px")}
            {campo("PRAZO DE DEFESA", <input type="date" value={form.prazo_defesa} onChange={(e) => setForm({ ...form, prazo_defesa: e.target.value })} style={s.input} />, "1 1 140px")}
            {campo("VENCIMENTO", <input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} style={s.input} />, "1 1 140px")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {campo("LICENÇA / DOCUMENTO DA EMPRESA (OPCIONAL)", <select value={form.documento_id} onChange={(e) => setForm({ ...form, documento_id: e.target.value })} style={s.input}>
              <option value="">Nenhum</option>{d.documentos.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.vence_em ? ` · vence ${dataBR(x.vence_em)}` : ""}</option>)}</select>, "2 1 240px")}
            {campo("VEÍCULO (OPCIONAL)", <select value={form.equipamento_id} onChange={(e) => setForm({ ...form, equipamento_id: e.target.value })} style={s.input}>
              <option value="">—</option>{d.equipamentos.map((e) => <option key={e.id} value={e.id}>{[e.tag, e.nome].filter(Boolean).join(" — ")}</option>)}</select>, "1 1 180px")}
          </div>
          {campo("QUEM MONITORA (CRIA TAREFA NO ✅ PLANO)", <select value={form.responsavel_id} onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })} style={s.input}>
            <option value="">Ninguém</option>{d.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>)}
          {campo("AUTO DE INFRAÇÃO (PDF OU FOTO, ATÉ 10 MB)", <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setForm({ ...form, arquivo: e.target.files?.[0] || null })} style={{ ...s.input, padding: 7 }} />)}
          {campo("OBSERVAÇÕES", <textarea rows={2} value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} style={{ ...s.input, resize: "vertical" }} />)}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => setForm(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          {(() => { const okk = !salvando && form.orgao.trim() && form.esfera && form.descricao.trim() && form.data_autuacao && form.recebida_em; return <button disabled={!okk} onClick={salvar} style={{ ...s.btn(!!okk), flex: 2 }}>{salvando ? "Salvando…" : "Salvar"}</button>; })()}
        </div>
      </>, () => !salvando && setForm(null), 720)}

      {confirmar && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>⚠ {confirmar.titulo}</div>
        <div style={{ fontSize: 13, color: C.textSub, marginTop: 10, lineHeight: 1.5 }}>{confirmar.texto}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={() => setConfirmar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          <button onClick={async () => { const c = confirmar; setConfirmar(null); try { ok(await c.acao()); await carregar(); } catch (e) { err(e.message); } }} style={{ ...s.btn(true, "#ef4444"), cursor: "pointer", flex: 1 }}>Confirmar</button>
        </div>
      </>, () => setConfirmar(null), 460)}
    </>
  );
}
