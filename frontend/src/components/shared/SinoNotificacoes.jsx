// components/shared/SinoNotificacoes.jsx — etapa 18n: 🔔 Central de Notificações (sistema e portal do fornecedor)
//   Fica fixo no canto superior direito. Chega aviso → o contador sobe e aparece um aviso rápido no canto ("Peças Serra
//   respondeu sobre DSP-0004"). Clicar abre o assunto (ex.: a conversa da demanda spot). Tempo real por espera longa.
//   base: "/notificacoes" (usuário do sistema) ou "/notificacoes-fornecedor" (portal).
import { useState, useEffect, useRef } from "react";
import apiService from "../../services/apiService";

const tempo = (d) => { const m = Math.floor((Date.now() - Date.parse(d)) / 60000); return m < 1 ? "agora" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : `há ${Math.floor(m / 1440)} d`; };

export default function SinoNotificacoes({ C, base = "/notificacoes", onAbrir }) {
  const [lista, setLista] = useState([]); const [nao, setNao] = useState(0); const [aberto, setAberto] = useState(false);
  const [toast, setToast] = useState(null); const versao = useRef(0); const vivo = useRef(true); const primeira = useRef(true);
  useEffect(() => {
    vivo.current = true;
    (async () => {
      while (vivo.current) {
        try {
          const r = await apiService.get(base, { desde: versao.current, esperar: primeira.current ? undefined : 1 });
          if (!vivo.current) break;
          if (r.sem_migration) { await new Promise((ok) => setTimeout(ok, 120000)); continue; }
          setLista(r.notificacoes || []); setNao(r.nao_lidas || 0);
          if (!primeira.current && (r.novas || []).length) { const n = r.novas[0]; setToast(n); setTimeout(() => setToast((t) => (t?.id === n.id ? null : t)), 6000); }
          versao.current = Math.max(versao.current, r.versao || 0); primeira.current = false;
        } catch { await new Promise((ok) => setTimeout(ok, 15000)); }
      }
    })();
    return () => { vivo.current = false; };
  }, [base]);
  const abrir = async (n) => {
    setAberto(false); setToast(null);
    if (!n.lida) { apiService.post(`${base}/${n.id}/lida`, {}).catch(() => {}); setLista((l) => l.map((x) => (x.id === n.id ? { ...x, lida: true } : x))); setNao((v) => Math.max(0, v - 1)); }
    onAbrir?.(n.link || {}, n);
  };
  const todasLidas = async () => { await apiService.post(`${base}/lidas`, {}).catch(() => {}); setLista((l) => l.map((x) => ({ ...x, lida: true }))); setNao(0); };
  return <>
    <button type="button" aria-label={`Notificações${nao ? ` (${nao} não lidas)` : ""}`} onClick={() => setAberto((v) => !v)}
      style={{ position: "fixed", top: 12, right: 16, zIndex: 900, width: 40, height: 40, borderRadius: 20, border: `1px solid ${C.border}`, background: C.surface || "#111722", color: C.text, fontSize: 18, cursor: "pointer", boxShadow: "0 4px 14px #0006" }}>
      🔔{nao > 0 && <span style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, background: C.danger || "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{nao > 99 ? "99+" : nao}</span>}
    </button>
    {aberto && <>
      <div onClick={() => setAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 899 }} />
      <div role="dialog" aria-label="Notificações" style={{ position: "fixed", top: 58, right: 16, zIndex: 901, width: 360, maxWidth: "calc(100vw - 32px)", maxHeight: "min(70vh, 360px)", overflowY: "auto", background: C.surface || "#111722", border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 12px 32px #000a", color: C.text, fontFamily: "inherit" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.surface || "#111722", zIndex: 1 }}>
          <b style={{ flex: 1, fontSize: 14 }}>🔔 Notificações</b>{/* 18n.3: topo fixo ao rolar */}
          {nao > 0 && <button type="button" onClick={todasLidas} style={{ background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer" }}>marcar todas como lidas</button>}
        </div>
        {lista.length === 0 ? <div style={{ padding: 20, fontSize: 13, color: C.muted, textAlign: "center" }}>Nenhuma notificação.<br /><span style={{ fontSize: 11.5 }}>As lidas ficam aqui por 30 dias.</span></div>
          : lista.map((n) => <div key={n.id} role="button" tabIndex={0} onClick={() => abrir(n)} onKeyDown={(e) => e.key === "Enter" && abrir(n)}
            style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: n.lida ? "transparent" : `${C.accent}14`, display: "flex", gap: 8 }}>
            {!n.lida && <span style={{ width: 8, height: 8, borderRadius: 4, background: C.accent, marginTop: 6, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: n.lida ? 400 : 600 }}>{n.titulo}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>{[n.texto, n.quantidade > 1 ? `${n.quantidade} mensagens` : null, tempo(n.em)].filter(Boolean).join(" · ")}</div>
            </div>
          </div>)}
      </div>
    </>}
    {toast && !aberto && <div role="status" onClick={() => abrir(toast)} style={{ position: "fixed", top: 62, right: 16, zIndex: 902, width: 340, maxWidth: "calc(100vw - 32px)", background: C.surface || "#111722", border: `1px solid ${C.accent}`, borderRadius: 10, padding: "10px 14px", boxShadow: "0 12px 32px #000a", cursor: "pointer", color: C.text }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{toast.titulo}</div>
      {toast.texto && <div style={{ fontSize: 11.5, color: C.muted }}>{toast.texto}{toast.quantidade > 1 ? ` · ${toast.quantidade} mensagens` : ""}</div>}
    </div>}
  </>;
}
