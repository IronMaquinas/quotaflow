// components/pessoas/LerCnh.jsx — etapas 18zl/18zn: 🪪 "Anexe a CNH e o sistema preenche" + 📷 foto do colaborador
//   PDF da CNH digital ou foto da CNH física → nome, CPF, nascimento, RG, categoria e os dados da CNH (registro, emissão,
//   validade, 1ª habilitação, observações, local) entram no formulário; a foto do titular é recortada (✂ ajustável).
//   Ao salvar: foto do colaborador + documento CNH com o arquivo. IA desligada → aviso e o cadastro manual segue igual.
//   18zn: trocar a foto (enviar outra e ajustar) ou tirar (com confirmação), mesmo sem ler a CNH.
import { useRef, useState } from "react";
import apiService from "../../services/apiService";
import { cnhParaImagem, recortarFoto, arquivoOriginal } from "../../utils/lerCnh";
import ConfirmarExclusao from "../shared/ConfirmarExclusao";
import ImagemZoom from "../shared/ImagemZoom";
import AjustarFoto from "./AjustarFoto";

const fmtCpf = (c) => (c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c || "");
const dBR = (d) => (d ? d.split("-").reverse().join("/") : "—");

export default function LerCnh({ C, s, form, setForm, fotoAtual = null }) {
  const inp = useRef(null); const inpFoto = useRef(null);
  const [lendo, setLendo] = useState(false); const [erro, setErro] = useState(null); const [ver, setVer] = useState(null); const [tirar, setTirar] = useState(false);
  const [ajustar, setAjustar] = useState(null); // { src, inicial, destino: 'cnh' | 'foto' }
  const k = form._cnh || null;
  // foto que aparece: nova (lida/enviada) › atual do cadastro (se não mandou tirar)
  const foto = k?.foto?.dataUrl || form._foto?.dataUrl || (form._foto_remover ? null : fotoAtual);

  const escolher = async (file) => {
    if (!file) return; setErro(null); setLendo(true);
    try {
      const img = await cnhParaImagem(file);
      const r = await apiService.post("/pessoas/colaboradores/ler-cnh", { base64: img.base64, mime: img.mime });
      const c = r.cnh;
      if (!c?.eh_cnh) { setErro(c?.aviso || "Não parece ser uma CNH."); return; }
      const ft = c.foto ? await recortarFoto(img.dataUrl, c.foto).catch(() => null) : null;
      const orig = await arquivoOriginal(file);
      const preenchidos = []; const novo = { ...form };
      const pega = (campo, valor, rot) => { if (valor && String(novo[campo] || "") !== String(valor)) { novo[campo] = valor; if (rot) preenchidos.push(rot); } };
      pega("nome", c.nome, "Nome"); pega("cpf", fmtCpf(c.cpf), "CPF"); pega("data_nascimento", c.data_nascimento, "Nascimento"); pega("rg", c.rg, "RG"); pega("cnh_categoria", c.categoria, "Categoria");
      const antes = preenchidos.length;
      pega("cnh_registro", c.registro, "Registro"); pega("cnh_validade", c.validade, "Validade"); pega("cnh_emissao", c.emissao, "Emissão"); pega("cnh_primeira_habilitacao", c.primeira_habilitacao, "1ª habilitação");
      pega("cnh_observacoes", c.observacoes_cnh, "Observações"); pega("cnh_local_emissao", c.local_emissao, "Local");
      if (preenchidos.length > antes) { const cnh = preenchidos.splice(antes); preenchidos.push(`dados da CNH (${cnh.join(", ").toLowerCase()})`); }
      const { _foto, _foto_remover, ...semFoto } = novo;
      setForm({ ...semFoto, _cnh: { ...c, preenchidos, foto: ft, fotoBox: c.foto, imagem: img.dataUrl, arquivo: orig } });
    } catch (e) { setErro(e?.response?.data?.erro || e.message || "Não consegui ler a CNH"); }
    finally { setLendo(false); if (inp.current) inp.current.value = ""; }
  };
  const fotoNova = async (file) => { // 18zn: trocar a foto por outra (câmera/galeria) → ajustar
    if (!file) return; try { const img = await cnhParaImagem(file); setAjustar({ src: img.dataUrl, inicial: null, destino: "foto" }); } catch (e) { setErro(e.message); } finally { if (inpFoto.current) inpFoto.current.value = ""; }
  };
  const aplicarAjuste = (r) => {
    if (ajustar.destino === "cnh") setForm({ ...form, _cnh: { ...k, foto: r } });
    else { const { _foto_remover, ...resto } = form; setForm({ ...resto, ...(k ? { _cnh: { ...k, foto: r } } : { _foto: r }) }); }
    setAjustar(null);
  };
  const confirmarTirar = () => { if (k) setForm({ ...form, _cnh: { ...k, foto: null } }); else { const { _foto, ...resto } = form; setForm({ ...resto, ...(fotoAtual ? { _foto_remover: true } : {}) }); } setTirar(false); };

  const caixa = { border: `1px dashed ${C.accent}`, borderRadius: 10, padding: "10px 12px", background: `${C.accent}0d` };
  const lnk = (cor = C.accent) => ({ background: "none", border: "none", color: cor, cursor: "pointer", padding: 0, fontSize: 12.5 });
  const inputs = <>
    <input ref={inp} type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={(e) => escolher(e.target.files?.[0])} />
    <input ref={inpFoto} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => fotoNova(e.target.files?.[0])} />
  </>;
  const bloco = <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
    {foto ? <div style={{ position: "relative" }}>
      <img src={foto} alt="Foto do colaborador" onClick={() => setVer(foto)} style={{ width: 72, height: 96, objectFit: "cover", borderRadius: 8, cursor: "zoom-in", border: `1px solid ${C.border}`, background: "#fff" }} />
      <button type="button" aria-label="Tirar a foto" onClick={() => setTirar(true)} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: "none", background: C.danger, color: "#fff", fontSize: 12, cursor: "pointer", lineHeight: 1 }}>✕</button>
    </div> : <div style={{ width: 72, height: 96, borderRadius: 8, border: `1px dashed ${C.border}`, fontSize: 10.5, color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>sem foto</div>}
    {k?.imagem && <button type="button" onClick={() => setAjustar({ src: k.imagem, inicial: k.fotoBox, destino: "cnh" })} style={lnk()}>✂ Ajustar</button>}
    <button type="button" onClick={() => inpFoto.current?.click()} style={lnk()}>📷 {foto ? "Trocar" : "Enviar foto"}</button>
  </div>;
  const modais = <>
    {ver && <div onClick={() => setVer(null)} style={{ position: "fixed", inset: 0, background: "#000000e0", zIndex: 1500, padding: 20 }}><ImagemZoom src={ver} alt="Foto" /></div>}
    {tirar && <ConfirmarExclusao C={C} s={s} titulo="Tirar esta foto?" texto="O colaborador fica sem foto (você pode enviar outra)." imagem={foto} rotulo="Tirar" z={1500} onCancelar={() => setTirar(false)} onConfirmar={confirmarTirar} />}
    {ajustar && <AjustarFoto C={C} s={s} src={ajustar.src} inicial={ajustar.inicial} onPronto={aplicarAjuste} onCancelar={() => setAjustar(null)} />}
  </>;

  if (!k) return <div style={caixa}>{inputs}
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      {bloco}
      <div style={{ flex: "1 1 220px", fontSize: 12.5 }}><b>🪪 Tem a CNH?</b> Anexe o PDF da CNH digital ou uma foto da CNH e o sistema preenche nome, CPF, nascimento, RG, os dados da CNH, a foto e o documento CNH. <span style={{ color: C.muted }}>(leitura automática — confira antes de salvar)</span>
        {form._foto_remover && <div style={{ color: C.warn, marginTop: 4 }}>A foto será retirada ao salvar.</div>}</div>
      <button type="button" disabled={lendo} onClick={() => inp.current?.click()} style={{ ...s.btn(true), padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>{lendo ? "Lendo a CNH…" : "📎 Anexar CNH"}</button>
    </div>
    {erro && <div style={{ fontSize: 12.5, color: C.warn, marginTop: 6 }}>{erro}</div>}
    {modais}
  </div>;

  return <div style={{ ...caixa, borderStyle: "solid" }}>{inputs}
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
      {bloco}
      <div style={{ flex: "1 1 240px", fontSize: 12.5 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>🪪 CNH lida{k.confianca !== "alta" ? <span style={{ ...s.tag(C.warn), marginLeft: 6 }}>confiança {k.confianca}</span> : null}</div>
        <div style={{ color: C.textSub }}>{k.preenchidos.length ? <>Preenchido: <b>{k.preenchidos.join(", ")}</b> — confira abaixo.</> : "Os dados já estavam iguais aos do formulário."}</div>
        <div style={{ color: C.textSub, marginTop: 2 }}>Ao salvar, vira também o documento <b>CNH</b> (validade <b style={{ color: k.validade && k.validade < new Date().toISOString().slice(0, 10) ? C.danger : C.text }}>{dBR(k.validade)}</b>) com o arquivo anexado — o sistema avisa antes de vencer.</div>
        {(k.avisos || []).map((a, i) => <div key={i} style={{ color: C.warn, marginTop: 2 }}>⚠ {a}</div>)}
        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          <button type="button" disabled={lendo} onClick={() => inp.current?.click()} style={lnk()}>{lendo ? "Lendo…" : "↻ Ler outra CNH"}</button>
          <button type="button" onClick={() => { const { _cnh, ...resto } = form; setForm(resto); }} style={lnk(C.muted)}>Não usar a leitura</button>
        </div>
        {erro && <div style={{ fontSize: 12.5, color: C.warn, marginTop: 4 }}>{erro}</div>}
      </div>
    </div>
    {modais}
  </div>;
}
