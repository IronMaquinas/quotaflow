// backend/services/convitesFornecedor.js
//
// Convites para o portal de fornecedores.
//
// 1) Fornecedor LOCAL já cadastrado (etapa 10)
//   tenant → POST /api/fornecedores/:id/convidar
//   fornecedor → cria nome + senha; o login fica ligado ao cadastro existente
//
// 2) Fornecedor NOVO, ainda sem cadastro (etapas 10b e 10c)
//   tenant → POST /api/fornecedores/convidar-novo { cnpj, email, nome? }
//            CNPJ obrigatório (10c): conferido na Receita NO ENVIO (inexistente,
//            não ATIVO ou Receita fora do ar = não envia) e gravado no convite
//   fornecedor → confere os dados da Receita (CNPJ, razão social e endereço
//                travados), completa contato, atuação e login;
//                o cadastro nasce como fornecedor LOCAL do tenant que convidou
//                (quem convidou responde pelo fornecedor — por isso não passa
//                pela fila de "não verificado" do autocadastro da etapa 11)
//
// Os dois tipos usam o mesmo link <FRONTEND_URL>/#convite?token=... e as mesmas
// rotas públicas:
//   GET  /api/auth/convite/validar?token=
//   POST /api/auth/convite/aceitar { token, nome, senha, empresa? }
//
// Regras:
//   • Global já é da plataforma: não recebe convite.
//   • Fornecedor que já tem login no portal não recebe convite.
//   • E-mail que já é login no portal: bloqueia (juntar cadastros é a etapa 2).
//   • Novo convite cancela o anterior pendente (mesmo fornecedor, ou mesmo
//     tenant + e-mail no caso de fornecedor novo).
//   • Token cru nunca é guardado — só o SHA-256.
//   • Fornecedor novo cujo CNPJ é de um GLOBAL: não duplica (o tenant já o vê).
//   • CNPJ que o próprio tenant já cadastrou como local (sem login): o login é
//     ligado a esse cadastro, sem duplicar.
//   • CNPJ que existe como local de OUTRO tenant: nada é revelado; nasce um
//     cadastro novo para este tenant (dados de um tenant nunca vazam para outro).
//   • CNPJ conferido na Receita (BrasilAPI) quando ela responde: inexistente ou
//     não ATIVA bloqueia; fora do ar não bloqueia (o cadastro segue sem a consulta).

const crypto = require('crypto');
const { DB } = require('../db');
const { enviarEmailFornecedor } = require('./emailService');
const { normalizarAtuacao } = require('./atuacao');

const DIAS_VALIDADE = 7;
const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const hash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const esc = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const normEmail = (e) => String(e || '').trim().toLowerCase();
const texto = (v, max = 200) => {
  const t = String(v == null ? '' : v).trim();
  return t ? t.slice(0, max) : null;
};
const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const pendente = (c) => !c.aceito_em && !c.cancelado_em;
const expirado = (c) => new Date(c.expira_em).getTime() < Date.now();

function cnpjValido(cnpj) {
  const c = soDigitos(cnpj);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const digito = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, p, i) => acc + p * Number(base[i]), 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digito(c.slice(0, 12)) === Number(c[12]) && digito(c.slice(0, 13)) === Number(c[13]);
}

// Só o que interessa do retorno da BrasilAPI (não guarda/expõe sócios etc.)
function resumoReceita(rf) {
  if (!rf) return null;
  const endereco = [rf.descricao_tipo_de_logradouro, rf.logradouro].filter(Boolean).join(' ').trim();
  return {
    razao_social: texto(rf.razao_social, 160),
    nome_fantasia: texto(rf.nome_fantasia, 120),
    situacao: texto(rf.descricao_situacao_cadastral, 40),
    endereco: texto(endereco, 160),
    numero: texto(rf.numero, 20),
    complemento: texto(rf.complemento, 80),
    bairro: texto(rf.bairro, 80),
    cidade: texto(rf.municipio, 80),
    estado: rf.uf ? String(rf.uf).toUpperCase().slice(0, 2) : null,
    cep: soDigitos(rf.cep).slice(0, 8) || null,
    telefone: texto(rf.ddd_telefone_1, 30),
    email: rf.email ? normEmail(rf.email) : null,
    cnae: rf.cnae_fiscal_descricao ? texto(rf.cnae_fiscal_descricao, 160) : null,
    abertura: texto(rf.data_inicio_atividade, 10),
  };
}

const nomeDaReceita = (r) => (r && (r.nome_fantasia || r.razao_social)) || null;

// jsonb pode chegar como objeto ou como texto
function lerJson(v) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
}

// O que a tela do convite mostra travado (dados da Receita gravados no convite)
function dadosReceitaParaTela(convite) {
  if (!convite?.cnpj) return null;
  const r = lerJson(convite.dados_cnpj) || {};
  return {
    cnpj: convite.cnpj,
    razao_social: r.razao_social || null,
    nome_fantasia: r.nome_fantasia || null,
    endereco: r.endereco || null,
    numero: r.numero || null,
    complemento: r.complemento || null,
    bairro: r.bairro || null,
    cidade: r.cidade || null,
    estado: r.estado || null,
    cep: r.cep || null,
    telefone: r.telefone || null,
  };
}

// Consulta pública da Receita (BrasilAPI). Nunca lança erro.
//   { status: 'ok', dados } | { status: 'nao_encontrado' } | { status: 'indisponivel' }
async function consultarReceitaBrasilAPI(cnpj) {
  if (typeof fetch !== 'function') return { status: 'indisponivel' };
  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), 6000);
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: controle.signal });
    if (r.status === 404) return { status: 'nao_encontrado' };
    if (!r.ok) return { status: 'indisponivel' };
    return { status: 'ok', dados: await r.json() };
  } catch {
    return { status: 'indisponivel' };
  } finally {
    clearTimeout(tempo);
  }
}
let consultarReceita = consultarReceitaBrasilAPI;

function urlDoPortal() {
  return String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
}

async function temLoginNoPortal(fornecedorId) {
  const logins = (await DB.select('fornecedor_usuarios', { fornecedor_id: fornecedorId })) || [];
  return logins.length > 0;
}

async function loginPorEmail(email) {
  // e-mail de login pode ter sido gravado com maiúsculas antes desta etapa
  const exato = await DB.selectOne('fornecedor_usuarios', { email });
  if (exato) return exato;
  const todos = (await DB.select('fornecedor_usuarios', {})) || [];
  return todos.find((u) => normEmail(u.email) === email) || null;
}

// Mapa fornecedor_id → { portal_ativo, convite_pendente_ate } para a lista do tenant
async function situacaoPortal(tenantId, fornecedorIds) {
  const ids = new Set((fornecedorIds || []).map(String));
  const saida = {};
  if (!ids.size) return saida;
  const [logins, convites] = await Promise.all([
    DB.select('fornecedor_usuarios', {}),
    DB.select('fornecedor_convites', { tenant_id: tenantId }),
  ]);
  for (const l of logins || []) {
    if (ids.has(String(l.fornecedor_id))) saida[String(l.fornecedor_id)] = { portal_ativo: true };
  }
  for (const c of convites || []) {
    if (c.fornecedor_id == null) continue; // convite de fornecedor novo: lista própria
    const k = String(c.fornecedor_id);
    if (!ids.has(k) || saida[k]?.portal_ativo) continue;
    if (!pendente(c) || expirado(c)) continue;
    const atual = saida[k]?.convite_pendente_ate;
    if (!atual || new Date(c.expira_em) > new Date(atual)) {
      saida[k] = { portal_ativo: false, convite_pendente_ate: c.expira_em, convite_email: c.email };
    }
  }
  return saida;
}

// ─── E-mails ────────────────────────────────────────────────────────────────

function moldura(conteudo) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
    <div style="font-size:12px;color:#64748b;letter-spacing:.08em;">QUOTAFLOW · PORTAL DO FORNECEDOR</div>
    ${conteudo}
  </div>`;
}

function botao(link, rotulo) {
  return `
    <div style="text-align:center;margin:20px 0;">
      <a href="${esc(link)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:700;font-size:14px;display:inline-block;">
        ${esc(rotulo)}
      </a>
    </div>`;
}

function rodape(expiraEm) {
  return `
    <p style="font-size:12px;color:#64748b;line-height:1.5;">
      O link vale até ${esc(new Date(expiraEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}.
      Se você não esperava este convite, pode ignorar este e-mail.
    </p>`;
}

const BENEFICIOS = `
    <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 6px;">No portal, gratuitamente, você:</p>
    <ul style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 14px;padding-left:20px;">
      <li>recebe e responde pedidos de cotação;</li>
      <li>acompanha pedidos e envia a NF-e;</li>
      <li>vê demandas urgentes de peças (Canal Spot) de transportadoras de todo o Brasil;</li>
      <li>mantém os dados da sua empresa sempre atualizados.</li>
    </ul>`;

function emailConvite({ link, fornecedor, tenant, expiraEm }) {
  const empresa = fornecedor.nome_fantasia || fornecedor.nome || 'sua empresa';
  const cliente = tenant?.nome || 'Um cliente';
  const assunto = `${cliente} convidou ${empresa} para o portal de fornecedores QuotaFlow`;
  const html = moldura(`
    <h2 style="margin:6px 0 10px;font-size:20px;">Você foi convidado</h2>
    <p style="font-size:14px;color:#334155;line-height:1.6;">
      <b>${esc(cliente)}</b> usa o QuotaFlow para compras e convidou <b>${esc(empresa)}</b> para o portal de fornecedores.
    </p>
    ${BENEFICIOS}
    ${botao(link, 'Criar meu acesso')}
    ${rodape(expiraEm)}`);
  return { assunto, html };
}

function emailConviteNovo({ link, nome, empresa, tenant, expiraEm }) {
  const cliente = tenant?.nome || 'Um cliente';
  const assunto = empresa
    ? `${cliente} quer receber cotações de ${empresa} pelo QuotaFlow`
    : `${cliente} quer receber cotações da sua empresa pelo QuotaFlow`;
  const saudacao = nome ? `Olá, ${esc(nome)}!` : 'Olá!';
  const html = moldura(`
    <h2 style="margin:6px 0 10px;font-size:20px;">${saudacao}</h2>
    <p style="font-size:14px;color:#334155;line-height:1.6;">
      <b>${esc(cliente)}</b> usa o QuotaFlow para compras e convidou ${empresa ? `<b>${esc(empresa)}</b>` : 'a sua empresa'} para ser fornecedora dela.
      Os dados da empresa já vêm da Receita Federal: você só confere, completa o contato e cria o seu acesso.
    </p>
    ${BENEFICIOS}
    ${botao(link, 'Cadastrar minha empresa')}
    ${rodape(expiraEm)}`);
  return { assunto, html };
}

// ─── 1) Convite ao fornecedor LOCAL já cadastrado ──────────────────────────

// tenant convida fornecedor local → { ok, expira_em, email } ou { erro, status }
async function convidar({ tenantId, fornecedorId, email, criadoPor }) {
  const f = await DB.selectOne('fornecedores', { id: fornecedorId });
  if (!f || f.tipo === 'global' || String(f.tenant_id) !== String(tenantId)) {
    return { status: 404, erro: 'Fornecedor não encontrado' };
  }
  if (await temLoginNoPortal(f.id)) {
    return { status: 409, erro: 'Este fornecedor já tem acesso ao portal' };
  }
  const destino = normEmail(email || f.email || f.email_contato);
  if (!EMAIL_VALIDO.test(destino)) {
    return { status: 400, erro: 'Informe um e-mail válido para o convite' };
  }
  if (await loginPorEmail(destino)) {
    return { status: 409, erro: 'Este e-mail já é usado por outra empresa no portal. Use outro e-mail do fornecedor.' };
  }
  const urlPortal = urlDoPortal();
  if (!urlPortal) return { status: 500, erro: 'FRONTEND_URL não configurada no servidor' };

  // cancela convites pendentes anteriores deste fornecedor
  const anteriores = (await DB.select('fornecedor_convites', { fornecedor_id: f.id })) || [];
  const agoraIso = new Date().toISOString();
  for (const c of anteriores) {
    if (pendente(c)) await DB.update('fornecedor_convites', c.id, { cancelado_em: agoraIso });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiraEm = new Date(Date.now() + DIAS_VALIDADE * 24 * 3600 * 1000).toISOString();
  await DB.insert('fornecedor_convites', {
    token_hash: hash(token),
    fornecedor_id: f.id,
    tenant_id: tenantId,
    email: destino,
    criado_por: criadoPor ? String(criadoPor) : null,
    expira_em: expiraEm,
  });

  const tenant = await DB.selectOne('tenants', { id: tenantId });
  const { assunto, html } = emailConvite({ link: `${urlPortal}/#convite?token=${token}`, fornecedor: f, tenant, expiraEm });
  await enviarEmailFornecedor(destino, assunto, html);
  return { ok: true, expira_em: expiraEm, email: destino };
}

// ─── 2) Convite a fornecedor NOVO (sem cadastro) ───────────────────────────

// tenant convida pelo CNPJ + e-mail → { ok, expira_em, email, empresa } ou { erro, status }
async function convidarNovo({ tenantId, cnpj, email, nome, criadoPor }) {
  const cnpjLimpo = soDigitos(cnpj);
  if (!cnpjValido(cnpjLimpo)) {
    return { status: 400, erro: 'Informe um CNPJ válido (14 dígitos)' };
  }
  const destino = normEmail(email);
  if (!EMAIL_VALIDO.test(destino)) {
    return { status: 400, erro: 'Informe um e-mail válido para o convite' };
  }

  // CNPJ já é de fornecedor global → já está na lista do tenant
  const global = await DB.selectOne('fornecedores', { cnpj: cnpjLimpo, tipo: 'global' });
  if (global) {
    return { status: 409, erro: `Este CNPJ é de ${global.nome_fantasia || global.nome}, fornecedor verificado da rede — ele já aparece na sua lista de fornecedores.` };
  }
  // CNPJ que o próprio tenant já cadastrou
  const doTenant = ((await DB.select('fornecedores', { tenant_id: tenantId, cnpj: cnpjLimpo })) || [])
    .find((f) => f.tipo !== 'global');
  if (doTenant) {
    const nomeF = doTenant.nome_fantasia || doTenant.nome;
    return (await temLoginNoPortal(doTenant.id))
      ? { status: 409, erro: `${nomeF} já está na sua lista e já usa o portal.` }
      : { status: 409, erro: `Você já tem ${nomeF} cadastrado com este CNPJ. Use o ✉ na linha dele para convidar.` };
  }

  const login = await loginPorEmail(destino);
  if (login) {
    const dono = await DB.selectOne('fornecedores', { id: login.fornecedor_id });
    if (dono && dono.tipo === 'global') {
      return { status: 409, erro: `Este e-mail é de ${dono.nome_fantasia || dono.nome}, fornecedor da rede global — ele já aparece na sua lista de fornecedores.` };
    }
    if (dono && String(dono.tenant_id) === String(tenantId)) {
      return { status: 409, erro: `Este e-mail é de ${dono.nome_fantasia || dono.nome}, que já está na sua lista e já usa o portal.` };
    }
    // login de fornecedor de outro tenant: não diz de quem é
    return { status: 409, erro: 'Este e-mail já tem acesso ao portal de fornecedores. Peça ao fornecedor outro e-mail para o convite.' };
  }

  const locais = (await DB.select('fornecedores', { tenant_id: tenantId })) || [];
  const jaCadastrado = locais.find((f) => f.tipo !== 'global' && normEmail(f.email) === destino);
  if (jaCadastrado) {
    return { status: 409, erro: `Você já tem ${jaCadastrado.nome_fantasia || jaCadastrado.nome} cadastrado com este e-mail. Use o ✉ na linha dele para convidar.` };
  }

  const urlPortal = urlDoPortal();
  if (!urlPortal) return { status: 500, erro: 'FRONTEND_URL não configurada no servidor' };

  // Receita: obrigatória no envio — sem resposta, não convida
  const receita = await consultarReceita(cnpjLimpo);
  if (receita.status === 'nao_encontrado') return { status: 400, erro: 'CNPJ não encontrado na Receita Federal. Confira o número.' };
  if (receita.status !== 'ok') return { status: 503, erro: 'Não foi possível consultar a Receita Federal agora. Tente de novo em alguns minutos.' };
  const dadosReceita = resumoReceita(receita.dados || {});
  if (dadosReceita.situacao && dadosReceita.situacao.toUpperCase() !== 'ATIVA') {
    return { status: 400, erro: `Este CNPJ consta como "${dadosReceita.situacao}" na Receita Federal. Só empresas ATIVAS podem ser convidadas.` };
  }

  // cancela convite pendente anterior do mesmo tenant para o mesmo e-mail ou o mesmo CNPJ
  const anteriores = (await DB.select('fornecedor_convites', { tenant_id: tenantId })) || [];
  const agoraIso = new Date().toISOString();
  for (const c of anteriores) {
    const mesmo = normEmail(c.email) === destino || (c.cnpj && c.cnpj === cnpjLimpo);
    if (c.fornecedor_id == null && mesmo && pendente(c)) {
      await DB.update('fornecedor_convites', c.id, { cancelado_em: agoraIso });
    }
  }

  const nomeSugerido = texto(nome, 120);
  const token = crypto.randomBytes(32).toString('hex');
  const expiraEm = new Date(Date.now() + DIAS_VALIDADE * 24 * 3600 * 1000).toISOString();
  await DB.insert('fornecedor_convites', {
    token_hash: hash(token),
    fornecedor_id: null,
    tenant_id: tenantId,
    email: destino,
    nome_sugerido: nomeSugerido,
    cnpj: cnpjLimpo,
    dados_cnpj: dadosReceita,
    criado_por: criadoPor ? String(criadoPor) : null,
    expira_em: expiraEm,
  });

  const tenant = await DB.selectOne('tenants', { id: tenantId });
  const empresa = nomeDaReceita(dadosReceita);
  const { assunto, html } = emailConviteNovo({ link: `${urlPortal}/#convite?token=${token}`, nome: nomeSugerido, empresa, tenant, expiraEm });
  await enviarEmailFornecedor(destino, assunto, html);
  return { ok: true, expira_em: expiraEm, email: destino, empresa };
}

// Convites a fornecedor novo ainda não concluídos (tela de Fornecedores do tenant)
async function listarConvitesNovos(tenantId) {
  const convites = (await DB.select('fornecedor_convites', { tenant_id: tenantId })) || [];
  return convites
    .filter((c) => c.fornecedor_id == null && pendente(c))
    .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0))
    .map((c) => ({
      id: c.id,
      email: c.email,
      nome: c.nome_sugerido || null,
      cnpj: c.cnpj || null,
      empresa: nomeDaReceita(lerJson(c.dados_cnpj)),
      enviado_em: c.criado_em || null,
      expira_em: c.expira_em,
      expirado: expirado(c),
    }));
}

async function cancelarConviteNovo(tenantId, conviteId) {
  const c = await DB.selectOne('fornecedor_convites', { id: conviteId });
  if (!c || String(c.tenant_id) !== String(tenantId) || c.fornecedor_id != null || !pendente(c)) {
    return { status: 404, erro: 'Convite não encontrado' };
  }
  await DB.update('fornecedor_convites', c.id, { cancelado_em: new Date().toISOString() });
  return { ok: true };
}

// ─── Abrir e aceitar o convite (lado do fornecedor) ────────────────────────

// valida token → { convite, fornecedor, tenant, novo } ou { motivo }
async function carregarConvite(token) {
  if (!/^[0-9a-f]{64}$/i.test(String(token || ''))) return { motivo: 'invalido' };
  const c = await DB.selectOne('fornecedor_convites', { token_hash: hash(token) });
  if (!c) return { motivo: 'invalido' };
  if (c.aceito_em) return { motivo: 'usado' };
  if (c.cancelado_em) return { motivo: 'cancelado' };
  if (expirado(c)) return { motivo: 'expirado' };
  const tenant = await DB.selectOne('tenants', { id: c.tenant_id });

  if (c.fornecedor_id == null) {
    return { convite: c, fornecedor: null, tenant, novo: true };
  }
  const fornecedor = await DB.selectOne('fornecedores', { id: c.fornecedor_id });
  if (!fornecedor) return { motivo: 'invalido' };
  if (await temLoginNoPortal(fornecedor.id)) return { motivo: 'usado' };
  return { convite: c, fornecedor, tenant, novo: false };
}

async function criarLogin({ fornecedorId, nome, email, senhaHash }) {
  // perfil e ativo ficam com o padrão da tabela (mesmo comportamento dos logins atuais)
  return DB.insert('fornecedor_usuarios', {
    fornecedor_id: fornecedorId,
    nome: String(nome).trim(),
    email,
    senha_hash: senhaHash,
  });
}

// Dados da empresa enviados pelo fornecedor no cadastro (só os campos aceitos)
function dadosDaEmpresa(empresa, nomeUsuario) {
  const e = empresa || {};
  const uf = texto(e.estado, 2);
  const cep = soDigitos(e.cep).slice(0, 8);
  return {
    nome_fantasia: texto(e.nome_fantasia, 120),
    razao_social: texto(e.razao_social, 160),
    endereco: texto(e.endereco, 160),
    numero: texto(e.numero, 20),
    complemento: texto(e.complemento, 80),
    bairro: texto(e.bairro, 80),
    cidade: texto(e.cidade, 80),
    estado: uf ? uf.toUpperCase() : null,
    cep: cep || null,
    telefone: texto(e.telefone, 30),
    whatsapp: texto(e.whatsapp, 30),
    nome_contato: texto(nomeUsuario, 120),
  };
}

// Fornecedor novo conclui o cadastro → { usuario, fornecedor } ou { motivo, detalhe? }
async function aceitarNovo({ convite, nome, senhaHash, empresa }) {
  // Convite com CNPJ (10c): o CNPJ e os dados oficiais vêm do convite — o que o
  // fornecedor mandar nesses campos é ignorado. Convite antigo (10b, sem CNPJ):
  // o fornecedor informa o CNPJ.
  const travado = !!convite.cnpj;
  const cnpj = travado ? soDigitos(convite.cnpj) : soDigitos(empresa?.cnpj);
  if (!cnpjValido(cnpj)) return { motivo: 'cnpj_invalido' };
  const dados = dadosDaEmpresa(empresa, nome);
  const daReceita = travado ? lerJson(convite.dados_cnpj) : null;
  if (daReceita) {
    for (const campo of ['razao_social', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep']) {
      if (daReceita[campo]) dados[campo] = daReceita[campo];
    }
    if (!dados.nome_fantasia) dados.nome_fantasia = nomeDaReceita(daReceita);
  }
  if (!dados.nome_fantasia) return { motivo: 'empresa_incompleta' };

  if (await loginPorEmail(normEmail(convite.email))) return { motivo: 'email_em_uso' };

  const global = await DB.selectOne('fornecedores', { cnpj, tipo: 'global' });
  if (global) return { motivo: 'cnpj_global' };

  const doTenant = ((await DB.select('fornecedores', { tenant_id: convite.tenant_id, cnpj })) || [])
    .find((f) => f.tipo !== 'global');
  if (doTenant && (await temLoginNoPortal(doTenant.id))) return { motivo: 'cnpj_ja_no_portal' };

  if (daReceita) {
    // já conferido na Receita no envio do convite (até 7 dias atrás)
    dados.dados_cnpj = daReceita;
    dados.situacao_cnpj = daReceita.situacao || null;
    dados.ultima_consulta_cnpj = convite.criado_em || new Date().toISOString();
  } else {
    const receita = await consultarReceita(cnpj);
    if (receita.status === 'nao_encontrado') return { motivo: 'cnpj_nao_encontrado' };
    const rf = receita.status === 'ok' ? receita.dados || {} : null;
    const situacao = rf ? texto(rf.descricao_situacao_cadastral, 40) : null;
    if (situacao && situacao.toUpperCase() !== 'ATIVA') return { motivo: 'cnpj_inativo', detalhe: situacao };
    if (rf) {
      // razão social oficial vem da Receita
      dados.razao_social = texto(rf.razao_social, 160) || dados.razao_social;
      dados.dados_cnpj = resumoReceita(rf);
      dados.situacao_cnpj = situacao;
      dados.ultima_consulta_cnpj = new Date().toISOString();
    }
  }

  let fornecedor;
  let criadoAgora = false;
  if (doTenant) {
    // O tenant já tinha este CNPJ cadastrado (sem login): liga o login a esse
    // cadastro. Daqui em diante o fornecedor mantém os dados — o que ele
    // preencheu vale; o que deixou vazio fica como o tenant tinha.
    const atualizacao = Object.fromEntries(Object.entries(dados).filter(([, v]) => v != null));
    if (!doTenant.email) atualizacao.email = convite.email;
    await DB.update('fornecedores', doTenant.id, atualizacao, convite.tenant_id);
    fornecedor = await DB.selectOne('fornecedores', { id: doTenant.id });
  } else {
    fornecedor = await DB.insert('fornecedores', {
      ...dados,
      nome: dados.nome_fantasia,
      cnpj,
      email: convite.email, // e-mail oficial: para onde vão cotações, pedidos e NCs
      tenant_id: convite.tenant_id,
      tipo: 'local',
      ativo: 1,
    }, convite.tenant_id);
    criadoAgora = true;
  }

  let usuario;
  try {
    usuario = await criarLogin({ fornecedorId: fornecedor.id, nome, email: convite.email, senhaHash });
  } catch (err) {
    // sem login, o cadastro recém-criado ficaria órfão: desfaz
    if (criadoAgora) {
      try { await DB.delete('fornecedores', fornecedor.id, convite.tenant_id); } catch { /* registra abaixo */ }
    }
    throw err;
  }

  // Atuação (opcional) depois de existir o fornecedor: assim a "Outra marca"
  // sugerida fica registrada em nome dele.
  try {
    const atuacao = await normalizarAtuacao(DB, empresa, { fornecedorId: fornecedor.id });
    if (Object.keys(atuacao).length) {
      await DB.update('fornecedores', fornecedor.id, atuacao, convite.tenant_id);
      fornecedor = { ...fornecedor, ...atuacao };
    }
  } catch (err) {
    // não impede o acesso: ele completa a atuação em Meus Dados
    console.error('⚠️ convite novo: atuação não gravada:', err.message);
  }

  await DB.update('fornecedor_convites', convite.id, {
    aceito_em: new Date().toISOString(),
    fornecedor_id: fornecedor.id,
  });
  return { usuario, fornecedor };
}

// cria o login do fornecedor → { usuario, fornecedor } ou { motivo }
async function aceitar({ token, nome, senhaHash, empresa }) {
  const r = await carregarConvite(token);
  if (r.motivo) return r;
  if (r.novo) return aceitarNovo({ convite: r.convite, nome, senhaHash, empresa });

  const { convite, fornecedor } = r;
  if (await loginPorEmail(normEmail(convite.email))) return { motivo: 'email_em_uso' };
  const usuario = await criarLogin({ fornecedorId: fornecedor.id, nome, email: convite.email, senhaHash });
  await DB.update('fornecedor_convites', convite.id, { aceito_em: new Date().toISOString() });
  return { usuario, fornecedor };
}

module.exports = {
  convidar,
  convidarNovo,
  listarConvitesNovos,
  cancelarConviteNovo,
  carregarConvite,
  aceitar,
  situacaoPortal,
  temLoginNoPortal,
  cnpjValido,
  dadosReceitaParaTela,
  DIAS_VALIDADE,
  // só para testes
  _definirConsultaReceita: (fn) => { consultarReceita = fn || consultarReceitaBrasilAPI; },
};
