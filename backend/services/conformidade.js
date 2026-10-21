// backend/services/conformidade.js — etapa 12d.2 · regra revista na 12d.3.1
//
// Selo de conformidade do colaborador — mostra ao gestor, de relance, o quão longe a pessoa está de ficar compliant.
// Regra (decidida com o Marcony em 19–20/10/2026):
//   • A FUNÇÃO é pré-requisito, não ponto: sem função ligada não dá para saber o que exigir → nivel 'sem_funcao'
//     (⚪ "Defina a função", sem %).
//   • Geral = ITENS em dia ÷ ITENS exigidos (cada documento, cada EPI do kit e, na 12e, cada treinamento vale 1).
//     Ex.: 1 documento em dia de 4 + 0 de 6 EPIs = 1/10 = 10% · "faltam 9".
//     (A 12d.2 fazia média por pilar — 42% no mesmo exemplo: generoso demais.)
//   • Os pilares continuam separados (📄 1/4 · 🦺 0/6) para mostrar ONDE está a falta.
//   • 🟢 conforme = 100% · 🟡 em_andamento = falta registrar, NADA vencido (oportunidade/observação — o documento
//     pode existir fora do sistema; não é não conformidade) · 🔴 atencao = algo VENCIDO (não conformidade).
//   • Função sem nenhuma exigência (sem documentos e sem kit): 🟢 100% "nada exigido".
//   • 12e.1: pilar 🎓 Treinamentos — em dia (ok + vence) ÷ exigidos; vencido conta como vencido; agendado ainda é falta.
//   • 12e.3: pilar 🧩 Competências — escolaridade, CNH e a lista atende/não atende da função. ok ÷ exigidos;
//     pendente / não atende / reavaliar = falta (🟡), NUNCA vencido (decidido 21/10).

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

/**
 * @param {object} p
 * @param {boolean} p.funcaoLigada
 * @param {object}  p.docs  resumo da ficha de documentos { total, falta, vencido, vence_30, ok, sem_vencimento }
 * @param {object}  p.epi   resumo de EPI { total, ok, vence, vencido, nao_entregue } (null se ainda não há EPI)
 */
function selo({ funcaoLigada, docs, epi, trein, comp }) {
  if (!funcaoLigada) return { nivel: 'sem_funcao', geral: null, feitos: 0, total: 0, faltam: null, vencidos: 0, pilares: [] };
  const pilares = [];
  if (docs && docs.total > 0) {
    const emDia = docs.total - (docs.falta || 0) - (docs.vencido || 0);
    pilares.push({ pilar: 'documentos', pct: pct(emDia, docs.total), vencidos: docs.vencido || 0, feitos: emDia, total: docs.total });
  }
  if (epi && epi.total > 0) {
    const emDia = (epi.ok || 0) + (epi.vence || 0);
    pilares.push({ pilar: 'epi', pct: pct(emDia, epi.total), vencidos: epi.vencido || 0, feitos: emDia, total: epi.total });
  }
  if (trein && trein.total > 0) {
    const emDia = (trein.ok || 0) + (trein.vence || 0);
    pilares.push({ pilar: 'treinamentos', pct: pct(emDia, trein.total), vencidos: trein.vencido || 0, feitos: emDia, total: trein.total });
  }
  if (comp && comp.total > 0) {
    pilares.push({ pilar: 'competencias', pct: pct(comp.ok || 0, comp.total), vencidos: 0, feitos: comp.ok || 0, total: comp.total });
  }
  const feitos = pilares.reduce((s, p) => s + p.feitos, 0);
  const total = pilares.reduce((s, p) => s + p.total, 0);
  const vencidos = pilares.reduce((s, p) => s + p.vencidos, 0);
  const geral = total ? Math.floor((feitos / total) * 100) : 100; // floor: 99,9% não aparece como 100%
  const nivel = vencidos > 0 ? 'atencao' : feitos >= total ? 'conforme' : 'em_andamento';
  return { nivel, geral, feitos, total, faltam: total - feitos, vencidos, pilares };
}

module.exports = { selo };
