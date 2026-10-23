// components/contratos/Clientes.jsx — etapa 14b.3.1
// Cadastro de clientes (um por CNPJ/CPF na empresa), usado pelos contratos de locação e, depois, pelas propostas (15a).
//   CampoDocumento — CNPJ/CPF com máscara + 🔍 Buscar: 1º "já é cliente?", 2º Receita (BrasilAPI → CNPJ.ws)
//   FormNovoContrato — CNPJ primeiro → cliente existente (só escolhe datas/obra) ou dados da Receita para conferir
//   AbaClientes / ModalCliente — lista e edição dos clientes
import { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import CampoTelefone from "../shared/CampoTelefone";

export const soDig = (v) => String(v || "").replace(/\D/g, "");
export function mascaraDoc(v) {
  const d = soDig(v).slice(0, 14);
  if (d.length <= 11) return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
const mascaraCep = (v) => soDig(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const campo = (s, rot, el, flex = "1 1 160px") => <label style={{ flex, display: "block" }}><span style={s.label}>{rot}</span>{el}</label>;
const inp = (s, obj, set, k, extra = {}) => <input value={obj[k] ?? ""} onChange={(e) => set({ ...obj, [k]: e.target.value })} style={s.input} {...extra} />;

/** CNPJ/CPF + Buscar. onResultado({ existente, cliente, situacao, sem_receita }) */
function CampoDocumento({ C, s, valor, onValor, onResultado, onErro, autoFocus }) {
  const [buscando, setBuscando] = useState(false);
  const d = soDig(valor);
  const buscar = async () => {
    setBuscando(true);
    try { onResultado(await apiService.get(`/contratos/clientes/consulta/${d}`)); }
    catch (e) { onErro(e.message); } finally { setBuscando(false); }
  };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      {campo(s, "CNPJ / CPF DO CLIENTE", <input value={mascaraDoc(valor)} onChange={(e) => onValor(soDig(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter" && (d.length === 11 || d.length === 14)) buscar(); }}
        inputMode="numeric" placeholder="00.000.000/0000-00" autoFocus={autoFocus} style={s.input} />, "1 1 220px")}
      <button type="button" disabled={buscando || !(d.length === 11 || d.length === 14)} onClick={buscar} style={{ ...s.btn(!buscando && (d.length === 11 || d.length === 14), C.accent), whiteSpace: "nowrap" }}>{buscando ? "Buscando…" : "🔍 Buscar"}</button>
    </div>
  );
}

/** Nota do resultado da busca: dados da Receita / situação (em vermelho se não estiver ATIVA) / CPF / Receita fora do ar */
function NotaReceita({ C, r, doc }) {
  const inativa = r.situacao && r.situacao.toUpperCase() !== "ATIVA";
  return <div style={{ fontSize: 12, marginTop: 8, color: r.sem_receita ? C.warn : inativa ? C.danger : C.success }}>
    {r.sem_receita ? "Receita fora do ar agora — preencha os dados." : soDig(doc).length === 11 ? "CPF — preencha os dados do cliente." : `Dados da Receita${r.situacao ? ` · situação ${r.situacao}` : ""} — confira.`}{inativa ? " ⚠ Atenção: o CNPJ não está ATIVO." : ""}</div>;
}

const vazioCliente = () => ({ nome: "", razao_social: "", documento: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", cep: "", contato_nome: "", contato_email: "", contato_telefone: "", obs: "" });

/** Campos do cliente (novo ou edição) */
function CamposCliente({ C, s, c, setC, comDocumento = false }) {
  return (<>
    {comDocumento && <div style={{ marginBottom: 8 }}>{campo(s, "CNPJ / CPF", <input value={mascaraDoc(c.documento)} onChange={(e) => setC({ ...c, documento: soDig(e.target.value) })} inputMode="numeric" style={s.input} />, "1 1 100%")}</div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{campo(s, "NOME / FANTASIA", inp(s, c, setC, "nome"), "2 1 220px")}{campo(s, "RAZÃO SOCIAL", inp(s, c, setC, "razao_social"), "2 1 220px")}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{campo(s, "ENDEREÇO", inp(s, c, setC, "endereco"), "3 1 240px")}{campo(s, "Nº", inp(s, c, setC, "numero"), "0 1 80px")}{campo(s, "BAIRRO", inp(s, c, setC, "bairro"))}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{campo(s, "CIDADE", inp(s, c, setC, "cidade"), "2 1 180px")}{campo(s, "UF", <input value={c.uf || ""} maxLength={2} onChange={(e) => setC({ ...c, uf: e.target.value.toUpperCase() })} style={s.input} />, "0 1 60px")}
      {campo(s, "CEP", <input value={mascaraCep(c.cep)} onChange={(e) => setC({ ...c, cep: soDig(e.target.value) })} inputMode="numeric" style={s.input} />, "0 1 110px")}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{campo(s, "CONTATO", inp(s, c, setC, "contato_nome"))}{campo(s, "E-MAIL", inp(s, c, setC, "contato_email", { type: "email" }))}
      {campo(s, "TELEFONE", <CampoTelefone value={c.contato_telefone || ""} onChange={(v) => setC({ ...c, contato_telefone: v || "" })} C={C} />, "1 1 200px")}</div>
  </>);
}

/** Novo contrato: CNPJ/CPF primeiro. onSalvar(corpo) → POST /contratos */
export function FormNovoContrato({ C, s, ocupado, onSalvar, onCancelar, onErro }) {
  const [doc, setDoc] = useState("");
  const [res, setRes] = useState(null);            // resultado da busca
  const [semDoc, setSemDoc] = useState(false);
  const [cli, setCli] = useState(vazioCliente());  // cliente novo
  const [k, setK] = useState({ local: "", inicio: hoje(), fim_previsto: "", obs: "", contato_nome: "", contato_email: "", contato_telefone: "" });
  const existente = res?.existente ? res.cliente : null;
  const pronto = existente || ((res || semDoc) && cli.nome.trim());
  const aoBuscar = (r) => {
    setRes(r);
    if (r.existente) setK((x) => ({ ...x, contato_nome: r.cliente.contato_nome || "", contato_email: r.cliente.contato_email || "", contato_telefone: r.cliente.contato_telefone || "" }));
    else setCli({ ...vazioCliente(), ...Object.fromEntries(Object.entries(r.cliente || {}).map(([a, b]) => [a, b ?? ""])) });
  };
  const salvar = () => {
    const base = { local: k.local, inicio: k.inicio, fim_previsto: k.fim_previsto || null, obs: k.obs };
    if (existente) return onSalvar({ ...base, cliente_id: existente.id, contato_nome: k.contato_nome, contato_email: k.contato_email, contato_telefone: k.contato_telefone });
    return onSalvar({ ...base, ...cli, cliente: cli.nome, cliente_nome: cli.nome, cliente_doc: semDoc ? null : cli.documento || doc });
  };
  return (<>
    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Novo contrato de locação</div>
    {!semDoc && <CampoDocumento C={C} s={s} valor={doc} onValor={(v) => { setDoc(v); setRes(null); }} onResultado={aoBuscar} onErro={onErro} autoFocus />}
    {!res && !semDoc && <button type="button" onClick={() => { setSemDoc(true); setCli(vazioCliente()); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", padding: "6px 0" }}>Cliente sem CNPJ/CPF? Preencher na mão ›</button>}
    {existente && <div style={{ ...s.card, padding: 12, marginTop: 10, borderColor: C.success }}>
      <div style={{ color: C.success, fontWeight: 700, fontSize: 13 }}>✓ Já é seu cliente — o contrato usa o mesmo cadastro</div>
      <div style={{ fontSize: 13, marginTop: 4 }}><b>{existente.nome}</b>{existente.razao_social && existente.razao_social !== existente.nome ? ` · ${existente.razao_social}` : ""}</div>
      <div style={{ fontSize: 12, color: C.textSub }}>{[existente.cidade, existente.uf].filter(Boolean).join("/")}{existente.contato_email ? ` · ${existente.contato_email}` : ""}</div>
    </div>}
    {res && !existente && <NotaReceita C={C} r={res} doc={doc} />}
    {((res && !existente) || semDoc) && <div style={{ marginTop: 10 }}><CamposCliente C={C} s={s} c={cli} setC={setCli} /></div>}
    {pronto && <>
      <div style={{ ...s.label, marginTop: 14 }}>DADOS DESTE CONTRATO</div>
      <div>{campo(s, "LOCAL / OBRA", inp(s, k, setK, "local", { placeholder: "Obra BR-101, km 230 — Campos/RJ" }), "1 1 100%")}</div>
      {existente && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{campo(s, "CONTATO NESTE CONTRATO", inp(s, k, setK, "contato_nome"))}{campo(s, "E-MAIL", inp(s, k, setK, "contato_email", { type: "email" }))}
        {campo(s, "TELEFONE", <CampoTelefone value={k.contato_telefone || ""} onChange={(v) => setK({ ...k, contato_telefone: v || "" })} C={C} />, "1 1 200px")}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{campo(s, "INÍCIO", inp(s, k, setK, "inicio", { type: "date" }))}{campo(s, "FIM PREVISTO (OPCIONAL)", inp(s, k, setK, "fim_previsto", { type: "date" }))}</div>
      <label style={{ display: "block", marginTop: 8 }}><span style={s.label}>OBSERVAÇÕES</span><textarea rows={2} value={k.obs} onChange={(e) => setK({ ...k, obs: e.target.value })} style={{ ...s.input, resize: "vertical" }} /></label>
    </>}
    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
      <button type="button" onClick={onCancelar} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
      <button type="button" disabled={ocupado || !pronto} onClick={salvar} style={{ ...s.btn(!ocupado && !!pronto, C.accent), flex: 1 }}>Salvar contrato</button>
    </div>
  </>);
}

export function AbaClientes({ C, s, editar, onErro, onOk, onAbrirContratos }) {
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState(null); // 14b.3.2: resultado da busca (mesma nota do novo contrato)
  const carregar = async () => { try { setLista((await apiService.get("/contratos/clientes")).clientes || []); } catch (e) { onErro(e.message); } };
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  const vis = useMemo(() => (lista || []).filter((c) => !busca.trim() || semAcento(`${c.nome} ${c.razao_social || ""} ${c.documento || ""} ${c.cidade || ""}`).includes(semAcento(busca.trim()))), [lista, busca]);
  const salvar = async () => {
    setOcupado(true); setNota(null);
    try {
      const { id, contratos, contratos_ativos, criado_em, atualizado_em, tenant_id, ativo, ...corpo } = form; // eslint-disable-line no-unused-vars
      if (id) await apiService.put(`/contratos/clientes/${id}`, corpo); else { const r = await apiService.post("/contratos/clientes", corpo); if (r.existente) onOk(`Esse CNPJ/CPF já era do cliente ${r.cliente.nome}.`); }
      setForm(null); onOk("Cliente salvo."); await carregar();
    } catch (e) { onErro(e.message); } finally { setOcupado(false); }
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Nome, CNPJ/CPF, cidade…" style={{ ...s.input, maxWidth: 300 }} />
        {editar && <button type="button" onClick={() => { setNota(null); setForm(vazioCliente()); }} style={{ ...s.btn(true, C.accent), cursor: "pointer" }}>＋ Cliente</button>}
      </div>
      {!lista ? <div style={{ color: C.muted }}>Carregando…</div> : (
        <div style={{ ...s.card, overflow: "hidden" }}>
          {vis.map((c, k) => (
            <div key={c.id} onClick={() => editar && setForm({ ...vazioCliente(), ...Object.fromEntries(Object.entries(c).map(([a, b]) => [a, b ?? ""])) })} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: k < vis.length - 1 ? `1px solid ${C.border}` : "none", cursor: editar ? "pointer" : "default", flexWrap: "wrap" }}>
              <div style={{ flex: "2 1 240px" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{c.nome}</div><div style={{ fontSize: 11, color: C.muted }}>{c.documento ? mascaraDoc(c.documento) : "sem CNPJ/CPF"}{c.cidade ? ` · ${c.cidade}/${c.uf || ""}` : ""}{c.contato_nome ? ` · ${c.contato_nome}` : ""}</div></div>
              <span style={s.tag(c.contratos_ativos ? C.success : C.muted)}>📑 {c.contratos_ativos} ativo(s) · {c.contratos} no total</span>
            </div>
          ))}
          {vis.length === 0 && <div style={{ padding: 20, color: C.muted, textAlign: "center" }}>{(lista || []).length ? "Nenhum cliente na busca." : "Nenhum cliente ainda — eles nascem ao criar um contrato (ou em ＋ Cliente)."}</div>}
        </div>
      )}
      {form && (
        <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 320, padding: 16, overflowY: "auto" }} onClick={() => setForm(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 680, maxWidth: "100%", padding: "18px 20px", margin: "auto 0" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{form.id ? `Cliente — ${form.nome}` : "Novo cliente"}</div>
            {!form.id && <div style={{ marginBottom: 10 }}><CampoDocumento C={C} s={s} valor={form.documento} onValor={(v) => setForm({ ...form, documento: v })} onErro={onErro}
              onResultado={(r) => { if (r.existente) { setNota(null); return onErro(`Já é seu cliente: ${r.cliente.nome}`); } setNota(r); setForm({ ...form, ...Object.fromEntries(Object.entries(r.cliente || {}).map(([a, b]) => [a, b ?? ""])) }); }} />
              {nota && <NotaReceita C={C} r={nota} doc={form.documento} />}</div>}
            <CamposCliente C={C} s={s} c={form} setC={setForm} comDocumento={!!form.id} />
            <label style={{ display: "block", marginTop: 8 }}><span style={s.label}>OBSERVAÇÕES</span><textarea rows={2} value={form.obs || ""} onChange={(e) => setForm({ ...form, obs: e.target.value })} style={{ ...s.input, resize: "vertical" }} /></label>
            {form.id && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Os contratos guardam o nome do cliente de quando foram criados.{onAbrirContratos ? "" : ""}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => setForm(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Cancelar</button>
              <button type="button" disabled={ocupado || !String(form.nome || "").trim()} onClick={salvar} style={{ ...s.btn(!ocupado && !!String(form.nome || "").trim(), C.accent), flex: 1 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
