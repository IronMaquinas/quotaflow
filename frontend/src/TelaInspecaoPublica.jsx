// src/TelaInspecaoPublica.jsx — etapa 14b.1
// Link de inspeção de terceiros (#inspecao?t=<token>) — motorista terceirizado, agregado ou temporário, sem login.
// Ele se identifica (nome, CPF, empresa; placa quando o veículo é dele) e faz a mesma inspeção do app (ExecutarInspecao),
// inclusive sem internet: fica guardada no aparelho e é enviada quando a conexão voltar.
import { useState, useEffect, useCallback } from "react";
import { C, s } from "./App";
import ExecutarInspecao from "./components/inspecoes/ExecutarInspecao";
import * as Fila from "./utils/filaInspecoes";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const tokenDaUrl = () => { const m = (window.location.hash || "").match(/[?&]t=([a-f0-9]{48})/i); return m ? m[1] : ""; };
const mascCPF = (v) => { const d = String(v).replace(/\D/g, "").slice(0, 11); return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2"); };
const cpfOk = (v) => { const d = String(v).replace(/\D/g, ""); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false; const dv = (n) => { let t = 0; for (let i = 0; i < n; i++) t += Number(d[i]) * (n + 1 - i); const r = (t * 10) % 11; return r === 10 ? 0 : r; }; return dv(9) === Number(d[9]) && dv(10) === Number(d[10]); };

export default function TelaInspecaoPublica() {
  const tk = tokenDaUrl();
  const chave = `qf-insp-link-${tk}`;
  const [info, setInfo] = useState(null);
  const [erro, setErro] = useState("");
  const [id, setId] = useState(() => { try { return JSON.parse(localStorage.getItem(chave) || "null") || { nome: "", cpf: "", empresa: "", telefone: "", placa: "", veiculo: "" }; } catch { return { nome: "", cpf: "", empresa: "", telefone: "", placa: "", veiculo: "" }; } });
  const [exec, setExec] = useState(null);
  const [locais, setLocais] = useState([]);
  const [feito, setFeito] = useState(null);

  const chamar = async (metodo, caminho, corpo) => {
    let r;
    try { r = await fetch(`${API}/inspecao-link/${tk}${caminho}`, { method: metodo, headers: { "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined }); }
    catch { throw new Error("Sem internet"); } // sem .body = não chegou no servidor (fila tenta de novo)
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.erro || `Erro ${r.status}`); e.body = j; throw e; }
    return j;
  };
  const enviar = (corpo) => chamar("POST", "/enviar", corpo);
  const carregarLocais = useCallback(async () => setLocais(await Fila.listar(`link-${tk}`)), [tk]);
  const sincronizar = useCallback(async () => { const r = await Fila.sincronizar(`link-${tk}`, enviar); await carregarLocais(); if (r.enviadas) setFeito({ offline: false, enviadasFila: r.enviadas }); }, [tk]); // eslint-disable-line
  useEffect(() => {
    if (!tk) { setErro("Link incompleto — peça o link de novo à empresa."); return; }
    chamar("GET", "").then(setInfo).catch((e) => setErro(e.body ? e.message : "Sem internet para abrir o link. Se você já começou a inspeção neste celular, ela continua abaixo."));
    carregarLocais().then(sincronizar);
    const on = () => sincronizar(); window.addEventListener("online", on); return () => window.removeEventListener("online", on);
  }, []); // eslint-disable-line

  const falta = !id.nome.trim() || id.nome.trim().length < 3 ? "Informe seu nome completo" : !cpfOk(id.cpf) ? "CPF inválido" : info?.pede_placa && !id.placa.trim() ? "Informe a placa do veículo" : null;
  const comecar = () => {
    try { localStorage.setItem(chave, JSON.stringify(id)); } catch { /* ok */ }
    const placa = id.placa.trim().toUpperCase();
    setExec({ equipamento: { id: placa || "fixo" }, chavePrep: `${tk}-${placa || "fixo"}`,
      carregarPrep: async () => { const r = await chamar("GET", info?.pede_placa ? `?placa=${encodeURIComponent(placa)}&veiculo=${encodeURIComponent(id.veiculo || "")}` : ""); return r.prep; },
      extraCorpo: { terceiro: { nome: id.nome.trim(), cpf: id.cpf.replace(/\D/g, ""), empresa: id.empresa.trim(), telefone: id.telefone.trim(), placa, veiculo: id.veiculo.trim() } } });
  };
  const comum = { tenant: `link-${tk}`, C, s, enviarFn: enviar, onFechar: () => { setExec(null); carregarLocais(); }, onConcluida: (r) => { setExec(null); setFeito(r); carregarLocais(); } };
  if (exec) return <ExecutarInspecao {...comum} {...exec} />;

  const campo = (k, rot, extra = {}) => (
    <label style={{ display: "block", marginBottom: 12 }}><span style={s.label}>{rot}</span>
      <input value={id[k]} onChange={(e) => setId({ ...id, [k]: k === "cpf" ? mascCPF(e.target.value) : e.target.value })} style={{ ...s.input, fontSize: 16, padding: 12 }} {...extra} /></label>
  );
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 16px 60px" }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>QuotaFlow <span style={{ color: C.muted, fontWeight: 400, fontSize: 13 }}>· {info?.empresa?.nome || "inspeção"}</span></div>
        <div style={{ fontSize: 13, color: C.textSub, marginBottom: 16 }}>🔍 Inspeção de terceiros{info?.modelo_nome ? ` — ${info.modelo_nome}` : ""}{info?.prep?.equipamento ? ` · ${info.prep.equipamento.tag}` : ""}</div>

        {feito && <div style={{ ...s.card, padding: 14, marginBottom: 14, borderColor: feito.offline ? C.warn : C.success }}>
          {feito.offline ? <><b style={{ color: C.warn }}>💾 Guardada no celular.</b> Sem internet agora — ela será enviada sozinha quando a conexão voltar (deixe esta página aberta ou abra o link de novo).</>
            : feito.enviadasFila ? <b style={{ color: C.success }}>✓ {feito.enviadasFila} inspeção(ões) guardada(s) foram enviadas.</b>
            : <><b style={{ color: feito.bloqueou ? C.danger : C.success }}>{feito.bloqueou ? "⛔ Inspeção enviada — o veículo NÃO deve ser usado até a empresa liberar." : "✓ Inspeção enviada."}</b> {feito.numero && <div style={{ fontSize: 13, marginTop: 4 }}>Número: <b>{feito.numero}</b></div>}</>}
        </div>}

        {locais.length > 0 && <div style={{ ...s.card, padding: 12, marginBottom: 14, borderColor: C.warn }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.warn, marginBottom: 6 }}>💾 Guardadas neste celular</div>
          {locais.map((x) => (
            <div key={x.uid} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "4px 0", flexWrap: "wrap" }}>
              <span style={{ flex: 1 }}>{x.rotulo}</span>
              {x.situacao === "rascunho" && <button type="button" onClick={() => setExec({ rascunho: x })} style={{ ...s.btn(true, C.accent), cursor: "pointer", padding: "6px 12px" }}>Continuar</button>}
              {x.situacao === "pendente" && <span style={s.tag(C.warn)}>AGUARDANDO INTERNET</span>}
              {x.situacao === "erro" && <button type="button" onClick={() => { const y = { ...x, situacao: "rascunho" }; Fila.salvar(y).then(() => setExec({ rascunho: y })); }} style={{ ...s.btn(true, C.danger), cursor: "pointer", padding: "6px 12px" }} title={x.erro}>Corrigir: {x.erro}</button>}
            </div>))}
        </div>}

        {!info && erro && <div style={{ ...s.card, padding: 18, color: C.danger }}>{erro}</div>}
        {info && (
          <div style={{ ...s.card, padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Quem está inspecionando</div>
            {campo("nome", "NOME COMPLETO", { autoComplete: "name" })}
            {campo("cpf", "CPF", { inputMode: "numeric" })}
            {campo("empresa", "EMPRESA (TRANSPORTADORA / AGREGADO)")}
            {campo("telefone", "TELEFONE (OPCIONAL)", { inputMode: "tel" })}
            {info.pede_placa && <>{campo("placa", "PLACA DO VEÍCULO")}{campo("veiculo", "VEÍCULO (EX.: CAVALO 6X4, CARRETA PRANCHA)")}</>}
            {falta && (id.nome || id.cpf) && <div style={{ color: C.warn, fontSize: 13, marginBottom: 8 }}>{falta}</div>}
            <button type="button" disabled={!!falta} onClick={comecar} style={{ ...s.btn(!falta, C.accent), width: "100%", padding: 14, fontSize: 15 }}>Começar a inspeção ›</button>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Seus dados ficam registrados na inspeção, com a sua assinatura. Link válido até {new Date(info.valido_ate).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.</div>
          </div>
        )}
      </div>
    </div>
  );
}
