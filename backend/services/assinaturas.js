// backend/services/assinaturas.js — etapa 18v: 💳 assinatura por empresa (Console da Plataforma) + fim do teste em "só leitura"
//
// • Preço nos planos-modelo (plataforma_planos): mensal/anual, moeda e métrica de cobrança — empresa (valor fixo),
//   usuário, equipamento ou uso (pay-per-use) — com preço por unidade e franquia incluída.
// • Assinatura (tenant_assinaturas): plano, situação, ciclo, valor negociado, desconto, início, próxima renovação.
//   Sem linha = situação derivada do tenant (plano 'teste' → 🧪 teste; senão ✅ ativa — empresas antigas).
//   Toda mudança vai para tenant_assinatura_historico (quem, quando, de → para).
// • Teste grátis: 14 dias (cadastroPublico). Terminou sem contratar → SÓ LEITURA (vê tudo, não cria/altera — 409 com
//   "Escolha um plano em ⭐ Meu plano"); dados guardados. Aviso 3 dias antes (🔔 + e-mail para o contato da empresa).
//   Ativar a assinatura no Console tira a empresa do teste (tenants.plano = 'assinante').
const SITUACOES = ['teste', 'ativa', 'inadimplente', 'suspensa', 'cancelada'];
const METRICAS = ['empresa', 'usuario', 'equipamento', 'uso'];
const MOEDAS = ['BRL', 'USD', 'EUR', 'DKK'];
// 18w: modalidade (como a Adobe) — mensal: cobra todo mês, sem fim · anual_mensal: compromisso 12 meses, cobra todo mês · anual_prepago: paga o ano
const MODALIDADES = { mensal: 'Mensal (sem fidelidade)', anual_mensal: 'Anual, pago por mês', anual_prepago: 'Anual pré-pago' };
const somar = (iso, meses) => { const d = new Date(`${iso}T12:00:00Z`); const dia = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + meses); const ult = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(dia, ult)); return d.toISOString().slice(0, 10); };
/** datas da modalidade a partir do início: próxima cobrança e fim do compromisso (mensal: sem fim) */
function datasDa(modalidade, inicio) {
  if (!inicio) return { proxima_cobranca: null, fim_compromisso: null };
  if (modalidade === 'anual_prepago') return { proxima_cobranca: somar(inicio, 12), fim_compromisso: somar(inicio, 12) };
  if (modalidade === 'anual_mensal') return { proxima_cobranca: somar(inicio, 1), fim_compromisso: somar(inicio, 12) };
  return { proxima_cobranca: somar(inicio, 1), fim_compromisso: null };
}
/** preço do plano na modalidade (valor por mês, ou por ano no pré-pago) */
const precoNa = (plano, modalidade) => (!plano ? null : modalidade === 'anual_prepago' ? plano.preco_anual : modalidade === 'anual_mensal' ? plano.preco_anual_mensal ?? plano.preco_mensal : plano.preco_mensal) ?? null;
const DIA = 864e5;
const sem077 = (e) => /tenant_assinatura|preco_mensal|teste_aviso_em|does not exist|schema cache/i.test(String(e?.message || e));
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const data10 = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null);

/** campos de preço de um plano-modelo (validados) — usado por modulos.salvarPlano */
function precoDoPlano(body = {}) {
  const metrica = METRICAS.includes(body.metrica) ? body.metrica : 'empresa';
  return { preco_mensal: num(body.preco_mensal), preco_anual: num(body.preco_anual), preco_anual_mensal: num(body.preco_anual_mensal), publico: body.publico !== false, moeda: MOEDAS.includes(body.moeda) ? body.moeda : 'BRL',
    metrica, preco_unidade: metrica === 'empresa' ? null : num(body.preco_unidade), franquia: metrica === 'empresa' || body.franquia === '' || body.franquia == null ? null : Math.max(0, parseInt(body.franquia, 10) || 0) };
}

const testeAcabou = (t, agora = Date.now()) => t?.plano === 'teste' && !!t.teste_ate && Date.parse(t.teste_ate) <= agora;
function situacaoDerivada(t, a) {
  if (a?.situacao) return a.situacao;
  return t?.plano === 'teste' ? 'teste' : 'ativa';
}

async function daEmpresa(supabase, tenantId) {
  const t = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0];
  if (!t) return { status: 404, erro: 'Empresa não encontrada' };
  let a = null; let hist = []; let migrou = true;
  try { a = (await q(supabase.from('tenant_assinaturas').select('*').eq('tenant_id', tenantId)))[0] || null; hist = await q(supabase.from('tenant_assinatura_historico').select('*').eq('tenant_id', tenantId)); }
  catch (e) { if (!sem077(e)) throw e; migrou = false; }
  hist.sort((x, y) => Date.parse(y.em) - Date.parse(x.em));
  const dias = t.plano === 'teste' && t.teste_ate ? Math.ceil((Date.parse(t.teste_ate) - Date.now()) / DIA) : null;
  let pedidos = []; try { pedidos = (await q(supabase.from('tenant_plano_pedidos').select('*').eq('tenant_id', tenantId))).sort((x, y) => Date.parse(y.criado_em) - Date.parse(x.criado_em)); } catch { /* sem a 078 */ }
  return { pedidos, modalidades: MODALIDADES, migrou, assinatura: a, situacao: situacaoDerivada(t, a), teste_ate: t.teste_ate || null, dias_teste: dias, somente_leitura: testeAcabou(t), historico: hist.slice(0, 50) };
}

/** Console: salva a assinatura (e, opcional, um novo fim de teste). quem = admin da plataforma */
async function salvar(supabase, tenantId, body = {}, quem = null) {
  const atual = await daEmpresa(supabase, tenantId); if (atual.erro) return atual;
  if (!atual.migrou) return { status: 409, erro: 'Falta rodar a migration 077 no Supabase (assinaturas).' };
  const situacao = SITUACOES.includes(body.situacao) ? body.situacao : atual.situacao;
  let plano = null;
  const a0 = atual.assinatura || {}; const tem = (k) => Object.prototype.hasOwnProperty.call(body, k); // 18w: o que não vier no corpo fica como está
  const planoId = tem('plano_id') ? body.plano_id : a0.plano_id;
  if (planoId) { plano = (await q(supabase.from('plataforma_planos').select('*').eq('id', planoId)))[0] || null; if (!plano && tem('plano_id')) return { status: 400, erro: 'Plano não encontrado' }; }
  const modalidade = MODALIDADES[body.modalidade] ? body.modalidade : body.ciclo === 'anual' ? 'anual_prepago' : atual.assinatura?.modalidade || 'mensal'; // 18w
  const ciclo = modalidade === 'anual_prepago' ? 'anual' : 'mensal';
  const linha = { tenant_id: tenantId, plano_id: plano?.id ?? null, plano_nome: String((tem('plano_nome') ? body.plano_nome : a0.plano_nome) || plano?.nome || '').trim().slice(0, 80) || null, situacao, ciclo,
    moeda: MOEDAS.includes(body.moeda) ? body.moeda : a0.moeda || plano?.moeda || 'BRL',
    modalidade, valor: tem('valor') && body.valor !== '' ? num(body.valor) : (!a0.id || String(planoId ?? '') !== String(a0.plano_id ?? '') || modalidade !== (a0.modalidade || 'mensal') ? num(precoNa(plano, modalidade)) ?? num(a0.valor) : num(a0.valor)), desconto_pct: tem('desconto_pct') ? num(body.desconto_pct) : num(a0.desconto_pct),
    inicio: tem('inicio') ? data10(body.inicio) : data10(a0.inicio), proxima_renovacao: data10(body.proxima_renovacao), obs: (tem('obs') ? String(body.obs || '').trim().slice(0, 500) : a0.obs) || null, atualizado_em: new Date().toISOString() };
  if (linha.desconto_pct != null && (linha.desconto_pct < 0 || linha.desconto_pct > 100)) return { status: 400, erro: 'Desconto entre 0 e 100%' };
  if (situacao === 'ativa' && !linha.inicio) linha.inicio = new Date().toISOString().slice(0, 10);
  // 18w: datas pela modalidade (se não vierem preenchidas); proxima_renovacao = fim do compromisso (ou próxima cobrança no mensal)
  const calc = datasDa(modalidade, linha.inicio);
  linha.proxima_cobranca = (tem('proxima_cobranca') ? data10(body.proxima_cobranca) : data10(a0.proxima_cobranca)) || calc.proxima_cobranca;
  linha.fim_compromisso = modalidade === 'mensal' ? null : (tem('fim_compromisso') ? data10(body.fim_compromisso) : data10(a0.fim_compromisso)) || calc.fim_compromisso;
  linha.proxima_renovacao = linha.fim_compromisso || linha.proxima_cobranca;
  const a = atual.assinatura;
  const gravar = (l) => (a ? supabase.from('tenant_assinaturas').update(l).eq('id', a.id).select() : supabase.from('tenant_assinaturas').insert([l]).select());
  let r = await gravar(linha);
  if (r.error && /modalidade|proxima_cobranca|fim_compromisso/.test(r.error.message)) { const { modalidade: _m, proxima_cobranca: _p, fim_compromisso: _f, ...sem } = linha; r = await gravar(sem); } // sem a 078
  if (r.error) throw new Error(r.error.message);
  // o tenant: ativa → sai do teste; volta para teste com nova data → estende
  const updT = {};
  if (situacao === 'ativa' && atual.situacao !== 'ativa') updT.plano = 'assinante';
  if (situacao === 'teste' && data10(body.teste_ate)) { updT.plano = 'teste'; updT.teste_ate = new Date(`${data10(body.teste_ate)}T23:59:59-03:00`).toISOString(); updT.teste_aviso_em = null; }
  if (Object.keys(updT).length) { const u = await supabase.from('tenants').update(updT).eq('id', tenantId); if (u.error && !/teste_aviso_em/.test(u.error.message)) throw new Error(u.error.message); }
  const campos = ['plano_nome', 'situacao', 'modalidade', 'moeda', 'valor', 'desconto_pct', 'inicio', 'proxima_cobranca', 'fim_compromisso'];
  const mudou = {}; for (const c of campos) { const de = a ? a[c] ?? null : c === 'situacao' ? atual.situacao : null; const para = linha[c] ?? null; if (String(de ?? '') !== String(para ?? '')) mudou[c] = { de, para }; }
  if (updT.teste_ate) mudou.teste_ate = { de: atual.teste_ate, para: updT.teste_ate };
  if (Object.keys(mudou).length) await supabase.from('tenant_assinatura_historico').insert([{ tenant_id: tenantId, evento: a ? 'alterada' : 'criada', detalhe: mudou, quem: quem || null }]);
  limparCache(tenantId);
  return daEmpresa(supabase, tenantId);
}

// ─── 18w: o cliente vê a assinatura e escolhe/troca de plano ─────────────────────
/** ⭐ Meu plano (admin e gestor): assinatura, planos públicos com preço, pedido pendente */
async function doCliente(supabase, tenantId) {
  const d = await daEmpresa(supabase, tenantId); if (d.erro) return d;
  const a = d.assinatura;
  let planos = []; try { planos = (await q(supabase.from('plataforma_planos').select('*'))).filter((p) => p.publico !== false && (p.preco_mensal != null || p.preco_anual != null || p.preco_anual_mensal != null || p.metrica === 'uso')); } catch { /* ok */ }
  const MOD = require('./modulos'); const nomes = new Map(MOD.MODULOS.map((m) => [m.id, m.nome]));
  planos = planos.sort((x, y) => (Number(x.preco_mensal) || 0) - (Number(y.preco_mensal) || 0)).map((p) => ({ id: p.id, nome: p.nome, descricao: p.descricao, moeda: p.moeda || 'BRL', metrica: p.metrica || 'empresa',
    preco_mensal: p.preco_mensal, preco_anual_mensal: p.preco_anual_mensal, preco_anual: p.preco_anual, preco_unidade: p.preco_unidade, franquia: p.franquia, modulos: MOD.resolver(p.modulos).map((id) => nomes.get(id) || id), atual: a?.plano_id != null && String(a.plano_id) === String(p.id) }));
  const pend = (d.pedidos || []).find((x) => x.status === 'pendente') || null;
  return { situacao: d.situacao, teste_ate: d.teste_ate, dias_teste: d.dias_teste, somente_leitura: d.somente_leitura, modalidades: MODALIDADES,
    assinatura: a ? { plano_nome: a.plano_nome, modalidade: a.modalidade || (a.ciclo === 'anual' ? 'anual_prepago' : 'mensal'), moeda: a.moeda, valor: a.valor, desconto_pct: a.desconto_pct,
      valor_liquido: a.valor != null ? Math.round(Number(a.valor) * (1 - (Number(a.desconto_pct) || 0) / 100) * 100) / 100 : null, inicio: a.inicio, proxima_cobranca: a.proxima_cobranca || a.proxima_renovacao, fim_compromisso: a.fim_compromisso || null } : null,
    planos, pedido_pendente: pend ? { id: pend.id, plano_nome: pend.plano_nome, modalidade: pend.modalidade, valor: pend.valor, moeda: pend.moeda, em: pend.criado_em, pedido_por: pend.pedido_por } : null };
}
let avisarPlataforma = async (assunto, html) => { const ps = String(process.env.PLATAFORMA_ADMINS || process.env.PLATAFORMA_CONTATO_EMAIL || '').split(/[,;\s]+/).filter((x) => /@/.test(x)); for (const p of ps) await require('./emailService').enviarEmailFornecedor(p, assunto, html).catch(() => {}); };
function _definirAvisoPlataforma(fn) { avisarPlataforma = fn; }
/** "Quero este" — pedido pendente (substitui o pendente anterior); a plataforma recebe e-mail e confirma no Console */
async function pedirPlano(supabase, tenantId, quem = {}, body = {}) {
  const plano = body.plano_id ? (await q(supabase.from('plataforma_planos').select('*').eq('id', body.plano_id)))[0] : null;
  const personalizado = !plano && body.personalizado === true;
  if (!plano && !personalizado) return { status: 400, erro: 'Escolha um plano' };
  if (plano && plano.publico === false) return { status: 400, erro: 'Plano indisponível' };
  const modalidade = MODALIDADES[body.modalidade] ? body.modalidade : 'mensal';
  const t = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  try {
    for (const x of (await q(supabase.from('tenant_plano_pedidos').select('*').eq('tenant_id', tenantId))).filter((x) => x.status === 'pendente')) await supabase.from('tenant_plano_pedidos').update({ status: 'cancelado', decidido_em: new Date().toISOString(), motivo: 'substituído por outro pedido' }).eq('id', x.id);
    const linha = { tenant_id: tenantId, plano_id: plano?.id ?? null, plano_nome: plano?.nome || 'Plano personalizado (fale conosco)', modalidade, valor: num(precoNa(plano, modalidade)), moeda: plano?.moeda || 'BRL',
      obs: String(body.obs || '').trim().slice(0, 500) || null, pedido_por: quem.nome || null, pedido_por_email: quem.email || null };
    const r = await supabase.from('tenant_plano_pedidos').insert([linha]).select(); if (r.error) throw new Error(r.error.message);
    const v = linha.valor != null ? `${linha.moeda} ${Number(linha.valor).toFixed(2)}${modalidade === 'anual_prepago' ? '/ano' : '/mês'}` : 'a combinar';
    await avisarPlataforma(`📝 Pedido de plano — ${t.nome || 'empresa'}: ${linha.plano_nome}`, `<p><b>${t.nome || 'Empresa'}</b> pediu o plano <b>${linha.plano_nome}</b> — ${MODALIDADES[modalidade]} · ${v}.</p><p>Pedido por: ${linha.pedido_por || '—'} (${linha.pedido_por_email || '—'})${linha.obs ? `<br>Obs.: ${linha.obs}` : ''}</p><p>Confirme no Console da Plataforma → 🚚 Transportadoras → 💳 Assinatura…</p>`);
    return { ok: true, pedido: r.data[0] };
  } catch (e) { if (sem077(e) || /tenant_plano_pedidos/.test(e.message)) return { status: 409, erro: 'Falta rodar a migration 078 no Supabase.' }; throw e; }
}
/** Console: confirma (ativa a assinatura no plano/modalidade e liga os módulos do plano) ou recusa */
async function decidirPedido(supabase, tenantId, pedidoId, { confirmar, motivo = null } = {}, quem = null) {
  const p = (await q(supabase.from('tenant_plano_pedidos').select('*').eq('id', pedidoId)))[0];
  if (!p || String(p.tenant_id) !== String(tenantId)) return { status: 404, erro: 'Pedido não encontrado' };
  if (p.status !== 'pendente') return { status: 409, erro: 'Este pedido já foi decidido' };
  if (confirmar) {
    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    const r = await salvar(supabase, tenantId, { situacao: 'ativa', plano_id: p.plano_id, plano_nome: p.plano_nome, modalidade: p.modalidade, moeda: p.moeda, valor: p.valor, inicio: hoje }, quem);
    if (r.erro) return r;
    if (p.plano_id) { const pl = (await q(supabase.from('plataforma_planos').select('*').eq('id', p.plano_id)))[0]; if (pl?.modulos?.length) await require('./modulos').definirDaEmpresa(supabase, tenantId, { modulos: pl.modulos, plano_nome: pl.nome }); }
  }
  await supabase.from('tenant_plano_pedidos').update({ status: confirmar ? 'confirmado' : 'recusado', decidido_em: new Date().toISOString(), decidido_por: quem, motivo: motivo ? String(motivo).slice(0, 300) : null }).eq('id', p.id);
  if (p.pedido_por_email) await enviarEmail(p.pedido_por_email, confirmar ? `✅ Plano ${p.plano_nome} confirmado` : `Pedido do plano ${p.plano_nome}`, confirmar
    ? `<p>Olá${p.pedido_por ? `, ${p.pedido_por}` : ''}!</p><p>O plano <b>${p.plano_nome}</b> (${MODALIDADES[p.modalidade] || p.modalidade}) está ativo. Os módulos do plano já aparecem no menu em alguns minutos — veja em ⭐ Meu plano.</p>`
    : `<p>Olá${p.pedido_por ? `, ${p.pedido_por}` : ''}!</p><p>Sobre o pedido do plano <b>${p.plano_nome}</b>: ${motivo || 'vamos falar com você para acertar os detalhes.'}</p>`).catch(() => {});
  return daEmpresa(supabase, tenantId);
}
/** Console: pedidos pendentes de todas as empresas (selo na lista) */
async function pendentes(supabase) { try { return { pedidos: (await q(supabase.from('tenant_plano_pedidos').select('*').eq('status', 'pendente'))) }; } catch { return { pedidos: [] }; } }

// ─── só leitura no fim do teste (middleware) ───────────────────────────────────
const cache = new Map(); // tenantId → { acabou, em }
const limparCache = (id) => cache.delete(String(id));
const LIVRE = /^\/api\/(auth|plataforma|notificacoes|notificacoes-fornecedor|fornecedor|usuarios\/me|configuracoes\/modulos|configuracoes\/assinatura)(\/|$)/; // 18w: com o teste vencido dá para pedir o plano
function somenteLeituraNoFimDoTeste(supabaseFn) {
  return async (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const url = String(req.originalUrl || '').split('?')[0]; if (LIVRE.test(url)) return next();
    const h = req.headers.authorization; if (!h || !h.startsWith('Bearer ')) return next(); // links públicos seguem como estão
    let tid; try { tid = require('jsonwebtoken').verify(h.slice(7), process.env.JWT_SECRET)?.tenant_id; } catch { return next(); } // o próprio middleware da rota responde
    if (tid == null) return next();
    let c = cache.get(String(tid));
    if (!c || Date.now() - c.em > 30000) {
      try { const t = (await q(supabaseFn().from('tenants').select('*').eq('id', tid)))[0]; c = { acabou: testeAcabou(t), em: Date.now() }; } catch { c = { acabou: false, em: Date.now() }; }
      cache.set(String(tid), c);
    }
    if (c.acabou) return res.status(409).json({ erro: 'Seu teste grátis terminou — o sistema está só para consulta. Escolha um plano em ⭐ Meu plano.', somente_leitura: true });
    return next();
  };
}

// ─── aviso "faltam 3 dias" (cron diário) ──────────────────────────────────────
let enviarEmail = async (para, assunto, html) => require('./emailService').enviarEmailFornecedor(para, assunto, html);
function _definirEmail(fn) { enviarEmail = fn; }
async function avisarFimDoTeste(supabase, agora = Date.now()) {
  let ts; try { ts = (await q(supabase.from('tenants').select('*').eq('plano', 'teste'))).filter((t) => t.teste_ate && !t.teste_aviso_em); } catch (e) { if (sem077(e)) return { avisados: 0 }; throw e; }
  const res = { avisados: 0 };
  for (const t of ts) {
    const dias = Math.ceil((Date.parse(t.teste_ate) - agora) / DIA); if (dias > 3 || dias < 0) continue;
    const ate = new Date(t.teste_ate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const N = require('./notificacoes');
    await N.avisarPerfis(supabase, t.id, ['gestor'], { tipo: 'teste_acabando', chave: 'teste:fim', titulo: `🎁 Seu teste grátis termina em ${dias <= 1 ? '1 dia' : `${dias} dias`} (${ate})`, texto: 'Depois disso o sistema fica só para consulta. Escolha um plano em ⭐ Meu plano.', link: { tela: 'meu_plano' } }).catch(() => {});
    // contato da empresa (quem contratou) — é aviso do contrato, não de rotina
    const para = t.email_admin || t.email; if (para) await enviarEmail(para, `🎁 Seu teste grátis do QuotaFlow termina em ${ate}`, `<p>Olá!</p><p>O teste grátis da <b>${t.nome || 'sua empresa'}</b> termina em <b>${ate}</b>.</p><p>Depois disso o sistema continua aberto <b>só para consulta</b> — seus dados ficam guardados. Para seguir usando normalmente, escolha um plano em ⭐ Meu plano ou responda este e-mail.</p>`).catch((e) => console.error('⚠️ [assinaturas] e-mail do teste:', e.message));
    await supabase.from('tenants').update({ teste_aviso_em: new Date(agora).toISOString() }).eq('id', t.id); res.avisados++;
  }
  return res;
}

module.exports = { MODALIDADES, datasDa, precoNa, doCliente, pedirPlano, decidirPedido, pendentes, _definirAvisoPlataforma, SITUACOES, METRICAS, MOEDAS, precoDoPlano, testeAcabou, daEmpresa, salvar, somenteLeituraNoFimDoTeste, avisarFimDoTeste, limparCache, _definirEmail };
