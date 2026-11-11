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
const DIA = 864e5;
const sem077 = (e) => /tenant_assinatura|preco_mensal|teste_aviso_em|does not exist|schema cache/i.test(String(e?.message || e));
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const data10 = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null);

/** campos de preço de um plano-modelo (validados) — usado por modulos.salvarPlano */
function precoDoPlano(body = {}) {
  const metrica = METRICAS.includes(body.metrica) ? body.metrica : 'empresa';
  return { preco_mensal: num(body.preco_mensal), preco_anual: num(body.preco_anual), moeda: MOEDAS.includes(body.moeda) ? body.moeda : 'BRL',
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
  return { migrou, assinatura: a, situacao: situacaoDerivada(t, a), teste_ate: t.teste_ate || null, dias_teste: dias, somente_leitura: testeAcabou(t), historico: hist.slice(0, 50) };
}

/** Console: salva a assinatura (e, opcional, um novo fim de teste). quem = admin da plataforma */
async function salvar(supabase, tenantId, body = {}, quem = null) {
  const atual = await daEmpresa(supabase, tenantId); if (atual.erro) return atual;
  if (!atual.migrou) return { status: 409, erro: 'Falta rodar a migration 077 no Supabase (assinaturas).' };
  const situacao = SITUACOES.includes(body.situacao) ? body.situacao : atual.situacao;
  let plano = null;
  if (body.plano_id) { plano = (await q(supabase.from('plataforma_planos').select('*').eq('id', body.plano_id)))[0] || null; if (!plano) return { status: 400, erro: 'Plano não encontrado' }; }
  const ciclo = body.ciclo === 'anual' ? 'anual' : 'mensal';
  const linha = { tenant_id: tenantId, plano_id: plano?.id ?? null, plano_nome: String(body.plano_nome || plano?.nome || '').trim().slice(0, 80) || null, situacao, ciclo,
    moeda: MOEDAS.includes(body.moeda) ? body.moeda : plano?.moeda || 'BRL',
    valor: num(body.valor) ?? (plano ? num(ciclo === 'anual' ? plano.preco_anual : plano.preco_mensal) : null), desconto_pct: num(body.desconto_pct),
    inicio: data10(body.inicio), proxima_renovacao: data10(body.proxima_renovacao), obs: String(body.obs || '').trim().slice(0, 500) || null, atualizado_em: new Date().toISOString() };
  if (linha.desconto_pct != null && (linha.desconto_pct < 0 || linha.desconto_pct > 100)) return { status: 400, erro: 'Desconto entre 0 e 100%' };
  if (situacao === 'ativa' && !linha.inicio) linha.inicio = new Date().toISOString().slice(0, 10);
  if (situacao === 'ativa' && !linha.proxima_renovacao) { const d = new Date(`${linha.inicio}T12:00:00Z`); if (ciclo === 'anual') d.setUTCFullYear(d.getUTCFullYear() + 1); else d.setUTCMonth(d.getUTCMonth() + 1); linha.proxima_renovacao = d.toISOString().slice(0, 10); }
  const a = atual.assinatura;
  const r = a ? await supabase.from('tenant_assinaturas').update(linha).eq('id', a.id).select() : await supabase.from('tenant_assinaturas').insert([linha]).select();
  if (r.error) throw new Error(r.error.message);
  // o tenant: ativa → sai do teste; volta para teste com nova data → estende
  const updT = {};
  if (situacao === 'ativa' && atual.situacao !== 'ativa') updT.plano = 'assinante';
  if (situacao === 'teste' && data10(body.teste_ate)) { updT.plano = 'teste'; updT.teste_ate = new Date(`${data10(body.teste_ate)}T23:59:59-03:00`).toISOString(); updT.teste_aviso_em = null; }
  if (Object.keys(updT).length) { const u = await supabase.from('tenants').update(updT).eq('id', tenantId); if (u.error && !/teste_aviso_em/.test(u.error.message)) throw new Error(u.error.message); }
  const campos = ['plano_nome', 'situacao', 'ciclo', 'moeda', 'valor', 'desconto_pct', 'inicio', 'proxima_renovacao'];
  const mudou = {}; for (const c of campos) { const de = a ? a[c] ?? null : c === 'situacao' ? atual.situacao : null; const para = linha[c] ?? null; if (String(de ?? '') !== String(para ?? '')) mudou[c] = { de, para }; }
  if (updT.teste_ate) mudou.teste_ate = { de: atual.teste_ate, para: updT.teste_ate };
  if (Object.keys(mudou).length) await supabase.from('tenant_assinatura_historico').insert([{ tenant_id: tenantId, evento: a ? 'alterada' : 'criada', detalhe: mudou, quem: quem || null }]);
  limparCache(tenantId);
  return daEmpresa(supabase, tenantId);
}

// ─── só leitura no fim do teste (middleware) ───────────────────────────────────
const cache = new Map(); // tenantId → { acabou, em }
const limparCache = (id) => cache.delete(String(id));
const LIVRE = /^\/api\/(auth|plataforma|notificacoes|notificacoes-fornecedor|fornecedor|usuarios\/me|configuracoes\/modulos)(\/|$)/;
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

module.exports = { SITUACOES, METRICAS, MOEDAS, precoDoPlano, testeAcabou, daEmpresa, salvar, somenteLeituraNoFimDoTeste, avisarFimDoTeste, limparCache, _definirEmail };
