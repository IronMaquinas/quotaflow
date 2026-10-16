// components/shared/SeletorAtuacao.jsx
//
// Perfil de atuação (etapa 4) — peças compartilhadas entre:
//   • portal do fornecedor (Meus Dados)
//   • tela de fornecedores do tenant (cadastro do local)
//   • Canal Spot (nova demanda + detalhe, dos dois lados)
//
// As listas vêm de GET /api/atuacao/opcoes (tabela atuacao_opcoes) e ficam em
// cache na memória: abrir várias telas não repete a chamada.
//
// Exporta:
//   useOpcoesAtuacao()  → { opcoes, recarregar }
//   nomeAtuacao(opcoes, dimensao, codigo)
//   SeletorAtuacao      → chips de uma dimensão (múltipla ou única escolha)
//   PainelAtuacao       → as 5 dimensões juntas + "Outra marca"
//   ResumoAtuacao       → texto curto "Hidráulica, Freios +2"

import { useState, useEffect, useCallback } from "react";
import apiService from "../../services/apiService";

let cacheOpcoes = null;
let promessaOpcoes = null;

function buscarOpcoes(forcar = false) {
  if (forcar) { cacheOpcoes = null; promessaOpcoes = null; }
  if (cacheOpcoes) return Promise.resolve(cacheOpcoes);
  if (!promessaOpcoes) {
    promessaOpcoes = apiService.get("/atuacao/opcoes")
      .then((r) => { cacheOpcoes = r; return r; })
      .catch((e) => { promessaOpcoes = null; throw e; });
  }
  return promessaOpcoes;
}

export function useOpcoesAtuacao() {
  const [opcoes, setOpcoes] = useState(cacheOpcoes);

  useEffect(() => {
    let vivo = true;
    buscarOpcoes().then((r) => { if (vivo) setOpcoes(r); }).catch((e) => console.error("❌ opções de atuação:", e));
    return () => { vivo = false; };
  }, []);

  // Depois de sugerir marca nova, recarrega para ela aparecer marcada.
  const recarregar = useCallback(async () => {
    try { setOpcoes(await buscarOpcoes(true)); } catch (e) { console.error("❌ opções de atuação:", e); }
  }, []);

  return { opcoes, recarregar };
}

export function nomeAtuacao(opcoes, dimensao, codigo) {
  const o = opcoes?.[dimensao]?.find((x) => x.codigo === codigo);
  return o ? o.nome : codigo;
}

export const DIMENSOES_ATUACAO = [
  { dimensao: "segmento", campo: "atuacao_segmentos", titulo: "SEGMENTOS", ajuda: "Para que tipo de equipamento atende" },
  { dimensao: "sistema", campo: "atuacao_sistemas", titulo: "SISTEMAS", ajuda: "Em que parte do equipamento" },
  { dimensao: "marca", campo: "atuacao_marcas", titulo: "MARCAS", ajuda: "Marcas que atende" },
  { dimensao: "oferta", campo: "atuacao_ofertas", titulo: "TIPO DE OFERTA", ajuda: "O que fornece" },
  { dimensao: "uf", campo: "atuacao_ufs", titulo: "ÁREA DE ATENDIMENTO", ajuda: "Estados que atende" },
];

export function atuacaoVazia() {
  return { atuacao_segmentos: [], atuacao_sistemas: [], atuacao_marcas: [], atuacao_ofertas: [], atuacao_ufs: [], marca_sugerida: "" };
}

export function atuacaoDe(registro) {
  const r = registro || {};
  const lista = (v) => (Array.isArray(v) ? v : []);
  return {
    atuacao_segmentos: lista(r.atuacao_segmentos),
    atuacao_sistemas: lista(r.atuacao_sistemas),
    atuacao_marcas: lista(r.atuacao_marcas),
    atuacao_ofertas: lista(r.atuacao_ofertas),
    atuacao_ufs: lista(r.atuacao_ufs),
    marca_sugerida: "",
  };
}

function Chip({ ativo, onClick, children, C, pendente, somenteLeitura }) {
  return (
    <button
      type="button"
      onClick={somenteLeitura ? undefined : onClick}
      title={pendente ? "Marca sugerida — aguardando aprovação da plataforma" : undefined}
      style={{
        background: ativo ? `${C.accent}22` : "transparent",
        border: `1px solid ${ativo ? C.accent : C.border}`,
        color: ativo ? C.text : C.muted,
        borderRadius: 14,
        padding: "4px 11px",
        fontSize: 11,
        cursor: somenteLeitura ? "default" : "pointer",
        fontFamily: "inherit",
        fontWeight: ativo ? 600 : 400,
      }}
    >
      {ativo ? "✓ " : ""}{children}{pendente ? " (em análise)" : ""}
    </button>
  );
}

// valor: array de códigos. multiplo=false → no máximo 1 (clicar de novo desmarca).
export default function SeletorAtuacao({ opcoes, dimensao, valor, onChange, multiplo = true, C, somenteLeitura = false }) {
  const selecionados = Array.isArray(valor) ? valor : [];
  if (!opcoes) return <div style={{ fontSize: 11, color: C.muted }}>Carregando opções…</div>;

  // pendentes (marca sugerida) só aparecem para quem já tem marcada
  const lista = (opcoes[dimensao] || []).filter((o) => o.aprovado || selecionados.includes(o.codigo));

  const alternar = (codigo) => {
    if (!multiplo) return onChange(selecionados[0] === codigo ? [] : [codigo]);
    if (dimensao === "uf") {
      if (codigo === "BR") return onChange(selecionados.includes("BR") ? [] : ["BR"]);
      const semBR = selecionados.filter((c) => c !== "BR");
      return onChange(semBR.includes(codigo) ? semBR.filter((c) => c !== codigo) : [...semBR, codigo]);
    }
    onChange(selecionados.includes(codigo) ? selecionados.filter((c) => c !== codigo) : [...selecionados, codigo]);
  };

  const chips = (itens) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {itens.map((o) => (
        <Chip key={o.codigo} C={C} ativo={selecionados.includes(o.codigo)} pendente={!o.aprovado}
          somenteLeitura={somenteLeitura} onClick={() => alternar(o.codigo)}>
          {o.nome}
        </Chip>
      ))}
    </div>
  );

  // marcas: agrupadas (Caminhão e ônibus, Guindaste, …)
  if (dimensao === "marca") {
    const grupos = [];
    for (const o of lista) {
      const g = o.grupo || "Outras";
      let grupo = grupos.find((x) => x.nome === g);
      if (!grupo) { grupo = { nome: g, itens: [] }; grupos.push(grupo); }
      grupo.itens.push(o);
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {grupos.map((g) => (
          <div key={g.nome}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{g.nome}</div>
            {chips(g.itens)}
          </div>
        ))}
      </div>
    );
  }

  return chips(lista);
}

// As 5 dimensões juntas. valores = { atuacao_segmentos: [...], ..., marca_sugerida: "" }
export function PainelAtuacao({ opcoes, valores, onChange, C, s, permitirSugestao = true }) {
  const v = valores || atuacaoVazia();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {DIMENSOES_ATUACAO.map((d) => (
        <div key={d.campo}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <label style={{ ...s.label, marginBottom: 0 }}>{d.titulo}</label>
            <span style={{ fontSize: 10, color: C.muted }}>{d.ajuda} · opcional</span>
          </div>
          <SeletorAtuacao
            opcoes={opcoes}
            dimensao={d.dimensao}
            valor={v[d.campo]}
            onChange={(novo) => onChange({ ...v, [d.campo]: novo })}
            C={C}
          />
          {d.dimensao === "marca" && permitirSugestao && (
            <div style={{ marginTop: 8, maxWidth: 320 }}>
              <input
                value={v.marca_sugerida || ""}
                onChange={(e) => onChange({ ...v, marca_sugerida: e.target.value })}
                placeholder="Outra marca? Digite aqui (ex.: Manitowoc)"
                maxLength={60}
                style={{ ...s.input, fontSize: 12 }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Texto curto para listas: "Hidráulica, Freios +2"
export function ResumoAtuacao({ opcoes, dimensao, codigos, max = 2 }) {
  const lista = Array.isArray(codigos) ? codigos : [];
  if (!lista.length) return "—";
  const nomes = lista.map((c) => nomeAtuacao(opcoes, dimensao, c));
  return nomes.slice(0, max).join(", ") + (nomes.length > max ? ` +${nomes.length - max}` : "");
}
