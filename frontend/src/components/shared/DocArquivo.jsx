// components/shared/DocArquivo.jsx — etapa 18zz.13: mostra o PDF/imagem da empresa NA TELA (páginas empilhadas), sem o nosso modelo por cima
//   Toque numa página = abre flutuante com zoom (VerArquivo). Se não conseguir desenhar, oferece abrir o arquivo flutuante.
import { useEffect, useState } from "react";
import { paginasDoArquivo, MAX_PAGINAS } from "../../utils/paginasArquivo";

export default function DocArquivo({ url, mime, nome, C, onAbrir }) {
  const [st, setSt] = useState({ carregando: true, paginas: [], total: 0, erro: null });
  useEffect(() => {
    let vivo = true; setSt({ carregando: true, paginas: [], total: 0, erro: null });
    paginasDoArquivo(url, { mime, nome }).then((r) => vivo && setSt({ carregando: false, ...r, erro: null }))
      .catch(() => vivo && setSt({ carregando: false, paginas: [], total: 0, erro: "Não consegui mostrar o arquivo aqui." }));
    return () => { vivo = false; };
  }, [url]); // eslint-disable-line
  if (st.carregando) return <div style={{ background: "#fff", borderRadius: 6, padding: 40, textAlign: "center", color: "#555", fontSize: 13 }}>Abrindo o documento…</div>;
  if (st.erro) return <div style={{ background: "#fff", borderRadius: 6, padding: 24, textAlign: "center", color: "#555", fontSize: 13 }}>{st.erro} <button type="button" onClick={onAbrir} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 13 }}>📎 Abrir o arquivo</button></div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {st.paginas.map((p, i) => <img key={i} src={p} alt={`Página ${i + 1}`} onClick={() => onAbrir?.(p)} style={{ width: "100%", background: "#fff", borderRadius: 4, boxShadow: "0 2px 10px rgba(0,0,0,.35)", cursor: "zoom-in", display: "block" }} />)}
      {st.total > st.paginas.length && <div style={{ fontSize: 12, color: C?.textSub || "#999", textAlign: "center" }}>Mostrando {MAX_PAGINAS} de {st.total} páginas — <button type="button" onClick={() => onAbrir?.()} style={{ background: "none", border: "none", color: C?.accent || "#3b82f6", cursor: "pointer", fontSize: 12 }}>abrir o arquivo completo</button></div>}
    </div>
  );
}
