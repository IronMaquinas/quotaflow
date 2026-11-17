// services/ia/conferir.js — etapa SC3: 🛡 CONFERÊNCIA ANTI-ALUCINAÇÃO (por regra, sem outra IA)
//   Depois que a IA escreve, todo NÚMERO e todo CÓDIGO do texto (R$ 48.231, 92%, 3 tarefas, AT-0231, SIN-2026-0003…)
//   precisa existir nos dados que foram entregues a ela. Aceita arredondamento, diferença entre dois números dos dados
//   (ex.: "caiu 5 pontos"), datas/horas (17/11, 06:00, "dia 17") e anos. O que sobrar é "suspeito".
//   gerarConferido(): gera; se houver suspeito, pede UMA reescrita apontando o problema; se persistir, devolve com os suspeitos marcados.

const CODIGO = /\b[A-Z]{2,5}(?:-[A-Z]{2,4})?-\d{2,4}(?:-\d{2,6})?\b/g;
const NUMERO = /(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})+(?:,\d+)?%?|(?:R\$\s*)?-?\d+(?:[.,]\d+)?%?/g;

const paraNum = (t) => { let x = String(t).replace(/R\$\s*/, '').replace('%', '').trim(); if (/\d\.\d{3}(\D|$)/.test(x) && !/,/.test(x) && x.split('.').length > 1 && x.split('.').slice(1).every((g) => g.length === 3)) x = x.replace(/\./g, ''); else x = x.replace(/\./g, '').replace(',', '.'); const n = Number(x); return Number.isFinite(n) ? n : null; };

// datas/horas dos dados (2026-11-17, 17/11, 06:00) não viram "números" que validam o texto
function numerosDosDados(dados) {
  const out = new Set(); const txt = typeof dados === 'string' ? dados : JSON.stringify(dados);
  const vistos = (v) => { if (v == null || !Number.isFinite(v)) return; out.add(v); out.add(Math.round(v)); out.add(Math.round(v * 10) / 10); out.add(Math.abs(v)); };
  (function walk(o) { if (o == null) return; if (typeof o === 'number') vistos(o); else if (typeof o === 'string') { for (const m of o.replace(/\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?/g, ' ').replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ').replace(/\b\d{1,2}:\d{2}\b/g, ' ').match(NUMERO) || []) vistos(paraNum(m)); } else if (Array.isArray(o)) o.forEach(walk); else if (typeof o === 'object') Object.values(o).forEach(walk); })(typeof dados === 'string' ? txt : dados);
  return { lista: [...out], txt };
}

function conferirNumeros(texto, dados) {
  const { lista, txt } = numerosDosDados(dados); const suspeitos = [];
  const base = lista.slice(0, 400);
  const casa = (n, ctx = '') => base.some((v) => Math.abs(v - n) <= Math.max(0.51, Math.abs(v) * 0.005))
    || (/^\s*%?\s*(pontos?|p\.?p\.?|a mais|a menos|abaixo|acima|de diferença)/i.test(ctx) && base.some((a, i) => base.slice(i + 1).some((b) => Math.abs(Math.abs(a - b) - n) <= 0.51))) // diferença só quando o texto diz que é diferença
    || (Number.isInteger(n) && (n === 0 || (n >= 2000 && n <= 2100)));
  const semCod = String(texto || '').replace(CODIGO, (c) => { if (!txt.includes(c)) suspeitos.push(c); return ' '; })
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ').replace(/\b\d{1,2}(?::|h)\d{2}\b/g, ' ').replace(/\bdia\s+\d{1,2}\b/gi, ' '); // datas, horas e "dia N" não são dado
  for (const m of semCod.matchAll(NUMERO)) { const n = paraNum(m[0]); if (n == null) continue; if (!casa(n, semCod.slice(m.index + m[0].length, m.index + m[0].length + 25))) suspeitos.push(m[0].trim()); }
  return { ok: suspeitos.length === 0, suspeitos: [...new Set(suspeitos)] };
}

/** gerar(extra) → { texto, ... } da IA; dados = o que foi entregue a ela */
async function gerarConferido(gerar, dados) {
  let r = await gerar(''); if (!r?.texto) return { ...r, conferido: null };
  let c = conferirNumeros(r.texto, dados); if (c.ok) return { ...r, conferido: true, suspeitos: [] };
  const r2 = await gerar(`\n\nATENÇÃO: na versão anterior você citou ${c.suspeitos.map((x) => `"${x}"`).join(', ')}, que NÃO existe(m) nos dados. Reescreva usando somente números e códigos que estão no JSON.`);
  if (r2?.texto) { const c2 = conferirNumeros(r2.texto, dados); if (c2.ok) return { ...r2, conferido: true, suspeitos: [], refeito: true }; r = r2; c = c2; }
  return { ...r, conferido: false, suspeitos: c.suspeitos };
}

module.exports = { conferirNumeros, gerarConferido, _paraNum: paraNum };
