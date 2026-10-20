// components/pessoas/AreaTreinamentoColaborador.jsx — etapa 12e.2b
// O que o COLABORADOR vê — usado em dois lugares, com o mesmo visual:
//   • "🎓 Meus treinamentos" (colaborador logado) — TelaMeusTreinamentos.jsx
//   • link externo da prova (CPF + data de nascimento) — TelaProvaPublica.jsx
// api = { abrir(turmaId), material(turmaId, i), prova(turmaId, respostas), concluir(turmaId) } (cada uma devolve Promise do JSON)
// Fluxo: conteúdo (texto, vídeo, PDF) → prova (até N tentativas; reprovou → revisa o conteúdo antes de tentar de novo)
//        → aprovado = presença + horas creditadas. Sem prova: "✓ Concluí o conteúdo" (declaração).
import { useState, useEffect } from "react";
import TextoAula from "../shared/TextoAula";
import { embedVideo } from "../shared/EditorConteudoTreinamento";

export const CORES = { bg: "#0a0e14", surface: "#111722", border: "#1e2535", accent: "#3b82f6", success: "#22c55e", warn: "#f59e0b", danger: "#ef4444", muted: "#64748b", text: "#e2e8f0", textSub: "#94a3b8" };
const C = CORES;
export const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 };
export const botao = (on = true, cor = C.accent) => ({ background: on ? cor : C.surface, border: `1px solid ${on ? cor : C.border}`, borderRadius: 8, padding: "11px 18px", color: on ? "#fff" : C.muted, fontSize: 14, fontWeight: 600, cursor: on ? "pointer" : "not-allowed", fontFamily: "inherit" });
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const fmtH = (n) => `${Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;

export default function AulaEProva({ api, turmaId, onVoltar, onMudou }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState("conteudo"); // conteudo | prova | resultado
  const [resp, setResp] = useState([]);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [revisou, setRevisou] = useState(false);
  const [declaro, setDeclaro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [video, setVideo] = useState(null);

  const carregar = async () => {
    try { const r = await api.abrir(turmaId); setD(r); setResp((r.prova?.perguntas || []).map(() => null)); setErro(""); }
    catch (e) { setErro(e.message); }
  };
  useEffect(() => { carregar(); }, [turmaId]); // eslint-disable-line

  if (erro && !d) return <div style={{ ...card, padding: 20, color: C.danger }}>{erro}</div>;
  if (!d) return <div style={{ color: C.muted, padding: 20 }}>Carregando…</div>;

  const abrirPdf = async (i) => {
    const w = window.open("", "_blank");
    try { const r = await api.material(turmaId, i); if (w) w.location.href = r.url; else window.location.href = r.url; }
    catch (e) { try { w?.close(); } catch { /* ok */ } setErro(e.message); }
  };
  const enviar = async () => {
    setEnviando(true); setErro("");
    try {
      const r = await api.prova(turmaId, resp);
      setResultado(r); setModo("resultado"); setConfirmando(false); setRevisou(false);
      await carregar(); onMudou?.();
    } catch (e) { setErro(e.message); setConfirmando(false); }
    finally { setEnviando(false); }
  };
  const concluir = async () => {
    setEnviando(true); setErro("");
    try { await api.concluir(turmaId); await carregar(); onMudou?.(); }
    catch (e) { setErro(e.message); }
    finally { setEnviando(false); }
  };

  const reprovouAntes = d.tentativas_usadas > 0 && !d.concluido;
  const podeProva = d.tem_prova && !d.concluido && !d.encerrada && d.restantes > 0 && (!reprovouAntes || revisou);
  const todas = resp.length > 0 && resp.every((x) => x !== null);

  return (
    <div style={{ color: C.text }}>
      {onVoltar && <button onClick={onVoltar} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 10, fontFamily: "inherit" }}>← Meus treinamentos</button>}
      <div style={{ fontSize: 20, fontWeight: 700 }}>🎓 {d.treinamento}</div>
      <div style={{ fontSize: 13, color: C.textSub, margin: "4px 0 14px" }}>
        {d.norma ? `${d.norma} · ` : ""}{d.carga_horaria ? `${fmtH(d.carga_horaria)} · ` : ""}{d.tem_prova ? `prova: ${d.perguntas} perguntas, mínimo ${d.nota_minima}%` : "sem prova"}
      </div>

      {d.concluido && (
        <div style={{ ...card, padding: 14, borderColor: C.success, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: C.success }}>✓ Concluído{d.nota != null ? ` — nota ${Number(d.nota).toLocaleString("pt-BR")}%` : ""}</div>
          <div style={{ fontSize: 13, color: C.textSub, marginTop: 4 }}>em {d.concluido_em ? new Date(d.concluido_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}{d.valido_ate ? ` · válido até ${dataBR(d.valido_ate)}` : ""}{d.carga_horaria ? ` · ${fmtH(d.carga_horaria)} creditadas` : ""}</div>
        </div>
      )}
      {d.encerrada && !d.concluido && <div style={{ ...card, padding: 14, color: C.warn, marginBottom: 14 }}>Esta turma já foi encerrada.</div>}

      {/* ─── resultado da última tentativa ─── */}
      {modo === "resultado" && resultado && (
        <div style={{ ...card, padding: 16, marginBottom: 14, borderColor: resultado.aprovado ? C.success : C.danger }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: resultado.aprovado ? C.success : C.danger }}>{resultado.aprovado ? "🎉 Aprovado!" : "Não foi desta vez"}</div>
          <div style={{ fontSize: 14, marginTop: 6 }}>Você acertou {resultado.acertos} de {resultado.total} — nota {Number(resultado.nota).toLocaleString("pt-BR")}% (mínimo {resultado.nota_minima}%).</div>
          {!resultado.aprovado && <div style={{ fontSize: 13, color: C.textSub, marginTop: 6 }}>{resultado.restantes > 0 ? `Revise o conteúdo abaixo e tente de novo — resta(m) ${resultado.restantes} tentativa(s).` : "As tentativas acabaram. Fale com o responsável pelo treinamento para liberar de novo."}</div>}
        </div>
      )}

      {/* ─── conteúdo ─── */}
      {modo !== "prova" && (<>
        {d.conteudo && <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>{d.conteudo}</div>}
        {d.secoes.map((sec) => {
          const emb = embedVideo(sec.video_url);
          return (
            <div key={sec.indice} style={{ ...card, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{sec.indice + 1}. {sec.titulo}</div>
              {sec.texto && <TextoAula texto={sec.texto} cor={C.accent} />}
              {sec.video_url && (emb
                ? (video === sec.indice
                    ? <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 8, overflow: "hidden", margin: "8px 0" }}><iframe title={sec.titulo} src={emb} allow="fullscreen; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} /></div>
                    : <button onClick={() => setVideo(sec.indice)} style={{ ...botao(true), margin: "8px 8px 0 0", fontSize: 13, padding: "8px 14px" }}>▶ Assistir ao vídeo</button>)
                : <a href={sec.video_url} target="_blank" rel="noopener noreferrer" style={{ ...botao(true), display: "inline-block", textDecoration: "none", margin: "8px 8px 0 0", fontSize: 13, padding: "8px 14px" }}>▶ Abrir vídeo</a>)}
              {sec.tem_pdf && <button onClick={() => abrirPdf(sec.indice)} style={{ ...botao(false), color: C.text, cursor: "pointer", margin: "8px 8px 0 0", fontSize: 13, padding: "8px 14px" }}>📄 {sec.material_nome || "Material de apoio"}</button>}
              {sec.material_url && <a href={sec.material_url} target="_blank" rel="noopener noreferrer" style={{ ...botao(false), color: C.text, cursor: "pointer", display: "inline-block", textDecoration: "none", margin: "8px 8px 0 0", fontSize: 13, padding: "8px 14px" }}>🔗 Material de apoio</a>}
            </div>
          );
        })}
        {!d.secoes.length && <div style={{ ...card, padding: 16, color: C.muted, marginBottom: 12 }}>Este treinamento não tem conteúdo online.</div>}

        {/* ─── ação final ─── */}
        {!d.concluido && !d.encerrada && (d.tem_prova ? (
          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>📝 Prova — {d.perguntas} perguntas, mínimo {d.nota_minima}%. Tentativas: {d.tentativas_usadas} de {d.tentativas_max}.</div>
            {d.restantes === 0 ? <div style={{ color: C.danger, fontSize: 13 }}>As tentativas acabaram. Fale com o responsável pelo treinamento para liberar de novo.</div> : (<>
              {reprovouAntes && <label style={{ display: "flex", gap: 8, fontSize: 13, color: C.textSub, marginBottom: 10, cursor: "pointer" }}><input type="checkbox" checked={revisou} onChange={(e) => setRevisou(e.target.checked)} />Revisei o conteúdo acima antes de tentar de novo.</label>}
              <button disabled={!podeProva} onClick={() => { setResp((d.prova?.perguntas || []).map(() => null)); setModo("prova"); window.scrollTo?.(0, 0); }} style={botao(podeProva)}>Fazer a prova</button>
            </>)}
          </div>
        ) : (
          <div style={{ ...card, padding: 16 }}>
            <label style={{ display: "flex", gap: 8, fontSize: 13, marginBottom: 10, cursor: "pointer" }}><input type="checkbox" checked={declaro} onChange={(e) => setDeclaro(e.target.checked)} />Declaro que estudei todo o conteúdo deste treinamento.</label>
            <button disabled={!declaro || enviando} onClick={concluir} style={botao(declaro && !enviando, C.success)}>{enviando ? "Registrando…" : "✓ Concluí o conteúdo"}</button>
          </div>
        ))}
      </>)}

      {/* ─── prova ─── */}
      {modo === "prova" && d.prova && (
        <div>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>Tentativa {d.tentativas_usadas + 1} de {d.tentativas_max} · mínimo {d.nota_minima}% para aprovar.</div>
          {d.prova.perguntas.map((q, i) => (
            <div key={i} style={{ ...card, padding: 16, marginBottom: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>{i + 1}. {q.enunciado}</div>
              {q.alternativas.map((a, j) => (
                <label key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 4, border: `1px solid ${resp[i] === j ? C.accent : C.border}`, background: resp[i] === j ? `${C.accent}18` : "transparent", fontSize: 14 }}>
                  <input type="radio" name={`q${i}`} checked={resp[i] === j} onChange={() => setResp(resp.map((x, k) => (k === i ? j : x)))} style={{ marginTop: 3 }} />
                  <span><b>{String.fromCharCode(65 + j)})</b> {a}</span>
                </label>
              ))}
            </div>
          ))}
          {erro && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{erro}</div>}
          {!confirmando ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setModo("conteudo")} style={{ ...botao(false), color: C.text, cursor: "pointer" }}>← Voltar ao conteúdo</button>
              <button disabled={!todas} onClick={() => setConfirmando(true)} style={botao(todas)}>{todas ? "Enviar respostas" : `Responda todas (${resp.filter((x) => x !== null).length}/${resp.length})`}</button>
            </div>
          ) : (
            <div style={{ ...card, padding: 14, borderColor: C.warn }}>
              <div style={{ fontSize: 14, marginBottom: 10 }}>Enviar as respostas? Esta é a tentativa {d.tentativas_usadas + 1} de {d.tentativas_max} e não dá para mudar depois.</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmando(false)} style={{ ...botao(false), color: C.text, cursor: "pointer" }}>Revisar respostas</button>
                <button disabled={enviando} onClick={enviar} style={botao(!enviando, C.success)}>{enviando ? "Enviando…" : "✓ Confirmar envio"}</button>
              </div>
            </div>
          )}
        </div>
      )}
      {erro && modo !== "prova" && <div style={{ color: C.danger, fontSize: 13, marginTop: 10 }}>{erro}</div>}
    </div>
  );
}

/** Lista de "Meus treinamentos" (colaborador logado) */
export function ListaMeusTreinamentos({ dados, onAbrir }) {
  const { pendentes = [], historico = [], horas, colaborador } = dados || {};
  return (
    <div style={{ color: C.text }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>🎓 Meus treinamentos</div>
      <div style={{ fontSize: 13, color: C.textSub, margin: "4px 0 14px" }}>{colaborador?.nome}{colaborador?.funcao ? ` · ${colaborador.funcao}` : ""}</div>
      {horas && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {[["Horas no ano", horas.ano], ["Últimos 12 meses", horas.ultimos_12m], ["Total", horas.total]].map(([l, n]) => (
            <div key={l} style={{ ...card, padding: "10px 16px" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#a855f7" }}>⏱ {fmtH(n)}</div><div style={{ fontSize: 11, color: C.textSub }}>{l}</div></div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Para fazer ({pendentes.length})</div>
      {pendentes.length === 0 && <div style={{ ...card, padding: 16, color: C.textSub, marginBottom: 16 }}>Nenhum treinamento online pendente. 👍</div>}
      <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
        {pendentes.map((t) => (
          <button key={t.turma_id} onClick={() => onAbrir(t.turma_id)} style={{ ...card, padding: 14, textAlign: "left", cursor: "pointer", color: C.text, fontFamily: "inherit" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{t.treinamento}</div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
              {t.carga_horaria ? `${fmtH(t.carga_horaria)} · ` : ""}{t.tem_prova ? `prova ${t.tentativas_usadas}/${t.tentativas_max} tentativas` : "sem prova"}
              {t.situacao === "esgotou" ? <span style={{ color: C.danger }}> · tentativas esgotadas — fale com o responsável</span> : t.situacao === "reprovado" ? <span style={{ color: C.warn }}> · reprovado — revise e tente de novo</span> : ""}
            </div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Já realizados</div>
      {historico.length === 0 ? <div style={{ ...card, padding: 16, color: C.textSub }}>Nenhum ainda.</div> : (
        <div style={{ ...card, overflow: "hidden" }}>
          {historico.map((h, i) => (
            <div key={h.id} style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderBottom: i < historico.length - 1 ? `1px solid ${C.border}` : "none", fontSize: 13 }}>
              <div style={{ flex: "2 1 200px", fontWeight: 600 }}>{h.treinamento}</div>
              <div style={{ color: C.textSub }}>{dataBR(h.data)}</div>
              {h.nota != null && <div style={{ color: C.textSub }}>nota {Number(h.nota).toLocaleString("pt-BR")}%</div>}
              <div style={{ color: "#a855f7" }}>⏱ {fmtH(h.horas)}</div>
              <div style={{ color: C.textSub }}>{h.valido_ate ? `válido até ${dataBR(h.valido_ate)}` : "não vence"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
