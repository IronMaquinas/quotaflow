// services/feriasRegras/BR.js — etapa B1.6: regras de férias do 🇧🇷 Brasil (CLT, arts. 129 a 145)
//   Mesmo formato para todo país (ver index.js). Números aqui; a lógica fica em services/ferias.js.
module.exports = {
  pais: 'BR',
  nome: 'Brasil (CLT)',
  periodoAquisitivoMeses: 12,      // art. 130: a cada 12 meses de trabalho
  periodoConcessivoMeses: 12,      // art. 134: gozar nos 12 meses seguintes; depois → pagamento em dobro (art. 137)
  diasDireito: 30,
  /** art. 130: dias de direito conforme as faltas INJUSTIFICADAS do período aquisitivo */
  diasPorFaltas(faltas) {
    if (faltas <= 5) return 30; if (faltas <= 14) return 24; if (faltas <= 23) return 18; if (faltas <= 32) return 12; return 0;
  },
  faixasFaltas: [[5, 30], [14, 24], [23, 18], [32, 12], [Infinity, 0]],
  maxDiasPorPeriodo: 30,
  fracionamento: { maxPeriodos: 3, minUmPeriodo: 14, minDemais: 5 },   // art. 134 §1º (Reforma 2017)
  abonoMaxFracao: 1 / 3,           // art. 143: vender até 1/3
  avisoPrevioDias: 30,             // art. 135: comunicar com 30 dias
  inicioVedadoAntesDeDescanso: 2,  // art. 134 §3º: não começar nos 2 dias antes de feriado ou do repouso semanal
  diasDescanso: [0],               // domingo = repouso semanal (0=dom … 6=sáb)
  alertas: { vencendoDias: 90, criticoDias: 30 },
  textoVencido: 'período concessivo vencido — a CLT manda pagar em dobro (art. 137)',
  /** feriados nacionais do ano (YYYY-MM-DD) — os locais vêm do cadastro de feriados da empresa */
  feriadosNacionais(ano) {
    const f = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].map((d) => `${ano}-${d}`);
    // Sexta-feira Santa (Páscoa − 2), algoritmo de Meeus
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, g = Math.floor((8 * b + 13) / 25), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    const pascoa = new Date(Date.UTC(ano, mes - 1, dia)); pascoa.setUTCDate(pascoa.getUTCDate() - 2);
    f.push(pascoa.toISOString().slice(0, 10));
    return f;
  },
};
