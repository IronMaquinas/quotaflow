// components/inspecoes/EditorModeloInspecao.jsx — etapa 14a
// Editor do modelo de inspeção — usado pela empresa (🔍 Inspeções → Modelos) e pelo Console (biblioteca).
// Vistas (frente, lateral, painel…) com o esquema do QuotaFlow ou a foto/desenho do próprio equipamento.
// Clique no desenho para criar um ponto; clique no ponto para editar. "📍 Mover" e clique no desenho reposiciona.
import { useState } from "react";
import { FundoVista, NOMES_ESQUEMA } from "./Esquemas";
import { comprimirImagem } from "../../utils/comprimirImagem"; // 14c.1

const TIPOS = { ok_nok: "OK / Não OK", numero: "Número (medida)", texto: "Texto" };
const FOTO = { nunca: "Sem foto", se_nok: "Pedir foto se não OK", sempre: "Pedir foto sempre" };
const CAMPO_NOME = { km: "Km (hodômetro)", horimetro: "Horímetro", local: "Local", cliente: "Cliente / contrato" };
const idNovo = (p = "p") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const lerBase64 = (file) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(new Error("Não foi possível ler a imagem")); r.readAsDataURL(file); });

export const modeloVazio = () => ({ nome: "", tipo: "equipamento", categoria: "cavalo", frequencia: "pre_uso", descricao: "", campos: ["km"], vistas: [{ codigo: idNovo("v"), nome: "Lateral", imagem: "esquema:cavalo_lateral", pontos: [] }] });

export default function EditorModeloInspecao({ inicial, listas, subirImagem, urls = {}, onSalvar, onCancelar, salvando, C, s, titulo }) {
  const [m, setM] = useState(() => JSON.parse(JSON.stringify(inicial || modeloVazio())));
  const [iv, setIv] = useState(0);
  const [sel, setSel] = useState(null);
  const [mover, setMover] = useState(false);
  const [previas, setPrevias] = useState({});
  const [erro, setErro] = useState(null);
  const [enviandoImg, setEnviandoImg] = useState(false);
  const [remover, setRemover] = useState(null); // confirmação (modal do app)

  const vista = m.vistas[iv] || m.vistas[0];
  const ponto = vista?.pontos.find((p) => p.id === sel) || null;
  const setVista = (fn) => setM((x) => ({ ...x, vistas: x.vistas.map((v, i) => (i === iv ? fn(v) : v)) }));
  const setPonto = (campo, valor) => setVista((v) => ({ ...v, pontos: v.pontos.map((p) => (p.id === sel ? { ...p, [campo]: valor } : p)) }));
  const url = (img) => previas[img] || urls[img] || null;

  const clicarDesenho = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(1, Math.min(99, ((e.clientX - r.left) / r.width) * 100)); const y = Math.max(1, Math.min(99, ((e.clientY - r.top) / r.height) * 100));
    const xy = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    if (mover && ponto) { setVista((v) => ({ ...v, pontos: v.pontos.map((p) => (p.id === sel ? { ...p, ...xy } : p)) })); setMover(false); return; }
    if (vista.pontos.length >= 40) { setErro("No máximo 40 pontos por vista"); return; }
    const novo = { id: idNovo(), rotulo: "", ...xy, tipo: "ok_nok", foto: "se_nok", foto_obrigatoria: true, critico: false, unidade: null, ajuda: null };
    setVista((v) => ({ ...v, pontos: [...v.pontos, novo] })); setSel(novo.id);
  };
  const novaVista = () => { if (m.vistas.length >= 12) return; setM((x) => ({ ...x, vistas: [...x.vistas, { codigo: idNovo("v"), nome: `Vista ${x.vistas.length + 1}`, imagem: "esquema:painel", pontos: [] }] })); setIv(m.vistas.length); setSel(null); };
  const enviarImagem = async (file) => {
    if (!file) return; setErro(null); setEnviandoImg(true);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("Imagem muito grande (acima de 25 MB)");
      let dataUrl; // 14c.1: reduz no navegador (lado maior 1600 px) — foto de celular sobe sem travar no limite
      try { dataUrl = (await comprimirImagem(file, { lado: 1600, qualidade: 0.8 })).dataUrl; } catch { dataUrl = await lerBase64(file); }
      const [cab, b64] = dataUrl.split(",");
      const path = await subirImagem(b64, cab.slice(5, cab.indexOf(";")));
      setPrevias((p) => ({ ...p, [path]: dataUrl })); setVista((v) => ({ ...v, imagem: path }));
    } catch (e) { setErro(e.message); } finally { setEnviandoImg(false); }
  };
  const salvar = () => {
    setErro(null);
    if (!m.nome.trim()) return setErro("Informe o nome do modelo");
    for (const v of m.vistas) { if (!v.nome.trim()) return setErro("Toda vista precisa de nome"); const semNome = v.pontos.find((p) => !String(p.rotulo || "").trim()); if (semNome) { setIv(m.vistas.indexOf(v)); setSel(semNome.id); return setErro(`Dê um nome ao ponto selecionado na vista “${v.nome}”`); } }
    if (!m.vistas.some((v) => v.pontos.length)) return setErro("Cadastre pelo menos um ponto (clique no desenho)");
    onSalvar({ nome: m.nome, ...(listas.tipos ? { tipo: m.tipo || "equipamento" } : {}), categoria: m.categoria, frequencia: m.frequencia, descricao: m.descricao, campos: m.campos, vistas: m.vistas });
  };

  const lb = (t) => <span style={s.label}>{t}</span>;
  const total = m.vistas.reduce((n, v) => n + v.pontos.length, 0);
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{titulo || (m.id ? `Editar — ${m.nome}` : "Novo modelo de inspeção")}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ flex: "2 1 260px" }}>{lb("NOME DO MODELO")}<input value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} placeholder="Cavalo mecânico — pré-uso" style={s.input} /></label>
        {listas.tipos && <label style={{ flex: "1 1 200px" }}>{lb("TIPO")}<select value={m.tipo || "equipamento"} onChange={(e) => setM({ ...m, tipo: e.target.value })} style={s.input}>{listas.tipos.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}</select></label>}
        <label style={{ flex: "1 1 160px" }}>{lb("CATEGORIA")}<select value={m.categoria} onChange={(e) => setM({ ...m, categoria: e.target.value })} style={s.input}>{listas.categorias.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}</select></label>
        <label style={{ flex: "1 1 160px" }}>{lb("FREQUÊNCIA")}<select value={m.frequencia} onChange={(e) => setM({ ...m, frequencia: e.target.value })} style={s.input}>{listas.frequencias.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}</select></label>
      </div>
      <label style={{ display: "block", marginBottom: 10 }}>{lb("ORIENTAÇÃO (APARECE NO INÍCIO DA INSPEÇÃO)")}<textarea rows={2} value={m.descricao || ""} onChange={(e) => setM({ ...m, descricao: e.target.value })} style={{ ...s.input, resize: "vertical" }} /></label>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <span style={{ ...s.label, marginBottom: 0, alignSelf: "center" }}>PEDIR NO INÍCIO:</span>
        {listas.campos.map((c) => <label key={c} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={m.campos.includes(c)} onChange={(e) => setM({ ...m, campos: e.target.checked ? [...m.campos, c] : m.campos.filter((x) => x !== c) })} />{CAMPO_NOME[c] || c}</label>)}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {m.vistas.map((v, i) => (
          <button key={v.codigo} type="button" onClick={() => { setIv(i); setSel(null); setMover(false); }}
            style={{ ...s.btn(i === iv, C.accent), cursor: "pointer", padding: "6px 12px", color: i === iv ? "#fff" : C.text }}>{v.nome || "—"} <span style={{ opacity: 0.7 }}>({v.pontos.length})</span></button>
        ))}
        {m.vistas.length < 12 && <button type="button" onClick={novaVista} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px", color: C.accent }}>＋ Vista</button>}
      </div>

      {vista && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 380px", minWidth: 280 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <input value={vista.nome} onChange={(e) => setVista((v) => ({ ...v, nome: e.target.value }))} placeholder="Nome da vista" style={{ ...s.input, flex: "1 1 140px", width: "auto" }} />
              <select value={vista.imagem?.startsWith("esquema:") ? vista.imagem : "proprio"} onChange={(e) => e.target.value !== "proprio" && setVista((v) => ({ ...v, imagem: e.target.value }))} style={{ ...s.input, flex: "1 1 180px", width: "auto" }}>
                {listas.esquemas.map((c) => <option key={c} value={`esquema:${c}`}>{NOMES_ESQUEMA[c] || c}</option>)}
                <option value="proprio">📷 Imagem própria…</option>
              </select>
              <label style={{ ...s.btn(false), cursor: "pointer", padding: "8px 12px", color: C.text }}>{enviandoImg ? "Enviando…" : "📷 Enviar imagem"}
                <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => { enviarImagem(e.target.files?.[0]); e.target.value = ""; }} /></label>
            </div>
            <div style={{ position: "relative", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", cursor: mover ? "move" : "crosshair", userSelect: "none" }} onClick={clicarDesenho}>
              <FundoVista imagem={vista.imagem} url={url(vista.imagem)} />
              {vista.pontos.map((p, k) => (
                <div key={p.id} onClick={(e) => { e.stopPropagation(); setSel(p.id); setMover(false); }} title={p.rotulo}
                  style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: "#fff", background: p.id === sel ? "#f59e0b" : p.critico ? "#ef4444" : "#3b82f6", border: "2px solid #fff", boxShadow: "0 1px 4px #0008", cursor: "pointer" }}>{k + 1}</div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{mover ? "📍 Clique no desenho para a nova posição do ponto." : "Clique no desenho para criar um ponto. 🔴 = crítico (não OK impede o uso)."}</div>
            {m.vistas.length > 1 && <button type="button" onClick={() => setRemover({ tipo: "vista" })} style={{ background: "none", border: "none", color: C.danger, fontSize: 12, cursor: "pointer", padding: "6px 0" }}>🗑 Remover esta vista</button>}
          </div>

          <div style={{ flex: "1 1 280px", minWidth: 260 }}>
            {ponto ? (
              <div style={{ ...s.card, padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Ponto {vista.pontos.indexOf(ponto) + 1}</div>
                <label style={{ display: "block", marginBottom: 8 }}>{lb("O QUE VERIFICAR")}<input autoFocus value={ponto.rotulo} onChange={(e) => setPonto("rotulo", e.target.value)} placeholder="Farol esquerdo" style={s.input} /></label>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <label style={{ flex: 1 }}>{lb("TIPO")}<select value={ponto.tipo} onChange={(e) => setPonto("tipo", e.target.value)} style={s.input}>{Object.entries(TIPOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                  <label style={{ flex: 1 }}>{lb("FOTO")}<select value={ponto.foto || "se_nok"} onChange={(e) => setPonto("foto", e.target.value)} style={s.input}>{Object.entries(FOTO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                </div>
                {ponto.foto !== "nunca" && <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: "pointer", marginBottom: 8 }}><input type="checkbox" checked={ponto.foto_obrigatoria !== false} onChange={(e) => setPonto("foto_obrigatoria", e.target.checked)} /><span><b>Foto obrigatória</b> — sem ela não conclui (desmarcado = opcional)</span></label>}
                {ponto.tipo === "numero" && <label style={{ display: "block", marginBottom: 8 }}>{lb("UNIDADE")}<input value={ponto.unidade || ""} onChange={(e) => setPonto("unidade", e.target.value || null)} placeholder="psi, mm, %" style={s.input} /></label>}
                <label style={{ display: "block", marginBottom: 8 }}>{lb("AJUDA PARA QUEM INSPECIONA (OPCIONAL)")}<input value={ponto.ajuda || ""} onChange={(e) => setPonto("ajuda", e.target.value || null)} placeholder="Sulco mínimo 1,6 mm" style={s.input} /></label>
                {ponto.tipo === "ok_nok" && <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, cursor: "pointer", marginBottom: 10 }}><input type="checkbox" checked={!!ponto.critico} onChange={(e) => setPonto("critico", e.target.checked)} style={{ marginTop: 3 }} />
                  <span><b>Crítico</b> — se der “Não OK”, o equipamento fica <b>bloqueado</b> até o gestor liberar.</span></label>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setMover(true)} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px", color: C.text }}>📍 Mover</button>
                  <button type="button" onClick={() => setRemover({ tipo: "ponto" })} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px", color: C.danger }}>🗑 Remover</button>
                  <button type="button" onClick={() => setSel(null)} style={{ ...s.btn(false), cursor: "pointer", padding: "6px 12px", color: C.text, marginLeft: "auto" }}>OK</button>
                </div>
              </div>
            ) : (
              <div style={{ ...s.card, padding: 10, maxHeight: 360, overflowY: "auto" }}>
                {vista.pontos.length === 0 && <div style={{ color: C.muted, fontSize: 13, padding: 10 }}>Nenhum ponto nesta vista. Clique no desenho.</div>}
                {vista.pontos.map((p, k) => (
                  <div key={p.id} onClick={() => setSel(p.id)} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 6px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", fontSize: 13 }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: p.critico ? "#ef4444" : "#3b82f6", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{k + 1}</span>
                    <span style={{ flex: 1 }}>{p.rotulo || <i style={{ color: C.danger }}>sem nome</i>}</span>
                    <span style={{ fontSize: 10, color: C.muted }}>{p.tipo !== "ok_nok" ? TIPOS[p.tipo] : ""}{p.foto !== "nunca" ? (p.foto_obrigatoria !== false ? " 📷" : " 📷?") : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {erro && <div style={{ color: C.danger, fontSize: 13, marginTop: 12 }}>⚠ {erro}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 16 }}>
        <span style={{ fontSize: 12, color: C.muted, marginRight: "auto" }}>{m.vistas.length} vista(s) · {total} ponto(s)</span>
        <button type="button" onClick={onCancelar} style={{ ...s.btn(false), cursor: "pointer", color: C.text }}>Cancelar</button>
        <button type="button" onClick={salvar} disabled={salvando} style={{ ...s.btn(!salvando, C.accent) }}>{salvando ? "Salvando…" : "Salvar modelo"}</button>
      </div>

      {remover && (
        <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }} onClick={() => setRemover(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 420, maxWidth: "100%", padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.danger }}>⚠ {remover.tipo === "vista" ? `Remover a vista “${vista.nome}”?` : `Remover o ponto “${ponto?.rotulo || "sem nome"}”?`}</div>
            <div style={{ fontSize: 13, color: C.textSub, marginTop: 8 }}>{remover.tipo === "vista" ? `Os ${vista.pontos.length} pontos dela também saem do modelo.` : "Inspeções já feitas não mudam."}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="button" onClick={() => setRemover(null)} style={{ ...s.btn(false), cursor: "pointer", flex: 1, color: C.text }}>Voltar</button>
              <button type="button" onClick={() => {
                if (remover.tipo === "vista") { setM((x) => ({ ...x, vistas: x.vistas.filter((_, i) => i !== iv) })); setIv(0); }
                else setVista((v) => ({ ...v, pontos: v.pontos.filter((p) => p.id !== sel) }));
                setSel(null); setRemover(null);
              }} style={{ ...s.btn(true, C.danger), cursor: "pointer", flex: 1 }}>Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
