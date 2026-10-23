// components/contratos/TelaContratos.jsx — etapa 14b.3
// 📑 Contratos de locação (visão da EMPRESA): contrato CL-AAAA-NNNN com os equipamentos locados, as rotinas de inspeção
// (em dia / atrasada), as inspeções de entrega/devolução e os ACESSOS do locatário (perfil "Locatário": e-mail + senha
// temporária — ele entra no QuotaFlow e vê só os contratos dele). Encerrar o contrato devolve os equipamentos e oferece
// pausar os acessos que ficaram sem contrato ativo. Ver: admin, gestor, operação, comprador, qualidade · alterar: admin, gestor.
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import { corEstado, txtEstado } from "../inspecoes/RotinasLocacao";

const FREQ = { diaria: "Diária", semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal" };
const dataBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const vazio = () => ({ cliente: "", cliente_doc: "", local: "", contato_nome: "", contato_email: "", contato_telefone: "", inicio: hoje(), fim_previsto: "", obs: "" });

export default function TelaContratos({ C, s, onAbrirInspecoes }) {
  const [d, setD] = useState(null);
  const [painel, setPainel] = useState(null); // equipamentos e modelos (para adicionar ao contrato)
  const [semMigration, setSemMigration] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [filtro, setFiltro] = useState("ativo");
  const [busca, setBusca] = useState("");
  const [abertoId, setAbertoId] = useState(null);
  const [form, setForm] = useState(null);       // novo / editar contrato
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

  const editar = !!d?.pode_editar;
  const lista = useMemo(() => (d?.contratos || []).filter((c) => (filtro === "todos" || c.status === filtro) && (!busca.trim() || semAcento(`${c.numero} ${c.cliente} ${c.local || ""} ${c.equipamentos.map((e) => e.tag).join(" ")}`).includes(semAcento(busca.trim())))), [d, filtro, busca]);
  const aberto = (d?.contratos || []).find((c) => c.id === abertoId) || null;
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
        {editar && <button type="button" onClick={() => setForm(vazio())} style={bt(C.accent)}>＋ Novo contrato</button>}
      </div>
      {aviso && <div style={{ ...s.card, padding: "10px 14px", marginBottom: 12, fontSize: 13, borderColor: aviso.tipo === "erro" ? C.danger : C.success, color: aviso.tipo === "erro" ? C.danger : C.success }}>{aviso.texto}</div>}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["ativo", "Ativos"], ["encerrado", "Encerrados"], ["todos", "Todos"]].map(([k, l]) => <button key={k} type="button" onClick={() => setFiltro(k)} style={{ ...s.btn(filtro === k, C.accent), cursor: "pointer", padding: "5px 12px", fontSize: 12, color: filtro === k ? "#fff" : C.text }}>{l}</button>)}
      </div>
      {!d ? <div style={{ color: C.muted }}>Carregando…</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
          {lista.map((c) => (
            <div key={c.id} onClick={() => setAbertoId(c.id)} style={{ ...s.card, padding: 14, cursor: "pointer", opacity: c.status === "ativo" ? 1 : 0.65, borderColor: c.atrasadas ? C.danger : C.border }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{c.cliente}</div><div style={{ fontSize: 12, color: C.textSub }}>{c.numero}{c.local ? ` · ${c.local}` : ""}</div></div>
                <span style={s.tag(c.status === "ativo" ? C.success : C.muted)}>{c.status === "ativo" ? "ATIVO" : "ENCERRADO"}</span>
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

      {aberto && !form && !addEq && !acesso && !confirmar && !pausar && modal(<>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>📑 {aberto.numero} — {aberto.cliente}</div>
          <span style={s.tag(aberto.status === "ativo" ? C.success : C.muted)}>{aberto.status === "ativo" ? "ATIVO" : "ENCERRADO"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px 14px", fontSize: 12, marginTop: 12 }}>
          {[["CNPJ / CPF", aberto.cliente_doc], ["Local / obra", aberto.local], ["Contato", [aberto.contato_nome, aberto.contato_email, aberto.contato_telefone].filter(Boolean).join(" · ")], ["Início", dataBR(aberto.inicio)],
            ["Fim previsto", dataBR(aberto.fim_previsto)], ...(aberto.status !== "ativo" ? [["Encerrado em", `${dataBR(aberto.fim_real)}${aberto.encerrado_por_nome ? ` por ${aberto.encerrado_por_nome}` : ""}`]] : []), ["Criado por", aberto.criado_por_nome]]
            .map(([l, v]) => <div key={l}><div style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>{l.toUpperCase()}</div>{v || "—"}</div>)}
        </div>
        {aberto.obs && <div style={{ fontSize: 13, marginTop: 8, whiteSpace: "pre-wrap" }}>{aberto.obs}</div>}

        <div style={{ display: "flex", alignItems: "center", marginTop: 16, marginBottom: 6 }}>
          <div style={{ fontWeight: 700, flex: 1 }}>🚜 Equipamentos</div>
          {editar && aberto.status === "ativo" && <button type="button" onClick={() => setAddEq({ equipamento_id: naBase[0]?.id || "", inicio: hoje(), comRotina: true, modelo_id: modelos.find((m) => m.tipo === "equipamento" && m.frequencia !== "pre_uso")?.id || modelos[0]?.id || "", frequencia: "semanal" })} style={bt(C.accent, false)}>＋ Equipamento</button>}
        </div>
        {aberto.equipamentos.map((e) => (
          <div key={e.locacao_id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}`, opacity: e.ativa ? 1 : 0.6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px", fontSize: 13 }}><b>{e.tag}</b> — {e.nome}{e.bloqueado && <span style={{ ...s.tag(C.danger), marginLeft: 6 }}>⛔ BLOQUEADO</span>}
                <div style={{ fontSize: 11, color: C.muted }}>{e.ativa ? `desde ${dataBR(e.inicio)}` : `devolvido em ${dataBR(e.fim_real)}`}{e.entrega_inspecao_id ? " · ✓ entrega" : e.ativa ? " · sem inspeção de entrega" : ""}{e.devolucao_inspecao_id ? " · ✓ devolução" : ""}</div></div>
              {e.ativa && editar && <button type="button" onClick={() => setConfirmar({ titulo: `Devolver ${e.tag}?`, texto: "O equipamento volta para 🏠 Na base e a rotina do locatário para. Faça a inspeção de devolução antes (o relatório compara com a entrega).", cor: C.success, rotulo: "Devolver",
                acao: () => apiService.post(`/contratos/${aberto.id}/equipamentos/${e.equipamento_id}/devolver`, { fim_real: hoje() }), msg: `${e.tag} devolvido — na base.` })} style={bt(C.success, false)}>🏠 Devolver</button>}
            </div>
            {e.rotinas.map((r) => <div key={r.id} style={{ fontSize: 11, color: corEstado(C, r), marginTop: 2 }}>⏰ {r.frequencia_nome} · {r.modelo_nome} · {r.responsavel_nome} — <b>{txtEstado(r)}</b></div>)}
          </div>
        ))}
        {aberto.equipamentos.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "6px 0" }}>Nenhum equipamento neste contrato.</div>}

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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{campo("CLIENTE (LOCATÁRIO)", inp(form, setForm, "cliente", { autoFocus: true }), "2 1 240px")}{campo("CNPJ / CPF", inp(form, setForm, "cliente_doc"))}</div>
        <div style={{ marginTop: 8 }}>{campo("LOCAL / OBRA", inp(form, setForm, "local", { placeholder: "Obra BR-101, km 230 — Campos/RJ" }), "1 1 100%")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{campo("CONTATO", inp(form, setForm, "contato_nome"))}{campo("E-MAIL", inp(form, setForm, "contato_email", { type: "email" }))}{campo("TELEFONE", inp(form, setForm, "contato_telefone", { inputMode: "tel" }))}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{!form.id && campo("INÍCIO", inp(form, setForm, "inicio", { type: "date" }))}{campo("FIM PREVISTO (OPCIONAL)", inp(form, setForm, "fim_previsto", { type: "date" }))}</div>
        <label style={{ display: "block", marginTop: 8 }}><span style={s.label}>OBSERVAÇÕES</span><textarea rows={2} value={form.obs || ""} onChange={(e) => setForm({ ...form, obs: e.target.value })} style={{ ...s.input, resize: "vertical" }} /></label>
        {!form.id && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>O número (CL-{hoje().slice(0, 4)}-…) é gerado ao salvar. Depois, adicione os equipamentos e os acessos do locatário.</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => setForm(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
          <button type="button" disabled={ocupado || !form.cliente.trim()} onClick={async () => {
            const { id, numero, equipamentos, acessos, ativos, atrasadas, status, criado_em, tenant_id, criado_por_nome, encerrado_por_nome, fim_real, ...corpo } = form; // eslint-disable-line no-unused-vars
            const r = await acao(() => (id ? apiService.put(`/contratos/${id}`, corpo) : apiService.post("/contratos", corpo)), id ? "Contrato salvo." : (x) => `Contrato ${x.contrato.numero} criado.`);
            if (r) { setForm(null); if (!id) setAbertoId(r.contrato.id); }
          }} style={{ ...s.btn(!ocupado && !!form.cliente.trim(), C.accent), flex: 1 }}>Salvar</button>
        </div>
      </>, () => setForm(null), 620, 320)}

      {addEq && aberto && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>＋ Equipamento no {aberto.numero}</div>
        {naBase.length === 0 ? <div style={{ fontSize: 13, color: C.muted }}>Nenhum equipamento 🏠 na base disponível.</div> : <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {campo("EQUIPAMENTO (NA BASE)", <select value={addEq.equipamento_id} onChange={(e) => setAddEq({ ...addEq, equipamento_id: e.target.value })} style={s.input}>{naBase.map((e) => <option key={e.id} value={e.id}>{e.tag} — {e.nome}{e.bloqueado ? " (⛔ bloqueado)" : ""}</option>)}</select>, "2 1 240px")}
            {campo("SAI EM", inp(addEq, setAddEq, "inicio", { type: "date" }))}
          </div>
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
            const r = await acao(() => apiService.post(`/contratos/${aberto.id}/equipamentos`, { equipamento_id: addEq.equipamento_id, inicio: addEq.inicio, rotina: addEq.comRotina ? { modelo_id: addEq.modelo_id, frequencia: addEq.frequencia } : null }), "Equipamento locado no contrato.");
            if (r) setAddEq(null);
          }} style={{ ...s.btn(!ocupado && !!addEq.equipamento_id, C.accent), flex: 1 }}>Locar</button>
        </div>
      </>, () => setAddEq(null), 600, 320)}

      {acesso && aberto && modal(<>
        <div style={{ fontSize: 16, fontWeight: 700 }}>👤 Acesso do locatário — {aberto.cliente}</div>
        <div style={{ fontSize: 12, color: C.muted, margin: "4px 0 12px" }}>Cria o usuário com perfil <b>Locatário</b>. Se o e-mail já for de um locatário seu (outro contrato), só liga este contrato a ele.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{campo("NOME", inp(acesso, setAcesso, "nome", { autoFocus: true }), "2 1 220px")}{campo("TELEFONE", inp(acesso, setAcesso, "telefone", { inputMode: "tel" }))}</div>
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
