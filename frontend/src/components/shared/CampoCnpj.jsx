// components/shared/CampoCnpj.jsx — etapa 18zx: CNPJ/CPF com máscara enquanto digita + consulta da Receita (BrasilAPI)
//   14 dígitos válidos → busca a razão social e a SITUAÇÃO CADASTRAL (ATIVA ✓ / outras ⚠) e devolve em onEmpresa(dados).
//   11 dígitos → CPF (só confere o dígito). Mesmo serviço usado no cadastro de fornecedores e no signup.
import { useEffect, useRef, useState } from "react";

const so = (v) => String(v || "").replace(/\D/g, "");
export function mascaraCnpjCpf(v) {
  const d = so(v).slice(0, 14);
  if (d.length <= 11) return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}
export function cnpjValido(c) {
  c = so(c); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n) => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += Number(c[i]) * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}
export function cpfValido(c) {
  c = so(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export default function CampoCnpj({ C, s, valor, onChange, onEmpresa, aceitaCpf = true, placeholder = "00.000.000/0000-00" }) {
  const [info, setInfo] = useState(null); const ult = useRef("");
  const d = so(valor);
  useEffect(() => {
    if (d.length === 14) {
      if (!cnpjValido(d)) { setInfo({ erro: "CNPJ inválido (dígito verificador)" }); return; }
      if (ult.current === d) return; ult.current = d; setInfo({ carregando: true });
      fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`).then(async (r) => {
        if (r.status === 404) { setInfo({ erro: "CNPJ não encontrado na Receita" }); return; }
        if (!r.ok) { setInfo({ aviso: "Não consegui consultar a Receita agora — confira depois." }); return; }
        const j = await r.json(); const sit = String(j.descricao_situacao_cadastral || "").toUpperCase();
        const x = { razao_social: j.razao_social || "", nome_fantasia: j.nome_fantasia || "", situacao: sit, ativa: sit === "ATIVA", cidade: j.municipio || "", uf: j.uf || "" };
        setInfo(x); onEmpresa?.(x);
      }).catch(() => setInfo({ aviso: "Não consegui consultar a Receita agora — confira depois." }));
    } else if (d.length === 11 && aceitaCpf) { ult.current = ""; setInfo(cpfValido(d) ? { cpf: true } : { erro: "CPF inválido (dígito verificador)" }); }
    else { ult.current = ""; setInfo(null); }
  }, [d]); // eslint-disable-line
  return <div>
    <input value={mascaraCnpjCpf(valor)} inputMode="numeric" placeholder={placeholder} onChange={(e) => onChange(mascaraCnpjCpf(e.target.value))} style={{ ...s.input, ...(info?.erro ? { borderColor: C.danger } : {}) }} />
    {info && <div style={{ fontSize: 11.5, marginTop: 3, color: info.erro ? C.danger : info.aviso ? C.warn : info.carregando ? C.muted : info.cpf ? C.textSub : info.ativa ? C.success : C.danger }}>
      {info.erro || info.aviso || (info.carregando ? "Consultando a Receita…" : info.cpf ? "CPF válido" : <>{info.ativa ? "✓" : "⚠"} {info.razao_social}{info.cidade ? ` — ${info.cidade}/${info.uf}` : ""} · situação: <b>{info.situacao || "—"}</b>{!info.ativa ? " (não está regular)" : ""}</>)}
    </div>}
  </div>;
}
