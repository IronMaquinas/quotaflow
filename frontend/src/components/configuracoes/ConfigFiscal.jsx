// components/configuracoes/ConfigFiscal.jsx — etapa 18g.1: 🧾 antecedência da tarefa fiscal do transporte · 18g.3: 📋 dados do CT-e + 🛡 apólices
//   A tarefa TSK-TR de cada trecho do pedido vence N dias úteis (seg a sex, sem feriados) antes da data do transporte. Padrão: 2 (D-2).
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

export default function ConfigFiscal({ C, s, onErro }) {
  const [cfg, setCfg] = useState(null);
  const [n, setN] = useState("2");
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => { apiService.get("/configuracoes/fiscal").then((r) => { setCfg(r); setN(String(r.antecedencia_dias ?? 2)); }).catch((e) => onErro?.(e.message)); }, []); // eslint-disable-line
  if (!cfg) return null;
  const valido = /^\d+$/.test(n) && Number(n) <= 30;
  const salvar = async () => {
    setSalvando(true); setOk(false);
    try { const r = await apiService.put("/configuracoes/fiscal", { antecedencia_dias: Number(n) }); setCfg(r); setN(String(r.antecedencia_dias)); setOk(true); setTimeout(() => setOk(false), 3000); }
    catch (e) { onErro?.(e.message); } finally { setSalvando(false); }
  };
  return <><div style={{ ...s.card, padding: 18, marginTop: 16 }}>
    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🧾 Documentos fiscais do transporte</div>
    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>Quando o BID é aprovado, cada trecho do pedido ganha uma tarefa <b>TSK-TR</b> no ✅ Plano para o time fiscal (e o gestor): NF-e → CT-e → averbação → MDF-e. O prazo é esta quantidade de <b>dias úteis antes do transporte</b>.</div>
    {cfg.migrou === false && <div style={{ fontSize: 12.5, color: C.warn, marginBottom: 10 }}>⚠️ Rode a migration 066 para salvar — até lá vale D-2.</div>}
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13 }}>Prazo: D −</span>
      <input aria-label="Dias úteis de antecedência" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, "").slice(0, 2))} style={{ ...s.input, width: 70, marginBottom: 0, textAlign: "center" }} />
      <span style={{ fontSize: 13, color: C.textSub }}>dia(s) úteis</span>
      <button type="button" onClick={salvar} disabled={salvando || !valido} style={{ ...s.btn(!salvando && valido), padding: "9px 18px", fontSize: 13, cursor: "pointer" }}>{salvando ? "Salvando…" : "Salvar"}</button>
      {ok && <span style={{ fontSize: 12.5, color: C.success || "#16a34a" }}>✓ salvo — vale para as próximas mudanças de data</span>}
    </div>
  </div>
  <DadosCte C={C} s={s} onErro={onErro} /></>;{/* 18g.3 */}
}

// ─── 18g.3: 📋 dados do CT-e + 🛡 apólices (a ficha do CT-e da tarefa fiscal usa daqui) ─────────
const CAMPOS = [["ie", "Inscrição estadual", "ex.: 0623079040081"], ["uf", "UF de inscrição da empresa", "ES"], ["rntrc", "RNTRC (ANTT)", "8 dígitos"],
  ["aliquota_interna", "Alíquota interna do ICMS (%) — sua UF", "17"], ["cst", "CST do ICMS (regime normal)", "00"], ["produto_padrao", "Produto predominante padrão", "Máquinas e equipamentos"], ["tomador_padrao", "Quem costuma ser o tomador", "Remetente"]]; // 18g.4: CFOP/ICMS sugeridos por trecho
const addAno = (d) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return ""; const x = new Date(`${d}T12:00:00Z`); x.setUTCFullYear(x.getUTCFullYear() + 1); return x.toISOString().slice(0, 10); };
const mascCnpj = (v) => String(v || "").replace(/\D/g, "").slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
const vazioApol = { seguradora: "", seguradora_cnpj: "", numero: "", ramo: "RCTR-C", responsavel: "emitente", vigencia_inicio: "", vigencia_fim: "", obs: "" };
function DadosCte({ C, s, onErro }) {
  const [d, setD] = useState(null); const [f, setF] = useState({}); const [ok, setOk] = useState(false); const [ap, setAp] = useState(null); const [buscando, setBuscando] = useState(false); const [cnpjMsg, setCnpjMsg] = useState(null); const [salv, setSalv] = useState(false); const [excluir, setExcluir] = useState(null);
  useEffect(() => { apiService.get("/configuracoes/fiscal-cte").then((r) => { setD(r); setF(r.cte || {}); }).catch((e) => onErro?.(e.message)); }, []); // eslint-disable-line
  if (!d) return null;
  const salvar = async () => { setSalv(true); try { const r = await apiService.put("/configuracoes/fiscal-cte", f); setD(r); setF(r.cte || {}); setOk(true); setTimeout(() => setOk(false), 3000); } catch (e) { onErro?.(e.message); } finally { setSalv(false); } };
  const salvarAp = async () => { setSalv(true); try { const r = ap.id ? await apiService.put(`/configuracoes/apolices/${ap.id}`, ap) : await apiService.post("/configuracoes/apolices", ap); setD(r); setAp(null); } catch (e) { onErro?.(e.message); } finally { setSalv(false); } };
  const confirmarExcluir = async () => { try { const r = await apiService.delete(`/configuracoes/apolices/${excluir.id}`); setD(r); } catch (e) { onErro?.(e.message); } finally { setExcluir(null); } };
  const buscarCnpj = async () => { const dg = String(ap?.seguradora_cnpj || "").replace(/\D/g, ""); if (dg.length !== 14) return; setBuscando(true); setCnpjMsg(null); // 18g.4
    try { const r = await apiService.get(`/configuracoes/apolices/consulta/${dg}`); if (r.nome) { setAp((a) => ({ ...a, seguradora: r.nome })); setCnpjMsg({ ok: true, texto: `✓ Receita${r.situacao ? ` · ${r.situacao}` : ""}` }); } else setCnpjMsg({ ok: false, texto: "Receita fora do ar agora — digite o nome." }); }
    catch (e) { setCnpjMsg({ ok: false, texto: e.message }); } finally { setBuscando(false); } };
  const hoje = new Date().toISOString().slice(0, 10); const dBR = (v) => (v ? v.split("-").reverse().join("/") : "—");
  const lab = { fontSize: 11, color: C.muted, display: "block", marginBottom: 4, letterSpacing: "0.05em" };
  return <div style={{ ...s.card, padding: 18, marginTop: 16 }}>
    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📋 Dados do CT-e e 🛡 apólices</div>
    <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>Usados na <b>Ficha do CT-e</b> de cada tarefa fiscal (✅ Plano → TSK-TR → 📋 Ficha do CT-e): o emissor recebe tudo pronto para copiar. Razão social, CNPJ e endereço vêm de ⚙️ Dados da empresa.</div>
    {!d.migrou && <div style={{ fontSize: 12.5, color: C.warn, marginBottom: 10 }}>⚠️ Rode a migration 080 para salvar.</div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "4px 12px" }}>
      {CAMPOS.map(([k, rot, ph]) => <div key={k}><label style={lab}>{rot.toUpperCase()}</label><input value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} style={s.input} /></div>)}
      <div><label style={lab}>TIPO DE TOMADOR MAIS COMUM (CFOP)</label><select value={f.tipo_tomador || "comercio"} onChange={(e) => setF({ ...f, tipo_tomador: e.target.value })} style={s.input}>{Object.entries(d.tipos_tomador || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    </div>
    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, margin: "2px 0 8px", cursor: "pointer" }}><input type="checkbox" checked={f.simples === true} onChange={(e) => setF({ ...f, simples: e.target.checked })} /> Empresa do <b>Simples Nacional</b> (ICMS do Simples, sem destaque no CT-e)</label>
    <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>🧮 <b>CFOP e ICMS são sugeridos por trecho</b> na Ficha do CT-e (cada trecho é um CT-e): vale onde a prestação começa e termina — mesma UF 5.35x, interestadual 6.35x, começando fora da sua UF 5.932/6.932; ICMS interestadual 12% (7% do S/SE, menos ES, para N/NE/CO/ES). O funcionário confere e pode corrigir na ficha. Valide as regras com o contador — há exceções por estado.</div>
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}><button type="button" onClick={salvar} disabled={salv} style={{ ...s.btn(true), padding: "9px 18px", fontSize: 13 }}>{salv ? "Salvando…" : "Salvar dados do CT-e"}</button>{ok && <span style={{ fontSize: 12.5, color: C.success || "#16a34a" }}>✓ salvo</span>}</div>
    <div style={{ display: "flex", alignItems: "center", marginTop: 18, marginBottom: 6 }}><b style={{ flex: 1, fontSize: 14 }}>🛡 Apólices de seguro</b><button type="button" onClick={() => { setCnpjMsg(null); setAp({ ...vazioApol }); }} style={{ ...s.btn(false), padding: "6px 12px", fontSize: 12.5 }}>＋ Apólice</button></div>
    {d.apolices.length === 0 ? <div style={{ fontSize: 12.5, color: C.muted }}>Nenhuma apólice. A ficha usa a apólice vigente na data do transporte (RCTR-C primeiro).</div>
      : d.apolices.map((a) => { const vig = a.ativo && (!a.vigencia_inicio || a.vigencia_inicio <= hoje) && (!a.vigencia_fim || a.vigencia_fim >= hoje);
        return <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.border}`, fontSize: 13, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}><b>{a.seguradora}</b> · {a.ramo} · nº {a.numero}<div style={{ fontSize: 11.5, color: C.muted }}>{dBR(a.vigencia_inicio)} → {dBR(a.vigencia_fim)} · {d.responsaveis[a.responsavel]}</div></div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: vig ? (C.success || "#22c55e") : C.muted }}>{vig ? "✓ vigente" : a.ativo ? "fora da vigência" : "inativa"}</span>
          <button type="button" onClick={() => setAp({ ...vazioApol, ...a, vigencia_inicio: a.vigencia_inicio || "", vigencia_fim: a.vigencia_fim || "", seguradora_cnpj: a.seguradora_cnpj || "", obs: a.obs || "" })} style={{ ...s.btn(false), padding: "4px 10px", fontSize: 12 }}>Editar</button>
          <button type="button" onClick={() => setExcluir(a)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 12 }}>Excluir</button>
        </div>; })}
    {ap && <div onClick={() => !salv && setAp(null)} style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Apólice" style={{ ...s.card, width: 520, maxWidth: "100%", padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>🛡 {ap.id ? "Editar apólice" : "Nova apólice"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>CNPJ DA SEGURADORA</label><div style={{ display: "flex", gap: 8 }}>
            <input value={mascCnpj(ap.seguradora_cnpj)} onChange={(e) => setAp({ ...ap, seguradora_cnpj: e.target.value.replace(/\D/g, "") })} onKeyDown={(e) => { if (e.key === "Enter") buscarCnpj(); }} inputMode="numeric" placeholder="00.000.000/0000-00" style={{ ...s.input, flex: 1 }} autoFocus={!ap.id} />
            <button type="button" disabled={buscando || String(ap.seguradora_cnpj || "").replace(/\D/g, "").length !== 14} onClick={buscarCnpj} style={{ ...s.btn(String(ap.seguradora_cnpj || "").replace(/\D/g, "").length === 14), padding: "0 14px", height: 40, whiteSpace: "nowrap" }}>{buscando ? "Buscando…" : "🔍 Buscar"}</button></div>
            {cnpjMsg && <div style={{ fontSize: 11.5, color: cnpjMsg.ok ? (C.success || "#16a34a") : C.warn, marginTop: -6, marginBottom: 8 }}>{cnpjMsg.texto}</div>}</div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>SEGURADORA</label><input value={ap.seguradora} onChange={(e) => setAp({ ...ap, seguradora: e.target.value })} style={s.input} /></div>
          <div><label style={lab}>Nº DA APÓLICE</label><input value={ap.numero} onChange={(e) => setAp({ ...ap, numero: e.target.value })} style={s.input} /></div>
          <div><label style={lab}>RAMO</label><select value={ap.ramo} onChange={(e) => setAp({ ...ap, ramo: e.target.value })} style={s.input}>{d.ramos.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div><label style={lab}>RESPONSÁVEL PELO SEGURO</label><select value={ap.responsavel} onChange={(e) => setAp({ ...ap, responsavel: e.target.value })} style={s.input}>{Object.entries(d.responsaveis).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label style={lab}>VIGÊNCIA — INÍCIO</label><input type="date" value={ap.vigencia_inicio} onChange={(e) => { const v = e.target.value; setAp({ ...ap, vigencia_inicio: v, ...(!ap.vigencia_fim || ap.vigencia_fim === addAno(ap.vigencia_inicio) ? { vigencia_fim: addAno(v) } : {}) }); }} style={s.input} /></div>
          <div><label style={lab}>VIGÊNCIA — FIM</label><input type="date" value={ap.vigencia_fim} onChange={(e) => setAp({ ...ap, vigencia_fim: e.target.value })} style={s.input} /></div>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, margin: "4px 0 12px" }}><input type="checkbox" checked={ap.ativo !== false} onChange={(e) => setAp({ ...ap, ativo: e.target.checked })} /> Ativa</label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" disabled={salv} onClick={() => setAp(null)} style={{ ...s.btn(false), padding: "8px 16px" }}>Cancelar</button><button type="button" disabled={salv} onClick={salvarAp} style={{ ...s.btn(true), padding: "8px 16px" }}>{salv ? "Salvando…" : "Salvar"}</button></div>
      </div></div>}
    {excluir && <div onClick={() => setExcluir(null)} style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Excluir apólice" style={{ ...s.card, width: 420, maxWidth: "100%", padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Excluir a apólice {excluir.numero}?</div><div style={{ fontSize: 13, color: C.textSub, marginBottom: 14 }}>Fichas já impressas não mudam. Se só venceu, prefira desmarcar "Ativa".</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setExcluir(null)} style={{ ...s.btn(false), padding: "8px 16px" }}>Cancelar</button><button type="button" onClick={confirmarExcluir} style={{ ...s.btn(true), padding: "8px 16px", background: C.danger, borderColor: C.danger }}>Excluir</button></div>
      </div></div>}
  </div>;
}
