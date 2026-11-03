// utils/lerXmlFiscal.js — etapa 18g.1.1: leitura do XML no navegador (prévia antes de salvar)
//   Ao escolher o XML, já mostra o que foi lido e preenche nº e chave. A leitura oficial (e a conferência das chaves) é no servidor.
const tag = (x, t) => { const m = String(x).match(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?${t}>`)); return m ? m[1].trim() : null; };
const bloco = (x, t) => { const m = String(x).match(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${t}>`)); return m ? m[1] : ""; };
const blocos = (x, t) => [...String(x).matchAll(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${t}>`, "g"))].map((m) => m[1]);
const idChave = (x, t) => { const m = String(x).match(new RegExp(`<(?:\\w+:)?${t}[^>]*\\sId="[A-Za-z]*(\\d{44})"`)); return m ? m[1] : null; };
const n = (v) => (v == null ? null : Number(v));
const brl = (v) => (v == null ? null : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);

export function lerXmlFiscal(item, xml) {
  const x = String(xml || "");
  if (item === "nfe") {
    const chave = idChave(x, "infNFe"); if (!chave) return { erro: "Este arquivo não é o XML de uma NF-e" };
    const numero = tag(bloco(x, "ide"), "nNF"); const peso = n(tag(bloco(x, "vol"), "pesoB"));
    return { chave, numero, resumo: [`NF-e nº ${numero || "—"}`, [tag(bloco(x, "emit"), "xNome"), tag(bloco(x, "dest"), "xNome")].filter(Boolean).join(" → "), brl(n(tag(bloco(x, "ICMSTot"), "vNF"))), peso != null ? `${peso.toLocaleString("pt-BR")} kg` : null].filter(Boolean).join(" · ") };
  }
  if (item === "cte") {
    const chave = idChave(x, "infCte"); if (!chave) return { erro: "Este arquivo não é o XML de um CT-e" };
    const numero = tag(bloco(x, "ide"), "nCT"); const nfes = blocos(x, "infNFe").map((b) => tag(b, "chave")).filter(Boolean).length;
    return { chave, numero, resumo: [`CT-e nº ${numero || "—"}`, [tag(bloco(x, "ide"), "xMunIni"), tag(bloco(x, "ide"), "xMunFim")].filter(Boolean).join(" → "), brl(n(tag(bloco(x, "vPrest"), "vTPrest"))) && `frete ${brl(n(tag(bloco(x, "vPrest"), "vTPrest")))}`, `${nfes} NF-e`].filter(Boolean).join(" · ") };
  }
  if (item === "mdfe") {
    const chave = idChave(x, "infMDFe"); if (!chave) return { erro: "Este arquivo não é o XML de um MDF-e" };
    const numero = tag(bloco(x, "ide"), "nMDF"); const tr = bloco(x, "veicTracao");
    const placas = [tag(tr, "placa"), ...blocos(x, "veicReboque").map((b) => tag(b, "placa"))].filter(Boolean);
    const aver = blocos(x, "seg").map((b) => tag(b, "nAver")).filter(Boolean);
    return { chave, numero, resumo: [`MDF-e nº ${numero || "—"}`, placas.length ? `🚛 ${placas.join(" + ")}` : null, tag(bloco(tr, "condutor"), "xNome") && `👤 ${tag(bloco(tr, "condutor"), "xNome")}`, aver.length ? `averbação ${aver.join(", ")}` : null].filter(Boolean).join(" · ") };
  }
  return { erro: "Sem leitura de XML para este documento" };
}
