// components/auditorias/FichaAuditoria.jsx — etapa A1.1: 🔎 auditoria FEITA no sistema — 📅 Planejamento · 🔎 Execução · ✅ Conclusão
//   Planejar (só o plano) → ▶ Iniciar → constatações com "＋" por tipo (NC maior/menor, observação, oportunidade, conforme), fotos,
//   rascunho que não se perde (cada item salva no servidor; o formulário em aberto e a conclusão também ficam no aparelho; conclusão salva
//   sozinha) → ■ Encerrar execução (relatório pronto e travado) → ✍ assinaturas do auditor e do responsável da área → ✅ aprovada.
//   NC maior/menor sugere ☑ abrir NC no módulo de Não Conformidades + ☑ tarefa AU; observação: tarefa; oportunidade: tarefa opcional.
import { useEffect, useRef, useState } from "react";
import apiService from "../../services/apiService";
import CampoFuncionario from "../shared/CampoFuncionario";
import AssinaturaTela from "../shared/AssinaturaTela";
import { comprimirImagem } from "../../utils/comprimirImagem";

const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const hora = (d) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const COR_C = { nc_maior: "#ef4444", nc_menor: "#f97316", observacao: "#f59e0b", oportunidade: "#60a5fa", conforme: "#22c55e" };
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const lerLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const gravarLS = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem espaço: segue só no servidor */ } };
const planoVazio = (ano) => ({ titulo: "", tipo: "interna", norma: "ISO 9001:2015", escopo: "", processos: "", requisitos: [], auditor_nome: "", auditor_colaborador_id: null, auditor_usuario_id: null, auditor_externo: "", data_prevista: `${ano}-${String(new Date().getMonth() + 1).padStart(2, "0")}-15` });

export function htmlRelatorio(det, meta) {
  const a = det.auditoria; const n = (t) => det.constatacoes.filter((c) => c.tipo === t).length;
  const linhas = det.constatacoes.map((c) => `<tr><td><b style="color:${COR_C[c.tipo]}">${esc(meta.CONST[c.tipo])}</b></td><td>${esc(c.requisito || "")}</td><td>${esc(c.processo || "")}</td><td>${esc(c.descricao)}${c.evidencia ? `<br><i>Evidência: ${esc(c.evidencia)}</i>` : ""}${(c.fotos || []).map((f) => `<br><img src="${f}" style="max-width:180px;max-height:130px;margin-top:4px;border:1px solid #ccc">`).join("")}</td><td>${c.nc ? `${esc(c.nc.numero)}<br>` : ""}${c.tarefa ? `${esc(c.tarefa.numero || "")} · ${esc(c.tarefa.responsavel || "")} · ${dBR(c.tarefa.prazo)}` : "—"}</td></tr>`).join("");
  const ass = (p) => { const x = (a.assinaturas || []).find((y) => y.papel === p); return `<div style="width:260px;text-align:center">${x ? `<img src="${x.png}" style="height:70px"><div style="border-top:1px solid #111;padding-top:4px">${esc(x.nome)}<br><span style="font-size:10px;color:#555">${esc(det.PAPEIS[p])} · assinado em ${hora(x.em)}</span></div>` : `<div style="height:70px"></div><div style="border-top:1px solid #111;padding-top:4px">${esc(det.PAPEIS[p])}</div>`}</div>`; };
  return `<html><head><meta charset="utf-8"><title>${esc(a.numero)}</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:28px}h1{font-size:18px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:8px}td,th{border:1px solid #bbb;padding:6px;vertical-align:top;text-align:left}th{background:#f1f5f9}.g{display:grid;grid-template-columns:150px 1fr;gap:4px 12px;margin-top:12px}.r{color:#555}h3{margin:18px 0 4px;font-size:14px}</style></head><body>
    <h1>Relatório de auditoria ${esc(a.numero)}</h1><div class="r">${esc(a.titulo)} · ${esc(meta.TIPOS[a.tipo])} · ${esc(a.norma)}${a.status === "concluida" ? ` · <b style="color:#16a34a">APROVADO em ${hora(a.aprovada_em)}</b>` : ""}</div>
    <div class="g"><b>Data</b><span>${dBR(a.data_realizada || a.data_prevista)}</span><b>Auditor</b><span>${esc(a.auditor_nome || a.auditor_externo || "—")}</span><b>Auditados</b><span>${esc((a.auditados || []).map((x) => x.nome).join(", ") || "—")}</span><b>Processos</b><span>${esc((a.processos || []).join(", ") || "—")}</span><b>Requisitos</b><span>${esc((a.requisitos || []).join(", ") || "—")}</span><b>Escopo</b><span>${esc(a.escopo || "—")}</span><b>Resumo</b><span>${n("nc_maior")} NC maior · ${n("nc_menor")} NC menor · ${n("observacao")} observação(ões) · ${n("oportunidade")} oportunidade(s) · ${n("conforme")} conforme(s)</span></div>
    <h3>Constatações</h3><table><tr><th>Tipo</th><th>Req.</th><th>Processo</th><th>Descrição / evidência</th><th>NC / ação</th></tr>${linhas || '<tr><td colspan="5">Nenhuma constatação.</td></tr>'}</table>
    <h3>Conclusão do auditor</h3><div>${esc(a.conclusao || "—").replace(/\n/g, "<br>")}</div>
    <div style="display:flex;gap:60px;margin-top:50px;flex-wrap:wrap">${ass("auditor")}${ass("auditado")}</div></body></html>`;
}

export default function FichaAuditoria({ C, s, id: id0, ano, meta, pessoas, onVoltar }) {
  const [id, setId] = useState(id0); const [det, setDet] = useState(null); const [plano, setPlano] = useState(() => planoVazio(ano)); const [aba, setAba] = useState("plano");
  const [msg, setMsg] = useState(""); const [nc, setNc] = useState(null); const [conc, setConc] = useState(""); const [salvo, setSalvo] = useState(null); const [aud, setAud] = useState(""); const [ass, setAss] = useState(null);
  const timer = useRef(null); const LSF = `qfAudForm:${id}`; const LSC = `qfAudConc:${id}`;
  const erroDe = (e) => setMsg(`⚠ ${e?.response?.data?.erro || e.message}`);
  const carregar = async (i = id) => { const r = await apiService.get(`/auditorias/${i}`); setDet(r); const a = r.auditoria; setPlano({ ...planoVazio(ano), ...a, processos: (a.processos || []).join(", ") });
    const loc = lerLS(`qfAudConc:${i}`); setConc(loc && loc.em > Date.parse(a.atualizado_em || 0) ? loc.texto : a.conclusao || ""); const f = lerLS(`qfAudForm:${i}`); if (f && !r.travada) setNc(f); return r; };
  useEffect(() => { if (id) carregar().then((r) => setAba(r.auditoria.status === "planejada" ? "plano" : r.travada ? "conc" : "exec")).catch(erroDe); }, []); // eslint-disable-line
  useEffect(() => { if (id && nc) gravarLS(LSF, nc); }, [nc]); // eslint-disable-line
  const a = det?.auditoria; const st = a?.status; const trav = !!det?.travada; const planejada = !id || st === "planejada";
  const card = { ...s.card, padding: "16px 18px" }; const lab = { fontSize: 11.5, color: C.textSub, display: "block", marginBottom: 3 }; const tit = { fontSize: 12, color: C.textSub, fontWeight: 700, letterSpacing: ".04em", marginBottom: 10 };
  const acao = async (fn, ok, depois) => { setMsg(""); try { const r = await fn(); if (ok) setMsg(typeof ok === "function" ? ok(r) : ok); const d = await carregar(r?.auditoria?.id || id); depois?.(d, r); return r; } catch (e) { erroDe(e); return null; } };

  const salvarPlano = async () => { setMsg(""); try { const corpo = { ...plano, processos: String(plano.processos || "").split(",").map((x) => x.trim()).filter(Boolean) }; const r = id ? await apiService.put(`/auditorias/${id}`, corpo) : await apiService.post("/auditorias", corpo); if (!id) setId(r.auditoria.id); setMsg(id ? "Planejamento salvo." : `Auditoria ${r.auditoria.numero} planejada — já está no programa.`); await carregar(r.auditoria.id); } catch (e) { erroDe(e); } };
  const salvarExec = async (campos) => { try { await apiService.put(`/auditorias/${id}`, campos); setSalvo(new Date()); } catch (e) { erroDe(e); } };
  const digitarConc = (v) => { setConc(v); gravarLS(LSC, { texto: v, em: Date.now() }); clearTimeout(timer.current); timer.current = setTimeout(() => salvarExec({ conclusao: v }).then(() => gravarLS(LSC, null)), 1200); };
  const novaC = (tipo) => setNc({ tipo, requisito: "", processo: "", descricao: "", evidencia: "", fotos: [], prazo: "", resp_nome: "", abrir_nc: !!meta.REGRAS[tipo]?.nc, criar_tarefa: !!meta.REGRAS[tipo]?.acao });
  const fotos = async (files) => { const out = [...(nc.fotos || [])]; for (const f of [...files].slice(0, 4 - out.length)) { try { out.push((await comprimirImagem(f, { lado: 1280, qualidade: 0.7 })).dataUrl); } catch { /* ignora arquivo ruim */ } } setNc({ ...nc, fotos: out }); };
  const registrar = () => acao(() => apiService.post(`/auditorias/${id}/constatacoes`, { ...nc, responsavel_ref: nc.resp_id ? `c:${nc.resp_id}` : nc.resp_uid ? `u:${nc.resp_uid}` : null, responsavel: nc.resp_nome || null }),
    (r) => r.aviso ? `⚠ ${r.aviso}` : [`${meta.CONST[nc.tipo]} registrada`, r.nc && `NC ${r.nc.numero} aberta`, r.tarefa && `tarefa ${r.tarefa.numero || ""} criada`].filter(Boolean).join(" · ") + ".", () => { setNc(null); gravarLS(LSF, null); });
  const editarC = async (c, campos) => { try { await apiService.put(`/auditorias/constatacoes/${c.id}`, campos); setSalvo(new Date()); } catch (e) { erroDe(e); } };
  const relatorio = () => { const w = window.open("", "_blank"); if (!w) return setMsg("⚠ Libere pop-ups para imprimir o relatório."); w.document.write(htmlRelatorio(det, meta).replace("</body>", "<script>setTimeout(()=>print(),400)</script></body>")); w.document.close(); };
  const reqs = meta.requisitos || [];
  const Resumo = () => <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "4px 12px", fontSize: 13 }}><span style={{ color: C.textSub }}>Tipo / norma</span><span>{meta.TIPOS[a.tipo]} · {a.norma}</span><span style={{ color: C.textSub }}>Previsto</span><span>{dBR(a.data_prevista)}</span><span style={{ color: C.textSub }}>Auditor</span><span>{a.auditor_nome || a.auditor_externo || "—"}</span><span style={{ color: C.textSub }}>Processos</span><span>{(a.processos || []).join(", ") || "—"}</span><span style={{ color: C.textSub }}>Requisitos</span><span>{(a.requisitos || []).join(", ") || "—"}</span><span style={{ color: C.textSub }}>Escopo</span><span style={{ whiteSpace: "pre-wrap" }}>{a.escopo || "—"}</span></div>;

  return (
    <div style={{ padding: "20px clamp(12px, 3vw, 28px)", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={onVoltar} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>← Programa</button>
        <div style={{ flex: 1, minWidth: 200 }}><div style={{ fontSize: 20, fontWeight: 800 }}>{a ? `🔎 ${a.numero} · ${a.titulo}` : "📅 Planejar auditoria"}</div>{a && <div style={{ fontSize: 12.5, color: C.textSub }}>{st === "concluida" ? `✅ Concluída e aprovada em ${hora(a.aprovada_em)}` : st === "cancelada" ? "Cancelada" : a.encerrada_em ? "■ Execução encerrada — aguardando assinaturas" : st === "em_andamento" ? `▶ Em andamento desde ${hora(a.iniciada_em || a.atualizado_em)}` : "📅 Planejada"}</div>}</div>
        {salvo && !trav && <span style={{ fontSize: 12, color: "#22c55e" }}>✓ salvo às {salvo.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
        {det && <button type="button" onClick={relatorio} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>🖨 Relatório</button>}
      </div>
      {id && <div style={{ display: "flex", gap: 6, borderBottom: `1px solid ${C.border}` }}>{[["plano", "📅 Planejamento"], ["exec", "🔎 Execução"], ["conc", "✅ Conclusão"]].map(([k, r]) => <button key={k} type="button" onClick={() => setAba(k)} style={{ background: "none", border: "none", borderBottom: `2px solid ${aba === k ? C.accent : "transparent"}`, color: aba === k ? C.text : C.textSub, padding: "8px 12px", fontWeight: aba === k ? 700 : 500, cursor: "pointer", fontSize: 13.5 }}>{r}</button>)}</div>}
      {msg && <div style={{ fontSize: 13, color: /^⚠/.test(msg) ? C.warn : "#22c55e" }}>{msg}</div>}

      {(aba === "plano" || !id) && (planejada ? <div style={{ ...card, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "3 1 280px" }}><span style={lab}>TÍTULO *</span><input value={plano.titulo} onChange={(e) => setPlano({ ...plano, titulo: e.target.value })} placeholder="Auditoria interna — Operação e Manutenção" style={{ ...s.input, width: "100%" }} /></div>
          <div style={{ flex: "1 1 160px" }}><span style={lab}>TIPO</span><select value={plano.tipo} onChange={(e) => setPlano({ ...plano, tipo: e.target.value })} style={{ ...s.input, width: "100%" }}>{Object.entries(meta.TIPOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div>
          <div style={{ flex: "1 1 140px" }}><span style={lab}>NORMA</span><input value={plano.norma} onChange={(e) => setPlano({ ...plano, norma: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
          <div style={{ flex: "1 1 150px" }}><span style={lab}>DATA PREVISTA *</span><input type="date" value={plano.data_prevista || ""} onChange={(e) => setPlano({ ...plano, data_prevista: e.target.value })} style={{ ...s.input, width: "100%" }} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "2 1 240px" }}><span style={lab}>AUDITOR (DO CADASTRO)</span><CampoFuncionario C={C} s={s} lista={pessoas} nome={plano.auditor_nome || ""} id={plano.auditor_colaborador_id} usuarioId={plano.auditor_usuario_id} placeholder="Digite o nome do auditor…" onChange={(v) => setPlano({ ...plano, auditor_nome: v.nome, auditor_colaborador_id: v.id, auditor_usuario_id: v.usuario_id })} /></div>
          <div style={{ flex: "2 1 220px" }}><span style={lab}>OU AUDITOR EXTERNO / EMPRESA</span><input value={plano.auditor_externo || ""} onChange={(e) => setPlano({ ...plano, auditor_externo: e.target.value })} placeholder="ex.: Certificadora XYZ — Fulano" style={{ ...s.input, width: "100%" }} /></div>
          <div style={{ flex: "2 1 240px" }}><span style={lab}>PROCESSOS (separe por vírgula)</span><input value={plano.processos} onChange={(e) => setPlano({ ...plano, processos: e.target.value })} placeholder="Compras, Manutenção, Programação" style={{ ...s.input, width: "100%" }} /></div>
        </div>
        <div><span style={lab}>ESCOPO</span><textarea value={plano.escopo || ""} onChange={(e) => setPlano({ ...plano, escopo: e.target.value })} rows={2} style={{ ...s.input, width: "100%", fontFamily: "inherit" }} /></div>
        <div><span style={lab}>REQUISITOS A AUDITAR</span><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{reqs.map((r) => { const on = (plano.requisitos || []).includes(r.codigo); return <button key={r.codigo} type="button" title={r.nome} onClick={() => setPlano({ ...plano, requisitos: on ? plano.requisitos.filter((x) => x !== r.codigo) : [...(plano.requisitos || []), r.codigo] })} style={{ padding: r.principal ? "4px 10px" : "3px 8px", borderRadius: 12, fontSize: r.principal ? 12.5 : 11.5, fontWeight: r.principal ? 700 : 400, border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accent : "transparent", color: on ? "#fff" : C.text, cursor: "pointer" }}>{r.codigo}{r.principal ? ` ${r.nome}` : ""}</button>; })}</div></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {id && <button type="button" onClick={() => acao(() => apiService.post(`/auditorias/${id}/cancelar`, {}), "Auditoria cancelada.")} style={{ ...s.btn(false), cursor: "pointer", color: C.danger }}>Cancelar auditoria</button>}
          <button type="button" onClick={salvarPlano} style={{ ...s.btn(!id), cursor: "pointer", color: id ? C.text : undefined }}>{id ? "Salvar planejamento" : "📅 Planejar auditoria"}</button>
          {id && <button type="button" onClick={() => acao(() => apiService.post(`/auditorias/${id}/iniciar`, {}), "Auditoria iniciada — registre as constatações.", () => setAba("exec"))} style={{ ...s.btn(true), cursor: "pointer" }}>▶ Iniciar auditoria</button>}
        </div></div> : <div style={card}><div style={tit}>PLANEJAMENTO</div><Resumo /></div>)}

      {id && aba === "exec" && a && (st === "planejada" ? <div style={{ ...card, textAlign: "center" }}><div style={{ fontSize: 14, marginBottom: 10 }}>A auditoria ainda não começou.</div><button type="button" onClick={() => acao(() => apiService.post(`/auditorias/${id}/iniciar`, {}), "Auditoria iniciada.")} style={{ ...s.btn(true), cursor: "pointer" }}>▶ Iniciar auditoria</button></div> : <>
        <div style={{ ...card, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 150px" }}><span style={lab}>DATA REALIZADA</span><input type="date" disabled={trav} value={a.data_realizada || ""} onChange={(e) => { setDet({ ...det, auditoria: { ...a, data_realizada: e.target.value } }); if (e.target.value) salvarExec({ data_realizada: e.target.value }); }} style={{ ...s.input, width: "100%" }} /></div>
            <div style={{ flex: "4 1 320px" }}><span style={lab}>AUDITADOS (DO CADASTRO)</span><div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>{(a.auditados || []).map((x, i) => <span key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: "3px 6px 3px 10px", fontSize: 12.5 }}>{x.nome}{!trav && <button type="button" onClick={() => { const l = a.auditados.filter((_, k) => k !== i); setDet({ ...det, auditoria: { ...a, auditados: l } }); salvarExec({ auditados: l }); }} aria-label={`Tirar ${x.nome}`} style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer" }}>×</button>}</span>)}
              {!trav && <div style={{ width: 240 }}><CampoFuncionario C={C} s={s} lista={pessoas} nome={aud} id={null} placeholder="＋ auditado…" onChange={(v) => { if (v.id != null || v.usuario_id != null) { const l = [...(a.auditados || []), { nome: v.nome, colaborador_id: v.id, usuario_id: v.usuario_id }]; setAud(""); setDet({ ...det, auditoria: { ...a, auditados: l } }); salvarExec({ auditados: l }); } else setAud(v.nome); }} /></div>}</div></div>
          </div>
          <details><summary style={{ cursor: "pointer", fontSize: 12.5, color: C.textSub }}>Ver o planejamento</summary><div style={{ marginTop: 8 }}><Resumo /></div></details>
        </div>
        <div style={card}>
          <div style={tit}>CONSTATAÇÕES ({det.constatacoes.length})</div>
          {!trav && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{Object.entries(meta.CONST).map(([k, r]) => <button key={k} type="button" onClick={() => novaC(k)} style={{ padding: "7px 12px", borderRadius: 16, fontSize: 13, border: `1px solid ${COR_C[k]}`, background: nc?.tipo === k ? COR_C[k] : "transparent", color: nc?.tipo === k ? "#fff" : C.text, cursor: "pointer", fontWeight: 600 }}>＋ {r}</button>)}</div>}
          {nc && !trav && <div style={{ border: `2px solid ${COR_C[nc.tipo]}88`, borderRadius: 8, padding: 12, marginBottom: 12, display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, color: COR_C[nc.tipo] }}>{meta.CONST[nc.tipo]} <span style={{ fontWeight: 400, fontSize: 11.5, color: C.textSub }}>· rascunho guardado no aparelho até registrar</span></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={nc.requisito} onChange={(e) => setNc({ ...nc, requisito: e.target.value })} style={{ ...s.input, flex: "1 1 220px" }}><option value="">Requisito…</option>{reqs.map((r) => <option key={r.codigo} value={r.codigo}>{r.codigo} — {r.nome}</option>)}</select>
              <input value={nc.processo} onChange={(e) => setNc({ ...nc, processo: e.target.value })} list="qf-aud-proc" placeholder="Processo" style={{ ...s.input, flex: "1 1 160px" }} /><datalist id="qf-aud-proc">{(a.processos || []).map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <textarea value={nc.descricao} onChange={(e) => setNc({ ...nc, descricao: e.target.value })} rows={3} placeholder={nc.tipo === "conforme" ? "O que foi verificado e está conforme *" : "Descrição * — requisito × o que foi encontrado"} style={{ ...s.input, fontFamily: "inherit" }} />
            <textarea value={nc.evidencia} onChange={(e) => setNc({ ...nc, evidencia: e.target.value })} rows={2} placeholder="Evidência — registro, documento, entrevista…" style={{ ...s.input, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{(nc.fotos || []).map((f, i) => <div key={i} style={{ position: "relative" }}><img src={f} alt="" style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 6 }} /><button type="button" onClick={() => setNc({ ...nc, fotos: nc.fotos.filter((_, k) => k !== i) })} aria-label="Tirar foto" style={{ position: "absolute", top: -6, right: -6, background: C.danger, color: "#fff", border: "none", borderRadius: 9, width: 18, height: 18, cursor: "pointer", fontSize: 11 }}>×</button></div>)}
              {(nc.fotos || []).length < 4 && <label style={{ ...s.btn(false), cursor: "pointer", color: C.text, fontSize: 12.5 }}>📷 Foto<input type="file" accept="image/*" capture="environment" multiple onChange={(e) => fotos(e.target.files)} style={{ display: "none" }} /></label>}</div>
            {(meta.REGRAS[nc.tipo]?.nc || meta.REGRAS[nc.tipo]?.acao || meta.REGRAS[nc.tipo]?.opcional) && <div style={{ display: "grid", gap: 6, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
              {meta.REGRAS[nc.tipo]?.nc && <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={nc.abrir_nc} onChange={(e) => setNc({ ...nc, abrir_nc: e.target.checked })} />Abrir NC no sistema (Não Conformidades, origem Auditoria — as fotos vão como anexo)</label>}
              <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={nc.criar_tarefa} onChange={(e) => setNc({ ...nc, criar_tarefa: e.target.checked })} />{nc.tipo === "oportunidade" ? "Criar tarefa para avaliar a melhoria" : "Criar tarefa de ação corretiva (🔎 AU)"}</label>
              {nc.criar_tarefa && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                <div style={{ flex: "2 1 240px" }}><span style={lab}>RESPONSÁVEL PELA AÇÃO</span><CampoFuncionario C={C} s={s} lista={pessoas} nome={nc.resp_nome} id={nc.resp_id} usuarioId={nc.resp_uid} placeholder="Digite o nome do funcionário…" onChange={(v) => setNc({ ...nc, resp_nome: v.nome, resp_id: v.id, resp_uid: v.usuario_id })} /></div>
                <div style={{ flex: "1 1 160px" }}><span style={lab}>PRAZO (vazio = {meta.REGRAS[nc.tipo]?.prazo} dias)</span><input type="date" value={nc.prazo} onChange={(e) => setNc({ ...nc, prazo: e.target.value })} style={{ ...s.input, width: "100%" }} /></div></div>}
            </div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => { setNc(null); gravarLS(LSF, null); }} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Descartar</button><button type="button" disabled={!nc.descricao.trim()} onClick={registrar} style={{ ...s.btn(true), cursor: "pointer" }}>Registrar</button></div>
          </div>}
          {det.constatacoes.map((c, i) => <div key={c.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: i || nc ? `1px solid ${C.border}55` : "none", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: COR_C[c.tipo], border: `1px solid ${COR_C[c.tipo]}`, borderRadius: 10, padding: "1px 8px", height: "fit-content", whiteSpace: "nowrap" }}>{c.tipo_nome}</span>
            <div style={{ flex: "1 1 300px", display: "grid", gap: 4 }}>
              {c.requisito && <div style={{ fontSize: 12, color: C.textSub }}>Requisito {c.requisito}{c.processo ? ` · ${c.processo}` : ""}</div>}
              {trav ? <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{c.descricao}</div> : <textarea defaultValue={c.descricao} onBlur={(e) => e.target.value.trim() && e.target.value !== c.descricao && editarC(c, { descricao: e.target.value })} rows={2} style={{ ...s.input, fontFamily: "inherit", fontSize: 13 }} />}
              {trav ? (c.evidencia && <div style={{ fontSize: 12, color: C.textSub }}>Evidência: {c.evidencia}</div>) : <textarea defaultValue={c.evidencia || ""} onBlur={(e) => e.target.value !== (c.evidencia || "") && editarC(c, { evidencia: e.target.value })} rows={1} placeholder="Evidência…" style={{ ...s.input, fontFamily: "inherit", fontSize: 12.5 }} />}
              {(c.fotos || []).length > 0 && <div style={{ display: "flex", gap: 6 }}>{c.fotos.map((f, k) => <a key={k} href={f} target="_blank" rel="noreferrer"><img src={f} alt="" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 5 }} /></a>)}</div>}
              {(c.nc || c.tarefa) && <div style={{ fontSize: 12, color: C.warn }}>{c.nc && <>⚠ {c.nc.numero} · {c.nc.status}{c.tarefa ? "   " : ""}</>}{c.tarefa && <>🔎 {c.tarefa.numero || "tarefa"} · {c.tarefa.responsavel || "—"} · prazo {dBR(c.tarefa.prazo)} · {c.tarefa.status}</>}</div>}
            </div>
            {!trav && !c.tarefa_id && !c.nc_id && <button type="button" onClick={() => acao(() => apiService.delete(`/auditorias/constatacoes/${c.id}`), "Constatação removida.")} aria-label="Remover constatação" style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer", height: "fit-content" }}>×</button>}
          </div>)}
          {!det.constatacoes.length && !nc && <div style={{ color: C.muted, fontSize: 13 }}>Use os botões "＋" acima. Registre também o que está Conforme — evidencia o que foi verificado.</div>}
        </div>
        <div style={card}><div style={tit}>CONCLUSÃO DO AUDITOR {!trav && <span style={{ fontWeight: 400, letterSpacing: 0 }}>· salva sozinha</span>}</div>
          <textarea value={conc} disabled={trav} onChange={(e) => digitarConc(e.target.value)} rows={4} placeholder="O sistema é eficaz? Pontos fortes, pontos de atenção, recomendações…" style={{ ...s.input, width: "100%", fontFamily: "inherit" }} />
          {!trav && st === "em_andamento" && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button type="button" onClick={async () => { clearTimeout(timer.current); await salvarExec({ conclusao: conc }); gravarLS(LSC, null); acao(() => apiService.post(`/auditorias/${id}/encerrar`, {}), "Execução encerrada — relatório pronto. Colete as assinaturas.", () => setAba("conc")); }} style={{ ...s.btn(true), cursor: "pointer" }}>■ Encerrar execução</button></div>}
        </div>
      </>)}

      {id && aba === "conc" && a && <>
        {!a.encerrada_em && st !== "concluida" ? <div style={{ ...card, color: C.textSub, fontSize: 13.5 }}>O relatório fica pronto quando a execução for encerrada (aba 🔎 Execução → ■ Encerrar execução).</div> : <>
          <div style={{ ...card, background: "#fff", color: "#111", padding: 0, overflow: "hidden" }}><iframe title="Relatório" srcDoc={htmlRelatorio(det, meta)} style={{ width: "100%", height: 560, border: "none" }} /></div>
          <div style={card}><div style={tit}>ASSINATURAS</div>
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>{Object.entries(det.PAPEIS).map(([p, r]) => { const x = (a.assinaturas || []).find((y) => y.papel === p); const padrao = p === "auditor" ? { nome: a.auditor_nome || a.auditor_externo || "", id: a.auditor_colaborador_id, usuario_id: a.auditor_usuario_id } : { nome: "", id: null, usuario_id: null };
              return <div key={p} style={{ border: `1px solid ${x ? "#22c55e" : C.border}`, borderRadius: 8, padding: 12 }}><div style={{ fontWeight: 700, marginBottom: 6 }}>{x ? "✅ " : "✍ "}{r}</div>
                {x ? <><img src={x.png} alt="" style={{ height: 70, background: "#fff", borderRadius: 4 }} /><div style={{ fontSize: 12.5, marginTop: 4 }}>{x.nome} · {hora(x.em)}</div></>
                  : st === "concluida" ? null : ass?.papel !== p ? <button type="button" onClick={() => setAss({ papel: p, nome: padrao.nome, colaborador_id: padrao.id, usuario_id: padrao.usuario_id, png: null })} style={{ ...s.btn(true), cursor: "pointer" }}>Assinar agora</button>
                  : <div style={{ display: "grid", gap: 8 }}><CampoFuncionario C={C} s={s} lista={pessoas} nome={ass.nome} id={ass.colaborador_id} usuarioId={ass.usuario_id} placeholder="Nome de quem assina…" onChange={(v) => setAss({ ...ass, nome: v.nome, colaborador_id: v.id, usuario_id: v.usuario_id })} />
                    <AssinaturaTela C={C} s={s} onChange={(png) => setAss((z) => ({ ...z, png }))} />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" onClick={() => setAss(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Cancelar</button><button type="button" disabled={!ass.png || !String(ass.nome || "").trim()} onClick={() => acao(() => apiService.post(`/auditorias/${id}/assinar`, ass), (rr) => (rr.aprovada ? "✅ Relatório aprovado — auditoria concluída." : "Assinatura registrada."), () => setAss(null))} style={{ ...s.btn(true), cursor: "pointer" }}>Confirmar assinatura</button></div></div>}
              </div>; })}</div>
            {st !== "concluida" && a.encerrada_em && <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}><span style={{ fontSize: 12, color: C.textSub }}>Com as duas assinaturas a auditoria fica concluída e o relatório vira registro.</span><button type="button" onClick={() => acao(() => apiService.post(`/auditorias/${id}/reabrir`, {}), "Execução reaberta — as assinaturas foram apagadas.", () => setAba("exec"))} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>↺ Reabrir execução</button></div>}
          </div></>}
      </>}
    </div>);
}
