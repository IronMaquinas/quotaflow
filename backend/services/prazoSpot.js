// backend/services/prazoSpot.js — etapa 18m: ⏳ prazo da demanda spot na rede (regra única)
// Aberta há PRAZO_SPOT_DIAS sem decisão sai do Spot dos fornecedores. Conta da renovação (renovada_em) ou da publicação.
const PRAZO_SPOT_DIAS = 30;
const DIA_MS = 24 * 60 * 60 * 1000;
function prazoDemanda(d, agora = Date.now()) {
  const base = new Date(d.renovada_em || d.criado_em || 0).getTime();
  const expiraEm = base + PRAZO_SPOT_DIAS * DIA_MS;
  return { expira_em: new Date(expiraEm).toISOString(), expirada_rede: d.status !== 'encerrada' && agora >= expiraEm, dias_para_expirar: Math.ceil((expiraEm - agora) / DIA_MS) };
}
const ativaNaRede = (d, agora = Date.now()) => d.status !== 'encerrada' && !prazoDemanda(d, agora).expirada_rede;
module.exports = { PRAZO_SPOT_DIAS, prazoDemanda, ativaNaRede };
