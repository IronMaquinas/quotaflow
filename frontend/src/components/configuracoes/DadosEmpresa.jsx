// frontend/src/components/configuracoes/DadosEmpresa.jsx — etapa 14d.4 / 14d.5
// ⚙️ Configurações → 🏢 Empresa → Dados cadastrais.
//   • CEP primeiro: com 8 dígitos busca rua, bairro e cidade (BrasilAPI) e pula para o Número. Tudo continua editável.
//   • 🔍 Buscar na Receita: completa os campos VAZIOS com os dados do CNPJ da empresa (não apaga o que já foi digitado).
//   • CNPJ travado depois de informado — só a administração do QuotaFlow troca (Console, com motivo, fica no histórico).
//   • 🕓 Histórico de alterações: campo, antes → depois, quem e quando.
// Vão no contrato ({{empresa.endereco_completo}}, {{empresa.telefone}}, {{empresa.email}}). Editar: admin ou gestor.
// 15a: Inscrição estadual (números ou ISENTO) e Opção fiscal — vão na "Identificação" do BID (📈 Comercial).
import { useState, useEffect, useRef } from "react";
import apiService from "../../services/apiService";
import CampoTelefone, { telefoneExibir } from "../shared/CampoTelefone";

const mCNPJ = (v) => String(v || "").replace(/\D/g, "").slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
const mCEP = (v) => String(v || "").replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
const ORIGEM = { empresa: "", plataforma: " · pela administração do QuotaFlow", banco: " · direto no banco" };
const valorHist = (campo, v) => (v == null || v === "" ? "(vazio)" : campo === "cnpj" ? mCNPJ(v) : campo === "cep" ? mCEP(v) : campo === "telefone" ? telefoneExibir(v) : v);

export default function DadosEmpresa({ C, s, onErro, onSalvo }) {
  const [f, setF] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null); // { tipo: ok|aviso, texto }
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoRf, setBuscandoRf] = useState(false);
  const [hist, setHist] = useState(null); // null = fechado
  const refNumero = useRef(null);
  const ultimoCep = useRef("");

  const carregar = () => apiService.get("/configuracoes/empresa/dados").then((r) => setF({ ...r, cnpj: mCNPJ(r?.cnpj), cep: mCEP(r?.cep) })).catch((e) => onErro?.(e.message || "Erro ao carregar os dados da empresa"));
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function buscarCep(valor) {
    const d = valor.replace(/\D/g, "");
    if (d.length !== 8 || d === ultimoCep.current) return;
    ultimoCep.current = d; setBuscandoCep(true); setMsg(null);
    try {
      const r = await apiService.get(`/configuracoes/cep/${d}`);
      setF((x) => ({ ...x, endereco: r.endereco || x.endereco, bairro: r.bairro || x.bairro, cidade: r.cidade || x.cidade }));
      if (r.uf && f?.regiao && r.uf !== f.regiao) setMsg({ tipo: "aviso", texto: `O CEP é de ${r.uf}; o estado da operação (Canal Spot) está ${f.regiao}. Ajuste em Região da empresa, se for o caso.` });
      setTimeout(() => refNumero.current?.focus(), 50);
    } catch (e) { setMsg({ tipo: "aviso", texto: e.message || "CEP não encontrado — preencha o endereço à mão" }); }
    finally { setBuscandoCep(false); }
  }

  async function buscarReceita() {
    setBuscandoRf(true); setMsg(null); onErro?.(null);
    try {
      const r = await apiService.get("/configuracoes/empresa/receita");
      const novos = {}; let n = 0;
      for (const k of ["razao_social", "nome_fantasia", "cep", "endereco", "numero", "complemento", "bairro", "cidade", "telefone", "email"]) {
        if (!String(f[k] || "").trim() && r[k]) { novos[k] = k === "cep" ? mCEP(r[k]) : r[k]; n++; }
      }
      setF((x) => ({ ...x, ...novos }));
      setMsg({ tipo: n ? "ok" : "aviso", texto: n ? `${n} campo(s) completado(s) com a Receita${r.situacao ? ` (situação: ${r.situacao})` : ""}. Confira e clique em Salvar dados.` : "Nada a completar — os campos já estavam preenchidos. A Receita não substitui o que você digitou." });
    } catch (e) { onErro?.(e.message || "Erro ao consultar a Receita"); }
    finally { setBuscandoRf(false); }
  }

  async function abrirHistorico() {
    if (hist) { setHist(null); return; }
    try { const r = await apiService.get("/configuracoes/empresa/alteracoes"); setHist(r?.alteracoes || []); } catch (e) { onErro?.(e.message); }
  }

  async function salvar() {
    onErro?.(null); setMsg(null); setSalvando(true);
    try {
      const { migrada, cnpj_travado, regiao, migrada_fiscal, opcoes_fiscais, ...dados } = f; // eslint-disable-line no-unused-vars
      if (!migrada_fiscal) { delete dados.inscricao_estadual; delete dados.opcao_fiscal; }
      if (cnpj_travado) delete dados.cnpj;
      const r = await apiService.put("/configuracoes/empresa/dados", dados);
      setMsg({ tipo: "ok", texto: r?.alterados ? "✅ Dados salvos" : "Nada mudou" });
      if (hist) { const h = await apiService.get("/configuracoes/empresa/alteracoes").catch(() => null); if (h) setHist(h.alteracoes || []); }
      await carregar(); onSalvo?.();
    } catch (e) { onErro?.(e.message || "Erro ao salvar"); } finally { setSalvando(false); }
  }

  if (!f) return null;
  const inp = (k, extra = {}) => <input ref={extra.ref} value={f[k] || ""} onChange={(e) => { const v = extra.mask ? extra.mask(e.target.value) : e.target.value; setF({ ...f, [k]: v }); extra.onValor?.(v); }} style={s.input} placeholder={extra.ph || ""} />;
  const campo = (rot, el, flex = "1 1 200px", k) => <div key={k || rot} style={{ flex }}><label style={s.label}>{rot}</label>{el}</div>;
  const linha = (...els) => <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>{els}</div>;
  const bt = (cor, cheio) => ({ background: cheio ? cor : "transparent", color: cheio ? "#fff" : cor, border: `1px solid ${cor}`, borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ ...s.card, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 12, color: C.textSub, fontWeight: 600, flex: 1 }}>DADOS CADASTRAIS</div>
          {f.cnpj_travado && <button type="button" onClick={buscarReceita} disabled={buscandoRf} style={{ ...bt(C.accent, false), opacity: buscandoRf ? 0.5 : 1 }}>{buscandoRf ? "Consultando…" : "🔍 Buscar na Receita"}</button>}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
          Vão no contrato de locação (qualificação da LOCADORA), na Identificação do BID e nos documentos. Comece pelo <strong>CEP</strong>: o endereço se completa sozinho.
        </div>
        {f.migrada === false && <div style={{ fontSize: 12, color: C.warning || "#d97706", marginBottom: 10 }}>⚠ Rode as migrations 048 e 049 no Supabase para salvar estes dados.</div>}

        {linha(
          campo("RAZÃO SOCIAL", inp("razao_social"), "2 1 300px", "rs"),
          campo("NOME FANTASIA", inp("nome_fantasia"), "1 1 200px", "nf"),
        )}
        {linha(
          campo("CNPJ", f.cnpj_travado
            ? <div style={{ ...s.input, display: "flex", alignItems: "center", gap: 8, opacity: 0.85, cursor: "not-allowed" }} title="Para trocar o CNPJ, fale com o suporte do QuotaFlow">🔒 {f.cnpj}</div>
            : inp("cnpj", { mask: mCNPJ, ph: "00.000.000/0000-00" }), "1 1 220px", "cnpj"),
          campo(<>CEP {buscandoCep && <span style={{ color: C.accent }}>· buscando…</span>}</>, inp("cep", { mask: mCEP, ph: "00000-000", onValor: buscarCep }), "0 1 150px", "cep"),
        )}
        {f.cnpj_travado && <div style={{ fontSize: 11, color: C.muted, margin: "-4px 0 10px" }}>🔒 O CNPJ não é alterado por aqui. Para trocar, fale com o suporte do QuotaFlow — a troca é analisada e fica registrada no histórico.</div>}
        {linha(
          campo("ENDEREÇO", inp("endereco", { ph: "Rua, avenida…" }), "3 1 300px", "end"),
          campo("NÚMERO", inp("numero", { ref: refNumero }), "0 1 100px", "num"),
        )}
        {linha(
          campo("COMPLEMENTO", inp("complemento"), "1 1 160px", "comp"),
          campo("BAIRRO", inp("bairro"), "1 1 160px", "bai"),
          campo("CIDADE", inp("cidade"), "1 1 160px", "cid"),
        )}
        {linha(
          campo("TELEFONE", <CampoTelefone value={f.telefone || ""} onChange={(v) => setF({ ...f, telefone: v || "" })} C={C} />, "1 1 220px", "tel"),
          campo("E-MAIL", inp("email"), "1 1 220px", "mail"),
        )}
        {linha( /* 16e.3: onde o conjunto é liberado antes de sair (pode ser diferente do endereço fiscal) */
          campo("📍 PÁTIO / BASE DA FROTA (ONDE O CONJUNTO É LIBERADO)", inp("base_endereco", { ph: "Ex.: Rod. BR-101, km 280, Serra - ES — vazio = usar o endereço de coleta da AT" }), "1 1 100%", "base"),
        )}
        {f.migrada_fiscal ? linha(
          campo("INSCRIÇÃO ESTADUAL", inp("inscricao_estadual", { ph: "Números ou ISENTO" }), "1 1 220px", "ie"),
          campo("OPÇÃO FISCAL", <select value={f.opcao_fiscal || ""} onChange={(e) => setF({ ...f, opcao_fiscal: e.target.value })} style={s.input}><option value="">—</option>{(f.opcoes_fiscais || []).map((o) => <option key={o} value={o}>{o}</option>)}</select>, "1 1 220px", "of"),
        ) : <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Inscrição estadual e opção fiscal (cabeçalho do BID): rode a migration 051.</div>}
        {msg && <div style={{ fontSize: 12, color: msg.tipo === "ok" ? C.success : (C.warning || "#d97706"), marginBottom: 10 }}>{msg.texto}</div>}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={salvar} disabled={salvando} style={{ ...s.btn(true), padding: "10px 24px", fontSize: 13, opacity: salvando ? 0.5 : 1 }}>{salvando ? "Salvando..." : "Salvar dados"}</button>
          <button type="button" onClick={abrirHistorico} className="qf-clicavel" style={{ background: "none", border: "none", color: C.textSub, fontSize: 12, textDecoration: "underline", padding: 0 }}>🕓 {hist ? "Fechar o histórico" : "Histórico de alterações"}</button>
        </div>

        {hist && (
          <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 10, maxHeight: 320, overflowY: "auto" }}>
            {hist.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>Nenhuma alteração registrada ainda.</div>}
            {hist.map((a) => (
              <div key={a.id} style={{ fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <div><strong>{a.rotulo}</strong>: <span style={{ color: C.muted, textDecoration: "line-through" }}>{valorHist(a.campo, a.antes)}</span> → {valorHist(a.campo, a.depois)}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{dataHora(a.criado_em)}{a.usuario_nome ? ` · ${a.usuario_nome}` : ""}{ORIGEM[a.origem] || ""}{a.motivo ? ` · motivo: ${a.motivo}` : ""}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
