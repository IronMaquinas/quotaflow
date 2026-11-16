// components/pessoas/MeusProcedimentos.jsx — etapa 18zz.2: 📘 PROCEDIMENTOS no app do colaborador
//   Os documentos de gestão vigentes distribuídos para ele (todos ou a função dele): os não lidos primeiro, abre o texto
//   em A4 (logo, assinaturas) e confirma "✓ Li e entendi". Nova revisão = nova leitura.
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import { corpoDocGestao, CSS_DOC_GESTAO } from "../../utils/gerarDocumentoGestao";
import VerArquivo from "../programacao/VerArquivo";

const rev = (n) => `Rev. ${String(n ?? 0).padStart(2, "0")}`;
export default function MeusProcedimentos({ C, s }) {
  const [l, setL] = useState(null); const [erro, setErro] = useState(null); const [ver, setVer] = useState(null); const [arq, setArq] = useState(null); const [ocup, setOcup] = useState(false);
  const carregar = () => apiService.get("/meus-procedimentos").then((r) => setL(r.documentos || [])).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  const abrir = async (d) => { try { setVer(await apiService.get(`/meus-procedimentos/${d.id}`)); } catch (e) { setErro(e.message); } };
  const li = async () => { setOcup(true); try { await apiService.post(`/meus-procedimentos/${ver.documento.id}/leitura`, {}); setVer({ ...ver, lido: true }); carregar(); } catch (e) { setErro(e.message); } finally { setOcup(false); } };
  const pend = (l || []).filter((d) => !d.lido_em).length;
  return <div style={{ padding: 16, maxWidth: 820, margin: "0 auto" }}>
    <div style={{ fontSize: 18, fontWeight: 700 }}>📘 Procedimentos</div>
    <div style={{ fontSize: 12.5, color: C.textSub, margin: "2px 0 12px" }}>Leia e confirme. {pend ? <b style={{ color: C.warn }}>{pend} para ler.</b> : l?.length ? "Tudo lido ✓" : ""}</div>
    {erro && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{erro}</div>}
    {!l ? <div style={{ color: C.muted }}>Carregando…</div> : !l.length ? <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.textSub }}>Nenhum procedimento para você no momento.</div>
      : <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>{l.map((d, i) => <button key={d.id} type="button" onClick={() => abrir(d)} style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", background: "none", border: "none", borderBottom: i < l.length - 1 ? `1px solid ${C.border}` : "none", color: C.text, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}><span style={{ color: C.accent }}>{d.codigo}</span> · {d.titulo}</div><div style={{ fontSize: 11.5, color: C.muted }}>{rev(d.revisao)}</div></div>
        {d.lido_em ? <span style={s.tag(C.success)}>✓ lido</span> : <span style={s.tag(C.warn)}>ler</span>}
      </button>)}</div>}
    {ver && <div onClick={() => setVer(null)} style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 80, overflowY: "auto", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ background: "#fff", borderRadius: 6, padding: "20px 22px", overflow: "hidden" }}><style>{CSS_DOC_GESTAO}</style><div dangerouslySetInnerHTML={{ __html: corpoDocGestao(ver.documento) }} /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10, flexWrap: "wrap", position: "sticky", bottom: 0 }}>
          {ver.documento.arquivo_url && <button type="button" onClick={() => setArq({ url: ver.documento.arquivo_url, nome: ver.documento.arquivo_nome, mime: ver.documento.arquivo_mime })} style={{ ...s.btn(false), cursor: "pointer", color: C.accent, background: C.surface }}>📎 Arquivo</button>}
          <button type="button" onClick={() => setVer(null)} style={{ ...s.btn(false), cursor: "pointer", color: C.text, background: C.surface }}>Fechar</button>
          {ver.lido ? <span style={{ ...s.tag(C.success), padding: "8px 12px" }}>✓ Você leu esta revisão</span>
            : <button type="button" disabled={ocup} onClick={li} style={{ ...s.btn(true), cursor: "pointer", padding: "10px 18px" }}>{ocup ? "…" : "✓ Li e entendi"}</button>}
        </div>
      </div>
    </div>}
    {arq && <VerArquivo C={C} s={s} arquivo={arq} onFechar={() => setArq(null)} z={90} />}
  </div>;
}
