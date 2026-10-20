// src/plataforma/BibliotecaTreinamentos.jsx — etapa 12e.2a
// Console da Plataforma → aba "🎓 Biblioteca de treinamentos" (a "Academia QuotaFlow").
// Modelos (tenant_id NULL) com conteúdo em seções (texto, vídeo por link, material) e prova de múltipla escolha.
// A empresa importa uma cópia em Pessoas → Treinamentos → Catálogo. Mudou conteúdo/prova → a versão sobe
// e as empresas que importaram veem "✨ Versão nova". 12e.2b: PDF de apoio enviado (bucket privado, pasta biblioteca/).
import { useState, useEffect, useCallback } from "react";
import EditorConteudoTreinamento, { limparConteudo } from "../components/shared/EditorConteudoTreinamento";

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const TIPO = { regulatorio: "Regulatório (NR, ANTT…)", integracao: "Integração", desenvolvimento: "Desenvolvimento (lean, liderança…)" };
const vazio = () => ({ codigo: "", nome: "", norma: "", carga_horaria: "", validade_meses: "", tipo: "regulatorio", conteudo: "", secoes: [], prova: null });

export default function BibliotecaTreinamentos({ token, chamar, C, input, label, card, btn, tag, onAviso }) {
  const [dados, setDados] = useState(null);
  const [form, setForm] = useState(null);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try { setDados(await chamar(token, "GET", "/biblioteca/treinamentos")); }
    catch (e) { onAviso({ tipo: "erro", texto: /secoes|prova|treinamento/.test(e.message) ? "Rode as migrations 030 e 031 (treinamentos)." : e.message }); }
  }, [token, chamar, onAviso]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const { secoes, prova } = limparConteudo(form);
      const corpo = { nome: form.nome, norma: form.norma, carga_horaria: form.carga_horaria, validade_meses: form.validade_meses, tipo: form.tipo, conteudo: form.conteudo, secoes, prova };
      let r;
      if (form.id) r = await chamar(token, "PUT", `/biblioteca/treinamentos/${form.id}`, corpo);
      else r = await chamar(token, "POST", "/biblioteca/treinamentos", { ...corpo, codigo: form.codigo });
      onAviso({ tipo: "ok", texto: form.id ? (r?.versao_subiu ? "Salvo — versão nova: as empresas que importaram vão ver o aviso." : "Salvo.") : "Treinamento criado na biblioteca." });
      setForm(null); await carregar();
    } catch (e) { onAviso({ tipo: "erro", texto: e.message }); }
    finally { setSalvando(false); }
  };
  const alternar = async (t) => {
    try { await chamar(token, "PUT", `/biblioteca/treinamentos/${t.id}`, { ativo: t.ativo === false }); await carregar(); }
    catch (e) { onAviso({ tipo: "erro", texto: e.message }); }
  };

  if (!dados) return <div style={{ color: C.muted }}>Carregando…</div>;
  const lista = dados.modelos.filter((t) => !busca.trim() || semAcento(`${t.nome} ${t.codigo} ${t.norma || ""}`).includes(semAcento(busca.trim())));
  const ui = { text: C.text, sub: C.sub, border: C.border, accent: C.accent, danger: C.danger, success: C.success, input, label };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: C.sub, flex: 1, minWidth: 240 }}>
          Treinamentos do QuotaFlow (conteúdo + vídeo + prova) que as transportadoras importam. Regulatórios (NR, ANTT) e de desenvolvimento (lean, liderança…).
        </div>
        <button type="button" onClick={() => setForm(vazio())} style={btn(C.accent)}>＋ Novo treinamento</button>
      </div>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar treinamento…" style={{ ...input, maxWidth: 360, marginBottom: 12 }} />
      <div style={{ ...card, overflow: "hidden" }}>
        {lista.map((t, i) => (
          <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: i < lista.length - 1 ? `1px solid ${C.border}` : "none", opacity: t.ativo === false ? 0.5 : 1, flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 240px" }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t.nome}{t.norma ? <span style={{ color: C.muted, fontWeight: 400 }}> · {t.norma}</span> : ""}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{t.codigo} · v{t.versao} · {TIPO[t.tipo] || t.tipo}{t.carga_horaria ? ` · ${Number(t.carga_horaria).toLocaleString("pt-BR")} h` : ""}</div>
            </div>
            <span style={tag(C.accent)}>📖 {t.secoes_qtd} seç.</span>
            {t.videos_qtd > 0 && <span style={tag(C.violet)}>🎬 {t.videos_qtd}</span>}
            <span style={tag(t.perguntas_qtd ? C.success : C.muted)}>📝 {t.perguntas_qtd ? `${t.perguntas_qtd} perguntas` : "sem prova"}</span>
            {t.ativo === false && <span style={tag(C.muted)}>Fora da biblioteca</span>}
            <button type="button" onClick={() => setForm({ ...vazio(), ...t, norma: t.norma || "", carga_horaria: t.carga_horaria ?? "", validade_meses: t.validade_meses ?? "", conteudo: t.conteudo || "", secoes: t.secoes || [], prova: t.prova || null })} style={btn(C.accent, false)}>Editar</button>
            <button type="button" onClick={() => alternar(t)} style={btn(t.ativo === false ? C.success : C.danger, false)}>{t.ativo === false ? "Voltar à biblioteca" : "Tirar da biblioteca"}</button>
          </div>
        ))}
        {lista.length === 0 && <div style={{ padding: 20, color: C.sub, textAlign: "center" }}>Nenhum treinamento na biblioteca ainda.</div>}
      </div>

      {form && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: 20, overflowY: "auto" }} onClick={() => !salvando && setForm(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 720, padding: "20px 22px", margin: "auto 0" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{form.id ? `Editar — ${form.nome}` : "Novo treinamento da biblioteca"}</div>
            <label style={{ display: "block", marginBottom: 12 }}><span style={label}>NOME</span>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="NR-6 — Uso correto de EPI" style={input} /></label>
            {!form.id && <label style={{ display: "block", marginBottom: 12 }}><span style={label}>CÓDIGO (OPCIONAL — GERADO PELO NOME; É O QUE AS FUNÇÕES USAM)</span>
              <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="nr6_epi" style={input} /></label>}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ flex: "1 1 150px" }}><span style={label}>NORMA</span><input value={form.norma} onChange={(e) => setForm({ ...form, norma: e.target.value })} style={input} /></label>
              <label style={{ flex: "1 1 100px" }}><span style={label}>CARGA (H)</span><input type="number" min={0.5} step="0.5" value={form.carga_horaria} onChange={(e) => setForm({ ...form, carga_horaria: e.target.value })} style={input} /></label>
              <label style={{ flex: "1 1 120px" }}><span style={label}>RECICLAGEM (MESES)</span><input type="number" min={1} max={240} value={form.validade_meses} onChange={(e) => setForm({ ...form, validade_meses: e.target.value })} placeholder="não vence" style={input} /></label>
              <label style={{ flex: "1 1 180px" }}><span style={label}>TIPO</span><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={input}>{Object.entries(TIPO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            </div>
            <label style={{ display: "block", marginBottom: 12 }}><span style={label}>CONTEÚDO PROGRAMÁTICO (RESUMO — VAI NA LISTA DE PRESENÇA)</span>
              <textarea rows={3} value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} style={{ ...input, resize: "vertical" }} /></label>
            <EditorConteudoTreinamento secoes={form.secoes} prova={form.prova} onChange={(v) => setForm((f) => ({ ...f, ...v }))} ui={ui}
              onEnviarPdf={(base64, nome) => chamar(token, "POST", "/biblioteca/treinamentos/material", { base64, nome })}
              onVerPdf={async (path) => (await chamar(token, "GET", `/biblioteca/treinamentos/material?path=${encodeURIComponent(path)}`))?.url} />
            {form.id && <div style={{ fontSize: 11, color: C.muted, margin: "10px 0" }}>Mudou nome, carga, conteúdo ou prova → a versão sobe (v{form.versao} → v{Number(form.versao) + 1}) e quem importou vê “✨ Versão nova”.</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setForm(null)} style={btn(C.muted, false)}>Cancelar</button>
              <button type="button" onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ ...btn(C.accent), opacity: salvando || !form.nome.trim() ? 0.5 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
