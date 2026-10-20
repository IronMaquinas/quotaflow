// components/shared/EditorConteudoTreinamento.jsx — etapa 12e.2a
// Editor do CONTEÚDO (seções com texto, vídeo por link e material de apoio) e da PROVA (múltipla escolha,
// nota mínima, tentativas) de um treinamento. Usado em dois lugares, com o visual de cada um:
//   • Pessoas → 🎓 Treinamentos → 📚 Catálogo (treinamento da empresa)
//   • Console da Plataforma → 🎓 Biblioteca de treinamentos (modelo do QuotaFlow)
// ui = { text, sub, border, accent, danger, success, input (estilo), label (estilo) }
// Vídeo: link do YouTube ou Vimeo (pode ser "não listado") — o QuotaFlow não hospeda o arquivo.
// 12e.2b: "📎 Enviar PDF" (fica no bucket privado do QuotaFlow — só quem faz o treinamento abre) e
//   "👁 Ver como o colaborador vê" (formatação leve: # título, - lista, **negrito**).
// onEnviarPdf(base64, nome) → { material_path, material_nome } · onVerPdf(path) → url   (sem eles, o botão não aparece)
import { useState } from "react";
import TextoAula from "./TextoAula";

const lerPdf = (file) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => falha(new Error("Não foi possível ler o arquivo")); r.readAsDataURL(file); });

/** Link do YouTube/Vimeo → URL de embed (ou null se não reconhecer) */
export function embedVideo(url) {
  const u = String(url || "").trim();
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/i);
  if (m) return `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ""}`;
  return null;
}

export const secaoVazia = () => ({ titulo: "", texto: "", video_url: "", material_url: "", material_path: null, material_nome: null });
export const perguntaVazia = () => ({ enunciado: "", alternativas: ["", "", "", ""], correta: 0 });
export const provaVazia = () => ({ nota_minima: 70, tentativas_max: 3, perguntas: [] });

export default function EditorConteudoTreinamento({ secoes = [], prova = null, onChange, ui, onEnviarPdf, onVerPdf }) {
  const [aba, setAba] = useState("conteudo");
  const [ver, setVer] = useState(null); // índice da seção com vídeo aberto
  const [previa, setPrevia] = useState(null); // índice da seção com prévia do texto
  const [subindo, setSubindo] = useState(null);
  const [erroPdf, setErroPdf] = useState("");
  const enviarPdf = async (i, file) => {
    setErroPdf("");
    if (!file) return;
    if (file.type !== "application/pdf") { setErroPdf("Envie um arquivo PDF"); return; }
    if (file.size > 10 * 1024 * 1024) { setErroPdf("PDF maior que 10 MB"); return; }
    setSubindo(i);
    try { const r = await onEnviarPdf(await lerPdf(file), file.name); setSecoes(secoes.map((x, k) => (k === i ? { ...x, material_path: r.material_path, material_nome: r.material_nome } : x))); }
    catch (e) { setErroPdf(e.message); }
    finally { setSubindo(null); }
  };
  const verPdf = async (path) => {
    const w = window.open("", "_blank");
    try { const url = await onVerPdf(path); if (w && url) w.location.href = url; } catch (e) { try { w?.close(); } catch { /* ok */ } setErroPdf(e.message); }
  };
  const p = prova || provaVazia();
  const setSecoes = (n) => onChange({ secoes: n, prova });
  const setProva = (n) => onChange({ secoes, prova: n });
  const mover = (arr, i, d) => { const c = [...arr]; const j = i + d; if (j < 0 || j >= c.length) return c; [c[i], c[j]] = [c[j], c[i]]; return c; };

  const botao = (on) => ({ background: on ? ui.accent : "transparent", color: on ? "#fff" : ui.text, border: `1px solid ${on ? ui.accent : ui.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });
  const mini = { background: "none", border: "none", color: ui.sub, cursor: "pointer", fontSize: 13, padding: "0 4px", fontFamily: "inherit" };
  const link = { background: "none", border: "none", color: ui.accent, cursor: "pointer", fontSize: 12, padding: 0, fontFamily: "inherit" };
  const caixa = { border: `1px solid ${ui.border}`, borderRadius: 8, padding: 10, marginBottom: 8 };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button type="button" onClick={() => setAba("conteudo")} style={botao(aba === "conteudo")}>📖 Conteúdo ({secoes.length})</button>
        <button type="button" onClick={() => setAba("prova")} style={botao(aba === "prova")}>📝 Prova ({p.perguntas.length})</button>
      </div>

      {aba === "conteudo" && (<>
        <div style={{ fontSize: 11, color: ui.sub, marginBottom: 8 }}>Divida em seções (aulas). Vídeo: link do YouTube ou Vimeo — pode ser “não listado”. Material: link de PDF/apostila.</div>
        {secoes.map((sec, i) => {
          const emb = embedVideo(sec.video_url);
          return (
            <div key={i} style={caixa}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <b style={{ fontSize: 12, color: ui.sub }}>{i + 1}.</b>
                <input value={sec.titulo} onChange={(e) => setSecoes(secoes.map((x, k) => (k === i ? { ...x, titulo: e.target.value } : x)))} placeholder="Título da seção (ex.: Por que usar EPI)" style={{ ...ui.input, flex: 1, padding: "6px 10px", fontSize: 13 }} />
                <button type="button" title="Subir" onClick={() => setSecoes(mover(secoes, i, -1))} style={mini}>↑</button>
                <button type="button" title="Descer" onClick={() => setSecoes(mover(secoes, i, 1))} style={mini}>↓</button>
                <button type="button" title="Tirar seção" onClick={() => setSecoes(secoes.filter((_, k) => k !== i))} style={{ ...mini, color: ui.danger }}>×</button>
              </div>
              <textarea rows={4} value={sec.texto || ""} onChange={(e) => setSecoes(secoes.map((x, k) => (k === i ? { ...x, texto: e.target.value } : x)))} placeholder={"Texto da aula (opcional). Formatação: # Título · - item de lista · **negrito**"} style={{ ...ui.input, resize: "vertical", fontSize: 12, padding: "6px 10px", marginBottom: 4 }} />
              {sec.texto && <button type="button" onClick={() => setPrevia(previa === i ? null : i)} style={{ ...link, fontSize: 11, marginBottom: 6 }}>{previa === i ? "Fechar prévia" : "👁 Ver como o colaborador vê"}</button>}
              {previa === i && <div style={{ border: `1px dashed ${ui.border}`, borderRadius: 6, padding: "8px 12px", marginBottom: 6, color: ui.text }}><TextoAula texto={sec.texto} cor={ui.accent} /></div>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input value={sec.video_url || ""} onChange={(e) => setSecoes(secoes.map((x, k) => (k === i ? { ...x, video_url: e.target.value } : x)))} placeholder="🎬 https://youtu.be/…" style={{ ...ui.input, flex: "1 1 200px", fontSize: 12, padding: "6px 10px" }} />
                <input value={sec.material_url || ""} onChange={(e) => setSecoes(secoes.map((x, k) => (k === i ? { ...x, material_url: e.target.value } : x)))} placeholder="🔗 https://… (link de material — seu site, Drive)" style={{ ...ui.input, flex: "1 1 200px", fontSize: 12, padding: "6px 10px" }} />
              </div>
              {onEnviarPdf && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6, fontSize: 12 }}>
                  {sec.material_path ? (<>
                    <span style={{ color: ui.text }}>📎 {sec.material_nome || "PDF"}</span>
                    {onVerPdf && <button type="button" onClick={() => verPdf(sec.material_path)} style={link}>abrir</button>}
                    <button type="button" onClick={() => setSecoes(secoes.map((x, k) => (k === i ? { ...x, material_path: null, material_nome: null } : x)))} style={{ ...link, color: ui.danger }}>tirar</button>
                  </>) : (
                    <label style={{ ...link, cursor: subindo === i ? "wait" : "pointer" }}>
                      {subindo === i ? "Enviando…" : "📎 Enviar PDF (protegido — só quem faz o treinamento abre)"}
                      <input type="file" accept="application/pdf" disabled={subindo !== null} onChange={(e) => { enviarPdf(i, e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
                    </label>
                  )}
                </div>
              )}
              {sec.video_url && (emb
                ? <button type="button" onClick={() => setVer(ver === i ? null : i)} style={{ ...link, marginTop: 6 }}>{ver === i ? "Fechar vídeo" : "▶ Ver vídeo"}</button>
                : <div style={{ fontSize: 11, color: ui.danger, marginTop: 4 }}>Link não reconhecido como YouTube/Vimeo — vai abrir como link comum.</div>)}
              {ver === i && emb && <div style={{ position: "relative", paddingTop: "56.25%", marginTop: 6, borderRadius: 6, overflow: "hidden" }}><iframe title="vídeo" src={emb} allow="fullscreen; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} /></div>}
            </div>
          );
        })}
        {erroPdf && <div style={{ fontSize: 12, color: ui.danger, marginBottom: 6 }}>{erroPdf}</div>}
        <button type="button" onClick={() => setSecoes([...secoes, secaoVazia()])} style={link}>＋ Adicionar seção</button>
      </>)}

      {aba === "prova" && (<>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <label style={{ flex: "1 1 120px" }}><span style={ui.label}>NOTA MÍNIMA (%)</span><input type="number" min={1} max={100} value={p.nota_minima} onChange={(e) => setProva({ ...p, nota_minima: e.target.value })} style={ui.input} /></label>
          <label style={{ flex: "1 1 120px" }}><span style={ui.label}>TENTATIVAS</span><input type="number" min={1} max={5} value={p.tentativas_max} onChange={(e) => setProva({ ...p, tentativas_max: e.target.value })} style={ui.input} /></label>
        </div>
        <div style={{ fontSize: 11, color: ui.sub, marginBottom: 8 }}>Marque (●) a alternativa correta. Esgotadas as tentativas, o instrutor libera de novo. Sem perguntas = treinamento sem prova.</div>
        {p.perguntas.map((q, i) => (
          <div key={i} style={caixa}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <b style={{ fontSize: 12, color: ui.sub }}>{i + 1}.</b>
              <input value={q.enunciado} onChange={(e) => setProva({ ...p, perguntas: p.perguntas.map((x, k) => (k === i ? { ...x, enunciado: e.target.value } : x)) })} placeholder="Enunciado da pergunta" style={{ ...ui.input, flex: 1, padding: "6px 10px", fontSize: 13 }} />
              <button type="button" title="Tirar pergunta" onClick={() => setProva({ ...p, perguntas: p.perguntas.filter((_, k) => k !== i) })} style={{ ...mini, color: ui.danger }}>×</button>
            </div>
            {q.alternativas.map((a, j) => (
              <div key={j} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, paddingLeft: 16 }}>
                <input type="radio" name={`correta-${i}`} checked={Number(q.correta) === j} onChange={() => setProva({ ...p, perguntas: p.perguntas.map((x, k) => (k === i ? { ...x, correta: j } : x)) })} title="Alternativa correta" />
                <input value={a} onChange={(e) => setProva({ ...p, perguntas: p.perguntas.map((x, k) => (k === i ? { ...x, alternativas: x.alternativas.map((y, z) => (z === j ? e.target.value : y)) } : x)) })} placeholder={`Alternativa ${String.fromCharCode(65 + j)}`} style={{ ...ui.input, flex: 1, padding: "5px 10px", fontSize: 12, ...(Number(q.correta) === j ? { borderColor: ui.success } : {}) }} />
                {q.alternativas.length > 2 && <button type="button" onClick={() => setProva({ ...p, perguntas: p.perguntas.map((x, k) => (k === i ? { ...x, alternativas: x.alternativas.filter((_, z) => z !== j), correta: Number(x.correta) === j ? 0 : Number(x.correta) > j ? Number(x.correta) - 1 : x.correta } : x)) })} style={mini}>×</button>}
              </div>
            ))}
            {q.alternativas.length < 6 && <button type="button" onClick={() => setProva({ ...p, perguntas: p.perguntas.map((x, k) => (k === i ? { ...x, alternativas: [...x.alternativas, ""] } : x)) })} style={{ ...link, paddingLeft: 16 }}>＋ alternativa</button>}
          </div>
        ))}
        <button type="button" onClick={() => setProva({ ...p, perguntas: [...p.perguntas, perguntaVazia()] })} style={link}>＋ Adicionar pergunta</button>
      </>)}
    </div>
  );
}

/** Prepara para enviar ao backend: tira alternativas vazias e linhas sem título */
export function limparConteudo({ secoes = [], prova = null }) {
  const sec = secoes.filter((x) => String(x.titulo || "").trim() || String(x.texto || "").trim() || String(x.video_url || "").trim() || x.material_path)
    .map((x) => ({ ...x, titulo: String(x.titulo || "").trim() || "Seção" }));
  if (!prova || !prova.perguntas?.length) return { secoes: sec, prova: null };
  const perguntas = prova.perguntas.map((q) => {
    const idx = q.alternativas.map((a, j) => [String(a || "").trim(), j]).filter(([a]) => a);
    const novaCorreta = idx.findIndex(([, j]) => j === Number(q.correta));
    return { enunciado: q.enunciado, alternativas: idx.map(([a]) => a), correta: novaCorreta };
  });
  return { secoes: sec, prova: { nota_minima: prova.nota_minima, tentativas_max: prova.tentativas_max, perguntas } };
}
