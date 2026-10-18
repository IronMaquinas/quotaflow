// backend/services/plataformaConsole.js
//
// Console da Plataforma (etapa 11b) — regras das telas do admin:
//   visaoGeral · pendentes · listarTransportadoras · listarFornecedores
//   aprovar / recusar / excluir  (transportadora e fornecedor)
//
// Toda ação grava em admin_acoes (auditoria) e avisa a empresa por e-mail.
// Exclusão é só para cadastro que ainda não entrou de verdade:
//   • transportadora criada pelo "Criar conta", pendente ou recusada, e sem
//     dados de operação (OS, cotação, demanda…);
//   • fornecedor candidato (autocadastro, nunca aprovado).

const { DB, supabase } = require('../db');
const { enviarEmailFornecedor } = require('./emailService');

const DIA = 24 * 3600 * 1000;
const esc = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const lerJson = (v) => {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
};
const urlPortal = () => String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');

// ─── Auditoria ──────────────────────────────────────────────────────────────
async function registrar(admin, acao, alvoTipo, alvoId, detalhes = null) {
  try {
    await DB.insert('admin_acoes', {
      admin_id: admin?.id || null,
      admin_email: admin?.email || 'desconhecido',
      acao,
      alvo_tipo: alvoTipo,
      alvo_id: alvoId != null ? String(alvoId) : null,
      detalhes,
    });
  } catch (err) {
    console.error('⚠️ admin_acoes não gravado:', err.message);
  }
}

// ─── Apoio: delete/update com filtro composto (o DB.delete só aceita id) ────
async function apagar(tabela, filtros) {
  let q = supabase.from(tabela).delete();
  for (const [k, v] of Object.entries(filtros)) q = q.eq(k, v);
  const { error } = await q;
  if (error) throw new Error(`${tabela}: ${error.message}`);
}
async function apagarSeExistir(tabela, filtros) {
  try { await apagar(tabela, filtros); } catch (err) {
    // tabela inexistente/opcional: segue
    if (!/does not exist|relation|schema cache/i.test(err.message)) throw err;
  }
}
async function atualizarOnde(tabela, valores, filtros) {
  let q = supabase.from(tabela).update(valores);
  for (const [k, v] of Object.entries(filtros)) q = q.eq(k, v);
  const { error } = await q;
  if (error) throw new Error(`${tabela}: ${error.message}`);
}

// ─── E-mails ────────────────────────────────────────────────────────────────
function moldura(titulo, corpo) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
    <div style="font-size:12px;color:#64748b;letter-spacing:.08em;">QUOTAFLOW</div>
    <h2 style="margin:6px 0 12px;font-size:20px;">${titulo}</h2>
    ${corpo}
  </div>`;
}
const botao = (link, rotulo) => link ? `
    <div style="text-align:center;margin:22px 0;">
      <a href="${esc(link)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:700;font-size:14px;display:inline-block;">${esc(rotulo)}</a>
    </div>` : '';
const p = (t) => `<p style="font-size:14px;color:#334155;line-height:1.6;">${t}</p>`;

async function enviar(para, assunto, html) {
  const lista = [...new Set((para || []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];
  for (const e of lista) {
    try { await enviarEmailFornecedor(e, assunto, html); } catch (err) { console.error('⚠️ e-mail do console não enviado:', err.message); }
  }
  return lista;
}

function emailTenantAprovado(tenant) {
  const dias = tenant.plano === 'teste' && tenant.teste_ate
    ? Math.max(0, Math.ceil((new Date(tenant.teste_ate).getTime() - Date.now()) / DIA)) : null;
  return {
    assunto: `${tenant.nome}: cadastro aprovado no QuotaFlow`,
    html: moldura('Cadastro aprovado ✅', `
      ${p(`O cadastro da <b>${esc(tenant.nome)}</b> foi aprovado pela nossa equipe.`)}
      ${p('O <b>Canal Spot</b> está liberado: publique demandas urgentes de peças e receba propostas de fornecedores verificados de todo o Brasil.')}
      ${dias != null ? p(`Seu teste grátis continua: ${dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`}.`) : ''}
      ${botao(urlPortal(), 'Publicar minha primeira demanda')}`),
  };
}

function emailTenantRecusado(tenant, motivo) {
  return {
    assunto: `${tenant.nome}: sobre o seu cadastro no QuotaFlow`,
    html: moldura('Seu cadastro não foi aprovado', `
      ${p(`Analisamos o cadastro da <b>${esc(tenant.nome)}</b> e, por enquanto, não foi possível aprovar o acesso ao Canal Spot.`)}
      ${motivo ? p(`<b>Motivo:</b> ${esc(motivo)}`) : ''}
      ${p('Se algum dado estiver errado ou se quiser conversar, responda este e-mail.')}`),
  };
}

function emailFornecedorAprovado(f) {
  return {
    assunto: `Parabéns! ${f.nome_fantasia || f.nome} agora é fornecedor verificado no QuotaFlow`,
    html: moldura('Sua empresa foi verificada 🏅', `
      ${p(`Parabéns! A <b>${esc(f.nome_fantasia || f.nome)}</b> agora é <b>fornecedora verificada</b> da rede QuotaFlow. A partir de agora ela:`)}
      <ul style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 14px;padding-left:20px;">
        <li>vê e responde as <b>demandas spot</b> de transportadoras de todo o Brasil;</li>
        <li>aparece para <b>todos os clientes</b> do QuotaFlow nas cotações;</li>
        <li>exibe o selo 🏅 de fornecedor verificado.</li>
      </ul>
      ${p('Dica: deixe a sua <b>atuação</b> (segmentos, sistemas, marcas e estados) completa em Meus Dados — é o que faz as demandas certas chegarem até você.')}
      ${botao(urlPortal(), 'Ver oportunidades')}`),
  };
}

function emailFornecedorRecusado(f, motivo) {
  return {
    assunto: `Sobre o cadastro de ${f.nome_fantasia || f.nome} no QuotaFlow`,
    html: moldura('Seu cadastro não foi aprovado', `
      ${p(`Analisamos o cadastro da <b>${esc(f.nome_fantasia || f.nome)}</b> e, por enquanto, não foi possível aprovar a entrada na rede de fornecedores verificados.`)}
      ${motivo ? p(`<b>Motivo:</b> ${esc(motivo)}`) : ''}
      ${p('Se algum dado estiver errado ou se quiser conversar, responda este e-mail.')}`),
  };
}

// ─── Leitura ────────────────────────────────────────────────────────────────
async function loginsDoTenant(tenantId) {
  const us = (await DB.select('usuarios', { tenant_id: tenantId })) || [];
  return us.map((u) => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, email_confirmado: u.email_confirmado_em !== null, criado_em: u.criado_em }));
}
async function loginsDoFornecedor(fornecedorId) {
  const us = (await DB.select('fornecedor_usuarios', { fornecedor_id: fornecedorId })) || [];
  return us.map((u) => ({ id: u.id, nome: u.nome, email: u.email, email_confirmado: u.email_confirmado_em !== null, criado_em: u.criado_em }));
}

function resumoTenant(t) {
  const emTeste = t.plano === 'teste' && t.teste_ate;
  return {
    id: t.id,
    nome: t.nome,
    cnpj: t.cnpj,
    regiao: t.regiao,
    telefone: t.telefone || null,
    email_admin: t.email_admin || null,
    plano: t.plano,
    teste_ate: t.teste_ate || null,
    dias_teste: emTeste ? Math.ceil((new Date(t.teste_ate).getTime() - Date.now()) / DIA) : null,
    aprovacao_status: t.aprovacao_status || 'aprovado',
    aprovacao_obs: t.aprovacao_obs || null,
    aprovado_em: t.aprovado_em || null,
    cadastro_origem: t.cadastro_origem || null,
    criado_em: t.criado_em || null,
    alertas: lerJson(t.alertas_cadastro) || [],
    receita: lerJson(t.dados_cnpj),
  };
}

function resumoFornecedor(f, tenantsPorId = {}) {
  return {
    id: f.id,
    tipo: f.tipo,
    nome: f.nome_fantasia || f.nome,
    razao_social: f.razao_social || null,
    cnpj: f.cnpj || null,
    cidade: f.cidade || null,
    estado: f.estado || null,
    email: f.email || null,
    telefone: f.telefone || null,
    whatsapp: f.whatsapp || null,
    plano: f.plano || 'gratuito',
    ativo: f.ativo !== 0 && f.ativo !== false,
    tenant: f.tenant_id ? (tenantsPorId[String(f.tenant_id)]?.nome || `#${f.tenant_id}`) : null,
    cadastro_origem: f.cadastro_origem || null,
    criado_em: f.criado_em || null,
    aprovado_em: f.aprovado_em || null,
    recusado_em: f.recusado_em || null,
    aprovacao_obs: f.aprovacao_obs || null,
    alertas: lerJson(f.alertas_cadastro) || [],
    receita: lerJson(f.dados_cnpj),
    atuacao: {
      segmentos: (f.atuacao_segmentos || []).length,
      sistemas: (f.atuacao_sistemas || []).length,
      marcas: (f.atuacao_marcas || []).length,
      ufs: f.atuacao_ufs || [],
    },
  };
}

async function visaoGeral() {
  const [tenants, fornecedores, demandas, acoes] = await Promise.all([
    DB.select('tenants', {}),
    DB.select('fornecedores', {}),
    DB.select('demandas_spot', { status: 'aberta' }),
    DB.select('admin_acoes', {}),
  ]);
  const agora = Date.now();
  const recente = (d) => d && agora - new Date(d).getTime() <= 7 * DIA;
  const ts = tenants || [];
  const fs = fornecedores || [];
  return {
    transportadoras: {
      total: ts.length,
      aprovadas: ts.filter((t) => (t.aprovacao_status || 'aprovado') === 'aprovado').length,
      pendentes: ts.filter((t) => t.aprovacao_status === 'pendente').length,
      recusadas: ts.filter((t) => t.aprovacao_status === 'recusado').length,
      em_teste: ts.filter((t) => t.plano === 'teste' && t.teste_ate && new Date(t.teste_ate).getTime() > agora).length,
      teste_vencido: ts.filter((t) => t.plano === 'teste' && t.teste_ate && new Date(t.teste_ate).getTime() <= agora).length,
      novas_7_dias: ts.filter((t) => recente(t.criado_em)).length,
    },
    fornecedores: {
      verificados: fs.filter((f) => f.tipo === 'global').length,
      locais: fs.filter((f) => f.tipo === 'local').length,
      pendentes: fs.filter((f) => f.tipo === 'candidato' && !f.recusado_em).length,
      recusados: fs.filter((f) => f.tipo === 'candidato' && f.recusado_em).length,
      pro: fs.filter((f) => f.tipo === 'global' && f.plano === 'pro').length,
      novos_7_dias: fs.filter((f) => recente(f.criado_em)).length,
    },
    spot: { demandas_abertas: (demandas || []).length },
    ultimas_acoes: (acoes || [])
      .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0))
      .slice(0, 10)
      .map((a) => ({ acao: a.acao, alvo_tipo: a.alvo_tipo, alvo_id: a.alvo_id, admin_email: a.admin_email, criado_em: a.criado_em, detalhes: a.detalhes })),
  };
}

async function pendentes() {
  const [tenants, fornecedores] = await Promise.all([DB.select('tenants', {}), DB.select('fornecedores', {})]);
  const porData = (a, b) => new Date(a.criado_em || 0) - new Date(b.criado_em || 0); // mais antigo primeiro (fila)

  const ts = (tenants || []).filter((t) => t.aprovacao_status === 'pendente' || t.aprovacao_status === 'recusado').sort(porData);
  const transportadoras = [];
  for (const t of ts) transportadoras.push({ ...resumoTenant(t), logins: await loginsDoTenant(t.id) });

  const todos = fornecedores || [];
  const fsCand = todos.filter((f) => f.tipo === 'candidato').sort(porData);
  const lista = [];
  for (const f of fsCand) {
    const cnpj = soDigitos(f.cnpj);
    lista.push({
      ...resumoFornecedor(f),
      logins: await loginsDoFornecedor(f.id),
      // mesmo CNPJ já cadastrado como local por algum tenant (junção na promoção — etapa 11c)
      locais_mesmo_cnpj: cnpj ? todos.filter((o) => o.tipo === 'local' && soDigitos(o.cnpj) === cnpj).length : 0,
      global_mesmo_cnpj: cnpj ? todos.some((o) => o.tipo === 'global' && soDigitos(o.cnpj) === cnpj) : false,
    });
  }
  return { transportadoras, fornecedores: lista };
}

async function listarTransportadoras() {
  const [tenants, usuarios] = await Promise.all([DB.select('tenants', {}), DB.select('usuarios', {})]);
  const qtd = {};
  for (const u of usuarios || []) qtd[String(u.tenant_id)] = (qtd[String(u.tenant_id)] || 0) + 1;
  return (tenants || [])
    .map((t) => ({ ...resumoTenant(t), receita: undefined, usuarios: qtd[String(t.id)] || 0 }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

async function listarFornecedores() {
  const [fornecedores, tenants, logins] = await Promise.all([
    DB.select('fornecedores', {}), DB.select('tenants', {}), DB.select('fornecedor_usuarios', {}),
  ]);
  const tPorId = Object.fromEntries((tenants || []).map((t) => [String(t.id), t]));
  const comLogin = new Set((logins || []).map((l) => String(l.fornecedor_id)));
  const ordemTipo = { candidato: 0, global: 1, local: 2 };
  return (fornecedores || [])
    .map((f) => ({ ...resumoFornecedor(f, tPorId), receita: undefined, portal: comLogin.has(String(f.id)) }))
    .sort((a, b) => (ordemTipo[a.tipo] ?? 9) - (ordemTipo[b.tipo] ?? 9) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

// ─── Ações: transportadora ──────────────────────────────────────────────────
async function aprovarTransportadora(id, admin) {
  const t = await DB.selectOne('tenants', { id });
  if (!t) return { status: 404, erro: 'Transportadora não encontrada' };
  if ((t.aprovacao_status || 'aprovado') === 'aprovado') return { status: 409, erro: 'Esta transportadora já está aprovada.' };
  await DB.update('tenants', t.id, { aprovacao_status: 'aprovado', aprovado_em: new Date().toISOString(), aprovacao_obs: null });
  const { assunto, html } = emailTenantAprovado(t);
  const logins = await loginsDoTenant(t.id);
  const para = await enviar([t.email_admin, ...logins.map((l) => l.email)], assunto, html);
  await registrar(admin, 'aprovar', 'tenant', t.id, { nome: t.nome, cnpj: t.cnpj, avisados: para });
  return { ok: true, avisados: para };
}

async function recusarTransportadora(id, motivo, admin) {
  const t = await DB.selectOne('tenants', { id });
  if (!t) return { status: 404, erro: 'Transportadora não encontrada' };
  const m = String(motivo || '').trim().slice(0, 500);
  if (!m) return { status: 400, erro: 'Informe o motivo da recusa (vai no e-mail para a empresa).' };
  await DB.update('tenants', t.id, { aprovacao_status: 'recusado', aprovacao_obs: m });
  const { assunto, html } = emailTenantRecusado(t, m);
  const logins = await loginsDoTenant(t.id);
  const para = await enviar([t.email_admin, ...logins.map((l) => l.email)], assunto, html);
  await registrar(admin, 'recusar', 'tenant', t.id, { nome: t.nome, cnpj: t.cnpj, motivo: m, avisados: para });
  return { ok: true, avisados: para };
}

// Tabelas de operação: se a transportadora já tem algo aqui, não se exclui
const TABELAS_OPERACAO = [
  'chamados', 'cotacoes', 'ordens_venda', 'demandas_spot', 'nao_conformidades',
  'equipamentos', 'itens_consumo', 'catalogo_itens', 'tarefas', 'movimentacoes_estoque',
];

async function excluirTransportadora(id, admin) {
  const t = await DB.selectOne('tenants', { id });
  if (!t) return { status: 404, erro: 'Transportadora não encontrada' };
  if ((t.aprovacao_status || 'aprovado') === 'aprovado' || t.cadastro_origem !== 'signup') {
    return { status: 409, erro: 'Só dá para excluir cadastro do "Criar conta" que ainda não foi aprovado. Para os demais, recuse.' };
  }
  for (const tabela of TABELAS_OPERACAO) {
    let linhas = [];
    try { linhas = (await DB.select(tabela, { tenant_id: t.id })) || []; } catch { linhas = []; }
    if (linhas.length) {
      return { status: 409, erro: `Esta transportadora já tem dados de operação (${tabela}). Recuse em vez de excluir.` };
    }
  }

  // fornecedores locais que ela cadastrou (e os convites)
  await apagarSeExistir('fornecedor_convites', { tenant_id: t.id });
  await apagarSeExistir('tenant_fornecedores', { tenant_id: t.id });
  const locais = (await DB.select('fornecedores', { tenant_id: t.id })) || [];
  for (const f of locais) {
    if (f.tipo === 'local') await excluirFornecedorDados(f.id);
  }

  const logins = await loginsDoTenant(t.id);
  for (const u of logins) {
    await apagarSeExistir('usuario_perfis', { usuario_id: u.id });
    await apagarSeExistir('email_confirmacoes', { tipo: 'usuario', login_id: String(u.id) });
    await apagarSeExistir('password_resets', { usuario_id: u.id });
  }
  await apagarSeExistir('password_resets', { tenant_id: t.id });
  await apagar('usuarios', { tenant_id: t.id });
  await apagar('tenants', { id: t.id });

  await registrar(admin, 'excluir', 'tenant', t.id, { nome: t.nome, cnpj: t.cnpj, logins: logins.map((l) => l.email) });
  return { ok: true };
}

// ─── Ações: fornecedor ──────────────────────────────────────────────────────
async function aprovarFornecedor(id, admin) {
  const f = await DB.selectOne('fornecedores', { id });
  if (!f) return { status: 404, erro: 'Fornecedor não encontrado' };
  if (f.tipo !== 'candidato') return { status: 409, erro: 'Só cadastros aguardando aprovação podem ser aprovados aqui.' };
  const cnpj = soDigitos(f.cnpj);
  if (cnpj) {
    const globais = (await DB.select('fornecedores', { tipo: 'global' })) || [];
    const dono = globais.find((g) => soDigitos(g.cnpj) === cnpj);
    if (dono) return { status: 409, erro: `Já existe fornecedor verificado com este CNPJ (${dono.nome_fantasia || dono.nome}). Exclua este cadastro duplicado.` };
  }
  await DB.update('fornecedores', f.id, { tipo: 'global', aprovado_em: new Date().toISOString(), recusado_em: null, aprovacao_obs: null });
  const { assunto, html } = emailFornecedorAprovado(f);
  const logins = await loginsDoFornecedor(f.id);
  const para = await enviar([f.email, ...logins.map((l) => l.email)], assunto, html);
  await registrar(admin, 'aprovar', 'fornecedor', f.id, { nome: f.nome_fantasia || f.nome, cnpj: f.cnpj, avisados: para });
  return { ok: true, avisados: para };
}

async function recusarFornecedor(id, motivo, admin) {
  const f = await DB.selectOne('fornecedores', { id });
  if (!f) return { status: 404, erro: 'Fornecedor não encontrado' };
  if (f.tipo !== 'candidato') return { status: 409, erro: 'Só cadastros aguardando aprovação podem ser recusados aqui.' };
  const m = String(motivo || '').trim().slice(0, 500);
  if (!m) return { status: 400, erro: 'Informe o motivo da recusa (vai no e-mail para a empresa).' };
  await DB.update('fornecedores', f.id, { recusado_em: new Date().toISOString(), aprovacao_obs: m });
  const { assunto, html } = emailFornecedorRecusado(f, m);
  const logins = await loginsDoFornecedor(f.id);
  const para = await enviar([f.email, ...logins.map((l) => l.email)], assunto, html);
  await registrar(admin, 'recusar', 'fornecedor', f.id, { nome: f.nome_fantasia || f.nome, cnpj: f.cnpj, motivo: m, avisados: para });
  return { ok: true, avisados: para };
}

// Remove o fornecedor e tudo que é só dele (logins, confirmações, convites…).
// Interesses/visualizações do Spot saem pela chave estrangeira (migration 018).
async function excluirFornecedorDados(fornecedorId) {
  const logins = (await DB.select('fornecedor_usuarios', { fornecedor_id: fornecedorId })) || [];
  for (const u of logins) {
    await apagarSeExistir('email_confirmacoes', { tipo: 'fornecedor_usuario', login_id: String(u.id) });
    await apagarSeExistir('password_resets', { fornecedor_usuario_id: u.id });
  }
  await apagarSeExistir('fornecedor_usuarios', { fornecedor_id: fornecedorId });
  try { await atualizarOnde('atuacao_opcoes', { sugerido_por_fornecedor_id: null }, { sugerido_por_fornecedor_id: fornecedorId }); } catch { /* opcional */ }
  await apagarSeExistir('recomendacoes_enviadas', { fornecedor_id: fornecedorId });
  await apagarSeExistir('recomendacoes_email_log', { fornecedor_id: fornecedorId });
  await apagarSeExistir('tenant_fornecedores', { fornecedor_id: fornecedorId });
  await apagarSeExistir('fornecedor_convites', { fornecedor_id: fornecedorId });
  await apagar('fornecedores', { id: fornecedorId });
  return logins.map((l) => l.email);
}

async function excluirFornecedor(id, admin) {
  const f = await DB.selectOne('fornecedores', { id });
  if (!f) return { status: 404, erro: 'Fornecedor não encontrado' };
  if (f.tipo !== 'candidato') {
    return { status: 409, erro: 'Só dá para excluir cadastro que nunca foi aprovado (candidato).' };
  }
  const emails = await excluirFornecedorDados(f.id);
  await registrar(admin, 'excluir', 'fornecedor', f.id, { nome: f.nome_fantasia || f.nome, cnpj: f.cnpj, logins: emails });
  return { ok: true };
}

module.exports = {
  registrar,
  visaoGeral,
  pendentes,
  listarTransportadoras,
  listarFornecedores,
  aprovarTransportadora,
  recusarTransportadora,
  excluirTransportadora,
  aprovarFornecedor,
  recusarFornecedor,
  excluirFornecedor,
};
