// components/pessoas/AcessoColaborador.jsx — etapa 12e.2b
//   • <AcessoColaborador>  — no formulário do colaborador: dá/renova/desativa o acesso a "🎓 Meus treinamentos"
//     (usuário de perfil "colaborador": NÃO conta na cobrança do plano e só vê os treinamentos dele).
//   • <CardAniversariantes> — 🎂 aniversariantes do mês na aba Colaboradores (só dia/mês — LGPD).
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function AcessoColaborador({ C, s, colaboradorId, emailPadrao, onAviso, onErro }) {
  const [st, setSt] = useState(null);
  const [form, setForm] = useState(null);
  const [desativar, setDesativar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const carregar = async () => { try { setSt(await apiService.get(`/pessoas/colaboradores/${colaboradorId}/acesso`)); } catch { setSt({ erro: true }); } };
  useEffect(() => { carregar(); }, [colaboradorId]); // eslint-disable-line
  if (!st || st.erro) return null;
  const salvar = async () => {
    setSalvando(true);
    try { const r = await apiService.post(`/pessoas/colaboradores/${colaboradorId}/acesso`, form); onAviso(`Acesso liberado: ${r.email} · senha: ${r.senha_cpf ? "o CPF (só números)" : "a que você digitou"}. Passe para o colaborador.`); setForm(null); await carregar(); }
    catch (e) { onErro(e.message); }
    finally { setSalvando(false); }
  };
  const tirar = async () => {
    try { await apiService.delete(`/pessoas/colaboradores/${colaboradorId}/acesso`); onAviso("Acesso desativado."); setDesativar(false); await carregar(); } catch (e) { onErro(e.message); }
  };
  const box = { border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, fontSize: 12 };
  if (st.tem && !st.so_colaborador) return <div style={{ ...box, color: C.textSub }}>🎓 Tem usuário do sistema ({st.email}) — ele vê os treinamentos em “🎓 Meus treinamentos” no menu.</div>;
  return (
    <div style={box}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px", color: C.textSub }}>🎓 <b style={{ color: C.text }}>Acesso a “Meus treinamentos”</b> — {st.tem ? (st.ativo ? <>ativo · <b style={{ color: C.text }}>{st.email}</b></> : <>desativado ({st.email})</>) : "sem acesso"}. Não conta na cobrança do plano.</div>
        {!form && <button type="button" onClick={() => setForm({ email: st.email || emailPadrao || "", senha: "" })} style={{ ...s.btn(true), cursor: "pointer", padding: "5px 12px", fontSize: 12 }}>{st.tem ? "Trocar senha / reativar" : "🔑 Dar acesso"}</button>}
        {st.tem && st.ativo && !form && !desativar && <button type="button" onClick={() => setDesativar(true)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 12px", fontSize: 12, color: C.danger }}>Desativar</button>}
      </div>
      {desativar && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ color: C.danger }}>Desativar o acesso? O histórico de treinamentos fica.</span>
          <button type="button" onClick={() => setDesativar(false)} style={{ ...s.btn(false), cursor: "pointer", padding: "4px 10px", fontSize: 12, color: C.text }}>Voltar</button>
          <button type="button" onClick={tirar} style={{ ...s.btn(true, C.danger), cursor: "pointer", padding: "4px 10px", fontSize: 12 }}>Desativar</button>
        </div>
      )}
      {form && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e-mail de login" disabled={st.tem} style={{ ...s.input, flex: "2 1 200px", padding: "6px 10px", fontSize: 12 }} />
          <input value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="senha — vazio = CPF (só números)" type="text" style={{ ...s.input, flex: "1 1 130px", padding: "6px 10px", fontSize: 12 }} />
          <button type="button" onClick={() => setForm(null)} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.text }}>Cancelar</button>
          <button type="button" disabled={salvando || (form.senha.length > 0 && form.senha.length < 6) || !form.email} onClick={salvar} style={{ ...s.btn(!salvando && !(form.senha.length > 0 && form.senha.length < 6) && !!form.email), padding: "5px 12px", fontSize: 12 }}>{salvando ? "Salvando…" : "Salvar acesso"}</button>
        </div>
      )}
    </div>
  );
}

export function CardAniversariantes({ C, s }) {
  const [d, setD] = useState(null);
  useEffect(() => { apiService.get("/pessoas/aniversariantes").then(setD).catch(() => setD(null)); }, []);
  if (!d || d.sem_migration || (!d.aniversariantes?.length && !d.sem_data)) return null;
  return (
    <div style={{ ...s.card, padding: "10px 14px", marginBottom: 12, fontSize: 12 }}>
      <b>🎂 Aniversariantes de {MESES[(d.mes || 1) - 1]}</b>
      {d.aniversariantes.length ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {d.aniversariantes.map((a) => <span key={a.id} style={s.tag(a.dia === d.hoje_dia ? "#ec4899" : "#a855f7")}>{a.dia === d.hoje_dia ? "🎉 hoje" : `dia ${a.dia}`} · {a.nome}</span>)}
        </div>
      ) : <span style={{ color: C.muted }}> — ninguém este mês.</span>}
      {d.sem_data > 0 && <div style={{ color: C.muted, marginTop: 6 }}>{d.sem_data} colaborador(es) sem data de nascimento — preencha em Editar (também confirma a identidade no link da prova).</div>}
    </div>
  );
}
