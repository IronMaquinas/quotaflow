// backend/services/cobrancaLocacao.js — etapa 18zf: 📏 COBRANÇA HÍBRIDA por equipamento do contrato de locação
//   (decidido com o Marcony, 14/11: a cliente do MVP cobra por mês/dia; o modelo atende também quem cobra por hora)
//   Por equipamento (equipamento_locacoes — reaproveita as colunas da 18d: medicao_unidade · medicao_valor · medicao_qtd):
//     mensal (unidade nula/'fixo') — valor_mensal × dias no ciclo ÷ dias do ciclo; se o contrato tem FRANQUIA de horas e
//                                    HORA EXCEDENTE (condições do documento, sem N/A): + horas acima da franquia (proporcional) × hora excedente
//     diária ('dia')               — medicao_valor (R$/dia) × dias corridos locados no ciclo (paradas aparecem na medição p/ decidir)
//     por hora ('hora')            — medicao_valor (R$/h) × horas do horímetro no ciclo, com mínimo de medicao_qtd h/mês (proporcional)
//   Horas: leituras de horímetro das inspeções do equipamento (início = última leitura até o 1º dia do período, ou a 1ª dentro dele;
//   fim = última dentro do período). Sem leitura suficiente → o item fica SEM VALOR até alguém informar as horas (decidido: bloquear).
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const r1 = (n) => Math.round(Number(n) * 10) / 10;
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
const nf = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const diaBR = (iso) => String(iso || '').slice(0, 10);

const modoDe = (l) => (l?.medicao_unidade === 'dia' ? 'dia' : l?.medicao_unidade === 'hora' ? 'hora' : 'mensal');
const ROT = { mensal: 'mensal', dia: 'diária', hora: 'por hora' };

/** franquia do contrato (condições do documento) — { horas, excedente } ou null */
function franquiaDo(c) {
  const k = c?.condicoes || {}; const na = new Set(k.na || []);
  const h = Number(String(k.franquia_horas ?? '').replace(',', '.')); const x = Number(String(k.hora_excedente ?? '').replace(',', '.'));
  if (na.has('franquia_horas') || na.has('hora_excedente') || !(h > 0) || !(x > 0)) return null;
  return { horas: h, excedente: x };
}

/** horas do horímetro no período [de, ate] a partir das inspeções do equipamento */
function horasDoPeriodo(inspecoes, de, ate) {
  const ls = (inspecoes || []).filter((i) => i.horimetro != null && Number.isFinite(Number(i.horimetro)) && i.concluida_em)
    .map((i) => ({ dia: diaBR(i.concluida_em), em: String(i.concluida_em), h: Number(i.horimetro) })).sort((a, b) => a.em.localeCompare(b.em));
  const antes = ls.filter((x) => x.dia <= de); const dentro = ls.filter((x) => x.dia >= de && x.dia <= ate);
  const ini = antes.length ? antes[antes.length - 1] : dentro[0]; const fim = dentro.length ? dentro[dentro.length - 1] : null;
  if (!ini || !fim || ini === fim || fim.em <= ini.em) return null;
  return { de: ini.h, ate: fim.h, horas: r1(Math.max(0, fim.h - ini.h)) };
}

/** item da medição: { valor_recomendado, base, precisa_horas, horas_usadas } — p = { modo, valor_mensal, valor_unit, minimo_h, franquia, dias, dias_ciclo, horas } */
function calcular(p) {
  const prop = p.dias >= p.dias_ciclo ? 1 : p.dias / p.dias_ciclo;
  if (p.modo === 'dia') {
    if (!(Number(p.valor_unit) > 0)) return { valor_recomendado: null, base: 'sem valor da diária no contrato' };
    return { valor_recomendado: r2(p.dias * p.valor_unit), base: `${p.dias} dia(s) × ${brl(p.valor_unit)}/dia` };
  }
  if (p.modo === 'hora') {
    if (!(Number(p.valor_unit) > 0)) return { valor_recomendado: null, base: 'sem valor da hora no contrato' };
    if (p.horas == null) return { valor_recomendado: null, base: 'sem leitura de horímetro — informe as horas', precisa_horas: true };
    const min = Number(p.minimo_h) > 0 ? r1(p.minimo_h * prop) : 0; const cob = Math.max(p.horas, min);
    return { valor_recomendado: r2(cob * p.valor_unit), precisa_horas: true, horas_usadas: p.horas,
      base: `${nf(p.horas)} h × ${brl(p.valor_unit)}/h${min > 0 ? (cob > p.horas ? ` → mínimo ${nf(min)} h` : ` (mínimo ${nf(min)} h)`) : ''}` };
  }
  // mensal
  if (p.valor_mensal == null) return { valor_recomendado: null, base: 'sem valor mensal no contrato' };
  const mes = prop >= 1 ? r2(p.valor_mensal) : r2(p.valor_mensal * prop);
  const baseMes = prop >= 1 ? `${brl(p.valor_mensal)}/mês` : `${brl(p.valor_mensal)}/mês × ${p.dias}/${p.dias_ciclo} dias`;
  if (!p.franquia) return { valor_recomendado: mes, base: baseMes };
  if (p.horas == null) return { valor_recomendado: null, base: `${baseMes} · franquia ${nf(p.franquia.horas)} h: sem leitura de horímetro — informe as horas`, precisa_horas: true };
  const fr = r1(p.franquia.horas * prop); const exc = r1(Math.max(0, p.horas - fr));
  return { valor_recomendado: r2(mes + exc * p.franquia.excedente), precisa_horas: true, horas_usadas: p.horas,
    base: `${baseMes} · ${nf(p.horas)} h de ${nf(fr)} h de franquia${exc > 0 ? ` → ${nf(exc)} h excedente × ${brl(p.franquia.excedente)}` : ''}` };
}

/** texto do valor no documento do contrato / na tabela */
function rotuloValor(l) {
  const m = modoDe(l);
  if (m === 'dia') return l.medicao_valor != null ? `${brl(l.medicao_valor)}/dia` : null;
  if (m === 'hora') return l.medicao_valor != null ? `${brl(l.medicao_valor)}/hora${Number(l.medicao_qtd) > 0 ? ` (mín. ${nf(l.medicao_qtd)} h/mês)` : ''}` : null;
  return l.valor_mensal != null ? `${brl(l.valor_mensal)}/mês` : null;
}

module.exports = { modoDe, ROT, franquiaDo, horasDoPeriodo, calcular, rotuloValor };
