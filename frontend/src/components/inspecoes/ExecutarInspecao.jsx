// components/inspecoes/ExecutarInspecao.jsx — etapa 14a
// Fazer a inspeção (pensada para o celular): registro (km/horímetro/local/cliente) → uma tela por vista (desenho com os
// pontos + lista: OK / Não OK / N.A., foto, "impede o uso") → resumo + assinatura → concluir.
// Tudo é guardado NO APARELHO a cada toque (rascunho). Concluiu sem internet → fica na fila e envia sozinho quando voltar.
// 14b.1: "🔧 Resolvi na hora" no item não OK (conta o que fez — não bloqueia) · usado também pelo link de terceiros
//   (carregarPrep / enviarFn / extraCorpo vindos da tela pública).
import { useState, useEffect, useRef, useMemo } from "react";
import apiService from "../../services/apiService";
import AssinaturaTela from "../shared/AssinaturaTela";
import { FundoVista } from "./Esquemas";
import * as Fila from "../../utils/filaInspecoes";

const COR = { ok: "#22c55e", nok: "#ef4444", na: "#64748b" };
const CAMPO = { km: ["Km (hodômetro)", "number"], horimetro: ["Horímetro (h)", "number"], local: ["Local", "text"], cliente: ["Cliente / contrato", "text"] };
const urlFoto = (f) => f.previa || `data:${f.mime};base64,${f.base64}`;

/** item: rascunho da fila (retomar) — ou { equipamento, modeloId } para começar */
export default function ExecutarInspecao({ tenant, equipamento, modeloId, rascunho, onFechar, onConcluida, C, s, carregarPrep, chavePrep, enviarFn, extraCorpo }) {
  const enviarAgora = enviarFn || ((corpo) => apiService.post("/inspecoes/enviar", corpo));
  const [it, setIt] = useState(rascunho || null);
  const [erro, setErro] = useState(null);
  const [passo, setPasso] = useState(rascunho?.passo ?? 0); // 0 = registro, 1..n = vistas, n+1 = finalizar
  const [ass, setAss] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [aberto, setAberto] = useState(null); // ponto expandido
  const [sair, setSair] = useState(false);
  const topo = useRef(null);

  // começa: busca o modelo (ou usa o que ficou guardado no aparelho, se estiver sem internet)
  useEffect(() => {
    if (rascunho) return;
    const chave = `qf-insp-prep-${tenant}-${chavePrep || `${equipamento.id}-${modeloId || "padrao"}`}`;
    (async () => {
      let prep = null;
      try { prep = carregarPrep ? await carregarPrep() : await apiService.get(`/inspecoes/preparar/${equipamento.id}`, modeloId ? { modelo_id: modeloId } : {}); try { localStorage.setItem(chave, JSON.stringify(prep)); } catch { /* ok */ } }
      catch (e) { try { prep = JSON.parse(localStorage.getItem(chave) || "null"); } catch { /* ok */ } if (!prep) return setErro(e.body ? e.message : "Sem internet e este modelo ainda não foi aberto neste aparelho. Conecte-se uma vez para baixar o modelo."); }
      const novo = { uid: Fila.novoUid(), tenant, situacao: "rascunho", prep, passo: 0, rotulo: [prep.equipamento.tag, prep.equipamento.nome].filter(Boolean).join(" — "),
        corpo: { ...(extraCorpo || {}), equipamento_id: prep.equipamento.id, modelo_id: prep.modelo.id, iniciada_em: new Date().toISOString(), km: "", horimetro: "", local: "", cliente: "", respostas: {}, obs: "", ...(prep.inicial ? { local: prep.inicial.local ?? "", cliente: prep.inicial.cliente ?? "" } : {}) } }; // 16e.2: local/cliente vindos da AT (fluxo da viagem)
      novo.corpo.cliente_uid = novo.uid;
      setIt(novo); Fila.salvar(novo);
      try { navigator.geolocation?.getCurrentPosition((p) => setIt((x) => { const y = { ...x, corpo: { ...x.corpo, gps: { lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy } } }; Fila.salvar(y); return y; }), () => {}, { timeout: 8000, maximumAge: 300000 }); } catch { /* ok */ }
    })();
  }, []); // eslint-disable-line

  const prep = it?.prep;
  // 16e.3: de onde veio o valor do campo (só enquanto ele é igual ao sugerido)
  const origemDe = (c) => { const ini = prep?.inicial; if (!ini) return null; const v = it?.corpo?.[c];
    if (c === "local") { const o = (ini._opcoes_local || []).find((x) => x.valor && x.valor === v); return o ? o.origem : (v && v === ini.local ? ini._origem?.local || "dados da AT" : null); }
    return v && v === ini[c] ? ini._origem?.[c] || "dados da AT" : null; };
  const vistas = prep?.modelo.vistas || [];
  const nPassos = vistas.length + 2;
  const mudar = (fn) => setIt((x) => { const y = fn(x); Fila.salvar(y); return y; });
  const setCorpo = (campo, v) => mudar((x) => ({ ...x, corpo: { ...x.corpo, [campo]: v } }));
  const resp = (id) => it?.corpo.respostas[id] || {};
  const setResp = (id, patch) => mudar((x) => ({ ...x, corpo: { ...x.corpo, respostas: { ...x.corpo.respostas, [id]: { ...(x.corpo.respostas[id] || {}), ...patch } } } }));
  const irPara = (p) => { setErro(null); setAberto(null); setPasso(p); mudar((x) => ({ ...x, passo: p })); setTimeout(() => topo.current?.scrollIntoView({ block: "start" }), 0); };

  const respondido = (p) => { const r = resp(p.id); if (r.status === "na") return true; if (p.tipo === "ok_nok") return r.status === "ok" || r.status === "nok"; return String(r.valor ?? "").trim() !== ""; };
  const falta = (p) => {
    const r = resp(p.id);
    if (!respondido(p)) return "verificar";
    if (r.status === "nok" && p.tipo === "ok_nok" && !String(r.obs || "").trim()) return "descrever o problema";
    if (r.status === "nok" && r.resolvido && !String(r.resolucao || "").trim()) return "contar o que foi feito";
    const precisa = r.status !== "na" && p.foto_obrigatoria !== false && (p.foto === "sempre" || ((p.foto || "se_nok") === "se_nok" && r.status === "nok"));
    if (precisa && !(r.fotos || []).length) return "tirar a foto";
    return null;
  };
  const resumo = useMemo(() => {
    const pts = vistas.flatMap((v) => v.pontos.map((p) => ({ ...p, vista: v.nome })));
    const nok = pts.filter((p) => resp(p.id).status === "nok");
    return { total: pts.length, nok, impede: nok.filter((p) => !resp(p.id).resolvido && (p.critico || resp(p.id).impede)), pendentes: pts.filter((p) => falta(p)) };
  }, [it]); // eslint-disable-line

  const validarRegistro = () => {
    for (const c of prep.modelo.campos || []) {
      const v = String(it.corpo[c] ?? "").trim();
      if (!v) return `Informe: ${CAMPO[c]?.[0] || c}`;
      if (c === "km" && prep.ultima.km && Number(v) < prep.ultima.km) return `Km menor que a última leitura (${prep.ultima.km.toLocaleString("pt-BR")})`;
      if (c === "horimetro" && prep.ultima.horimetro && Number(v) < prep.ultima.horimetro) return `Horímetro menor que a última leitura (${prep.ultima.horimetro.toLocaleString("pt-BR")})`;
    }
    return null;
  };
  const avancar = () => {
    if (passo === 0) { const e = validarRegistro(); if (e) return setErro(e); }
    else { const v = vistas[passo - 1]; const p = v.pontos.find((x) => falta(x)); if (p) { setAberto(p.id); return setErro(`Falta ${falta(p)}: ${p.rotulo}`); } }
    irPara(passo + 1);
  };
  const tudoOk = () => { const v = vistas[passo - 1]; mudar((x) => { const r = { ...x.corpo.respostas }; for (const p of v.pontos) if (p.tipo === "ok_nok" && !r[p.id]?.status) r[p.id] = { ...(r[p.id] || {}), status: "ok" }; return { ...x, corpo: { ...x.corpo, respostas: r } }; }); };
  const addFoto = async (p, file) => {
    if (!file) return;
    try { const f = await Fila.comprimirFoto(file); const atual = resp(p.id).fotos || []; if (atual.length >= 4) return setErro("No máximo 4 fotos por ponto"); setResp(p.id, { fotos: [...atual, { base64: f.base64, mime: f.mime }] }); }
    catch (e) { setErro(e.message); }
  };

  const concluir = async () => {
    setErro(null);
    if (resumo.pendentes.length) return setErro(`Falta ${falta(resumo.pendentes[0])}: ${resumo.pendentes[0].vista} → ${resumo.pendentes[0].rotulo}`);
    if (!ass) return setErro("Assine para concluir");
    const corpo = { ...it.corpo, assinatura_png: ass };
    const fila = { ...it, corpo, situacao: "pendente" };
    await Fila.salvar(fila); // guardado no aparelho ANTES de tentar enviar
    setEnviando(true);
    try {
      const r = await enviarAgora(corpo);
      await Fila.remover(it.uid);
      onConcluida({ ...r.inspecao, equipamento: prep.equipamento, offline: false });
    } catch (e) {
      if (e.body) { await Fila.salvar({ ...fila, situacao: "rascunho", passo: nPassos - 1 }); setErro(e.message); }
      else onConcluida({ offline: true, equipamento: prep.equipamento, impede: resumo.impede.length > 0 });
    } finally { setEnviando(false); }
  };

  const tela = (conteudo) => (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 250, overflowY: "auto" }}>
      <div ref={topo} style={{ maxWidth: 720, margin: "0 auto", padding: "14px 14px 120px" }}>{conteudo}</div>
    </div>
  );
  if (!it) return tela(<div style={{ padding: 30, color: erro ? C.danger : C.muted, textAlign: "center" }}>{erro || "Abrindo o modelo…"}{erro && <div style={{ marginTop: 14 }}><button type="button" onClick={onFechar} style={{ ...s.btn(true, C.accent), cursor: "pointer" }}>Voltar</button></div>}</div>);

  const cab = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <button type="button" onClick={() => setSair(true)} style={{ background: "none", border: "none", color: C.textSub, fontSize: 22, cursor: "pointer", padding: 0 }}>✕</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🔍 {it.rotulo}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{prep.modelo.nome} · passo {passo + 1} de {nPassos} · 💾 salvo no aparelho</div>
      </div>
    </div>
  );
  const barra = <div style={{ height: 4, background: C.border, borderRadius: 2, marginBottom: 14 }}><div style={{ height: 4, width: `${((passo + 1) / nPassos) * 100}%`, background: C.accent, borderRadius: 2 }} /></div>;
  const rodape = (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: C.surface, borderTop: `1px solid ${C.border}`, padding: "10px 14px", zIndex: 260 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {erro && <div style={{ color: C.danger, fontSize: 13, marginBottom: 8 }}>⚠ {erro}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          {passo > 0 && <button type="button" onClick={() => irPara(passo - 1)} style={{ ...s.btn(false), cursor: "pointer", color: C.text, flex: 1, padding: 14 }}>‹ Voltar</button>}
          {passo < nPassos - 1 ? <button type="button" onClick={avancar} style={{ ...s.btn(true, C.accent), cursor: "pointer", flex: 2, padding: 14, fontSize: 15 }}>Próximo ›</button>
            : <button type="button" onClick={concluir} disabled={enviando} style={{ ...s.btn(!enviando, resumo.impede.length ? C.danger : C.success), flex: 2, padding: 14, fontSize: 15 }}>{enviando ? "Enviando…" : "✓ Concluir inspeção"}</button>}
        </div>
      </div>
    </div>
  );
  const confirmaSair = sair && (
    <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }} onClick={() => setSair(false)}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 420, maxWidth: "100%", padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Sair da inspeção?</div>
        <div style={{ fontSize: 13, color: C.textSub, marginTop: 8 }}>O que você já preencheu fica salvo neste aparelho — dá para continuar depois em “Inspeções em andamento”.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <button type="button" onClick={async () => { await Fila.remover(it.uid); onFechar(); }} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.danger }}>Descartar</button>
          <button type="button" onClick={() => setSair(false)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Continuar</button>
          <button type="button" onClick={onFechar} style={{ ...s.btn(true, C.accent), cursor: "pointer", flex: 1 }}>Sair e guardar</button>
        </div>
      </div>
    </div>
  );

  // ─── passo 0: registro ───
  if (passo === 0) return tela(<>
    {cab}{barra}
    {prep.equipamento.bloqueado && <div style={{ ...s.card, borderColor: C.danger, padding: 12, marginBottom: 12, color: C.danger, fontSize: 13 }}>⛔ <b>Equipamento bloqueado</b>{prep.equipamento.bloqueio_motivo ? ` — ${prep.equipamento.bloqueio_motivo}` : ""}. Só use depois da liberação do gestor.</div>}
    {prep.modelo.descricao && <div style={{ fontSize: 13, color: C.textSub, marginBottom: 14, whiteSpace: "pre-wrap" }}>{prep.modelo.descricao}</div>}
    {(prep.modelo.campos || []).map((c) => (
      <label key={c} style={{ display: "block", marginBottom: 14 }}><span style={s.label}>{(CAMPO[c]?.[0] || c).toUpperCase()}{origemDe(c) ? <span title="Preenchido automaticamente — confira e corrija se precisar" style={{ marginLeft: 6, textTransform: "none", letterSpacing: 0, color: C.accent, fontWeight: 400 }}>↺ {origemDe(c)}</span> : null}</span>
        <input type={CAMPO[c]?.[1] || "text"} inputMode={CAMPO[c]?.[1] === "number" ? "decimal" : undefined} value={it.corpo[c] ?? ""} onChange={(e) => setCorpo(c, e.target.value)} style={{ ...s.input, fontSize: 17, padding: 12 }} />
        {prep.inicial && ["local", "cliente"].includes(c) && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {c === "local" && (prep.inicial._opcoes_local || []).map((o) => <button key={o.chave} type="button" onClick={() => (o.valor ? (setErro(null), setCorpo("local", o.valor)) : setErro("O endereço da base ainda não foi cadastrado — peça ao gestor para preencher em ⚙ Dados da empresa → 📍 Pátio / base da frota. Por enquanto, digite o local."))} title={o.valor || "Base não cadastrada"}
            style={{ background: it.corpo.local === o.valor ? C.accent : "transparent", color: it.corpo.local === o.valor ? "#fff" : C.textSub, border: `1px solid ${it.corpo.local === o.valor ? C.accent : C.border}`, borderRadius: 16, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>{o.rotulo}</button>)}
          {c === "cliente" && prep.inicial.cliente && it.corpo.cliente !== prep.inicial.cliente && <button type="button" onClick={() => setCorpo("cliente", prep.inicial.cliente)} style={{ background: "transparent", color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 16, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>↺ Dados da AT</button>}
          {String(it.corpo[c] || "") !== "" && <button type="button" onClick={() => setCorpo(c, "")} style={{ background: "transparent", color: C.danger, border: `1px solid ${C.border}`, borderRadius: 16, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>✕ Limpar</button>}
        </div>}
        {c === "km" && prep.ultima.km && <span style={{ fontSize: 11, color: C.muted }}>Última leitura: {prep.ultima.km.toLocaleString("pt-BR")} km</span>}
        {c === "horimetro" && prep.ultima.horimetro && <span style={{ fontSize: 11, color: C.muted }}>Última leitura: {prep.ultima.horimetro.toLocaleString("pt-BR")} h</span>}
      </label>
    ))}
    <div style={{ fontSize: 12, color: C.muted }}>{vistas.length} vista(s) · {resumo.total} ponto(s) para verificar{it.corpo.gps ? " · 📍 localização registrada" : ""}</div>
    {rodape}{confirmaSair}
  </>);

  // ─── passos 1..n: vistas ───
  if (passo <= vistas.length) {
    const v = vistas[passo - 1];
    return tela(<>
      {cab}{barra}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>{v.nome}</div>
        {v.pontos.some((p) => p.tipo === "ok_nok" && !resp(p.id).status) && <button type="button" onClick={tudoOk} style={{ ...s.btn(true, C.success), cursor: "pointer", padding: "8px 12px" }}>✓ Tudo OK nesta vista</button>}
      </div>
      <div style={{ position: "relative", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
        <FundoVista imagem={v.imagem} url={prep.imagens?.[v.imagem]} />
        {v.pontos.map((p, k) => { const st = resp(p.id).status; return (
          <div key={p.id} onClick={() => { setAberto(p.id); document.getElementById(`pt-${p.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }); }}
            style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff", background: st ? COR[st] : "#3b82f6", border: `2px solid ${aberto === p.id ? "#f59e0b" : "#fff"}`, boxShadow: "0 1px 4px #0008", cursor: "pointer" }}>{st === "ok" ? "✓" : st === "nok" ? "✕" : k + 1}</div>); })}
      </div>
      {v.pontos.map((p, k) => {
        const r = resp(p.id); const f = falta(p); const ab = aberto === p.id || r.status === "nok";
        return (
          <div key={p.id} id={`pt-${p.id}`} style={{ ...s.card, padding: 12, marginBottom: 8, borderColor: aberto === p.id && f ? C.warn : r.status ? `${COR[r.status]}66` : C.border }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }} onClick={() => setAberto(p.id)}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: r.status ? COR[r.status] : "#3b82f6", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{k + 1}</span>
              <div style={{ flex: "1 1 160px", fontSize: 14 }}>{p.rotulo}{p.critico && <span style={{ ...s.tag(C.danger), marginLeft: 6 }}>CRÍTICO</span>}{p.ajuda && <div style={{ fontSize: 11, color: C.muted }}>{p.ajuda}</div>}</div>
              {p.tipo === "ok_nok" ? (
                <div style={{ display: "flex", gap: 6 }}>
                  {[["ok", "OK"], ["nok", "Não OK"], ["na", "N.A."]].map(([k2, l]) => (
                    <button key={k2} type="button" onClick={(e) => { e.stopPropagation(); setResp(p.id, { status: k2 }); setAberto(k2 === "nok" ? p.id : null); }}
                      style={{ padding: "10px 12px", minWidth: 54, borderRadius: 8, border: `1px solid ${r.status === k2 ? COR[k2] : C.border}`, background: r.status === k2 ? COR[k2] : "transparent", color: r.status === k2 ? "#fff" : C.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type={p.tipo === "numero" ? "number" : "text"} inputMode={p.tipo === "numero" ? "decimal" : undefined} value={r.valor ?? ""} disabled={r.status === "na"} onChange={(e) => setResp(p.id, { valor: e.target.value, status: "ok" })} style={{ ...s.input, width: p.tipo === "numero" ? 110 : 200, fontSize: 15 }} />
                  {p.unidade && <span style={{ fontSize: 12, color: C.muted }}>{p.unidade}</span>}
                  <button type="button" onClick={() => setResp(p.id, { status: r.status === "na" ? null : "na", valor: "" })} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: r.status === "na" ? COR.na : "transparent", color: r.status === "na" ? "#fff" : C.text, fontSize: 12, cursor: "pointer" }}>N.A.</button>
                </div>
              )}
            </div>
            {(ab || p.foto === "sempre") && r.status !== "na" && (
              <div style={{ marginTop: 10 }}>
                {r.status === "nok" && <>
                  <textarea rows={2} value={r.obs || ""} onChange={(e) => setResp(p.id, { obs: e.target.value })} placeholder="O que está errado?" style={{ ...s.input, fontSize: 14, resize: "vertical", marginBottom: 8 }} />
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 8, cursor: "pointer" }}><input type="checkbox" checked={!!r.resolvido} onChange={(e) => setResp(p.id, { resolvido: e.target.checked })} style={{ width: 18, height: 18 }} /><span><b>🔧 Resolvi na hora</b> (consertei aqui mesmo)</span></label>
                  {r.resolvido && <textarea rows={2} value={r.resolucao || ""} onChange={(e) => setResp(p.id, { resolucao: e.target.value })} placeholder="O que foi feito? (ex.: troquei a lâmpada, reapertei a mangueira)" style={{ ...s.input, fontSize: 14, resize: "vertical", marginBottom: 8, borderColor: f === "contar o que foi feito" ? C.danger : undefined }} />}
                  {!r.resolvido && (p.critico ? <div style={{ fontSize: 12, color: C.danger, marginBottom: 8 }}>⛔ Item crítico — o equipamento ficará bloqueado até o gestor liberar.</div>
                    : <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 8, cursor: "pointer" }}><input type="checkbox" checked={!!r.impede} onChange={(e) => setResp(p.id, { impede: e.target.checked })} style={{ width: 18, height: 18 }} /><span><b>Impede o uso</b> (bloqueia o equipamento)</span></label>)}
                </>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {(r.fotos || []).map((ft, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={urlFoto(ft)} alt="" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.border}` }} />
                      <button type="button" onClick={() => setResp(p.id, { fotos: r.fotos.filter((_, j) => j !== i) })} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: C.danger, color: "#fff", fontSize: 11, cursor: "pointer" }}>✕</button>
                    </div>
                  ))}
                  {(r.fotos || []).length < 4 && p.foto !== "nunca" && (
                    <label style={{ width: 70, height: 70, borderRadius: 6, border: `1px dashed ${f === "tirar a foto" ? C.danger : C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, color: C.textSub }}>
                      <span style={{ fontSize: 22 }}>📷</span>{f === "tirar a foto" ? "obrigatória" : p.foto_obrigatoria === false ? "opcional" : "foto"}
                      <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { addFoto(p, e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {rodape}{confirmaSair}
    </>);
  }

  // ─── finalizar ───
  const res = resumo.impede.length ? ["⛔ Reprovado — equipamento será bloqueado", C.danger] : resumo.nok.length ? ["⚠ Aprovado com ressalvas", C.warn] : ["✓ Aprovado", C.success];
  return tela(<>
    {cab}{barra}
    <div style={{ ...s.card, padding: 14, marginBottom: 12, borderColor: res[1] }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: res[1] }}>{res[0]}</div>
      <div style={{ fontSize: 13, color: C.textSub, marginTop: 4 }}>{resumo.total} pontos verificados · {resumo.nok.length} não OK</div>
      {resumo.nok.map((p) => <div key={p.id} style={{ fontSize: 13, marginTop: 6 }}>{resp(p.id).resolvido ? "🔧" : "✕"} <b>{p.vista}</b> → {p.rotulo}: {resp(p.id).obs}{resp(p.id).resolvido ? <span style={{ color: C.success }}> — resolvido: {resp(p.id).resolucao}</span> : (p.critico || resp(p.id).impede) && <span style={{ color: C.danger }}> (impede o uso)</span>}</div>)}
      {resumo.pendentes.length > 0 && <div style={{ color: C.warn, fontSize: 13, marginTop: 8 }}>Ainda falta: {resumo.pendentes.map((p) => p.rotulo).join(", ")}</div>}
    </div>
    <label style={{ display: "block", marginBottom: 12 }}><span style={s.label}>OBSERVAÇÕES (OPCIONAL)</span><textarea rows={2} value={it.corpo.obs || ""} onChange={(e) => setCorpo("obs", e.target.value)} style={{ ...s.input, resize: "vertical" }} /></label>
    <span style={s.label}>ASSINATURA DE QUEM INSPECIONOU</span>
    <AssinaturaTela C={C} s={s} onChange={setAss} altura={160} />
    <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Sem internet? Pode concluir: a inspeção fica guardada no aparelho e é enviada sozinha quando a conexão voltar.</div>
    {rodape}{confirmaSair}
  </>);
}
