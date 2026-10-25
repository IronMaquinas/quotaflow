// src/plataforma/BibliotecaContratos.jsx — etapa 14d
// Console da Plataforma → aba "📄 Biblioteca de contratos": modelos de contrato (tenant_id NULL) com campos automáticos.
// As empresas importam em 📑 Contratos → 📄 Modelos. Mudou nome/texto → a versão sobe e quem importou vê "✨ Versão nova".
import { useState, useEffect, useCallback } from "react";
import { EditorModeloContrato } from "../components/contratos/ModelosContrato";

export default function BibliotecaContratos({ token, chamar, C, input, label, card, btn, tag, onAviso }) {
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const s = { input, label, card, tag, btn: (ativo, cor = C.accent) => ({ ...btn(cor, ativo), ...(ativo ? {} : { borderColor: C.border }) }) };
  const Cx = { ...C, textSub: C.sub || C.muted };
  const carregar = useCallback(async () => {
    try { setD(await chamar(token, "GET", "/biblioteca/contratos")); }
    catch (e) { onAviso({ tipo: "erro", texto: /contrato_modelos/.test(e.message) ? "Rode a migration 046 (modelos de contrato)." : e.message }); }
  }, [token, chamar, onAviso]);
  useEffect(() => { carregar(); }, [carregar]);
  const salvar = async (m) => {
    setSalvando(true);
    try {
      const corpo = { nome: m.nome, descricao: m.descricao, corpo: m.corpo };
      const r = m.id ? await chamar(token, "PUT", `/biblioteca/contratos/${m.id}`, corpo) : await chamar(token, "POST", "/biblioteca/contratos", corpo);
      onAviso({ tipo: "ok", texto: m.id ? (r?.versao_subiu ? "Salvo — versão nova: quem importou vai ver o aviso." : "Salvo.") : "Modelo criado na biblioteca." });
      setForm(null); await carregar();
    } catch (e) { onAviso({ tipo: "erro", texto: e.message }); } finally { setSalvando(false); }
  };
  const alternar = async (m) => { try { await chamar(token, "PUT", `/biblioteca/contratos/${m.id}`, { ativo: m.ativo === false }); await carregar(); } catch (e) { onAviso({ tipo: "erro", texto: e.message }); } };
  if (!d) return <div style={{ color: C.muted }}>Carregando…</div>;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: C.sub, flex: 1, minWidth: 240 }}>Modelos de contrato que as transportadoras importam e adaptam. São pontos de partida — a empresa revisa com o jurídico dela.</div>
        <button type="button" onClick={() => setForm({})} style={btn(C.accent)}>＋ Novo modelo</button>
      </div>
      <div style={{ ...card, overflow: "hidden" }}>
        {d.modelos.map((m, i) => (
          <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: i < d.modelos.length - 1 ? `1px solid ${C.border}` : "none", opacity: m.ativo === false ? 0.5 : 1, flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 240px" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{m.nome}</div><div style={{ fontSize: 11, color: C.muted }}>v{m.versao} · {m.campos_usados} campos automáticos{m.descricao ? ` · ${m.descricao}` : ""}</div></div>
            <button type="button" onClick={() => setForm(m)} style={btn(C.accent, false)}>Editar</button>
            <button type="button" onClick={() => alternar(m)} style={btn(m.ativo === false ? C.success : C.danger, false)}>{m.ativo === false ? "Voltar à biblioteca" : "Tirar da biblioteca"}</button>
          </div>
        ))}
        {d.modelos.length === 0 && <div style={{ padding: 20, color: C.sub, textAlign: "center" }}>Nenhum modelo ainda.</div>}
      </div>
      {form && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: 20, overflowY: "auto" }}>
          <div style={{ ...card, width: "100%", maxWidth: 1000, padding: "20px 22px", margin: "auto 0" }}>
            <EditorModeloContrato C={Cx} s={s} inicial={form} campos={d.campos} salvando={salvando} onSalvar={salvar} onCancelar={() => setForm(null)}
              titulo={form.id ? `Editar — ${form.nome} (v${form.versao})` : "Novo modelo da biblioteca"} />
          </div>
        </div>
      )}
    </div>
  );
}
