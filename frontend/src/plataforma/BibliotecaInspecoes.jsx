// src/plataforma/BibliotecaInspecoes.jsx — etapa 14a
// Console da Plataforma → aba "🔍 Biblioteca de inspeções". Modelos (tenant_id NULL) com vistas (esquemas genéricos do
// QuotaFlow ou imagem enviada) e pontos. A empresa importa em 🔍 Inspeções → Modelos. Mudou vistas/pontos → a versão sobe
// e quem importou vê "✨ Versão nova".
import { useState, useEffect, useCallback } from "react";
import EditorModeloInspecao, { modeloVazio } from "../components/inspecoes/EditorModeloInspecao";

export default function BibliotecaInspecoes({ token, chamar, C, input, label, card, btn, tag, onAviso }) {
  const [dados, setDados] = useState(null);
  const [editor, setEditor] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // o editor usa o "s" do app — adaptado ao visual do Console
  const s = { input, label, card, tag, btn: (ativo, cor = C.accent) => ({ ...btn(cor, ativo), ...(ativo ? {} : { borderColor: C.border }) }) };
  const Cx = { ...C, textSub: C.sub || C.muted, warn: C.warn || "#f59e0b", bg: C.bg || C.surface };

  const carregar = useCallback(async () => {
    try { setDados(await chamar(token, "GET", "/biblioteca/inspecoes")); }
    catch (e) { onAviso({ tipo: "erro", texto: /inspec/.test(e.message) ? "Rode a migration 040 (inspeções)." : e.message }); }
  }, [token, chamar, onAviso]);
  useEffect(() => { carregar(); }, [carregar]);

  const abrir = async (m) => {
    if (!m) return setEditor({ modelo: modeloVazio(), urls: {} });
    let urls = {}; try { urls = (await chamar(token, "GET", `/biblioteca/inspecoes/${m.id}/imagens`))?.imagens || {}; } catch { /* ok */ }
    setEditor({ modelo: JSON.parse(JSON.stringify(m)), urls });
  };
  const salvar = async (corpo) => {
    setSalvando(true);
    try {
      const r = editor.modelo.id ? await chamar(token, "PUT", `/biblioteca/inspecoes/${editor.modelo.id}`, corpo) : await chamar(token, "POST", "/biblioteca/inspecoes", corpo);
      onAviso({ tipo: "ok", texto: editor.modelo.id ? (r?.versao_subiu ? "Salvo — versão nova: quem importou vai ver o aviso." : "Salvo.") : "Modelo criado na biblioteca." });
      setEditor(null); await carregar();
    } catch (e) { onAviso({ tipo: "erro", texto: e.message }); } finally { setSalvando(false); }
  };
  const alternar = async (m) => {
    try { await chamar(token, "PUT", `/biblioteca/inspecoes/${m.id}`, { ativo: m.ativo === false }); await carregar(); }
    catch (e) { onAviso({ tipo: "erro", texto: e.message }); }
  };

  if (!dados) return <div style={{ color: C.muted }}>Carregando…</div>;
  const listas = { ...dados, campos: ["km", "horimetro", "local", "cliente"] };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: C.sub, flex: 1, minWidth: 240 }}>Checklists de inspeção (pré-uso e rotina) que as transportadoras importam. Use os esquemas genéricos — <b>nunca</b> desenho de fabricante.</div>
        <button type="button" onClick={() => abrir(null)} style={btn(C.accent)}>＋ Novo modelo</button>
      </div>
      <div style={{ ...card, overflow: "hidden" }}>
        {dados.modelos.map((m, i) => (
          <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: i < dados.modelos.length - 1 ? `1px solid ${C.border}` : "none", opacity: m.ativo === false ? 0.5 : 1, flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 240px" }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{m.nome}</div>
              <div style={{ fontSize: 11, color: C.muted }}>v{m.versao} · {dados.categorias.find((c) => c.codigo === m.categoria)?.nome} · {dados.frequencias.find((c) => c.codigo === m.frequencia)?.nome}</div>
            </div>
            <span style={tag(C.accent)}>{m.vistas_qtd} vistas · {m.pontos_qtd} pontos</span>
            {m.criticos_qtd > 0 && <span style={tag(C.danger)}>{m.criticos_qtd} críticos</span>}
            <button type="button" onClick={() => abrir(m)} style={btn(C.accent, false)}>Editar</button>
            <button type="button" onClick={() => alternar(m)} style={btn(m.ativo === false ? C.success : C.danger, false)}>{m.ativo === false ? "Voltar à biblioteca" : "Tirar da biblioteca"}</button>
          </div>
        ))}
        {dados.modelos.length === 0 && <div style={{ padding: 20, color: C.sub, textAlign: "center" }}>Nenhum modelo ainda.</div>}
      </div>
      {editor && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: 20, overflowY: "auto" }}>
          <div style={{ ...card, width: "100%", maxWidth: 1000, padding: "20px 22px", margin: "auto 0" }}>
            <EditorModeloInspecao inicial={editor.modelo} urls={editor.urls} listas={listas} salvando={salvando} C={Cx} s={s}
              titulo={editor.modelo.id ? `Editar — ${editor.modelo.nome} (v${editor.modelo.versao})` : "Novo modelo da biblioteca"}
              subirImagem={async (base64, mime) => (await chamar(token, "POST", "/biblioteca/inspecoes/imagem", { base64, mime }))?.imagem}
              onSalvar={salvar} onCancelar={() => setEditor(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
