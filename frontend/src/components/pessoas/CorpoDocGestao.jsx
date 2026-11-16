// components/pessoas/CorpoDocGestao.jsx — etapa 18zz.13: o que aparece no 👁 Ver de um documento de gestão
//   Texto no sistema → nosso A4 (logo, cabeçalho de controle, rodapé). Só arquivo da empresa → faixa de controle + o PDF/imagem DELA, como é.
//   arq = { url, mime, nome } do arquivo desta revisão. onZoom(arq) abre flutuante (VerArquivo).
import { corpoDocGestao, faixaControleHtml, CSS_DOC_GESTAO } from "../../utils/gerarDocumentoGestao";
import { soArquivo } from "../../utils/paginasArquivo";
import DocArquivo from "../shared/DocArquivo";

export default function CorpoDocGestao({ doc, arq, opc = {}, C, onZoom, pad = "26px 32px" }) {
  if (soArquivo(doc.conteudo, arq?.url)) return (
    <div>
      <div style={{ background: "#fff", borderRadius: 6, padding: "10px 14px", marginBottom: 10 }}><style>{CSS_DOC_GESTAO}</style><div dangerouslySetInnerHTML={{ __html: faixaControleHtml(doc, opc) }} /></div>
      <DocArquivo url={arq.url} mime={arq.mime} nome={arq.nome} C={C} onAbrir={(pagina) => onZoom?.(pagina ? { url: pagina, mime: "image/jpeg", nome: arq.nome } : arq)} />
    </div>
  );
  return <div style={{ background: "#fff", borderRadius: 6, padding: pad, overflow: "hidden" }}><style>{CSS_DOC_GESTAO}</style><div dangerouslySetInnerHTML={{ __html: corpoDocGestao(doc, opc) }} /></div>;
}

/** imprimir: documento da empresa → folha de controle + páginas dele; senão o nosso A4 */
export async function imprimirGestao(doc, arq, opc = {}) {
  const m = await import("../../utils/gerarDocumentoGestao");
  if (soArquivo(doc.conteudo, arq?.url)) return m.imprimirDocGestaoArquivo(doc, arq, opc);
  return m.imprimirDocGestao(doc, opc);
}
