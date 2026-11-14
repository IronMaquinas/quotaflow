// components/contratos/TelaContratos.jsx — etapa 14b.3
// 📑 Contratos de locação (visão da EMPRESA): contrato CL-AAAA-NNNN com os equipamentos locados, as rotinas de inspeção
// (em dia / atrasada), as inspeções de entrega/devolução e os ACESSOS do locatário (perfil "Locatário": e-mail + senha
// temporária — ele entra no QuotaFlow e vê só os contratos dele). Encerrar o contrato devolve os equipamentos e oferece
// pausar os acessos que ficaram sem contrato ativo. Ver: admin, gestor, operação, comprador, qualidade · alterar: admin, gestor.
import { moduloAtivo } from "../../utils/modulosSessao"; // 18k
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import { corEstado, txtEstado } from "../inspecoes/RotinasLocacao";
import { FormNovoContrato, AbaClientes, mascaraDoc } from "./Clientes"; // 14b.3.1
import { AbaModelos, DocumentoContrato } from "./ModelosContrato"; // 14d
import CampoTelefone, { telefoneExibir } from "../shared/CampoTelefone";
import AbaMedicoes from "./AbaMedicoes"; // 18d.5
import MobilizacaoContrato, { FaturamentoPrevisto } from "./MobilizacaoContrato"; // 18y
import PainelOcorrencias from "../ocorrencias/PainelOcorrencias"; // 18h
import GuardaContrato from "./GuardaContrato"; // 18za.1
import CampoMoeda from "../shared/CampoMoeda";

const FREQ = { diaria: "Diária", semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal" };
const dataBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// 14d.2: fase do contrato (calculada no servidor)
export const FASE = { elaboracao: ["📝 EM ELABORAÇÃO", "#64748b"], aguardando_aceite: ["⏳ AGUARDANDO ACEITE", "#f59e0b"], andamento: ["✅ EM ANDAMENTO", "#22c55e"], encerrado: ["🏁 ENCERRADO", "#64748b"] };
const faseDe = (c) => c.fase || (c.status === "ativo" ? "elaboracao" : "encerrado");
const vazio = () => ({ cliente: "", cliente_doc: "", local: "", contato_nome: "", contato_email: "", contato_telefone: "", inicio: hoje(), fim_previsto: "", obs: "" });

export default function TelaContratos({ C, s, onAbrirInspecoes, abrirContrato, abrirOcorrencia = null }) {
  const [d, setD] = useState(null);
  const [refArm, setRefArm] = useState(undefined); // 18zb: preço de tabela das áreas do pátio (sugestão no contrato CA)
  const [painel, setPainel] = useState(null); // equipamentos e modelos (para adicionar ao contrato)
  const [semMigration, setSemMigration] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [filtro, setFiltro] = useState("abertos"); // 14d.2: abertos (não encerrados) | fase | todos
  const [aba, setAba] = useState("contratos"); // 14b.3.1: contratos | clientes
  const [fatPrev, setFatPrev] = useState(false); // 18y
  const [novo, setNovo] = useState(false);     // 14b.3.1: novo contrato (CNPJ primeiro)
  const [dataEq, setDataEq] = useState(null);  // 14d.3: { id (locação), inicio } — mudar a data de saída
  const [clienteAbrir, setClienteAbrir] = useState(null); // 14d.3: abrir o cadastro do cliente a partir do contrato
  const [busca, setBusca] = useState("");
  const [abertoId, setAbertoId] = useState(null);
  const [form, setForm] = useState(null);       // novo / editar contrato
  useEffect(() => { if (form?.tipo === "armazenagem" && refArm === undefined) apiService.get("/patio/areas").then((r) => { const ps = (r.areas || []).map((x) => x.preco_ref_m2_mes).filter((x) => x != null); setRefArm(ps.length ? Math.max(...ps) : null); }).catch(() => setRefArm(null)); }, [form?.tipo]); // eslint-disable-line
  // 18d: 📏 medição
  const [filtroOc, setFiltroOc] = useState(null);     // 18h: aba Ocorrências filtrada por contrato
  const [filtroMed, setFiltroMed] = useState(null);   // 18d.5: abrir a aba Medições já filtrada por um contrato
  const [pendMed, setPendMed] = useState([]);         // pendências (aba Contratos)
  const [addEq, setAddEq] = useState(null);     // { equipamento_id, inicio, comRotina, modelo_id, frequencia }
  const [acesso, setAcesso] = useState(null);   // { nome, email, senha, telefone }
  const [confirmar, setConfirmar] = useState(null);
  const [pausar, setPausar] = useState(null);   // usuários sem contrato ativo depois de encerrar
  const [ocupado, setOcupado] = useState(false);
  const ok = (t) => setAviso({ tipo: "ok", texto: t });
  const err = (t) => setAviso({ tipo: "erro", texto: t });
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 6000); return () => clearTimeout(t); }, [aviso]);

  const carregar = async () => {
    try { setD(await apiService.get("/contratos")); setSemMigration(false); }
    catch (e) { if (/043/.test(e.message || "")) setSemMigration(true); else err(e.message); }
    try { setPainel(await apiService.get("/inspecoes/painel")); } catch { /* sem acesso às inspeções: segue sem */ }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  useEffect(() => { if (abrirContrato?.id != null && d) { const k = (d.contratos || []).find((c) => String(c.id) === String(abrirContrato.id)); if (k) setAbertoId(k.id); } }, [abrirContrato, d]); // 18b.7: veio do Cliente 360°

  const editar = !!d?.pode_editar;
  const lista = useMemo(() => (d?.contratos || []).filter((c) => (filtro === "todos" || (filtro === "abertos" ? faseDe(c) !== "encerrado" : faseDe(c) === filtro)) && (!busca.trim() || semAcento(`${c.numero} ${c.cliente} ${c.local || ""} ${c.equipamentos.map((e) => e.tag).join(" ")}`).includes(semAcento(busca.trim())))), [d, filtro, busca]);
  const aberto = (d?.contratos || []).find((c) => c.id === abertoId) || null;
  const carregarPend = async () => { try { setPendMed((await apiService.get("/contratos/medicoes/pendencias")).pendencias || []); } catch { setPendMed([]); } };
  useEffect(() => { carregarPend(); }, []); // eslint-disable-line
  // 18h.3: contador de ocorrências em aberto na aba (paradas em destaque)
  const [ocAbertas, setOcAbertas] = useState({ n: 0, paradas: 0 });
  const carregarOc = async () => { if (!moduloAtivo("ocorrencias")) return; try { const l = (await apiService.get("/ocorrencias", { status: "abertas" })).ocorrencias || []; setOcAbertas({ n: l.length, paradas: l.filter((o) => o.parado).length }); } catch { setOcAbertas({ n: 0, paradas: 0 }); } };
  useEffect(() => { carregarOc(); }, [aba]); // eslint-disable-line
  const [ocAbrir, setOcAbrir] = useState(null); // 18h.3.2: veio da tarefa TSK-MT
  useEffect(() => { if (abrirOcorrencia?.id != null) { setFiltroOc(null); setAba("ocorrencias"); setOcAbrir(abrirOcorrencia.id); } }, [abrirOcorrencia]);
  const paraEnviar = pendMed.filter((x) => ["aberta", "devolvida"].includes(x.status)).length; // 18d.5: contador da aba

  const modelos = (painel?.modelos || []).filter((m) => m.ativo !== false);
  const naBase = (painel?.equipamentos || []).filter((e) => e.situacao !== "locado");
  const acao = async (fn, msg) => { setOcupado(true); try { const r = await fn(); if (msg) ok(typeof msg === "function" ? msg(r) : msg); await carregar(); return r; } catch (e) { err(e.message); return null; } finally { setOcupado(false); } };

  const modal = (conteudo, fechar, largura = 640, z = 300) => (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: z, padding: 16, overflowY: "auto" }} onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: largura, maxWidth: "100%", padding: "18px 20px", margin: "auto 0", boxShadow: "0 24px 48px #00000060" }}>{conteudo}</div>
    </div>
  );
  const bt = (cor, cheio = true) => ({ ...s.btn(true, cor), cursor: "pointer", padding: "6px 11px", fontSize: 12, ...(cheio ? {} : { background: "transparent", color: cor }) });
  const campo = (rot, el, flex = "1 1 160px") => <label style={{ flex, display: "block" }}><span style={s.label}>{rot}</span>{el}</label>;
  const inp = (obj, set, k, extra = {}) => <input value={obj[k] ?? ""} onChange={(e) => set({ ...obj, [k]: e.target.value })} style={s.input} {...extra} />;

  if (semMigration) return <div style={{ padding: 24 }}><div style={{ ...s.card, padding: 20, color: C.warn }}>Rode a migration <b>043_contratos_locatario.sql</b> no Supabase para usar os contratos.</div></div>;

  return (
    <div style={{ padding: "20px 22px", maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>📑 Contratos de locação</div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Cliente, nº, equipamento…" style={{ ...s.input, width: 240 }} />
        {editar && aba === "contratos" && <button type="button" onClick={() => setNovo("locacao")} style={bt(C.accent)}>＋ {moduloAtivo("patio_cliente") ? "Contrato de locação" : "Novo contrato"}</button>}
        {editar && aba === "contratos" && moduloAtivo("patio_cliente") && <button type="button" onClick={() => setNovo("armazenagem")} style={bt(C.accent)}>＋ 📦 Contrato de armazenagem</button>}
      </div>
      {aviso && <div style={{ ...s.card, padding: "10px 14px", marginBottom: 12, fontSize: 13, borderColor: aviso.tipo === "erro" ? C.danger : C.success, color: aviso.tipo === "erro" ? C.danger : C.success }}>{aviso.texto}</div>}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>{/* 18h.4: abas numa linha (rola no celular) */}
        {[["contratos", "📑 Contratos"], ...(moduloAtivo("medicao") ? [["medicoes", <>📏 Medições{paraEnviar > 0 && <span style={{ marginLeft: 6, background: C.danger, color: "#fff", borderRadius: 10, padding: "0 7px", fontSize: 11.5, fontWeight: 700 }}>{paraEnviar}</span>}</>]] : []), ...(moduloAtivo("ocorrencias") ? [["ocorrencias", <>⚠️ Ocorrências{ocAbertas.n > 0 && <span title={ocAbertas.paradas ? `${ocAbertas.n} em aberto · ${ocAbertas.paradas} com equipamento parado` : `${ocAbertas.n} em aberto`} style={{ marginLeft: 6, background: C.danger, color: "#fff", borderRadius: 10, padding: "0 7px", fontSize: 11.5, fontWeight: 700 }}>{ocAbertas.n}</span>}</>]] : []), ["clientes", "👥 Clientes"], ["modelos", "📄 Modelos de contrato"]].map(([k, l]) => <button key={k} type="button" onClick={() => { setAba(k); if (k === "ocorrencias") setFiltroOc(null); }} style={{ whiteSpace: "nowrap", flexShrink: 0, background: "transparent", border: "none", borderBottom: `2px solid ${aba === k ? C.accent : "transparent"}`, padding: "8px 12px", color: aba === k ? C.text : C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}
      </div>
      {fatPrev && <FaturamentoPrevisto C={C} s={s} onFechar={() => setFatPrev(false)} onAbrirContrato={(id) => { setFatPrev(false); setAbertoId(id); }} />}
      {aba === "clientes" && <AbaClientes C={C} s={s} editar={editar} onErro={err} onOk={ok} abrirId={clienteAbrir} onAberto={() => setClienteAbrir(null)} />}
      {aba === "modelos" && <AbaModelos C={C} s={s} editar={editar} onErro={err} onOk={ok} />}
      {aba === "ocorrencias" && <>{filtroOc && <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 8 }}>Contrato {filtroOc.numero} · <button type="button" onClick={() => setFiltroOc(null)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0, fontSize: 12.5 }}>ver todos</button></div>}
        <PainelOcorrencias C={C} s={s} modo="empresa" podeEditar={editar} filtro={filtroOc ? { contrato_id: filtroOc.id } : {}} onErro={err} onOk={ok} onMudou={carregarOc} abrirId={ocAbrir} onAberto={() => setOcAbrir(null)} /></>}{/* 18h */}
      {aba === "medicoes" && <AbaMedicoes C={C} s={s} editar={editar} filtroContrato={filtroMed} onFiltroUsado={() => setFiltroMed(null)} onMudou={carregarPend} onErro={err} onOk={ok} />}{/* 18d.5 */}
      {aba === "contratos" && <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setFatPrev(true)} style={{ ...s.btn(false), padding: "5px 12px", fontSize: 12.5, marginLeft: "auto", order: 99 }}>📈 Faturamento previsto</button>{/* 18y */}
        {[["abertos", "Abertos"], ["elaboracao", "📝 Em elaboração"], ["aguardando_aceite", "⏳ Aguardando aceite"], ["andamento", "✅ Em andamento"], ["encerrado", "🏁 Encerrados"], ["todos", "Todos"]].map(([k, l]) => <button key={k} type="button" onClick={() => setFiltro(k)} style={{ ...s.btn(filtro === k, C.accent), cursor: "pointer", padding: "5px 12px", fontSize: 12, color: filtro === k ? "#fff" : C.text }}>{l}</button>)}
      </div>}
      {aba === "contratos" && paraEnviar > 0 && <div className="qf-clicavel" onClick={() => setAba("medicoes")} style={{ fontSize: 13, color: C.accent, marginBottom: 10, cursor: "pointer" }}>📏 {paraEnviar} medição(ões) para revisar e enviar ›</div>}{/* 18d.5 */}
      {aba !== "contratos" ? null : !d ? <div style={{ color: C.muted }}>Carregando…</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
          {lista.map((c) => (
            <div key={c.id} onClick={() => setAbertoId(c.id)} style={{ ...s.card, padding: 14, cursor: "pointer", opacity: c.status === "ativo" ? 1 : 0.65, borderColor: c.atrasadas ? C.danger : C.border }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{c.cliente}</div><div style={{ fontSize: 12, color: C.textSub }}>{c.numero}{c.local ? ` · ${c.local}` : ""}</div></div>
                <span style={s.tag(FASE[faseDe(c)][1])}>{FASE[faseDe(c)][0]}</span>{c.tipo === "armazenagem" && <span style={{ ...s.tag(C.accent), marginLeft: 4 }} title="Contrato de armazenagem — área no pátio">📦 ARMAZENAGEM</span>}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{dataBR(c.inicio)} → {c.status === "ativo" ? (c.fim_previsto ? dataBR(c.fim_previsto) : "sem prazo") : dataBR(c.fim_real)}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <span style={s.tag(C.accent)}>🚜 {c.ativos} equipamento(s)</span>
                <span style={s.tag(c.acessos.length ? C.violet || "#a855f7" : C.muted)}>👤 {c.acessos.length} acesso(s)</span>
                {c.atrasadas > 0 && <span style={s.tag(C.danger)}>⚠ {c.atrasadas} inspeção(ões) atrasada(s)</span>}
              </div>
            </div>
          ))}
          {lista.length === 0 && <div style={{ color: C.muted }}>{(d.contratos || []).length ? "Nenhum contrato neste filtro." : "Nenhum contrato ainda."}</div>}
        </div>
      )}

      {aberto && !form && !novo && !addEq && !acesso && !confirmar && !pausar && modal(<>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>📑 {aberto.numero} — {aberto.cliente}</div>
          <span style={s.tag(FASE[faseDe(aberto)][1])}>{FASE[faseDe(aberto)][0]}</span>{aberto.tipo === "armazenagem" && <span style={{ ...s.tag(C.accent), marginLeft: 6 }}>📦 ARMAZENAGEM</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px 14px", fontSize: 12, marginTop: 12 }}>
          {[["CNPJ / CPF", aberto.cliente_doc ? mascaraDoc(aberto.cliente_doc) : null], ["Local / obra", aberto.local], ["Início", dataBR(aberto.inicio)],
            ["Término", aberto.fim_previsto ? dataBR(aberto.fim_previsto) : "sem prazo"], ...(aberto.status !== "ativo" ? [["Encerrado em", `${dataBR(aberto.fim_real)}${aberto.encerrado_por_nome ? ` por ${aberto.encerrado_por_nome}` : ""}`]] : []), ["Criado por", aberto.criado_por_nome]]
            .map(([l, v]) => <div key={l}><div style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>{l.toUpperCase()}</div>{v || "—"}</div>)}
        </div>
        {/* 14d.4: contato separado — dados conforme o cadastro */}
        <div style={{ marginTop: 12, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 6 }}>CONTATO <span style={{ fontWeight: 400 }}>· dados conforme cadastro</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "6px 14px", fontSize: 12 }}>
            {[["Nome", aberto.contato_nome], ["E-mail", aberto.contato_email], ["Telefone", aberto.contato_telefone ? telefoneExibir(aberto.contato_telefone) : null]]
              .map(([l, v]) => <div key={l}><div style={{ fontSize: 10, color: C.muted }}>{l}</div><span style={{ wordBreak: "break-word" }}>{v || "—"}</span></div>)}
          </div>
        </div>
        {aberto.cliente_id && editar && <div style={{ marginTop: 8 }}><button type="button" onClick={() => { setClienteAbrir(aberto.cliente_id); setAbertoId(null); setAba("clientes"); }} className="qf-clicavel" style={{ background: "none", border: "none", color: C.textSub, fontSize: 12, textDecoration: "underline", padding: 0 }}>✏ Editar o cadastro do cliente (nome, endereço, contato)</button></div>}
        {aberto.obs && <div style={{ fontSize: 13, marginTop: 8, whiteSpace: "pre-wrap" }}>{aberto.obs}</div>}

        {aberto.tipo !== "armazenagem" && <>{/* 18zb: armazenagem não tem equipamentos locados nem mobilização */}
        <MobilizacaoContrato C={C} s={s} contrato={aberto} editar={editar} onOk={ok} onErro={err} />{/* 18y */}
        <div style={{ display: "flex", alignItems: "center", marginTop: 16, marginBottom: 6 }}>
          <div style={{ fontWeight: 700, flex: 1 }}>🚜 Equipamentos</div>
          {editar && aberto.status === "ativo" && <button type="button" onClick={() => setAddEq({ equipamento_id: naBase[0]?.id || "", inicio: hoje(), fim_previsto: aberto.fim_previsto ? String(aberto.fim_previsto).slice(0, 10) : "", comRotina: true, modelo_id: modelos.find((m) => m.tipo === "equipamento" && m.frequencia !== "pre_uso")?.id || modelos[0]?.id || "", frequencia: "semanal" })} style={bt(C.accent, false)}>＋ Equipamento</button>}
        </div>
        {aberto.equipamentos.map((e) => (
          <div key={e.locacao_id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}`, opacity: e.ativa ? 1 : 0.6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px", fontSize: 13 }}><b>{e.tag}</b> — {e.nome}{e.bloqueado && <span style={{ ...s.tag(C.danger), marginLeft: 6 }}>⛔ BLOQUEADO</span>}
                {e.ativa && String(e.inicio).slice(0, 10) > hoje() && <span style={{ ...s.tag(C.warn), marginLeft: 6 }} title="O equipamento só entra nas medições a partir desta data — confira se o ano está certo">⏳ começa em {dataBR(e.inicio)}</span>}{/* 18d.4 */}
                <div style={{ fontSize: 11, color: C.muted }}>{e.ativa ? `início ${dataBR(e.inicio)} · término ${e.fim_previsto ? dataBR(e.fim_previsto) : "sem prazo"}` : `devolvido em ${dataBR(e.fim_real)}`}{e.valor_mensal != null ? ` · ${Number(e.valor_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês` : e.ativa ? " · sem valor mensal" : ""}{e.entrega_inspecao_id ? " · ✓ entrega" : e.ativa ? " · sem inspeção de entrega" : ""}{e.devolucao_inspecao_id ? " · ✓ devolução" : ""}</div></div>
              {e.ativa && editar && (dataEq?.id === e.locacao_id
                ? <span style={{ display: "flex", gap: 4, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <label style={{ fontSize: 10, color: C.muted }}>INÍCIO<input type="date" value={dataEq.inicio} onChange={(x) => setDataEq({ ...dataEq, inicio: x.target.value })} style={{ ...s.input, width: 145, padding: "5px 8px", display: "block" }} /></label>
                    <label style={{ fontSize: 10, color: C.muted }}>TÉRMINO<input type="date" value={dataEq.fim_previsto} onChange={(x) => setDataEq({ ...dataEq, fim_previsto: x.target.value })} style={{ ...s.input, width: 145, padding: "5px 8px", display: "block" }} /></label>
                    <button type="button" onClick={async () => { const r = await acao(() => apiService.put(`/contratos/${aberto.id}/equipamentos/${e.equipamento_id}`, { inicio: dataEq.inicio, fim_previsto: dataEq.fim_previsto || null }), "Início e término do equipamento alterados."); if (r) setDataEq(null); }} style={bt(C.accent)}>OK</button>
                    <button type="button" onClick={() => setDataEq(null)} style={bt(C.muted, false)}>✕</button></span>
                : <button type="button" onClick={() => setDataEq({ id: e.locacao_id, inicio: String(e.inicio).slice(0, 10), fim_previsto: e.fim_previsto ? String(e.fim_previsto).slice(0, 10) : "" })} title="Mudar o início e o término deste equipamento" style={bt(C.accent, false)}>📅 Datas</button>)}
              {e.ativa && editar && !e.entrega_inspecao_id && <button type="button" onClick={() => setConfirmar({ titulo: `Tirar ${e.tag} do contrato?`, texto: "Para equipamento lançado por engano ou que o cliente desistiu antes de sair: a locação é apagada (sem devolução) e o equipamento volta para 🏠 Na base. Se já houve inspeção, use 🏠 Devolver.", cor: C.danger, rotulo: "Tirar do contrato",
                acao: () => apiService.delete(`/contratos/${aberto.id}/equipamentos/${e.equipamento_id}`), msg: `${e.tag} saiu do contrato.` })} style={bt(C.danger, false)}>✖ Tirar</button>}
              {e.ativa && editar && <button type="button" onClick={() => setConfirmar({ titulo: `Devolver ${e.tag}?`, texto: "O equipamento volta para 🏠 Na base e a rotina do locatário para. Faça a inspeção de devolução antes (o relatório compara com a entrega).", cor: C.success, rotulo: "Devolver",
                acao: () => apiService.post(`/contratos/${aberto.id}/equipamentos/${e.equipamento_id}/devolver`, { fim_real: hoje() }), msg: `${e.tag} devolvido — na base.` })} style={bt(C.success, false)}>🏠 Devolver</button>}
            </div>
            {e.rotinas.map((r) => <div key={r.id} style={{ fontSize: 11, color: corEstado(C, r), marginTop: 2 }}>⏰ {r.frequencia_nome} · {r.modelo_nome} · {r.responsavel_nome} — <b>{txtEstado(r)}</b></div>)}
          </div>
        ))}
        {aberto.equipamentos.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "6px 0" }}>Nenhum equipamento neste contrato.</div>}
        </>}
        {aberto.tipo === "armazenagem" && <GuardaContrato C={C} s={s} contrato={aberto} editar={editar} onEditar={() => setForm({ ...vazio(), ...aberto, fim_previsto: aberto.fim_previsto || "" })} />}

        <div style={{ marginTop: 14 }}><button type="button" onClick={() => { setFiltroMed(aberto.id); setAbertoId(null); setAba("medicoes"); }} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, padding: 0 }}>📏 Ver medições deste contrato ›</button>
          <button type="button" onClick={() => { setFiltroOc({ id: aberto.id, numero: aberto.numero }); setAbertoId(null); setAba("ocorrencias"); }} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, padding: 0, marginLeft: 14 }}>⚠️ Ocorrências ›</button>{/* 18h */}
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>ciclo {aberto.medicao_dia_inicio ? `do dia ${aberto.medicao_dia_inicio}` : "mês do calendário"}{aberto.medicao_vencimento_dia ? ` · vencimento dia ${String(aberto.medicao_vencimento_dia).padStart(2, "0")}` : ""}</span></div>{/* 18d.5 */}

        <DocumentoContrato C={C} s={s} contrato={aberto} editar={editar} onErro={err} onOk={ok} onMudou={carregar} />

        <div style={{ display: "flex", alignItems: "center", marginTop: 16, marginBottom: 6 }}>
          <div style={{ fontWeight: 700, flex: 1 }}>👤 Acessos do locatário</div>
          {editar && aberto.status === "ativo" && <button type="button" onClick={() => setAcesso({ nome: aberto.contato_nome || "", email: aberto.contato_email || "", senha: "", telefone: aberto.contato_telefone || "" })} style={bt(C.accent, false)}>＋ Acesso</button>}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Quem tem acesso entra no QuotaFlow e vê <b>só os contratos dele</b>: equipamentos, inspeções pendentes, fazer a inspeção e o histórico. Não conta na cobrança.</div>
        {aberto.acessos.map((a) => (
          <div key={a.usuario_id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>{a.nome} <span style={{ color: C.muted }}>· {a.email}</span></div>
            <span style={s.tag(a.ativo ? C.success : C.muted)}>{a.ativo ? "ATIVO" : "PAUSADO"}</span>
            {editar && <button type="button" onClick={() => acao(() => apiService.post(`/contratos/usuarios/${a.usuario_id}/pausar`, { ativo: !a.ativo }), a.ativo ? `${a.nome} pausado — não entra mais.` : `${a.nome} reativado.`)} style={bt(a.ativo ? C.warn : C.success, false)}>{a.ativo ? "⏸ Pausar" : "▶ Reativar"}</button>}
            {editar && <button type="button" onClick={() => setConfirmar({ titulo: `Tirar o acesso de ${a.nome} a este contrato?`, texto: "Ele deixa de ver este contrato. O usuário continua existindo (se tiver outros contratos, segue vendo esses).", cor: C.danger, rotulo: "Tirar acesso",
              acao: () => apiService.delete(`/contratos/${aberto.id}/acessos/${a.usuario_id}`), msg: "Acesso retirado." })} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer" }}>🗑</button>}
          </div>
        ))}
        {aberto.acessos.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "6px 0" }}>Nenhum acesso ainda.</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18, flexWrap: "wrap" }}>
          {onAbrirInspecoes && <button type="button" onClick={onAbrirInspecoes} style={{ ...bt(C.textSub, false), marginRight: "auto" }}>🔍 Ir para Inspeções</button>}
          {editar && aberto.status === "ativo" && <button type="button" onClick={() => setForm({ ...vazio(), ...aberto, fim_previsto: aberto.fim_previsto || "" })} style={bt(C.accent, false)}>Editar</button>}
          {editar && aberto.status === "ativo" && <button type="button" onClick={() => setConfirmar({ titulo: `Encerrar o contrato ${aberto.numero}?`, texto: `${aberto.ativos ? `Os ${aberto.ativos} equipamento(s) ainda locados voltam para 🏠 Na base. ` : ""}As rotinas do locatário param. Faça as inspeções de devolução antes.`, cor: C.danger, rotulo: "Encerrar",
            acao: () => apiService.post(`/contratos/${aberto.id}/encerrar`, { fim_real: hoje() }), msg: "Contrato encerrado.", depois: (r) => { if (r?.sem_contrato?.length) setPausar(r.sem_contrato); } })} style={bt(C.danger, false)}>Encerrar contrato</button>}
          <button type="button" onClick={() => setAbertoId(null)} style={bt(C.accent)}>Fechar</button>
        </div>
      </>, () => setAbertoId(null), 760)}

      {form && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{form.id ? `Editar ${form.numero}` : "Novo contrato de locação"}</div>
        <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8 }}>Cliente: <b>{form.cliente}</b>{form.cliente_doc ? ` · ${mascaraDoc(form.cliente_doc)}` : ""} <span style={{ color: C.muted }}>(dados do cliente: aba 👥 Clientes)</span></div>
        <div>{campo("LOCAL / OBRA", inp(form, setForm, "local", { placeholder: "Obra BR-101, km 230 — Campos/RJ" }), "1 1 100%")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{campo("CONTATO", inp(form, setForm, "contato_nome"))}{campo("E-MAIL", inp(form, setForm, "contato_email", { type: "email" }))}{campo("TELEFONE", <CampoTelefone value={form.contato_telefone || ""} onChange={(v) => setForm({ ...form, contato_telefone: v || "" })} C={C} />, "1 1 200px")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{campo("TÉRMINO (OPCIONAL)", inp(form, setForm, "fim_previsto", { type: "date" }))}</div>
        {form.id && <div style={{ ...s.card, background: C.bg, padding: "10px 12px", marginTop: 10 }}>{/* 18d: medição e inspeções */}
          <div style={{ ...s.label, marginBottom: 6 }}>📏 MEDIÇÃO E INSPEÇÕES</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
            <span>Ciclo de medição:</span>
            <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={!form.medicao_dia_inicio} onChange={(e) => setForm({ ...form, medicao_dia_inicio: e.target.checked ? "" : 10 })} /> Mês do calendário (dia 1 ao último dia)</label>
            {!!form.medicao_dia_inicio && <label style={{ display: "flex", gap: 6, alignItems: "center" }}>começa no dia <input type="number" min={2} max={28} value={form.medicao_dia_inicio} onChange={(e) => setForm({ ...form, medicao_dia_inicio: e.target.value })} style={{ ...s.input, width: 70, padding: "4px 6px" }} />
              <span style={{ color: C.muted }}>(ex.: 10 → do dia 10 ao dia 9 do mês seguinte)</span></label>}
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 13 }}>Vencimento da cobrança: dia <input type="number" min={1} max={31} value={form.medicao_vencimento_dia ?? ""} onChange={(e) => setForm({ ...form, medicao_vencimento_dia: e.target.value })} placeholder="ex.: 5" style={{ ...s.input, width: 80, padding: "4px 6px" }} /> <span style={{ color: C.muted }}>(aparece no boletim)</span></label>
          {form.tipo !== "armazenagem" && <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8, fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={!!form.checklist_locatario} onChange={(e) => setForm({ ...form, checklist_locatario: e.target.checked })} style={{ marginTop: 3 }} />
            <span><b>Checklist pelo locatário</b> — as inspeções de rotina dos equipamentos deste contrato ficam com o cliente (ele faz pelo acesso dele). Desmarcado, a empresa faz.</span></label>}
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 6, fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={!!form.medicao_locatario} onChange={(e) => setForm({ ...form, medicao_locatario: e.target.checked })} style={{ marginTop: 3 }} />
            <span><b>Aprovação da medição pelo locatário</b> — o sistema monta a medição de cada ciclo, você revisa e envia, e o cliente aprova (ou comenta na linha do item). Desmarcado, você revisa e fecha sozinho.</span></label>
          {form.tipo === "armazenagem" && <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>{/* 18zb: 📐 condições do contrato de armazenagem (CA) */}
            <div style={{ ...s.label, marginBottom: 6 }}>📐 CONDIÇÕES DA ARMAZENAGEM</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", fontSize: 13 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ ...s.label, marginBottom: 0 }}>PREÇO</span><CampoMoeda value={form.arm_preco == null ? "" : Number(form.arm_preco)} onChange={(v) => setForm({ ...form, arm_preco: v })} placeholder={refArm ? `tabela: ${Number(refArm).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "R$ 0,00"} style={{ ...s.input, width: 140, padding: "6px 8px" }} /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ ...s.label, marginBottom: 0 }}>POR</span><select value={form.arm_unidade || "m2_mes"} onChange={(e) => setForm({ ...form, arm_unidade: e.target.value })} style={{ ...s.input, width: 150, padding: "6px 8px" }}><option value="m2_mes">m² ao mês</option><option value="m2_dia">m² ao dia</option></select></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ ...s.label, marginBottom: 0 }}>ÁREA MÍNIMA (m²)</span><input inputMode="decimal" value={form.arm_minimo_m2 ?? ""} onChange={(e) => setForm({ ...form, arm_minimo_m2: e.target.value })} placeholder="opcional" style={{ ...s.input, width: 130, padding: "6px 8px" }} /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ ...s.label, marginBottom: 0 }}>ÁREA MÁXIMA (m²)</span><input inputMode="decimal" value={form.arm_area_max_m2 ?? ""} onChange={(e) => setForm({ ...form, arm_area_max_m2: e.target.value })} placeholder="opcional" style={{ ...s.input, width: 130, padding: "6px 8px" }} /></label>
              <div style={{ flexBasis: "100%", fontSize: 12, color: C.muted }}>{form.arm_unidade === "m2_dia" ? "Por m² ao dia: m²·dia do ciclo × preço." : "Por m² ao mês: proporcional aos dias do ciclo."} Área mínima: o cliente paga pelo menos ela, mesmo usando menos. Área máxima: passou dela, o pátio avisa e o gestor recebe 🔔 — o excedente é cobrado pelo mesmo preço.{refArm && form.arm_preco == null ? ` Preço de tabela das áreas: ${Number(refArm).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/m²·mês.` : ""}</div>
            </div>
          </div>}
        </div>}
        <label style={{ display: "block", marginTop: 8 }}><span style={s.label}>OBSERVAÇÕES</span><textarea rows={2} value={form.obs || ""} onChange={(e) => setForm({ ...form, obs: e.target.value })} style={{ ...s.input, resize: "vertical" }} /></label>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => setForm(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button type="button" disabled={ocupado} onClick={async () => {
            const { local, contato_nome, contato_email, contato_telefone, fim_previsto, obs, medicao_dia_inicio, medicao_vencimento_dia, checklist_locatario, medicao_locatario, arm_preco, arm_unidade, arm_minimo_m2, arm_area_max_m2 } = form;
            const vz = (x) => (x === "" || x == null ? null : String(x)); // 18zb: condições só no contrato de armazenagem
            const arm = form.tipo === "armazenagem" ? { arm_preco: arm_preco === "" || arm_preco == null ? null : Number(arm_preco), arm_unidade: arm_unidade || "m2_mes", arm_minimo_m2: vz(arm_minimo_m2), arm_area_max_m2: vz(arm_area_max_m2) } : {};
            const r = await acao(() => apiService.put(`/contratos/${form.id}`, { local, contato_nome, contato_email, contato_telefone, fim_previsto: fim_previsto || null, obs, medicao_dia_inicio: medicao_dia_inicio || null, medicao_vencimento_dia: medicao_vencimento_dia === "" || medicao_vencimento_dia == null ? null : Number(medicao_vencimento_dia), checklist_locatario: !!checklist_locatario, medicao_locatario: !!medicao_locatario, ...arm }), "Contrato salvo.");
            if (r) setForm(null);
          }} style={{ ...s.btn(!ocupado, C.accent), flex: 1 }}>Salvar</button>
        </div>
      </>, () => setForm(null), 620, 320)}


      {novo && modal(<FormNovoContrato C={C} s={s} tipo={novo === "armazenagem" ? "armazenagem" : "locacao"} ocupado={ocupado} onErro={err} onCancelar={() => setNovo(false)}
        onSalvar={async (corpo) => { const r = await acao(() => apiService.post("/contratos", corpo), (x) => (x.contrato.tipo === "armazenagem" ? `Contrato ${x.contrato.numero} criado — agora informe preço e áreas em ✎ Editar condições.` : `Contrato ${x.contrato.numero} criado — agora adicione os equipamentos e os acessos.`)); if (r) { setNovo(false); setAbertoId(r.contrato.id); } }} />, () => setNovo(false), 680, 320)}

      {addEq && aberto && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>＋ Equipamento no {aberto.numero}</div>
        {naBase.length === 0 ? <div style={{ fontSize: 13, color: C.muted }}>Nenhum equipamento 🏠 na base disponível.</div> : <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {campo("EQUIPAMENTO (NA BASE)", <select value={addEq.equipamento_id} onChange={(e) => setAddEq({ ...addEq, equipamento_id: e.target.value })} style={s.input}>{naBase.map((e) => <option key={e.id} value={e.id}>{e.tag} — {e.nome}{e.bloqueado ? " (⛔ bloqueado)" : ""}</option>)}</select>, "2 1 240px")}
            {campo("INÍCIO", inp(addEq, setAddEq, "inicio", { type: "date" }))}
            {campo("TÉRMINO", inp(addEq, setAddEq, "fim_previsto", { type: "date" }))}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Vazio = sem prazo{aberto.fim_previsto ? "" : " (o contrato não tem término)"}. Aparece na tabela de equipamentos do contrato.</div>
          <div style={{ ...s.card, padding: 12, marginTop: 12 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={addEq.comRotina} onChange={(e) => setAddEq({ ...addEq, comRotina: e.target.checked })} /><b>Rotina de inspeção pelo locatário</b></label>
            {addEq.comRotina && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {campo("MODELO", <select value={addEq.modelo_id} onChange={(e) => setAddEq({ ...addEq, modelo_id: e.target.value })} style={s.input}>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>, "2 1 220px")}
              {campo("FREQUÊNCIA", <select value={addEq.frequencia} onChange={(e) => setAddEq({ ...addEq, frequencia: e.target.value })} style={s.input}>{Object.entries(FREQ).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>)}
            </div>}
          </div>
          <div style={{ fontSize: 12, color: C.warn, marginTop: 8 }}>💡 Faça a inspeção de entrega antes de o equipamento sair (base da comparação na devolução).</div>
        </>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => setAddEq(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button type="button" disabled={ocupado || !addEq.equipamento_id || (addEq.comRotina && !addEq.modelo_id)} onClick={async () => {
            const r = await acao(() => apiService.post(`/contratos/${aberto.id}/equipamentos`, { equipamento_id: addEq.equipamento_id, inicio: addEq.inicio, fim_previsto: addEq.fim_previsto || null, rotina: addEq.comRotina ? { modelo_id: addEq.modelo_id, frequencia: addEq.frequencia } : null }), "Equipamento locado no contrato.");
            if (r) setAddEq(null);
          }} style={{ ...s.btn(!ocupado && !!addEq.equipamento_id, C.accent), flex: 1 }}>Locar</button>
        </div>
      </>, () => setAddEq(null), 600, 320)}

      {acesso && aberto && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700 }}>👤 Acesso do locatário — {aberto.cliente}</div>
        <div style={{ fontSize: 12, color: C.muted, margin: "4px 0 12px" }}>Cria o usuário com perfil <b>Locatário</b>. Se o e-mail já for de um locatário seu (outro contrato), só liga este contrato a ele.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{campo("NOME", inp(acesso, setAcesso, "nome", { autoFocus: true }), "2 1 220px")}{campo("TELEFONE", <CampoTelefone value={acesso.telefone || ""} onChange={(v) => setAcesso({ ...acesso, telefone: v || "" })} C={C} />, "1 1 200px")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{campo("E-MAIL (LOGIN)", inp(acesso, setAcesso, "email", { type: "email" }), "2 1 220px")}{campo("SENHA TEMPORÁRIA", inp(acesso, setAcesso, "senha", { placeholder: "mín. 6 caracteres" }))}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Passe o e-mail e a senha ao cliente. Ele pode trocar a senha em "Meu perfil".</div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => setAcesso(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button type="button" disabled={ocupado || !acesso.email.trim()} onClick={async () => {
            const r = await acao(() => apiService.post(`/contratos/${aberto.id}/acessos`, acesso), (x) => (x.novo ? `Acesso criado: ${x.usuario.email}` : `${x.usuario.email} agora também vê ${aberto.numero}.`));
            if (r) setAcesso(null);
          }} style={{ ...s.btn(!ocupado && !!acesso.email.trim(), C.accent), flex: 1 }}>Salvar acesso</button>
        </div>
      </>, () => setAcesso(null), 560, 320)}

      {confirmar && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, color: confirmar.cor || C.danger }}>⚠ {confirmar.titulo}</div>
        <div style={{ fontSize: 13, color: C.textSub, marginTop: 10, lineHeight: 1.5 }}>{confirmar.texto}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={() => setConfirmar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
          <button type="button" disabled={ocupado} onClick={async () => { const c = confirmar; setConfirmar(null); const r = await acao(c.acao, c.msg); if (r && c.depois) c.depois(r); }} style={{ ...s.btn(true, confirmar.cor || C.danger), cursor: "pointer", flex: 1 }}>{confirmar.rotulo || "Confirmar"}</button>
        </div>
      </>, () => setConfirmar(null), 460, 330)}

      {pausar && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700 }}>⏸ Pausar os acessos?</div>
        <div style={{ fontSize: 13, color: C.textSub, marginTop: 8 }}>Estes locatários ficaram sem nenhum contrato ativo. Pausado, o usuário não entra mais (dá para reativar depois).</div>
        {pausar.map((u) => <div key={u.usuario_id} style={{ fontSize: 13, padding: "4px 0" }}>👤 {u.nome} · <span style={{ color: C.muted }}>{u.email}</span></div>)}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => setPausar(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Manter ativos</button>
          <button type="button" disabled={ocupado} onClick={async () => { const l = pausar; setPausar(null); await acao(async () => { for (const u of l) await apiService.post(`/contratos/usuarios/${u.usuario_id}/pausar`, { ativo: false }); }, `${l.length} acesso(s) pausado(s).`); }} style={{ ...s.btn(true, C.warn), cursor: "pointer", flex: 1 }}>Pausar</button>
        </div>
      </>, () => setPausar(null), 460, 330)}
    </div>
  );
}
