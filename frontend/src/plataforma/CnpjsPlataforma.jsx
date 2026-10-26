// frontend/src/plataforma/CnpjsPlataforma.jsx — etapa 14e
// Console → 🛡 CNPJs: fornecedores da plataforma (globais e candidatos) com CNPJ irregular na Receita,
// quantos tenants têm processo em andamento com cada um, e a revisão: ✓ Revisado (nota) · ⛔ Suspender (some para
// todos os tenants) · Reativar. Tudo vai para o log do console (admin_acoes).
import { useState, useEffect, useCallback } from "react";

const fmt = (d) => (String(d || "").length === 14 ? String(d).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d || "—");
const dt = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const REV = { revisado: "✓ revisado", suspenso: "⛔ suspenso", em_revisao: "em revisão" };

export default function CnpjsPlataforma({ token, chamar, C, input, label, card, btn, tag, onAviso }) {
  const [d, setD] = useState(null);
  const [acao, setAcao] = useState(null); // { f, acao, nota }
  const [ocupado, setOcupado] = useState(false);
  const carregar = useCallback(() => chamar(token, "GET", "/cnpjs").then(setD).catch((e) => onAviso({ tipo: "erro", texto: e.message })), [token, chamar, onAviso]);
  useEffect(() => { carregar(); }, [carregar]);

  async function executar() {
    setOcupado(true);
    try { await chamar(token, "POST", `/cnpjs/${acao.f.id}/revisar`, { acao: acao.acao, nota: acao.nota }); onAviso({ tipo: "ok", texto: `${acao.f.nome}: registrado.` }); setAcao(null); carregar(); }
    catch (e) { onAviso({ tipo: "erro", texto: e.message }); } finally { setOcupado(false); }
  }
  async function rodar() {
    setOcupado(true);
    try { const r = await chamar(token, "POST", "/cnpjs/rodar", { lote: 50 }); onAviso({ tipo: "ok", texto: `Ciclo ${r.ciclo}: ${r.verificados_agora} verificados agora · restam ${r.restam}${r.emails != null ? ` · ${r.emails} e-mail(s) do ciclo enviados` : ""}` }); carregar(); }
    catch (e) { onAviso({ tipo: "erro", texto: e.message }); } finally { setOcupado(false); }
  }
  async function verificar(f) {
    setOcupado(true);
    try { await chamar(token, "POST", `/cnpjs/verificar/${f.documento}`, {}); carregar(); } catch (e) { onAviso({ tipo: "erro", texto: e.message }); } finally { setOcupado(false); }
  }

  if (!d) return <div style={{ color: C.muted }}>Carregando…</div>;
  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ ...card, padding: "10px 14px", fontSize: 13 }}>Fornecedores da plataforma com CNPJ: <b>{d.total}</b> · verificados: <b>{d.verificados}</b> · irregulares: <b style={{ color: d.irregulares.length ? C.danger : C.success }}>{d.irregulares.length}</b></div>
        <div style={{ fontSize: 12, color: C.muted, flex: 1 }}>Ciclo atual: {String(d.ciclo).split("-").reverse().join("/")}{d.ultimo_ciclo?.[0]?.concluido_em ? ` · último concluído ${dt(d.ultimo_ciclo[0].concluido_em)} (${d.ultimo_ciclo[0].total} CNPJs, ${d.ultimo_ciclo[0].irregulares} irregulares)` : ""}</div>
        <button type="button" disabled={ocupado} onClick={rodar} style={{ ...btn(C.accent, false), opacity: ocupado ? 0.5 : 1 }}>↻ Rodar lote agora (50)</button>
      </div>
      {d.irregulares.length === 0 && <div style={{ ...card, padding: 18, color: C.muted }}>✓ Nenhum fornecedor da plataforma com CNPJ irregular.</div>}
      {d.irregulares.map((f) => (
        <div key={f.id} style={{ ...card, padding: "12px 14px", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px" }}>
              <div style={{ fontWeight: 600 }}>{f.nome} <span style={{ color: C.muted, fontWeight: 400, fontSize: 12 }}>· {f.tipo}{!f.ativo ? " · inativo" : ""}</span></div>
              <div style={{ fontSize: 12, color: C.muted }}>CNPJ {fmt(f.documento)} · <b style={{ color: C.danger }}>{f.situacao}</b>{f.situacao_anterior ? ` (era ${f.situacao_anterior})` : ""} · mudou {dt(f.mudou_em)} · verificado {dt(f.verificado_em)}</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>{f.tenants_com_processo ? <b style={{ color: C.warn }}>{f.tenants_com_processo} transportadora(s) com processo em andamento ({f.processos})</b> : <span style={{ color: C.muted }}>sem processos em andamento</span>}</div>
              {f.revisao_status && <div style={{ fontSize: 12, marginTop: 2 }}><span style={tag(f.revisao_status === "suspenso" ? C.danger : C.success)}>{REV[f.revisao_status] || f.revisao_status}</span> <span style={{ color: C.muted }}>{f.revisao_nota} · {f.revisao_por} · {dt(f.revisao_em)}</span></div>}
            </div>
            <button type="button" disabled={ocupado} onClick={() => verificar(f)} style={{ ...btn(C.muted, false), padding: "5px 10px", fontSize: 11 }}>↻ Verificar</button>
            <button type="button" onClick={() => setAcao({ f, acao: "revisar", nota: "" })} style={{ ...btn(C.success, false), padding: "5px 10px", fontSize: 11 }}>✓ Revisado…</button>
            {f.ativo ? <button type="button" onClick={() => setAcao({ f, acao: "suspender", nota: "" })} style={{ ...btn(C.danger, false), padding: "5px 10px", fontSize: 11 }}>⛔ Suspender…</button>
              : <button type="button" onClick={() => setAcao({ f, acao: "reativar", nota: "" })} style={{ ...btn(C.accent, false), padding: "5px 10px", fontSize: 11 }}>Reativar…</button>}
          </div>
        </div>
      ))}

      {acao && (
        <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ ...card, padding: 20, width: "100%", maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{{ revisar: "Marcar como revisado", suspender: "Suspender fornecedor", reativar: "Reativar fornecedor" }[acao.acao]}</div>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 12 }}>
              <b style={{ color: C.text }}>{acao.f.nome}</b> · CNPJ {fmt(acao.f.documento)} · {acao.f.situacao}<br />
              {acao.acao === "suspender" && <>Ele <b style={{ color: C.danger }}>deixa de aparecer para todas as transportadoras</b> (cotações e Canal Spot). Os processos já abertos continuam, com a trava de justificativa.</>}
              {acao.acao === "revisar" && <>Registre o que foi conferido com o fornecedor (ex.: "situação regularizada, certidão de 26/10 recebida").</>}
              {acao.acao === "reativar" && <>Ele volta a aparecer para as transportadoras.</>}
            </div>
            {acao.acao !== "reativar" && <><label style={label}>NOTA (OBRIGATÓRIA)</label>
              <textarea rows={3} maxLength={500} value={acao.nota} onChange={(e) => setAcao({ ...acao, nota: e.target.value })} style={{ ...input, resize: "vertical", marginBottom: 12 }} /></>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setAcao(null)} style={btn(C.muted, false)}>Cancelar</button>
              <button type="button" disabled={ocupado || (acao.acao !== "reativar" && acao.nota.trim().length < 10)} onClick={executar}
                style={{ ...btn(acao.acao === "suspender" ? C.danger : C.success), opacity: ocupado || (acao.acao !== "reativar" && acao.nota.trim().length < 10) ? 0.5 : 1 }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
