// src/plataforma/BibliotecaFuncoes.jsx — etapa 12d.0
// Console da Plataforma → aba "Biblioteca de funções".
// Modelos de função (descritivo do cargo + documentos exigidos) que TODOS os tenants veem e importam.
// Editar descritivo/requisitos/documentos sobe a versão → as empresas que importaram veem "versão nova".
// Tirar da biblioteca só desativa: as cópias das empresas continuam intactas.
import { useState, useEffect, useCallback } from "react";

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// busca por nome, descritivo, requisitos ou documento exigido (sem acento, sem maiúscula)
const casa = (m, b, nomeTipo) => !b || semAcento(`${m.nome} ${m.cbo || ""} ${m.setor || ""} ${m.descritivo || ""} ${m.requisitos || ""} ${(m.documentos || []).map((d) => nomeTipo(d.codigo)).join(" ")}`).includes(b);

export default function BibliotecaFuncoes({ token, chamar, C, input, label, card, btn, tag, onAviso }) {
  const [dados, setDados] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    try { setDados(await chamar(token, "GET", "/biblioteca/funcoes")); }
    catch (e) { onAviso({ tipo: "erro", texto: e.message }); }
  }, [token, chamar, onAviso]);
  useEffect(() => { carregar(); }, [carregar]);

  const tipos = dados?.tipos_documento || [];
  const nomeTipo = (c) => tipos.find((t) => t.codigo === c)?.nome || c;
  const escolaridades = dados?.escolaridades || [];
  const riscos = dados?.riscos || [];
  const grupos = [...new Set(riscos.map((r) => r.grupo))];
  const nomeRisco = (c) => riscos.find((r) => r.codigo === c)?.nome || c;
  const tiposEpi = dados?.tipos_epi || [];
  const sugestao = dados?.sugestao_por_risco || {};
  const nomeEpi = (c) => tiposEpi.find((t) => t.codigo === c)?.nome || c;
  const sugerir = (f) => { const ja = new Set(f.epis.map((k) => k.tipo)); const out = []; for (const r of f.riscos) for (const t of sugestao[r] || []) if (!ja.has(t)) { ja.add(t); out.push({ tipo: t, quantidade: 1, troca_dias: "" }); } return out; };

  const salvar = async () => {
    setSalvando(true);
    try {
      const corpo = { nome: form.nome, descritivo: form.descritivo, requisitos: form.requisitos, documentos: form.documentos.map((codigo) => ({ codigo })),
        cbo: form.cbo, setor: form.setor, escolaridade: form.escolaridade || null, riscos: form.riscos, responde_a: form.responde_a,
        epis: form.epis.map((k) => ({ tipo: k.tipo, quantidade: Number(k.quantidade) || 1, troca_dias: k.troca_dias === "" || k.troca_dias == null ? null : Number(k.troca_dias) })) };
      const r = form.id ? await chamar(token, "PUT", `/biblioteca/funcoes/${form.id}`, corpo) : await chamar(token, "POST", "/biblioteca/funcoes", corpo);
      onAviso({ tipo: "ok", texto: form.id ? (r?.versao_subiu ? `Modelo salvo — versão ${r.modelo?.versao}. Quem importou verá "versão nova".` : "Modelo salvo.") : "Modelo criado na biblioteca." });
      setForm(null); await carregar();
    } catch (e) { onAviso({ tipo: "erro", texto: e.message }); }
    finally { setSalvando(false); }
  };

  const desativar = async () => {
    const m = confirmar; setConfirmar(null);
    try { await chamar(token, "DELETE", `/biblioteca/funcoes/${m.id}`); onAviso({ tipo: "ok", texto: `${m.nome} saiu da biblioteca.` }); await carregar(); }
    catch (e) { onAviso({ tipo: "erro", texto: e.message }); }
  };

  if (!dados) return <div style={{ color: C.muted }}>Carregando…</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: C.sub, flex: 1, minWidth: 240 }}>
          Modelos de função que todas as transportadoras veem em <b style={{ color: C.text }}>👷 Pessoas → Funções → Importar da biblioteca</b>. Importar faz uma cópia que a empresa adapta.
        </div>
        <button type="button" onClick={() => setForm({ nome: "", descritivo: "", requisitos: "", documentos: [], cbo: "", setor: "", escolaridade: "", riscos: [], responde_a: "", epis: [] })} style={btn(C.accent)}>＋ Novo modelo</button>
      </div>

      {dados.modelos.length > 0 && (
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar modelo por função, atividade ou documento…" style={{ ...input, maxWidth: 420, marginBottom: 12 }} />
      )}
      {dados.modelos.length > 0 && !dados.modelos.some((m) => casa(m, semAcento(busca.trim()), nomeTipo)) && <div style={{ ...card, padding: 20, color: C.sub, textAlign: "center" }}>Nenhum modelo com “{busca}”.</div>}
      {dados.modelos.length === 0 && <div style={{ ...card, padding: 24, color: C.sub, textAlign: "center" }}>Nenhum modelo. Rode a migration 024 ou crie o primeiro.</div>}
      <div style={{ display: "grid", gap: 10 }}>
        {dados.modelos.filter((m) => casa(m, semAcento(busca.trim()), nomeTipo)).map((m) => (
          <div key={m.id} style={{ ...card, padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 200 }}>{m.nome}</div>
              <span style={tag(C.violet)}>v{m.versao || 1}</span>
              <span style={tag(C.muted)}>{m.importacoes} empresa(s) importaram</span>
              <button type="button" onClick={() => setForm({ id: m.id, nome: m.nome, descritivo: m.descritivo || "", requisitos: m.requisitos || "", documentos: (m.documentos || []).map((d) => d.codigo), cbo: m.cbo || "", setor: m.setor || "", escolaridade: m.escolaridade || "", riscos: m.riscos || [], responde_a: m.responde_a || "", epis: (m.epis || []).map((k) => ({ ...k, troca_dias: k.troca_dias ?? "" })) })} style={btn(C.accent, false)}>Editar</button>
              <button type="button" onClick={() => setConfirmar(m)} style={btn(C.danger, false)}>Tirar da biblioteca</button>
            </div>
            {[m.cbo && `CBO ${m.cbo}`, m.setor, m.escolaridade && escolaridades.find((e) => e.codigo === m.escolaridade)?.nome, m.responde_a && `responde a ${m.responde_a}`].filter(Boolean).length > 0 && (
              <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>{[m.cbo && `CBO ${m.cbo}`, m.setor, m.escolaridade && escolaridades.find((e) => e.codigo === m.escolaridade)?.nome, m.responde_a && `responde a ${m.responde_a}`].filter(Boolean).join(" · ")}</div>
            )}
            <div style={{ fontSize: 12, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>{(m.descritivo || "").slice(0, 220)}{(m.descritivo || "").length > 220 ? "…" : ""}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {(m.documentos || []).map((d) => <span key={d.codigo} style={tag(C.accent)}>📄 {nomeTipo(d.codigo)}</span>)}
              {(m.riscos || []).map((r) => <span key={r} style={tag(C.warn)}>⚠ {nomeRisco(r)}</span>)}
              {(m.epis || []).map((k) => <span key={k.tipo} style={tag(C.success)}>🦺 {nomeEpi(k.tipo)}{k.quantidade > 1 ? ` ×${k.quantidade}` : ""}</span>)}
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: "40px 16px", overflowY: "auto" }} onClick={() => !salvando && setForm(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 640, padding: "20px 22px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{form.id ? "Editar modelo" : "Novo modelo de função"}</div>
            <label style={{ display: "block", marginBottom: 12 }}><span style={label}>NOME</span>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={input} /></label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ flex: "1 1 120px" }}><span style={label}>CBO</span>
                <input value={form.cbo} onChange={(e) => setForm({ ...form, cbo: e.target.value })} placeholder="7825-10" style={input} /></label>
              <label style={{ flex: "2 1 200px" }}><span style={label}>SETOR / ÁREA</span>
                <input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} placeholder="Manutenção / Oficina" style={input} /></label>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ flex: "1 1 180px" }}><span style={label}>ESCOLARIDADE MÍNIMA</span>
                <select value={form.escolaridade} onChange={(e) => setForm({ ...form, escolaridade: e.target.value })} style={input}>
                  <option value="">Não definida</option>{escolaridades.map((x) => <option key={x.codigo} value={x.codigo}>{x.nome}</option>)}</select></label>
              <label style={{ flex: "2 1 200px" }}><span style={label}>RESPONDE A</span>
                <input value={form.responde_a} onChange={(e) => setForm({ ...form, responde_a: e.target.value })} placeholder="Encarregado de manutenção" style={input} /></label>
            </div>
            <label style={{ display: "block", marginBottom: 12 }}><span style={label}>DESCRITIVO (ATIVIDADES E RESPONSABILIDADES)</span>
              <textarea rows={6} value={form.descritivo} onChange={(e) => setForm({ ...form, descritivo: e.target.value })} style={{ ...input, resize: "vertical" }} /></label>
            <label style={{ display: "block", marginBottom: 12 }}><span style={label}>REQUISITOS (ESCOLARIDADE, EXPERIÊNCIA, HABILITAÇÃO)</span>
              <textarea rows={3} value={form.requisitos} onChange={(e) => setForm({ ...form, requisitos: e.target.value })} style={{ ...input, resize: "vertical" }} /></label>
            <span style={label}>DOCUMENTOS EXIGIDOS</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              {tipos.map((t) => {
                const on = form.documentos.includes(t.codigo);
                return (
                  <label key={t.codigo} style={{ ...tag(on ? C.accent : C.muted), cursor: "pointer", padding: "5px 10px", fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="checkbox" checked={on} onChange={() => setForm({ ...form, documentos: on ? form.documentos.filter((c) => c !== t.codigo) : [...form.documentos, t.codigo] })} />
                    {t.nome}
                  </label>
                );
              })}
            </div>
            <span style={{ ...label, marginTop: 10 }}>RISCOS DA FUNÇÃO (PGR)</span>
            {grupos.map((g) => (
              <div key={g} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.sub, width: 78, fontWeight: 600 }}>{g}</span>
                {riscos.filter((r) => r.grupo === g).map((r) => {
                  const on = form.riscos.includes(r.codigo);
                  return (
                    <label key={r.codigo} style={{ ...tag(on ? C.warn : C.muted), cursor: "pointer", padding: "4px 9px", fontSize: 12, display: "flex", gap: 5, alignItems: "center" }}>
                      <input type="checkbox" checked={on} onChange={() => setForm({ ...form, riscos: on ? form.riscos.filter((c) => c !== r.codigo) : [...form.riscos, r.codigo] })} />
                      {r.nome}
                    </label>
                  );
                })}
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 6px" }}>
              <span style={{ ...label, marginBottom: 0 }}>KIT DE EPI</span>
              <div style={{ flex: 1 }} />
              <button type="button" onClick={() => setForm({ ...form, epis: [...form.epis, ...sugerir(form)] })} disabled={!sugerir(form).length} style={{ ...btn(C.violet, false), opacity: sugerir(form).length ? 1 : 0.45 }}>✨ Sugerir pelos riscos</button>
              <button type="button" onClick={() => setForm({ ...form, epis: [...form.epis, { tipo: "", quantidade: 1, troca_dias: "" }] })} style={btn(C.accent, false)}>＋ EPI</button>
            </div>
            {form.epis.map((k, i) => {
              const muda = (c, v) => setForm({ ...form, epis: form.epis.map((x, j) => (j === i ? { ...x, [c]: v } : x)) });
              return (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                  <select value={k.tipo} onChange={(e) => muda("tipo", e.target.value)} style={{ ...input, flex: "3 1 200px", padding: "7px 10px", fontSize: 12 }}>
                    <option value="">Tipo de EPI…</option>
                    {tiposEpi.filter((t) => t.codigo === k.tipo || !form.epis.some((x) => x.tipo === t.codigo)).map((t) => <option key={t.codigo} value={t.codigo}>{t.nome}</option>)}
                  </select>
                  <span style={{ fontSize: 11, color: C.sub }}>qtd</span>
                  <input type="number" min={1} max={99} value={k.quantidade} onChange={(e) => muda("quantidade", e.target.value)} style={{ ...input, width: 56, padding: "6px 8px", fontSize: 12 }} />
                  <span style={{ fontSize: 11, color: C.sub }}>troca (dias)</span>
                  <input type="number" min={1} max={3650} value={k.troca_dias} onChange={(e) => muda("troca_dias", e.target.value)} style={{ ...input, width: 70, padding: "6px 8px", fontSize: 12 }} />
                  <button type="button" onClick={() => setForm({ ...form, epis: form.epis.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
              );
            })}
            {form.id && <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Mudou descritivo, requisitos, documentos, CBO, setor, escolaridade, riscos, kit de EPI ou "responde a" → sobe a versão e as empresas que importaram veem "versão nova" (elas decidem se atualizam).</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setForm(null)} style={btn(C.muted, false)}>Cancelar</button>
              <button type="button" onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ ...btn(C.accent), opacity: salvando || !form.nome.trim() ? 0.5 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmar && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={() => setConfirmar(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 460, padding: "20px 22px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: C.danger }}>Tirar da biblioteca</div>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 14 }}>
              <b style={{ color: C.text }}>{confirmar.nome}</b> deixa de aparecer para importar. As {confirmar.importacoes} empresa(s) que já importaram continuam com a cópia delas.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setConfirmar(null)} style={btn(C.muted, false)}>Cancelar</button>
              <button type="button" onClick={desativar} style={btn(C.danger)}>Tirar da biblioteca</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
