// components/shared/TextoAula.jsx — etapa 12e.2b
// Mostra o texto de uma aula com formatação LEVE (sem HTML — seguro):
//   # Título · ## Subtítulo · linhas com "- " viram lista · **negrito** · links https:// clicáveis · linha em branco = parágrafo.
import { Fragment } from "react";

function inline(txt, cor) {
  const out = [];
  String(txt).split(/(\*\*[^*]+\*\*|https:\/\/[^\s)]+)/g).forEach((p, i) => {
    if (!p) return;
    if (/^\*\*[^*]+\*\*$/.test(p)) out.push(<b key={i}>{p.slice(2, -2)}</b>);
    else if (/^https:\/\//.test(p)) out.push(<a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: cor, wordBreak: "break-all" }}>{p}</a>);
    else out.push(<Fragment key={i}>{p}</Fragment>);
  });
  return out;
}

export default function TextoAula({ texto, cor = "#3b82f6", style }) {
  const linhas = String(texto || "").replace(/\r\n/g, "\n").split("\n");
  const blocos = []; let lista = null, par = [];
  const fechaPar = () => { if (par.length) { blocos.push({ t: "p", v: par }); par = []; } };
  const fechaLista = () => { if (lista) { blocos.push({ t: "ul", v: lista }); lista = null; } };
  for (const l of linhas) {
    const x = l.trimEnd();
    if (/^\s*[-•]\s+/.test(x)) { fechaPar(); (lista = lista || []).push(x.replace(/^\s*[-•]\s+/, "")); continue; }
    fechaLista();
    if (/^##\s+/.test(x)) { fechaPar(); blocos.push({ t: "h5", v: x.replace(/^##\s+/, "") }); }
    else if (/^#\s+/.test(x)) { fechaPar(); blocos.push({ t: "h4", v: x.replace(/^#\s+/, "") }); }
    else if (!x.trim()) fechaPar();
    else par.push(x);
  }
  fechaPar(); fechaLista();
  return (
    <div style={{ fontSize: 14, lineHeight: 1.6, ...style }}>
      {blocos.map((b, i) => b.t === "h4" ? <div key={i} style={{ fontSize: 16, fontWeight: 700, margin: "12px 0 6px" }}>{inline(b.v, cor)}</div>
        : b.t === "h5" ? <div key={i} style={{ fontSize: 14, fontWeight: 700, margin: "10px 0 4px" }}>{inline(b.v, cor)}</div>
        : b.t === "ul" ? <ul key={i} style={{ margin: "4px 0 8px", paddingLeft: 20 }}>{b.v.map((it, k) => <li key={k}>{inline(it, cor)}</li>)}</ul>
        : <p key={i} style={{ margin: "0 0 8px" }}>{b.v.map((l, k) => <Fragment key={k}>{k > 0 && <br />}{inline(l, cor)}</Fragment>)}</p>)}
    </div>
  );
}
