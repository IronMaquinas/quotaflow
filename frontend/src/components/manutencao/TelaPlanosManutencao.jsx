// components/manutencao/TelaPlanosManutencao.jsx — etapa 12b
// Planos de manutenção recorrentes (a cada N dias/semanas/meses, usando um
// "modelo de manutenção" da OS) + valor da hora da mão de obra própria.
// "Gerar OS" mostra a prévia (com caixinhas por data) antes de gravar e nunca duplica.
// 12b.2: responsável (herdado pelas OS) + transferir responsabilidade; regra de dia útil;
// sem modelo não gera (exceção "gerar sem itens" com confirmação).
// Aberta pelo botão "🔁 Planos" do Calendário.
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

const UNIDADE = { dias: ["dia", "dias"], semanas: ["semana", "semanas"], meses: ["mês", "meses"] };
const CATEGORIA = { preventiva: "Preventiva", preditiva: "Preditiva", corretiva: "Corretiva" };
const brl = (v) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataBR = (s) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "—");
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const periodicidade = (p) => `A cada ${p.periodicidade_valor} ${UNIDADE[p.periodicidade_unidade]?.[p.periodicidade_valor == 1 ? 0 : 1] || p.periodicidade_unidade}`;

const REGRA_DIA_UTIL = { proximo: "Mover para o próximo dia útil", anterior: "Mover para o dia útil anterior", manter: "Manter a data" };
const formVazio = () => ({ nome: "", descricao: "", equipamento_id: "", template_id: "", responsavel_id: "", regra_dia_util: "proximo", periodicidade_valor: 1, periodicidade_unidade: "meses",
  proxima_data: hojeISO(), termina_em: "", hora_inicio: "08:00", duracao_horas: 8, categoria: "preventiva", urgencia: "media" });

export default function TelaPlanosManutencao({ C, s, equipamentos = [], onVoltar }) {
  const [planos, setPlanos] = useState([]);
  const [podeEditar, setPodeEditar] = useState(false);
  const [modelos, setModelos] = useState([]);
  const [valorHora, setValorHora] = useState("");
  const [valorHoraSalvo, setValorHoraSalvo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [form, setForm] = useState(null); // null = fechado; { ...campos, id? }
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState(null); // { plano, dados }
  const [gerando, setGerando] = useState(false);
  const [marcadas, setMarcadas] = useState(new Set()); // datas nominais marcadas na prévia
  const [semItensOk, setSemItensOk] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [podeTransferir, setPodeTransferir] = useState(false);
  const [transf, setTransf] = useState(null); // { de, para, previa? }

  const carregar = async () => {
    setCarregando(true); setErro("");
    try {
      const [r, cfg] = await Promise.all([apiService.get("/manutencao/planos"), apiService.get("/manutencao/config")]);
      setPlanos(r?.planos || []); setPodeEditar(!!r?.pode_editar); setPodeTransferir(!!r?.pode_transferir);
      setValorHora(cfg?.valor_hora != null ? String(cfg.valor_hora).replace(".", ",") : "");
      setValorHoraSalvo(cfg?.valor_hora ?? null);
    } catch (e) { setErro(e.message || "Erro ao carregar"); }
    finally { setCarregando(false); }
  };

  useEffect(() => {
    carregar();
    apiService.get("/cotacoes/chamados/templates").then((l) => setModelos(Array.isArray(l) ? l : [])).catch(() => setModelos([]));
    apiService.get("/manutencao/usuarios").then((r) => setUsuarios(r?.usuarios || [])).catch(() => setUsuarios([]));
  }, []);

  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 5000); return () => clearTimeout(t); }, [aviso]);

  const salvarValorHora = async () => {
    try {
      const r = await apiService.put("/manutencao/config", { valor_hora: valorHora.trim() === "" ? null : valorHora });
      setValorHoraSalvo(r.valor_hora); setAviso("Valor da hora salvo — o calendário já usa o novo valor.");
    } catch (e) { setErro(e.message); }
  };

  const salvarPlano = async () => {
    setSalvando(true); setErro("");
    try {
      const corpo = { ...form, equipamento_id: form.equipamento_id || null, template_id: form.template_id || null, responsavel_id: form.responsavel_id || null };
      ["responsavel", "modelo", "equipamento", "os_futuras", "geradas_ate", "os_apos_termino", "encerrado", "criado_em", "atualizado_em", "criado_por", "tenant_id"].forEach((k) => delete corpo[k]);
      delete corpo.id;
      if (form.id) await apiService.put(`/manutencao/planos/${form.id}`, corpo);
      else await apiService.post("/manutencao/planos", corpo);
      setForm(null); setAviso(form.id ? "Plano atualizado." : "Plano criado. Agora clique em “Gerar OS”.");
      await carregar();
    } catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  };

  const alternarAtivo = async (p) => {
    try {
      if (p.ativo) await apiService.delete(`/manutencao/planos/${p.id}`);
      else await apiService.put(`/manutencao/planos/${p.id}`, { ativo: true });
      await carregar();
    } catch (e) { setErro(e.message); }
  };

  const abrirPrevia = async (p) => {
    setErro("");
    try {
      const dados = await apiService.get(`/manutencao/planos/${p.id}/previa`);
      setMarcadas(new Set(dados.ocorrencias.filter((o) => !o.ja_existe).map((o) => o.data)));
      setSemItensOk(false);
      setPrevia({ plano: p, dados });
    } catch (e) { setErro(e.message); }
  };

  const gerar = async () => {
    setGerando(true);
    try {
      const r = await apiService.post(`/manutencao/planos/${previa.plano.id}/gerar`, { datas: [...marcadas], sem_itens: semItensOk });
      setPrevia(null); setAviso(r.mensagem || "OS criadas."); await carregar();
    } catch (e) { setErro(e.message); }
    finally { setGerando(false); }
  };

  const verTransferencia = async () => {
    setErro("");
    try { const pv = await apiService.get("/manutencao/responsaveis/previa", { de: transf.de, para: transf.para }); setTransf((t) => ({ ...t, previa: pv })); }
    catch (e) { setErro(e.message); }
  };
  const transferir = async () => {
    try {
      const r = await apiService.post("/manutencao/responsaveis/transferir", { de: transf.de, para: transf.para });
      setTransf(null); setAviso(r.mensagem); await carregar();
    } catch (e) { setErro(e.message); }
  };

  const campo = (rotulo, el, larg) => (
    <label style={{ display: "block", minWidth: 0, ...(larg ? { flex: larg } : {}) }}>
      <span style={s.label}>{rotulo}</span>{el}
    </label>
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const eqOrdenados = [...equipamentos].sort((a, b) => String(a.tag || a.nome).localeCompare(String(b.tag || b.nome)));

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <button onClick={onVoltar} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 14, padding: 0, fontFamily: "inherit" }}>← Calendário</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🔁 Planos de manutenção</h2>
        <div style={{ flex: 1 }} />
        {podeTransferir && <button onClick={() => setTransf({ de: "", para: "" })} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>⇄ Transferir plano de responsável</button>}
        {podeEditar && <button onClick={() => setForm(formVazio())} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Novo plano</button>}
      </div>
      <div style={{ ...s.card, padding: "12px 16px", marginBottom: 14, fontSize: 12, color: C.textSub, borderColor: `${C.accent}55` }}>
        <b style={{ color: C.text }}>Antes de criar um plano, planeje a OS.</b> O plano repete uma OS-modelo: monte uma OS com os materiais e serviços na tela de
        Ordem de Serviço e use <b>📋 Salvar como modelo</b>. Depois escolha esse modelo aqui. Sem modelo, o plano não gera OS.
      </div>

      {aviso && <div style={{ ...s.card, padding: 12, marginBottom: 12, borderColor: C.success, color: C.success }}>✓ {aviso}</div>}
      {erro && <div style={{ ...s.card, padding: 12, marginBottom: 12, borderColor: C.danger, color: C.danger }}>⚠ {erro}</div>}

      {/* Valor da hora */}
      <div style={{ ...s.card, padding: 16, marginBottom: 18, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Valor da hora da mão de obra própria</div>
          <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
            Entra no custo planejado do calendário: horas × pessoas × R$/h. Serviço de terceiro continua pelo valor da OV.
          </div>
        </div>
        <label style={{ display: "block", width: 160 }}>
          <span style={s.label}>R$ POR HORA</span>
          <input value={valorHora} onChange={(e) => setValorHora(e.target.value.replace(/[^\d,.]/g, ""))} disabled={!podeEditar}
            placeholder="ex.: 85,00" inputMode="decimal" style={s.input} />
        </label>
        {podeEditar && (
          <button onClick={salvarValorHora} disabled={String(valorHoraSalvo ?? "").replace(".", ",") === valorHora}
            style={{ ...s.btn(String(valorHoraSalvo ?? "").replace(".", ",") !== valorHora), cursor: "pointer" }}>Salvar</button>
        )}
      </div>

      {/* Lista */}
      {carregando ? <div style={{ color: C.muted }}>Carregando…</div>
        : planos.length === 0 ? (
          <div style={{ ...s.card, padding: 28, textAlign: "center", color: C.textSub }}>
            <div style={{ fontSize: 15, color: C.text, marginBottom: 6 }}>Nenhum plano ainda</div>
            Crie um plano (ex.: “Troca de óleo — a cada 3 meses”) e gere as OS do próximo ano de uma vez.<br />
            Os itens vêm de um <b>modelo de manutenção</b> — salve uma OS como modelo na tela de Ordem de Serviço.
          </div>
        ) : planos.map((p) => (
          <div key={p.id} style={{ ...s.card, padding: 16, marginBottom: 10, opacity: p.ativo ? 1 : 0.55 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{p.nome}</div>
              <span style={s.tag(C.accent)}>{periodicidade(p)}</span>
              {!p.ativo && <span style={s.tag(C.muted)}>Desativado</span>}
              {p.ativo && p.encerrado && <span style={s.tag(C.muted)}>Encerrado</span>}
              <div style={{ flex: 1 }} />
              {podeEditar && p.ativo && !p.encerrado && (
                <button onClick={() => abrirPrevia(p)} style={{ ...s.btn(true), cursor: "pointer", padding: "7px 14px", fontSize: 12 }}>⚙ Gerar OS</button>
              )}
              {podeEditar && (
                <button onClick={() => setForm({ ...formVazio(), ...p, equipamento_id: p.equipamento_id || "", template_id: p.template_id || "",
                  responsavel_id: p.responsavel_id || "", regra_dia_util: p.regra_dia_util || "proximo", hora_inicio: String(p.hora_inicio || "08:00").slice(0, 5), proxima_data: String(p.proxima_data).slice(0, 10), termina_em: p.termina_em ? String(p.termina_em).slice(0, 10) : "" })}
                  style={{ ...s.btn(false), cursor: "pointer", padding: "7px 14px", fontSize: 12, color: C.text }}>Editar</button>
              )}
              {podeEditar && (
                <button onClick={() => alternarAtivo(p)} style={{ ...s.btn(false), cursor: "pointer", padding: "7px 14px", fontSize: 12, color: p.ativo ? C.danger : C.success }}>
                  {p.ativo ? "Desativar" : "Reativar"}
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>⚙ {p.equipamento || "Sem equipamento"}</span>
              <span>👤 {p.responsavel || <span style={{ color: C.muted }}>Sem responsável</span>}</span>
              <span>📋 {p.modelo ? `Modelo: ${p.modelo}` : <span style={{ color: C.warn }}>Sem modelo — escolha um para gerar OS</span>}</span>
              <span>📅 Desde {dataBR(p.proxima_data)} {p.termina_em ? `até ${dataBR(p.termina_em)}` : "· sem término"} · {String(p.hora_inicio || "").slice(0, 5)} · {Number(p.duracao_horas)} h</span>
              <span>{CATEGORIA[p.categoria] || p.categoria}</span>
              <span style={{ color: p.os_futuras ? C.success : C.muted }}>
                {p.os_futuras ? `${p.os_futuras} OS futura(s) geradas, até ${dataBR(p.geradas_ate)}` : "Nenhuma OS gerada"}
              </span>
            </div>
            {p.os_apos_termino > 0 && (
              <div style={{ fontSize: 12, color: C.warn, marginTop: 8 }}>
                ⚠ {p.os_apos_termino} OS já gerada(s) depois do término ({dataBR(p.termina_em)}). Elas não foram canceladas — cancele na tela de Ordem de Serviço se não forem mais necessárias.
              </div>
            )}
          </div>
        ))}

      {/* Formulário */}
      {form && (
        <div onClick={() => !salvando && setForm(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 60, overflowY: "auto", padding: "40px 16px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: "min(640px, 100%)", padding: 24, background: C.surface }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>{form.id ? "Editar plano" : "Novo plano de manutenção"}</div>
              <button onClick={() => setForm(null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }} aria-label="Fechar">×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {campo("NOME DO PLANO (VIRA O NOME DA OS)", <input value={form.nome} onChange={set("nome")} placeholder="Troca de óleo e filtros" style={s.input} />)}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {campo("EQUIPAMENTO", <select value={form.equipamento_id} onChange={set("equipamento_id")} style={s.input}>
                  <option value="">Sem equipamento</option>
                  {eqOrdenados.map((e) => <option key={e.id} value={e.id}>{e.tag ? `${e.tag} - ` : ""}{e.nome}</option>)}
                </select>, "1 1 240px")}
                {campo("MODELO DE MANUTENÇÃO (ITENS DA OS)", <select value={form.template_id} onChange={set("template_id")} style={s.input}>
                  <option value="">Sem modelo</option>
                  {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.total_itens || 0} itens)</option>)}
                </select>, "1 1 240px")}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                {campo("A CADA", <input type="number" min={1} max={3650} value={form.periodicidade_valor} onChange={set("periodicidade_valor")} style={s.input} />, "0 0 100px")}
                {campo("", <select value={form.periodicidade_unidade} onChange={set("periodicidade_unidade")} style={s.input}>
                  <option value="dias">dias</option><option value="semanas">semanas</option><option value="meses">meses</option>
                </select>, "0 0 140px")}
                {campo("PRÓXIMA MANUTENÇÃO", <input type="date" value={form.proxima_data} onChange={set("proxima_data")} style={s.input} />, "1 1 160px")}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                {campo("TÉRMINO DO PLANO", <select value={form.termina_em ? "data" : "sem"} style={s.input}
                  onChange={(e) => setForm((f) => ({ ...f, termina_em: e.target.value === "data" ? (f.termina_em || f.proxima_data) : "" }))}>
                  <option value="sem">Sem término</option>
                  <option value="data">Termina em…</option>
                </select>, "1 1 180px")}
                {form.termina_em
                  ? campo("ÚLTIMA DATA DO PLANO", <input type="date" value={form.termina_em} min={form.proxima_data || undefined} onChange={set("termina_em")} style={s.input} />, "1 1 180px")
                  : <div style={{ flex: "1 1 180px", fontSize: 12, color: C.textSub, paddingBottom: 10 }}>Repete até alguém desativar o plano. As OS só são criadas quando você clicar em “Gerar OS”.</div>}
              </div>
              {form.termina_em && form.proxima_data && form.termina_em < form.proxima_data && (
                <div style={{ fontSize: 12, color: C.danger }}>O término não pode ser antes da próxima manutenção.</div>
              )}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {campo("HORA DE INÍCIO", <input type="time" value={form.hora_inicio} onChange={set("hora_inicio")} style={s.input} />, "1 1 120px")}
                {campo("DURAÇÃO (HORAS)", <input type="number" min={0.5} step={0.5} max={720} value={form.duracao_horas} onChange={set("duracao_horas")} style={s.input} />, "1 1 120px")}
                {campo("TIPO", <select value={form.categoria} onChange={set("categoria")} style={s.input}>
                  {Object.entries(CATEGORIA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>, "1 1 140px")}
                {campo("URGÊNCIA", <select value={form.urgencia} onChange={set("urgencia")} style={s.input}>
                  <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option>
                </select>, "1 1 120px")}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {campo("RESPONSÁVEL (AS OS GERADAS HERDAM)", <select value={form.responsavel_id} onChange={set("responsavel_id")} style={s.input}>
                  <option value="">Sem responsável</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>, "1 1 240px")}
                {campo("SE CAIR EM FOLGA OU FERIADO", <select value={form.regra_dia_util} onChange={set("regra_dia_util")} style={s.input}>
                  {Object.entries(REGRA_DIA_UTIL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>, "1 1 240px")}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: -6 }}>Dias úteis e feriados vêm de Configurações (jornada da empresa); sem jornada, segunda a sexta.</div>
              {campo("OBSERVAÇÕES (OPCIONAL)", <textarea value={form.descricao || ""} onChange={set("descricao")} rows={2} style={{ ...s.input, resize: "vertical" }} />)}
              {modelos.length === 0 && (
                <div style={{ fontSize: 12, color: C.warn }}>Você ainda não tem modelos. Na tela de Ordem de Serviço, abra uma OS e use “📋 Salvar como modelo” — sem modelo o plano não gera OS.</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setForm(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
              <button onClick={salvarPlano} disabled={salvando || !form.nome.trim() || (form.termina_em && form.termina_em < form.proxima_data)} style={{ ...s.btn(!salvando && !!form.nome.trim() && !(form.termina_em && form.termina_em < form.proxima_data)), flex: 1 }}>
                {salvando ? "Salvando…" : form.id ? "Salvar alterações" : "Criar plano"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prévia do gerar (12b.2: caixinhas por data, dia útil, bloqueio sem modelo) */}
      {previa && (() => {
        const d = previa.dados;
        const disponiveis = d.ocorrencias.filter((o) => !o.ja_existe);
        const nSel = disponiveis.filter((o) => marcadas.has(o.data)).length;
        const semModelo = d.itens_modelo === 0;
        const podeCriar = !gerando && nSel > 0 && (!semModelo || semItensOk);
        const alternar = (data) => setMarcadas((m) => { const n = new Set(m); n.has(data) ? n.delete(data) : n.add(data); return n; });
        const todas = nSel === disponiveis.length;
        const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const diaSem = (s) => new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
        return (
        <div onClick={() => !gerando && setPrevia(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 60, overflowY: "auto", padding: "40px 16px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: "min(600px, 100%)", padding: 24, background: C.surface }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Gerar OS — {previa.plano.nome}</div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
              Datas de {dataBR(d.de)} a {dataBR(d.ate)}{d.termina_em ? ` · o plano termina em ${dataBR(d.termina_em)}` : ""}
              {previa.plano.responsavel ? ` · responsável: ${previa.plano.responsavel}` : ""}
            </div>

            {semModelo && (
              <div style={{ ...s.card, padding: 12, marginTop: 14, borderColor: C.warn, fontSize: 13 }}>
                <div style={{ color: C.warn, fontWeight: 600 }}>⚠ Este plano não tem modelo de manutenção</div>
                <div style={{ color: C.textSub, marginTop: 4, fontSize: 12 }}>
                  Planeje a OS antes: monte uma OS com os materiais e serviços, use <b>📋 Salvar como modelo</b> e escolha o modelo no plano (Editar).
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 12, color: C.text, cursor: "pointer" }}>
                  <input type="checkbox" checked={semItensOk} onChange={(e) => setSemItensOk(e.target.checked)} />
                  Gerar mesmo assim, <b>sem itens</b> (ex.: só inspeção)
                </label>
              </div>
            )}

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "16px 0 8px", fontSize: 13 }}>
              <span><b style={{ fontSize: 20 }}>{nSel}</b> de {disponiveis.length} marcadas</span>
              {d.ja_existentes > 0 && <span style={{ color: C.muted }}>{d.ja_existentes} já existem</span>}
              <span>Por OS <b>{brl(d.custo_por_os.total)}</b></span>
              <span>Total <b>{brl(d.custo_por_os.total * nSel)}</b></span>
            </div>
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>
              Materiais {brl(d.custo_por_os.materiais)} · mão de obra {brl(d.custo_por_os.mao_de_obra)} ({d.custo_por_os.horas} h)
              {" · "}{d.custo_por_os.percentual_conhecido}% do custo conhecido
              {!d.valor_hora && d.custo_por_os.horas > 0 && <span style={{ color: C.warn }}> · sem valor da hora</span>}
            </div>

            {disponiveis.length > 0 && (
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: C.textSub, marginBottom: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={todas} onChange={() => setMarcadas(todas ? new Set() : new Set(disponiveis.map((o) => o.data)))} />
                {todas ? "Desmarcar todas" : "Marcar todas"}
              </label>
            )}
            <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
              {d.ocorrencias.length === 0
                ? <div style={{ padding: 14, color: C.muted, fontSize: 13 }}>Nenhuma data nos próximos 12 meses{d.termina_em ? " antes do término do plano" : ""}.</div>
                : d.ocorrencias.map((o) => {
                  const movida = o.data_os && o.data_os !== o.data;
                  return (
                    <label key={o.data} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${C.border}`, fontSize: 13,
                      color: o.ja_existe ? C.muted : C.text, cursor: o.ja_existe ? "default" : "pointer" }}>
                      <input type="checkbox" disabled={o.ja_existe} checked={o.ja_existe || marcadas.has(o.data)} onChange={() => alternar(o.data)} />
                      <span style={{ flex: 1 }}>
                        {movida
                          ? <><span style={{ textDecoration: "line-through", color: C.muted }}>{dataBR(o.data)}</span> → <b>{diaSem(o.data_os)}</b>
                              <span style={{ fontSize: 11, color: C.warn }}> ({o.movida_por})</span></>
                          : diaSem(o.data_os || o.data)}
                      </span>
                      <span>{o.ja_existe ? "já existe" : `${hora(o.inicio)} → ${hora(o.fim)}`}</span>
                    </label>
                  );
                })}
            </div>

            <div style={{ fontSize: 12, color: C.textSub, marginTop: 12 }}>
              As OS nascem <b>abertas, sem requisição de compra</b>: os materiais ficam na fila do comprador para serem pedidos quando chegar a hora.
              Datas desmarcadas não se perdem — aparecem de novo no próximo “Gerar OS”.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => setPrevia(null)} disabled={gerando} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
              <button onClick={gerar} disabled={!podeCriar} style={{ ...s.btn(podeCriar), flex: 1 }}>
                {gerando ? "Gerando…" : `Criar ${nSel} OS`}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Transferir responsabilidade (12b.2) */}
      {transf && (
        <div onClick={() => setTransf(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 60, overflowY: "auto", padding: "40px 16px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: "min(520px, 100%)", padding: 24, background: C.surface }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>⇄ Transferir plano de responsável</div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>Férias, desligamento ou troca de função. Passa os planos e as OS ainda não concluídas; as concluídas ficam com quem fez. Para mudar só uma OS, use “⇄ Transferir” no cartão do dia (Calendário) ou no detalhe da OS.</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              {campo("DE", <select value={transf.de} onChange={(e) => setTransf({ de: e.target.value, para: transf.para })} style={s.input}>
                <option value="">Escolha…</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>, "1 1 200px")}
              {campo("PARA", <select value={transf.para} onChange={(e) => setTransf({ de: transf.de, para: e.target.value })} style={s.input}>
                <option value="">Escolha…</option>{usuarios.filter((u) => String(u.id) !== String(transf.de)).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>, "1 1 200px")}
            </div>
            {transf.previa && (
              <div style={{ ...s.card, padding: 12, marginTop: 14, fontSize: 13 }}>
                <b>{transf.previa.planos}</b> plano(s) e <b>{transf.previa.os}</b> OS em aberto passam de <b>{transf.previa.de}</b> para <b>{transf.previa.para}</b>.
                {transf.previa.os_numeros?.length > 0 && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{transf.previa.os_numeros.join(", ")}{transf.previa.os > transf.previa.os_numeros.length ? "…" : ""}</div>}
                <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Fica registrado no histórico de cada OS.</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => setTransf(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
              {!transf.previa
                ? <button onClick={verTransferencia} disabled={!transf.de || !transf.para} style={{ ...s.btn(!!(transf.de && transf.para)), flex: 1 }}>Ver o que será transferido</button>
                : <button onClick={transferir} disabled={!transf.previa.planos && !transf.previa.os} style={{ ...s.btn(!!(transf.previa.planos || transf.previa.os)), flex: 1 }}>Transferir</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
