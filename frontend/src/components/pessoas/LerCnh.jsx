// components/pessoas/LerCnh.jsx — etapa 18zl: 🪪 "Anexe a CNH e o sistema preenche" (IA) no cadastro do colaborador
//   PDF da CNH digital ou foto da CNH física → nome, CPF, nascimento e categoria entram no formulário; a foto do titular é
//   recortada; nº de registro, emissão e validade viram o documento CNH (com o arquivo) quando o colaborador é salvo.
//   Tudo fica visível para conferir antes de salvar. IA desligada → aviso e o cadastro manual segue igual.
import { useRef, useState } from "react";
import apiService from "../../services/apiService";
import { cnhParaImagem, recortarFoto, arquivoOriginal } from "../../utils/lerCnh";
import ConfirmarExclusao from "../shared/ConfirmarExclusao";
import ImagemZoom from "../shared/ImagemZoom";

const fmtCpf = (c) => (c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c || "");
const dBR = (d) => (d ? d.split("-").reverse().join("/") : "—");

export default function LerCnh({ C, s, form, setForm, fotoAtual = null }) {
  const inp = useRef(null);
  const [lendo, setLendo] = useState(false); const [erro, setErro] = useState(null); const [ver, setVer] = useState(false); const [tirar, setTirar] = useState(false);
  const k = form._cnh || null;
  const escolher = async (file) => {
    if (!file) return; setErro(null); setLendo(true);
    try {
      const img = await cnhParaImagem(file);
      const r = await apiService.post("/pessoas/colaboradores/ler-cnh", { base64: img.base64, mime: img.mime });
      const c = r.cnh;
      if (!c?.eh_cnh) { setErro(c?.aviso || "Não parece ser uma CNH."); return; }
      const foto = c.foto ? await recortarFoto(img.dataUrl, c.foto).catch(() => null) : null;
      const orig = await arquivoOriginal(file);
      const preenchidos = [];
      const novo = { ...form };
      const pega = (campo, valor, rot) => { if (valor && String(novo[campo] || "") !== String(valor)) { novo[campo] = valor; preenchidos.push(rot); } };
      pega("nome", c.nome, "Nome"); pega("cpf", fmtCpf(c.cpf), "CPF"); pega("data_nascimento", c.data_nascimento, "Nascimento"); pega("cnh_categoria", c.categoria, "Categoria da CNH");
      setForm({ ...novo, _cnh: { ...c, preenchidos, foto: foto, arquivo: orig, tokens: r.ia?.tokens || null } });
    } catch (e) { setErro(e?.response?.data?.erro || e.message || "Não consegui ler a CNH"); }
    finally { setLendo(false); if (inp.current) inp.current.value = ""; }
  };
  const caixa = { border: `1px dashed ${C.accent}`, borderRadius: 10, padding: "10px 12px", background: `${C.accent}0d` };
  const input = <input ref={inp} type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={(e) => escolher(e.target.files?.[0])} />;

  if (!k) return <div style={caixa}>{input}
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {fotoAtual && <img src={fotoAtual} alt="" style={{ width: 44, height: 54, objectFit: "cover", borderRadius: 6 }} />}
      <div style={{ flex: "1 1 220px", fontSize: 12.5 }}><b>🪪 Tem a CNH?</b> Anexe o PDF da CNH digital ou uma foto da CNH e o sistema preenche nome, CPF, nascimento, categoria, a foto e o documento CNH. <span style={{ color: C.muted }}>(leitura por IA — confira antes de salvar)</span></div>
      <button type="button" disabled={lendo} onClick={() => inp.current?.click()} style={{ ...s.btn(true), padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>{lendo ? "Lendo a CNH…" : "📎 Anexar CNH"}</button>
    </div>
    {erro && <div style={{ fontSize: 12.5, color: C.warn, marginTop: 6 }}>{erro}</div>}
  </div>;

  return <div style={{ ...caixa, borderStyle: "solid" }}>{input}
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
      {k.foto ? <div style={{ position: "relative" }}>
        <img src={k.foto.dataUrl} alt="Foto da CNH" onClick={() => setVer(true)} style={{ width: 72, height: 90, objectFit: "cover", borderRadius: 8, cursor: "zoom-in", border: `1px solid ${C.border}` }} />
        <button type="button" aria-label="Tirar a foto" onClick={() => setTirar(true)} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: "none", background: C.danger, color: "#fff", fontSize: 12, cursor: "pointer", lineHeight: 1 }}>✕</button>
      </div> : <div style={{ width: 72, height: 90, borderRadius: 8, border: `1px dashed ${C.border}`, fontSize: 10.5, color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>sem foto</div>}
      <div style={{ flex: "1 1 240px", fontSize: 12.5 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>🪪 CNH lida{k.confianca !== "alta" ? <span style={{ ...s.tag(C.warn), marginLeft: 6 }}>confiança {k.confianca}</span> : null}</div>
        <div style={{ color: C.textSub }}>{k.preenchidos.length ? <>Preenchido: <b>{k.preenchidos.join(", ")}</b> — confira acima.</> : "Os dados já estavam iguais aos do formulário."}</div>
        <div style={{ color: C.textSub, marginTop: 2 }}>Ao salvar, vira o documento <b>CNH</b>: nº {k.registro || "—"} · emissão {dBR(k.emissao)} · validade <b style={{ color: k.validade && k.validade < new Date().toISOString().slice(0, 10) ? C.danger : C.text }}>{dBR(k.validade)}</b>{k.primeira_habilitacao ? ` · 1ª habilitação ${dBR(k.primeira_habilitacao)}` : ""}{k.observacoes_cnh ? ` · obs.: ${k.observacoes_cnh}` : ""} (com o arquivo anexado).</div>
        {(k.avisos || []).map((a, i) => <div key={i} style={{ color: C.warn, marginTop: 2 }}>⚠ {a}</div>)}
        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          <button type="button" disabled={lendo} onClick={() => inp.current?.click()} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0, fontSize: 12.5 }}>{lendo ? "Lendo…" : "↻ Ler outra CNH"}</button>
          <button type="button" onClick={() => { const { _cnh, ...resto } = form; setForm(resto); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 0, fontSize: 12.5 }}>Não usar a leitura</button>
        </div>
        {erro && <div style={{ fontSize: 12.5, color: C.warn, marginTop: 4 }}>{erro}</div>}
      </div>
    </div>
    {ver && k.foto && <div onClick={() => setVer(false)} style={{ position: "fixed", inset: 0, background: "#000000e0", zIndex: 1500, padding: 20 }}><ImagemZoom src={k.foto.dataUrl} alt="Foto da CNH" /></div>}
    {tirar && <ConfirmarExclusao C={C} s={s} titulo="Tirar esta foto?" texto="O colaborador fica sem foto (você pode ler a CNH de novo)." imagem={k.foto?.dataUrl} rotulo="Tirar" z={1500}
      onCancelar={() => setTirar(false)} onConfirmar={() => { setForm({ ...form, _cnh: { ...k, foto: null } }); setTirar(false); }} />}
  </div>;
}
