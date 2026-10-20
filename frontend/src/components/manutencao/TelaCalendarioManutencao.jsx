// components/manutencao/TelaCalendarioManutencao.jsx — etapa 12a
// Calendário anual de manutenção ("folhinha"): visões Ano / Mês / Semana,
// clique no dia lista as OS e abre "Nova OS programada" com a data.
// Rodapé: planejado × comprometido × realizado do período visível e o
// "% de custo conhecido". Só leitura — dados de GET /api/manutencao/calendario.
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import TelaPlanosManutencao from "./TelaPlanosManutencao"; // etapa 12b
import ModalTransferirOS from "./ModalTransferirOS"; // etapa 12b.3

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const SEMANA = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

const SITUACAO = {
  atrasada:    { l: "Atrasada",    c: "#ef4444", peso: 4 },
  em_execucao: { l: "Em execução", c: "#f59e0b", peso: 3 },
  programada:  { l: "Programada",  c: "#3b82f6", peso: 2 },
  concluida:   { l: "Concluída",   c: "#22c55e", peso: 1 },
  documento:   { l: "Documento vence", c: "#14b8a6", peso: 0.5 }, // 12c: camada Documentos
  epi:         { l: "EPI (troca / CA)", c: "#f97316", peso: 0.4 }, // 12d.3: camada 🦺 EPI
  treino:      { l: "Treinamento", c: "#ec4899", peso: 0.45 }, // 12e.1: camada 🎓 Treinamentos
  prevista:    { l: "Prevista (sem OS)", c: "#a78bfa", peso: 0 }, // 12b.4: ocorrência de plano ainda sem OS (roxo do selo 🔁)
};
const CATEGORIA = { corretiva: "Corretiva", preventiva: "Preventiva", preditiva: "Preditiva" };

const pad = (n) => String(n).padStart(2, "0");
const chave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deChave = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const somaDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const inicioSemana = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return somaDias(x, -((x.getDay() + 6) % 7)); };
const brl = (v) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const hora = (iso) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

function intervalo(visao, ref) {
  if (visao === "ano") return [new Date(ref.getFullYear(), 0, 1), new Date(ref.getFullYear(), 11, 31)];
  if (visao === "mes") return [new Date(ref.getFullYear(), ref.getMonth(), 1), new Date(ref.getFullYear(), ref.getMonth() + 1, 0)];
  const ini = inicioSemana(ref);
  return [ini, somaDias(ini, 6)];
}

// Dias (chave local) que a OS ocupa, limitado a 60 dias para não travar a tela
function diasDaOS(os) {
  const ini = new Date(os.inicio); const fim = new Date(os.fim || os.inicio);
  const dias = []; let d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate());
  const ultimo = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  while (d <= ultimo && dias.length < 60) { dias.push(chave(d)); d = somaDias(d, 1); }
  return dias;
}

const DOC_SIT = { vencido: { l: "Vencido", c: "#ef4444" }, vence_30: { l: "Vence em até 30 dias", c: "#f59e0b" }, ok: { l: "Em dia", c: "#22c55e" } };

export default function TelaCalendarioManutencao({ C, s, equipamentos = [], onAbrirOS, onNovaOS, onAbrirPessoas }) {
  const [visao, setVisao] = useState("ano");
  const [ref, setRef] = useState(() => new Date());
  const [equipamentoId, setEquipamentoId] = useState("");
  const [categoria, setCategoria] = useState("");
  const [situacao, setSituacao] = useState("");
  const [responsavel, setResponsavel] = useState(""); // 12b.2: "" | "eu" | "sem" | id
  const [dados, setDados] = useState({ os: [] });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [diaSel, setDiaSel] = useState(null);
  const [verPlanos, setVerPlanos] = useState(false); // etapa 12b
  const [recarga, setRecarga] = useState(0);
  const [usuarios, setUsuarios] = useState([]);          // 12b.3
  const [podeTransferir, setPodeTransferir] = useState(false);
  const [podeEditarPlano, setPodeEditarPlano] = useState(false); // 12b.4
  const [gerandoPrev, setGerandoPrev] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  const [camadas, setCamadas] = useState({ manutencao: true, documentos: true, epi: true, treinamentos: true }); // 12c · 12d.3: + EPI · 12e.1: + treinamentos // 12b.6: { tipo: 'sem_modelo' | 'erro', msg, o } — modal do app em vez de window.confirm/alert
  const [osTransf, setOsTransf] = useState(null);
  const [aviso, setAviso] = useState("");

  const [ini, fim] = intervalo(visao, ref);
  const de = chave(ini), ate = chave(fim);
  const hoje = chave(new Date());

  useEffect(() => {
    let vivo = true;
    setCarregando(true); setErro("");
    const params = { de, ate };
    if (equipamentoId) params.equipamento_id = equipamentoId;
    apiService.get("/manutencao/calendario", params)
      .then((r) => { if (vivo) setDados(r || { os: [] }); })
      .catch((e) => { if (vivo) setErro(e.message || "Erro ao carregar"); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [de, ate, equipamentoId, recarga]);

  useEffect(() => {
    apiService.get("/manutencao/usuarios")
      .then((r) => { setUsuarios(r?.usuarios || []); setPodeTransferir(!!r?.pode_transferir); setPodeEditarPlano(!!r?.pode_editar); })
      .catch(() => {});
  }, []);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 4000); return () => clearTimeout(t); }, [aviso]);

  // 12b.4: previstas viram itens "prevista" na mesma lista (id próprio; nunca entram no planejado das OS)
  const previstas = useMemo(() => (dados.previstas || []).map((p) => ({
    id: `prev-${p.plano_id}-${p.data}`, prevista: true, plano_id: p.plano_id, data_nominal: p.data, movida_por: p.movida_por,
    numero: "Prevista", descricao: p.plano_nome, situacao: "prevista", categoria: p.categoria,
    equipamento: p.equipamento, responsavel_id: p.responsavel_id, responsavel: p.responsavel, tem_modelo: p.tem_modelo,
    inicio: p.inicio, fim: p.fim, custo_previsto: p.custo,
  })), [dados]);

  // 12c: documentos viram itens "documento" no dia do vencimento (camada própria)
  const documentos = useMemo(() => (dados.documentos || []).map((d) => ({
    id: `doc-${d.id}`, documento: true, doc: d, numero: "Documento", descricao: `${d.tipo_nome} — ${d.alvo_nome}`, situacao: "documento",
    responsavel_id: d.responsavel_id, responsavel: d.responsavel, inicio: `${d.vence_em}T12:00:00-03:00`, fim: `${d.vence_em}T12:00:00-03:00`,
  })), [dados]);

  // 12d.3: trocas de EPI e validade de CA (camada própria; tratados como "documento" na contagem de OS)
  const epis = useMemo(() => (dados.epi || []).map((e) => ({
    id: `epi-${e.id}`, documento: true, epi: true, doc: e, numero: "EPI", descricao: `${e.titulo} — ${e.de}`, situacao: "epi",
    inicio: `${e.data}T12:00:00-03:00`, fim: `${e.data}T12:00:00-03:00`,
  })), [dados]);

  // 12e.1: turmas agendadas e vencimentos de treinamento (camada própria; fora da contagem de OS)
  const treinos = useMemo(() => (dados.treinamentos || []).map((e) => ({
    id: `tr-${e.id}`, documento: true, treino: true, doc: e, numero: "Treinamento", descricao: `${e.titulo} — ${e.de}`, situacao: "treino",
    inicio: `${e.data}T12:00:00-03:00`, fim: `${e.data}T12:00:00-03:00`,
  })), [dados]);

  const lista = useMemo(() => [
    ...(camadas.manutencao ? [...(dados.os || []), ...previstas] : []),
    ...(camadas.documentos ? documentos : []),
    ...(camadas.epi ? epis : []),
    ...(camadas.treinamentos ? treinos : []),
  ].filter((o) =>
    (!categoria || o.documento || o.categoria === categoria) && (!situacao || o.situacao === situacao) &&
    (!responsavel
      || (responsavel === "eu" && dados.eu && String(o.responsavel_id) === String(dados.eu))
      || (responsavel === "sem" && !o.responsavel_id)
      || String(o.responsavel_id) === responsavel)
  ), [dados, previstas, documentos, epis, treinos, camadas, categoria, situacao, responsavel]);
  const responsaveis = useMemo(() => {
    const m = new Map();
    for (const o of [...(dados.os || []), ...(dados.previstas || [])]) if (o.responsavel_id) m.set(String(o.responsavel_id), o.responsavel || "Usuário");
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [dados]);

  const porDia = useMemo(() => {
    const m = {};
    for (const o of lista) for (const k of diasDaOS(o)) (m[k] = m[k] || []).push(o);
    return m;
  }, [lista]);

  const totais = useMemo(() => {
    const t = { planejado: 0, comprometido: 0, realizado: 0, horas: 0, itens: 0, comValor: 0, previsto: 0, nPrevistas: 0, nDocs: 0, nDocsVencidos: 0, nEpi: 0, nEpiVencidos: 0, nTr: 0, nTrVencidos: 0 };
    for (const o of lista) {
      if (o.treino) { t.nTr++; if (o.doc.situacao === "vencido") t.nTrVencidos++; continue; }
      if (o.epi) { t.nEpi++; if (o.doc.situacao === "vencido") t.nEpiVencidos++; continue; }
      if (o.documento) { t.nDocs++; if (o.doc.situacao === "vencido") t.nDocsVencidos++; continue; }
      if (o.prevista) { t.previsto += o.custo_previsto?.total || 0; t.nPrevistas++; continue; }
      t.planejado += o.custo.planejado; t.comprometido += o.custo.comprometido; t.realizado += o.custo.realizado;
      t.horas += o.custo.horas; t.itens += o.custo.itens; t.comValor += o.custo.itens_com_valor;
    }
    t.falta = Math.max(t.planejado - t.realizado - t.comprometido, 0);
    t.pct = t.itens ? Math.round((t.comValor / t.itens) * 100) : 0;
    return t;
  }, [lista]);

  const corDoDia = (k) => {
    const os = porDia[k]; if (!os) return null;
    return os.reduce((a, o) => (SITUACAO[o.situacao].peso > SITUACAO[a].peso ? o.situacao : a), os[0].situacao);
  };

  const navegar = (n) => {
    const d = new Date(ref);
    if (visao === "ano") d.setFullYear(d.getFullYear() + n);
    else if (visao === "mes") d.setMonth(d.getMonth() + n, 1);
    else d.setDate(d.getDate() + 7 * n);
    setRef(d);
  };

  const titulo = visao === "ano" ? String(ref.getFullYear())
    : visao === "mes" ? `${MESES[ref.getMonth()]} ${ref.getFullYear()}`
    : `${ini.toLocaleDateString("pt-BR")} – ${fim.toLocaleDateString("pt-BR")}`;

  const botaoVisao = (v, l) => (
    <button key={v} onClick={() => setVisao(v)} style={{ ...s.btn(visao === v), padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>{l}</button>
  );
  const sel = { ...s.input, width: "auto", minWidth: 150, padding: "7px 10px", fontSize: 12 };

  // ─── grade de um mês (usada no Ano em miniatura e no Mês grande) ───
  function GradeMes({ ano, mes, mini }) {
    const primeiro = new Date(ano, mes, 1);
    const desloc = (primeiro.getDay() + 6) % 7;
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const celulas = [];
    for (let i = 0; i < desloc; i++) celulas.push(null);
    for (let d = 1; d <= totalDias; d++) celulas.push(new Date(ano, mes, d));
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: mini ? 2 : 4 }}>
        {SEMANA.map((d) => (
          <div key={d} style={{ fontSize: mini ? 9 : 11, color: C.muted, textAlign: "center", paddingBottom: 2 }}>{mini ? d[0] : d}</div>
        ))}
        {celulas.map((d, i) => {
          if (!d) return <div key={"v" + i} />;
          const k = chave(d); const cor = corDoDia(k); const qtd = porDia[k]?.length || 0;
          const qtdOS = (porDia[k] || []).filter((o) => !o.prevista && !o.documento).length;
          const qtdDoc = (porDia[k] || []).filter((o) => o.documento).length;
          const soPrevista = cor === "prevista";
          const soDoc = cor === "documento" || cor === "epi" || cor === "treino";
          const ehHoje = k === hoje;
          if (mini) return (
            <button key={k} onClick={() => setDiaSel(k)} title={qtd ? [qtdOS ? `${qtdOS} OS` : "", qtd - qtdOS - qtdDoc ? `${qtd - qtdOS - qtdDoc} prevista(s)` : "", qtdDoc ? `${qtdDoc} documento(s)` : ""].filter(Boolean).join(" + ") : ""}
              style={{ aspectRatio: "1", border: soPrevista ? `1.5px dashed ${SITUACAO.prevista.c}` : soDoc ? `1.5px solid ${SITUACAO[cor].c}` : ehHoje ? `1px solid ${C.text}` : "1px solid transparent", borderRadius: 4, fontSize: 10, cursor: "pointer", padding: 0, fontFamily: "inherit",
                background: soPrevista ? `${SITUACAO.prevista.c}33` : soDoc ? `${SITUACAO[cor].c}33` : cor ? SITUACAO[cor].c : "transparent",
                color: soPrevista ? "#ddd6fe" : soDoc ? (cor === "epi" ? "#fed7aa" : cor === "treino" ? "#fbcfe8" : "#99f6e4") : cor ? "#fff" : C.textSub, fontWeight: cor ? 700 : 400,
                boxShadow: (soPrevista || soDoc) && ehHoje ? `0 0 0 1px ${C.text}` : "none" }}>
              {d.getDate()}
            </button>
          );
          return (
            <div key={k} onClick={() => setDiaSel(k)}
              style={{ minHeight: 92, background: C.bg, border: `1px solid ${ehHoje ? C.accent : C.border}`, borderRadius: 6, padding: 6, cursor: "pointer", overflow: "hidden" }}>
              <div style={{ fontSize: 12, color: ehHoje ? C.accent : C.textSub, fontWeight: ehHoje ? 700 : 500, marginBottom: 4 }}>{d.getDate()}</div>
              {(porDia[k] || []).slice(0, 3).map((o) => (
                <div key={o.id} style={{ fontSize: 10, background: o.prevista ? `${SITUACAO.prevista.c}1f` : `${SITUACAO[o.situacao].c}22`, borderLeft: `3px ${o.prevista ? "dashed" : "solid"} ${SITUACAO[o.situacao].c}`, color: o.prevista ? "#ddd6fe" : C.text, borderRadius: 3, padding: "2px 5px", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {o.prevista ? "🔁 " : o.treino ? "🎓 " : o.epi ? "🦺 " : o.documento ? "📄 " : `${o.numero} `}{o.descricao}
                </div>
              ))}
              {qtd > 3 && <div style={{ fontSize: 10, color: C.muted }}>+{qtd - 3}</div>}
            </div>
          );
        })}
      </div>
    );
  }

  if (verPlanos) {
    return <TelaPlanosManutencao C={C} s={s} equipamentos={equipamentos} onVoltar={() => { setVerPlanos(false); setRecarga((n) => n + 1); }} />;
  }

  // 12b.4: gerar só esta ocorrência do plano (mesmo POST do "Gerar OS", com uma data)
  const gerarPrevista = async (o, semItens = false) => {
    setGerandoPrev(o.id);
    try {
      const r = await apiService.post(`/manutencao/planos/${o.plano_id}/gerar`, { datas: [o.data_nominal], sem_itens: semItens });
      setAviso(r?.criadas?.length ? `${r.criadas[0].numero} criada a partir do plano` : (r?.mensagem || "OS criada"));
      setRecarga((n) => n + 1);
    } catch (e) {
      const msg = e.message || "Erro ao gerar";
      setDialogo(!semItens && /modelo/i.test(msg) ? { tipo: "sem_modelo", msg, o } : { tipo: "erro", msg });
    } finally { setGerandoPrev(null); }
  };

  const cartaoDocumento = (o) => {
    const d = o.doc; const sit = DOC_SIT[d.situacao] || DOC_SIT.ok;
    return (
      <div key={o.id} style={{ ...s.card, padding: 12, marginBottom: 8, borderLeft: `3px solid ${SITUACAO.documento.c}`, background: `${SITUACAO.documento.c}10` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>📄 {d.tipo_nome}{d.numero ? <span style={{ color: C.muted, fontWeight: 400 }}> · nº {d.numero}</span> : ""}</div>
          <span style={s.tag(sit.c)}>{sit.l}</span>
        </div>
        <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
          {d.alvo_tipo === "colaborador" ? "👤" : d.alvo_tipo === "equipamento" ? "⚙" : "🏢"} {d.alvo_nome} · vence {d.vence_em.split("-").reverse().join("/")}
          {d.responsavel ? ` · resp.: ${d.responsavel}` : ""}
        </div>
        {onAbrirPessoas && (
          <button onClick={() => onAbrirPessoas()} style={{ ...s.btn(false), cursor: "pointer", color: C.accent, padding: "5px 12px", fontSize: 12, marginTop: 8 }}>Ver em Pessoas → Documentos</button>
        )}
      </div>
    );
  };

  // 12d.3: cartão da camada 🦺 EPI
  const cartaoEpi = (o) => {
    const e = o.doc; const cor = e.situacao === "vencido" ? "#ef4444" : e.situacao === "vence" ? "#f59e0b" : "#22c55e";
    return (
      <div key={o.id} style={{ ...s.card, padding: 12, marginBottom: 8, borderLeft: `3px solid ${SITUACAO.epi.c}`, background: `${SITUACAO.epi.c}10` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>🦺 {e.titulo}</div>
          <span style={s.tag(cor)}>{e.dias < 0 ? `venceu há ${-e.dias} d` : e.dias === 0 ? "hoje" : `em ${e.dias} d`}</span>
        </div>
        <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{e.tipo === "troca" ? "👤" : "📦"} {e.de} · {e.data.split("-").reverse().join("/")}</div>
        {onAbrirPessoas && (
          <button onClick={() => onAbrirPessoas("epi")} style={{ ...s.btn(false), cursor: "pointer", color: C.accent, padding: "5px 12px", fontSize: 12, marginTop: 8 }}>Ver em Pessoas → 🦺 EPI</button>
        )}
      </div>
    );
  };

  // 12e.1: cartão da camada 🎓 Treinamentos
  const cartaoTreino = (o) => {
    const e = o.doc; const cor = e.tipo === "turma" ? SITUACAO.treino.c : e.situacao === "vencido" ? "#ef4444" : e.situacao === "vence" ? "#f59e0b" : "#22c55e";
    return (
      <div key={o.id} style={{ ...s.card, padding: 12, marginBottom: 8, borderLeft: `3px solid ${SITUACAO.treino.c}`, background: `${SITUACAO.treino.c}10` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>🎓 {e.titulo}</div>
          <span style={s.tag(cor)}>{e.tipo === "turma" ? "Turma agendada" : e.dias < 0 ? `venceu há ${-e.dias} d` : e.dias === 0 ? "vence hoje" : `vence em ${e.dias} d`}</span>
        </div>
        <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{e.tipo === "turma" ? "👥" : "👤"} {e.de} · {e.data.split("-").reverse().join("/")}</div>
        {onAbrirPessoas && (
          <button onClick={() => onAbrirPessoas("treinamentos")} style={{ ...s.btn(false), cursor: "pointer", color: C.accent, padding: "5px 12px", fontSize: 12, marginTop: 8 }}>Ver em Pessoas → 🎓 Treinamentos</button>
        )}
      </div>
    );
  };

  const cartaoPrevista = (o) => (
    <div key={o.id} style={{ ...s.card, padding: 12, marginBottom: 8, border: `1.5px dashed ${SITUACAO.prevista.c}`, background: `${SITUACAO.prevista.c}14` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>🔁 {o.descricao}</div>
        <span style={s.tag(SITUACAO.prevista.c)}>Prevista (sem OS)</span>
      </div>
      <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
        {o.responsavel ? `👤 ${o.responsavel} · ` : ""}{o.equipamento || "Sem equipamento"}{o.categoria ? ` · ${CATEGORIA[o.categoria] || o.categoria}` : ""}
        {" · "}{hora(o.inicio)} → {hora(o.fim)}
        {o.movida_por ? ` · movida de ${o.data_nominal.split("-").reverse().join("/")} (${o.movida_por})` : ""}
      </div>
      <div style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <span>Estimado <b>{brl(o.custo_previsto?.total)}</b></span>
        <span style={{ color: C.muted }}>{o.custo_previsto?.percentual_conhecido || 0}% do custo conhecido</span>
        {!o.tem_modelo && <span style={{ color: C.warn }}>plano sem modelo</span>}
      </div>
      {podeEditarPlano && (
        <button onClick={() => gerarPrevista(o)} disabled={gerandoPrev === o.id}
          style={{ ...s.btn(gerandoPrev !== o.id), cursor: "pointer", padding: "5px 12px", fontSize: 12, marginTop: 8 }}>
          {gerandoPrev === o.id ? "Gerando…" : "⚙ Gerar esta OS"}
        </button>
      )}
    </div>
  );

  const cartaoOS = (o) => (
    <div key={o.id} style={{ ...s.card, padding: 12, marginBottom: 8, borderLeft: `3px solid ${SITUACAO[o.situacao].c}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{o.numero} · {o.descricao || "Manutenção"}</div>
        <span style={{ display: "flex", gap: 6 }}>
          {o.origem_plano_id && <span style={s.tag(C.saving || "#a78bfa")} title="OS gerada por plano de manutenção">🔁 Plano</span>}
          <span style={s.tag(SITUACAO[o.situacao].c)}>{SITUACAO[o.situacao].l}</span>
        </span>
      </div>
      <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
        {o.responsavel ? `👤 ${o.responsavel} · ` : ""}{o.equipamento || "Sem equipamento"}{o.categoria ? ` · ${CATEGORIA[o.categoria] || o.categoria}` : ""}
        {" · "}{new Date(o.inicio).toLocaleDateString("pt-BR")} {hora(o.inicio)}
        {o.fim && o.fim !== o.inicio ? ` → ${new Date(o.fim).toLocaleDateString("pt-BR")} ${hora(o.fim)}` : ""}
      </div>
      <div style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <span>Planejado <b>{brl(o.custo.planejado)}</b></span>
        {o.custo.realizado > 0 && <span style={{ color: C.success }}>Realizado <b>{brl(o.custo.realizado)}</b></span>}
        {o.custo.comprometido > 0 && <span style={{ color: C.warn }}>Comprometido <b>{brl(o.custo.comprometido)}</b></span>}
        {o.custo.horas > 0 && <span style={{ color: C.textSub }}>{o.custo.horas} h{o.custo.mao_de_obra > 0 ? ` · mão de obra ${brl(o.custo.mao_de_obra)}` : ""}</span>}
        <span style={{ color: C.muted }}>{o.custo.percentual_conhecido}% do custo conhecido</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onAbrirOS && (
          <button onClick={() => onAbrirOS(o.id)} style={{ ...s.btn(false), cursor: "pointer", color: C.accent, padding: "5px 12px", fontSize: 12, marginTop: 8 }}>Abrir OS →</button>
        )}
        {podeTransferir && o.situacao !== "concluida" && (
          <button onClick={() => setOsTransf(o)} style={{ ...s.btn(false), cursor: "pointer", color: C.text, padding: "5px 12px", fontSize: 12, marginTop: 8 }}>
            {o.responsavel_id ? "⇄ Transferir" : "👤 Definir responsável"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ padding: "20px 24px 0", display: "flex", flexDirection: "column", minHeight: "100%", boxSizing: "border-box" }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>📅 Calendário de manutenção</h2>
        <div style={{ flex: 1 }} />
        <button onClick={() => setVerPlanos(true)} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 14px", fontSize: 12, color: C.text }}>🔁 Planos</button>
        {botaoVisao("ano", "Ano")}{botaoVisao("mes", "Mês")}{botaoVisao("semana", "Semana")}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => navegar(-1)} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px" }} aria-label="Anterior">‹</button>
        <div style={{ fontSize: 16, fontWeight: 600, minWidth: 170, textAlign: "center" }}>{titulo}</div>
        <button onClick={() => navegar(1)} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px" }} aria-label="Próximo">›</button>
        <button onClick={() => setRef(new Date())} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px", fontSize: 12 }}>Hoje</button>
        <div style={{ flex: 1 }} />
        <select value={equipamentoId} onChange={(e) => setEquipamentoId(e.target.value)} style={sel}>
          <option value="">Todos os equipamentos</option>
          {[...equipamentos].sort((a, b) => String(a.tag || a.nome).localeCompare(String(b.tag || b.nome))).map((e) => (
            <option key={e.id} value={e.id}>{e.tag ? `${e.tag} - ` : ""}{e.nome}</option>
          ))}
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={sel}>
          <option value="">Todos os tipos</option>
          {Object.entries(CATEGORIA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} style={sel}>
          <option value="">Todos os responsáveis</option>
          <option value="eu">👤 Só as minhas</option>
          {responsaveis.filter(([id]) => String(id) !== String(dados.eu)).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          <option value="sem">Sem responsável</option>
        </select>
        <select value={situacao} onChange={(e) => setSituacao(e.target.value)} style={sel}>
          <option value="">Todas as situações</option>
          {Object.entries(SITUACAO).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em" }}>CAMADAS</span>
        {[["manutencao", "🛠 Manutenção"], ["documentos", "📄 Documentos"], ["epi", "🦺 EPI"], ["treinamentos", "🎓 Treinamentos"]].map(([k, l]) => (
          <button key={k} onClick={() => setCamadas((c) => ({ ...c, [k]: !c[k] }))} aria-pressed={camadas[k]}
            style={{ ...s.btn(camadas[k], k === "documentos" ? SITUACAO.documento.c : k === "epi" ? SITUACAO.epi.c : k === "treinamentos" ? SITUACAO.treino.c : C.accent), cursor: "pointer", padding: "4px 12px", fontSize: 12 }}>{camadas[k] ? "✓ " : ""}{l}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.textSub, marginBottom: 12, flexWrap: "wrap" }}>
        {Object.entries(SITUACAO).map(([k, v]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, boxSizing: "border-box", ...(k === "prevista" ? { background: `${v.c}33`, border: `1.5px dashed ${v.c}` } : k === "documento" || k === "epi" || k === "treino" ? { background: `${v.c}33`, border: `1.5px solid ${v.c}` } : { background: v.c }) }} />{v.l} ({lista.filter((o) => o.situacao === k).length})
          </span>
        ))}
        {carregando && <span style={{ color: C.muted }}>carregando…</span>}
      </div>

      {erro && <div style={{ ...s.card, padding: 12, color: C.danger, marginBottom: 12 }}>⚠ {erro}</div>}

      {/* Corpo */}
      <div style={{ flex: 1 }}>
        {visao === "ano" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
            {MESES.map((nome, m) => (
              <div key={m} style={{ ...s.card, padding: 10 }}>
                <button onClick={() => { setRef(new Date(ref.getFullYear(), m, 1)); setVisao("mes"); }}
                  style={{ background: "none", border: "none", color: C.text, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 6, fontFamily: "inherit" }}>{nome}</button>
                <GradeMes ano={ref.getFullYear()} mes={m} mini />
              </div>
            ))}
          </div>
        )}

        {visao === "mes" && <GradeMes ano={ref.getFullYear()} mes={ref.getMonth()} />}

        {visao === "semana" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {Array.from({ length: 7 }, (_, i) => somaDias(ini, i)).map((d) => {
              const k = chave(d);
              return (
                <div key={k} style={{ ...s.card, padding: 8, minHeight: 200, borderColor: k === hoje ? C.accent : C.border }}>
                  <div onClick={() => setDiaSel(k)} style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, cursor: "pointer", color: k === hoje ? C.accent : C.text }}>
                    {SEMANA[i0(d)]} {d.getDate()}/{pad(d.getMonth() + 1)}
                  </div>
                  {(porDia[k] || []).map((o) => (
                    <div key={o.id} onClick={() => setDiaSel(k)} style={{ fontSize: 11, background: `${SITUACAO[o.situacao].c}22`, borderLeft: `3px solid ${SITUACAO[o.situacao].c}`, borderRadius: 3, padding: "4px 6px", marginBottom: 4, cursor: "pointer" }}>
                      <div style={{ fontWeight: 600 }}>{o.prevista ? "🔁 Prevista" : o.treino ? "🎓 Treinamento" : o.epi ? "🦺 EPI" : o.documento ? "📄 Vence" : o.numero}</div>
                      <div style={{ color: C.textSub }}>{o.descricao}</div>
                      <div style={{ color: C.muted }}>{o.equipamento || ""}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rodapé financeiro do período visível */}
      <div style={{ position: "sticky", bottom: 0, background: C.bg, paddingTop: 12, paddingBottom: 16, marginTop: 16 }}>
        <div style={{ ...s.card, padding: "12px 16px", display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
          <span style={{ color: C.muted, fontSize: 11, letterSpacing: "0.06em" }}>{visao === "ano" ? `ANO ${ref.getFullYear()}` : visao === "mes" ? "MÊS" : "SEMANA"} · {lista.filter((o) => !o.documento).length} OS</span>
          <span>Planejado <b>{brl(totais.planejado)}</b></span>
          <span style={{ color: C.success }}>Gasto <b>{brl(totais.realizado)}</b></span>
          <span style={{ color: C.warn }}>Comprometido <b>{brl(totais.comprometido)}</b></span>
          <span>Falta <b>{brl(totais.falta)}</b></span>
          {totais.horas > 0 && <span style={{ color: C.textSub }}>{Math.round(totais.horas)} h programadas</span>}
          {totais.nDocs > 0 && (
            <span style={{ color: SITUACAO.documento.c }}>📄 {totais.nDocs} documento(s) vencendo{totais.nDocsVencidos ? <b style={{ color: "#ef4444" }}> · {totais.nDocsVencidos} já vencido(s)</b> : ""}</span>
          )}
          {totais.nTr > 0 && (
            <span style={{ color: SITUACAO.treino.c }}>🎓 {totais.nTr} treinamento(s){totais.nTrVencidos ? <b style={{ color: "#ef4444" }}> · {totais.nTrVencidos} vencido(s)</b> : ""}</span>
          )}
          {totais.nEpi > 0 && (
            <span style={{ color: SITUACAO.epi.c }}>🦺 {totais.nEpi} troca(s)/CA de EPI{totais.nEpiVencidos ? <b style={{ color: "#ef4444" }}> · {totais.nEpiVencidos} vencido(s)</b> : ""}</span>
          )}
          {totais.nPrevistas > 0 && (
            <span title="Ocorrências dos planos que ainda não viraram OS — custo estimado pelo modelo. Não entra no planejado." style={{ color: SITUACAO.prevista.c, cursor: "help" }}>
              Previsto pelos planos <b>{brl(totais.previsto)}</b> ({totais.nPrevistas} sem OS)
            </span>
          )}
          <span title={dados.valor_hora ? `Itens das OS com algum valor (preço, OV ou mão de obra a R$ ${String(dados.valor_hora).replace(".", ",")}/h) ÷ total de itens.` : "Itens das OS com algum valor (preço, OV ou serviço contratado) ÷ total de itens. Cadastre o valor da hora em 🔁 Planos para a mão de obra própria entrar no custo."} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "help" }}>
            <span style={{ width: 80, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${totais.pct}%`, background: totais.pct >= 80 ? C.success : totais.pct >= 40 ? C.warn : C.danger }} />
            </span>
            {totais.pct}% do custo conhecido
          </span>
        </div>
      </div>

      {aviso && <div style={{ position: "fixed", bottom: 90, right: 24, zIndex: 90, ...s.card, padding: "10px 14px", borderColor: C.success, color: C.success, fontSize: 13 }}>✓ {aviso}</div>}
      {osTransf && (
        <ModalTransferirOS C={C} s={s} os={osTransf} usuarios={usuarios} onFechar={() => setOsTransf(null)}
          onTransferido={(r) => { setOsTransf(null); setAviso(r?.mensagem || "Responsável atualizado"); setRecarga((n) => n + 1); }} />
      )}

      {/* 12b.6: confirmação / erro no padrão de modal do app */}
      {dialogo && (
        <div onClick={() => setDialogo(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 95, padding: "80px 16px" }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ ...s.card, width: "min(460px, 100%)", padding: 22, background: C.surface }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: dialogo.tipo === "erro" ? C.danger : C.warn }}>
              {dialogo.tipo === "sem_modelo" ? "⚠ Plano sem modelo de manutenção" : "⚠ Não foi possível gerar a OS"}
            </div>
            <div style={{ fontSize: 13, color: C.textSub, marginTop: 10, lineHeight: 1.5 }}>{dialogo.msg}</div>
            {dialogo.tipo === "sem_modelo" && (
              <div style={{ fontSize: 13, color: C.text, marginTop: 12 }}>Gerar mesmo assim, <b>sem itens</b> (ex.: só inspeção)?</div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              {dialogo.tipo === "sem_modelo" ? (
                <>
                  <button onClick={() => setDialogo(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
                  <button onClick={() => { const o = dialogo.o; setDialogo(null); gerarPrevista(o, true); }} style={{ ...s.btn(true), cursor: "pointer", flex: 1 }}>Gerar sem itens</button>
                </>
              ) : (
                <button onClick={() => setDialogo(null)} style={{ ...s.btn(true), cursor: "pointer", flex: 1 }}>OK</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dia selecionado */}
      {diaSel && (
        <div onClick={() => setDiaSel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", justifyContent: "flex-end", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(460px, 100%)", height: "100%", background: C.surface, borderLeft: `1px solid ${C.border}`, padding: 20, overflowY: "auto", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>
                {deChave(diaSel).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              </div>
              <button onClick={() => setDiaSel(null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }} aria-label="Fechar">×</button>
            </div>
            {onNovaOS && (
              <button onClick={() => { const d = diaSel; setDiaSel(null); onNovaOS(d); }}
                style={{ ...s.btn(true), cursor: "pointer", width: "100%", marginBottom: 14 }}>＋ Nova OS programada para este dia</button>
            )}
            {(porDia[diaSel] || []).length === 0
              ? <div style={{ color: C.muted, fontSize: 13 }}>Nenhuma OS programada neste dia.</div>
              : porDia[diaSel].map((o) => (o.treino ? cartaoTreino(o) : o.epi ? cartaoEpi(o) : o.documento ? cartaoDocumento(o) : o.prevista ? cartaoPrevista(o) : cartaoOS(o)))}
          </div>
        </div>
      )}
    </div>
  );
}

function i0(d) { return (d.getDay() + 6) % 7; }
