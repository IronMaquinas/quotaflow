// backend/services/conformidade.js — etapa 12d.2
//
// Selo de conformidade do colaborador (regra decidida com o Marcony em 19/10/2026):
//   • Cada pilar tem a sua %: 👔 Função (ligada a um modelo) · 📄 Documentos (em dia ÷ exigidos) ·
//     🦺 EPIs (em uso e em dia ÷ itens do kit) · 🎓 Treinamentos (12e — entra quando existir).
//   • Geral = média dos pilares que se aplicam (pilar sem exigência não entra).
//   • 🟢 conforme = 100% · 🟡 em_andamento = falta registrar algo, NADA vencido (oportunidade/observação,
//     não é não conformidade — o documento pode existir fora do sistema) · 🔴 atencao = algo VENCIDO
//     (evidência objetiva de não conformidade).

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

/**
 * @param {object} p
 * @param {boolean} p.funcaoLigada
 * @param {object}  p.docs  resumo da ficha de documentos { total, falta, vencido, vence_30, ok, sem_vencimento }
 * @param {object}  p.epi   resumo de EPI { total, ok, vence, vencido, nao_entregue } (ou null se ainda não há EPI)
 */
function selo({ funcaoLigada, docs, epi }) {
  const pilares = [];
  pilares.push({ pilar: 'funcao', pct: funcaoLigada ? 100 : 0, vencidos: 0, feitos: funcaoLigada ? 1 : 0, total: 1 });
  if (docs && docs.total > 0) {
    const emDia = docs.total - (docs.falta || 0) - (docs.vencido || 0);
    pilares.push({ pilar: 'documentos', pct: pct(emDia, docs.total), vencidos: docs.vencido || 0, feitos: emDia, total: docs.total });
  }
  if (epi && epi.total > 0) {
    const emDia = (epi.ok || 0) + (epi.vence || 0);
    pilares.push({ pilar: 'epi', pct: pct(emDia, epi.total), vencidos: epi.vencido || 0, feitos: emDia, total: epi.total });
  }
  const geral = Math.round(pilares.reduce((s, p) => s + p.pct, 0) / pilares.length);
  const vencidos = pilares.reduce((s, p) => s + p.vencidos, 0);
  const nivel = vencidos > 0 ? 'atencao' : geral >= 100 ? 'conforme' : 'em_andamento';
  return { nivel, geral, vencidos, pilares };
}

module.exports = { selo };
