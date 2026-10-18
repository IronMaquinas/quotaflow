// components/manutencao/TelaCalendarioManutencao.jsx — etapa 12a
// Calendário anual de manutenção ("folhinha"): visões Ano / Mês / Semana,
// clique no dia lista as OS e abre "Nova OS programada" com a data.
// Rodapé: planejado × comprometido × realizado do período visível e o
// "% de custo conhecido". Só leitura — dados de GET /api/manutencao/calendario.
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const SEMANA = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

const SITUACAO = {
  atrasada:    { l: "Atrasada",    c: "#ef4444", peso: 4 },
  em_execucao: { l: "Em execução", c: "#f59e0b", peso: 3 },
  programada:  { l: "Programada",  c: "#3b82f6", peso: 2 },
  concluida:   { l: "Concluída",   c: "#22c55e", peso: 1 },
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

export default function TelaCalendarioManutencao({ C, s, equipamentos = [], onAbrirOS, onNovaOS }) {
  const [visao, setVisao] = useState("ano");
  const [ref, setRef] = useState(() => new Date());
  const [equipamentoId, setEquipamentoId] = useState("");
  const [categoria, setCategoria] = useState("");
  const [situacao, setSituacao] = useState("");
  const [dados, setDados] = useState({ os: [] });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [diaSel, setDiaSel] = useState(null);

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
  }, [de, ate, equipamentoId]);

  const lista = useMemo(() => (dados.os || []).filter((o) =>
    (!categoria || o.categoria === categoria) && (!situacao || o.situacao === situacao)
  ), [dados, categoria, situacao]);

  const porDia = useMemo(() => {
    const m = {};
    for (const o of lista) for (const k of diasDaOS(o)) (m[k] = m[k] || []).push(o);
    return m;
  }, [lista]);

  const totais = useMemo(() => {
    const t = { planejado: 0, comprometido: 0, realizado: 0, horas: 0, itens: 0, comValor: 0 };
    for (const o of lista) {
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
          const ehHoje = k === hoje;
          if (mini) return (
            <button key={k} onClick={() => setDiaSel(k)} title={qtd ? `${qtd} OS` : ""}
              style={{ aspectRatio: "1", border: ehHoje ? `1px solid ${C.text}` : "1px solid transparent", borderRadius: 4, fontSize: 10, cursor: "pointer", padding: 0, fontFamily: "inherit",
                background: cor ? SITUACAO[cor].c : "transparent", color: cor ? "#fff" : C.textSub, fontWeight: cor ? 700 : 400 }}>
              {d.getDate()}
            </button>
          );
          return (
            <div key={k} onClick={() => setDiaSel(k)}
              style={{ minHeight: 92, background: C.bg, border: `1px solid ${ehHoje ? C.accent : C.border}`, borderRadius: 6, padding: 6, cursor: "pointer", overflow: "hidden" }}>
              <div style={{ fontSize: 12, color: ehHoje ? C.accent : C.textSub, fontWeight: ehHoje ? 700 : 500, marginBottom: 4 }}>{d.getDate()}</div>
              {(porDia[k] || []).slice(0, 3).map((o) => (
                <div key={o.id} style={{ fontSize: 10, background: `${SITUACAO[o.situacao].c}22`, borderLeft: `3px solid ${SITUACAO[o.situacao].c}`, color: C.text, borderRadius: 3, padding: "2px 5px", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {o.numero} {o.descricao}
                </div>
              ))}
              {qtd > 3 && <div style={{ fontSize: 10, color: C.muted }}>+{qtd - 3}</div>}
            </div>
          );
        })}
      </div>
    );
  }

  const cartaoOS = (o) => (
    <div key={o.id} style={{ ...s.card, padding: 12, marginBottom: 8, borderLeft: `3px solid ${SITUACAO[o.situacao].c}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{o.numero} · {o.descricao || "Manutenção"}</div>
        <span style={s.tag(SITUACAO[o.situacao].c)}>{SITUACAO[o.situacao].l}</span>
      </div>
      <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
        {o.equipamento || "Sem equipamento"}{o.categoria ? ` · ${CATEGORIA[o.categoria] || o.categoria}` : ""}
        {" · "}{new Date(o.inicio).toLocaleDateString("pt-BR")} {hora(o.inicio)}
        {o.fim && o.fim !== o.inicio ? ` → ${new Date(o.fim).toLocaleDateString("pt-BR")} ${hora(o.fim)}` : ""}
      </div>
      <div style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <span>Planejado <b>{brl(o.custo.planejado)}</b></span>
        {o.custo.realizado > 0 && <span style={{ color: C.success }}>Realizado <b>{brl(o.custo.realizado)}</b></span>}
        {o.custo.comprometido > 0 && <span style={{ color: C.warn }}>Comprometido <b>{brl(o.custo.comprometido)}</b></span>}
        {o.custo.horas > 0 && <span style={{ color: C.textSub }}>{o.custo.horas} h</span>}
        <span style={{ color: C.muted }}>{o.custo.percentual_conhecido}% do custo conhecido</span>
      </div>
      {onAbrirOS && (
        <button onClick={() => onAbrirOS(o.id)} style={{ ...s.btn(false), cursor: "pointer", color: C.accent, padding: "5px 12px", fontSize: 12, marginTop: 8 }}>Abrir OS →</button>
      )}
    </div>
  );

  return (
    <div style={{ padding: "20px 24px 0", display: "flex", flexDirection: "column", minHeight: "100%", boxSizing: "border-box" }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>📅 Calendário de manutenção</h2>
        <div style={{ flex: 1 }} />
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
        <select value={situacao} onChange={(e) => setSituacao(e.target.value)} style={sel}>
          <option value="">Todas as situações</option>
          {Object.entries(SITUACAO).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.textSub, marginBottom: 12, flexWrap: "wrap" }}>
        {Object.entries(SITUACAO).map(([k, v]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: v.c }} />{v.l} ({lista.filter((o) => o.situacao === k).length})
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
                      <div style={{ fontWeight: 600 }}>{o.numero}</div>
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
          <span style={{ color: C.muted, fontSize: 11, letterSpacing: "0.06em" }}>{visao === "ano" ? `ANO ${ref.getFullYear()}` : visao === "mes" ? "MÊS" : "SEMANA"} · {lista.length} OS</span>
          <span>Planejado <b>{brl(totais.planejado)}</b></span>
          <span style={{ color: C.success }}>Gasto <b>{brl(totais.realizado)}</b></span>
          <span style={{ color: C.warn }}>Comprometido <b>{brl(totais.comprometido)}</b></span>
          <span>Falta <b>{brl(totais.falta)}</b></span>
          {totais.horas > 0 && <span style={{ color: C.textSub }}>{Math.round(totais.horas)} h programadas</span>}
          <span title="Itens das OS com algum valor (preço, OV ou serviço contratado) ÷ total de itens. Mão de obra própria ainda não tem valor de hora." style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "help" }}>
            <span style={{ width: 80, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${totais.pct}%`, background: totais.pct >= 80 ? C.success : totais.pct >= 40 ? C.warn : C.danger }} />
            </span>
            {totais.pct}% do custo conhecido
          </span>
        </div>
      </div>

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
              : porDia[diaSel].map(cartaoOS)}
          </div>
        </div>
      )}
    </div>
  );
}

function i0(d) { return (d.getDay() + 6) % 7; }
