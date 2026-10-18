// backend/services/cadastroPublico.js
//
// "Criar conta" pela tela de login (etapa 11a) — os dois públicos.
//
// TRANSPORTADORA (cliente)
//   • CNPJ obrigatório, conferido na Receita (inexistente, não ATIVO ou Receita
//     fora do ar = não cadastra). CNPJ que já é cliente → 409.
//   • Entra em TESTE de 15 dias (planos.dias_teste), sem bloqueio no fim por enquanto.
//   • aprovacao_status = 'pendente': usa o sistema normalmente, mas só publica no
//     Canal Spot depois da aprovação da plataforma (senão um tenant falso publica
//     demandas para colher contatos e preços de fornecedores verificados).
//   • O responsável entra como GESTOR — e também ADMIN, para conseguir cadastrar
//     a própria equipe (Usuários exige admin). Grava usuario_perfis.
//
// FORNECEDOR
//   • CNPJ obrigatório, conferido na Receita (mesmas regras).
//   • Nasce como tipo 'candidato' (aguardando aprovação): não aparece para
//     nenhum tenant e não vê o Canal Spot — todo o código filtra por 'global'
//     ou pelo tenant. Aprovar (etapa 11b) = 'candidato' → 'global'.
//   • CNPJ que já é global ou candidato → 409 (entre com o login existente).
//     CNPJ cadastrado como LOCAL por algum tenant: nada é revelado; o candidato
//     nasce normalmente (a junção pelo CNPJ acontece na aprovação — etapa 11b).
//
// Alertas automáticos (CNAE fora do esperado, empresa com menos de 6 meses,
// e-mail gratuito) são gravados em alertas_cadastro — não bloqueiam.
// Se ADMIN_EMAIL estiver configurado, a plataforma recebe um e-mail a cada
// cadastro novo, com os alertas e o comando de aprovação.

const { DB, supabase } = require('../db');
const { enviarEmailFornecedor } = require('./emailService');
const { normalizarAtuacao } = require('./atuacao');
const {
  EMAIL_VALIDO, soDigitos, normEmail, texto, conferirCnpj, nomeDaReceita, alertasCadastro,
} = require('./receitaCnpj');

const DIAS_TESTE_PADRAO = 15;
// Receita fora do ar no cadastro: segue (a conta já nasce em análise) e avisa o admin
const ALERTA_SEM_RECEITA = {
  codigo: 'receita_nao_conferida',
  texto: 'CNPJ NÃO conferido na Receita (consulta fora do ar no cadastro) — confira situação, razão social e atividade antes de aprovar',
};
const UFS = new Set(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']);

const esc = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function diasDeTeste() {
  try {
    const p = await DB.selectOne('planos', { codigo: 'teste' });
    const n = Number(p && p.dias_teste);
    return n > 0 ? n : DIAS_TESTE_PADRAO;
  } catch {
    return DIAS_TESTE_PADRAO;
  }
}

function slugDe(nome) {
  const base = String(nome || 'empresa')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'empresa';
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Aviso à plataforma ─────────────────────────────────────────────────────
async function avisarPlataforma({ publico, nome, cnpj, resumo, email, alertas, sqlAprovar }) {
  const para = normEmail(process.env.ADMIN_EMAIL);
  if (!EMAIL_VALIDO.test(para)) return;
  const tipo = publico === 'cliente' ? 'Transportadora' : 'Fornecedor';
  const listaAlertas = alertas.length
    ? `<ul style="margin:6px 0 0;padding-left:18px;color:#b45309;">${alertas.map((a) => `<li>${esc(a.texto)}</li>`).join('')}</ul>`
    : '<div style="color:#16a34a;">Nenhum alerta automático.</div>';
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;color:#0f172a;">
    <div style="font-size:12px;color:#64748b;letter-spacing:.08em;">QUOTAFLOW · CADASTRO NOVO AGUARDANDO APROVAÇÃO</div>
    <h2 style="margin:6px 0 12px;font-size:19px;">${tipo}: ${esc(nome)}</h2>
    <table style="font-size:13px;color:#334155;line-height:1.6;">
      <tr><td style="padding-right:12px;color:#64748b;">CNPJ</td><td>${esc(cnpj)}</td></tr>
      <tr><td style="padding-right:12px;color:#64748b;">Razão social</td><td>${esc(resumo.razao_social)}</td></tr>
      <tr><td style="padding-right:12px;color:#64748b;">Cidade</td><td>${esc([resumo.cidade, resumo.estado].filter(Boolean).join('/'))}</td></tr>
      <tr><td style="padding-right:12px;color:#64748b;">Atividade</td><td>${esc(resumo.cnae_descricao)}</td></tr>
      <tr><td style="padding-right:12px;color:#64748b;">Abertura</td><td>${esc(resumo.abertura)}</td></tr>
      <tr><td style="padding-right:12px;color:#64748b;">E-mail</td><td>${esc(email)}</td></tr>
    </table>
    <div style="margin-top:12px;font-size:13px;"><b>Alertas</b>${listaAlertas}</div>
    <div style="margin-top:12px;font-size:12px;color:#334155;">📧 A pessoa recebeu um link para confirmar o e-mail. Aprove de preferência depois da confirmação (coluna <b>email_confirmado_em</b> do login).</div>
    <div style="margin-top:14px;font-size:12px;color:#64748b;">Para aprovar (até a tela de aprovação existir), rode no SQL Editor do Supabase:</div>
    <pre style="background:#f1f5f9;padding:10px;border-radius:6px;font-size:12px;white-space:pre-wrap;">${esc(sqlAprovar)}</pre>
  </div>`;
  try {
    await enviarEmailFornecedor(para, `[QuotaFlow] ${tipo} novo aguardando aprovação: ${nome}`, html);
  } catch (err) {
    console.error('⚠️ aviso de cadastro à plataforma não enviado:', err.message);
  }
}

// ─── Transportadora ─────────────────────────────────────────────────────────
// → { tenant, usuario, perfis } ou { status, erro, motivo? }
async function cadastrarTransportadora({ cnpj, empresaNome, nome, email, senhaHash, telefone, regiao }) {
  const emailNorm = normEmail(email);
  const nomeResp = texto(nome, 120);
  if (!nomeResp) return { status: 400, erro: 'Informe o seu nome.' };
  if (!EMAIL_VALIDO.test(emailNorm)) return { status: 400, erro: 'Informe um e-mail válido.' };

  // E-mail já é usuário de algum cliente
  const jaUsuario = (await DB.selectOne('usuarios', { email: emailNorm }))
    || (String(email).trim() !== emailNorm ? await DB.selectOne('usuarios', { email: String(email).trim() }) : null);
  if (jaUsuario) return { status: 409, erro: 'Este e-mail já tem conta no QuotaFlow. Entre com ele ou use "Esqueci minha senha".' };

  const cnpjLimpo = soDigitos(cnpj);
  // CNPJ já é cliente
  if (cnpjLimpo.length === 14) {
    const tenants = (await DB.select('tenants', {})) || [];
    if (tenants.some((t) => soDigitos(t.cnpj) === cnpjLimpo)) {
      return { status: 409, erro: 'Esta empresa já tem conta no QuotaFlow. Peça ao gestor da sua empresa para cadastrar você em Usuários.' };
    }
  }

  const conf = await conferirCnpj(cnpjLimpo, { quem: 'empresa', permitirSemReceita: true });
  if (conf.erro) return conf;
  const resumo = conf.resumo || {};

  const nomeEmpresa = texto(empresaNome, 120) || nomeDaReceita(resumo);
  if (!nomeEmpresa) return { status: 400, erro: 'Informe o nome da empresa.' };
  const uf = String(regiao || resumo.estado || '').toUpperCase();
  const alertas = alertasCadastro('cliente', resumo, emailNorm);
  if (conf.semReceita) alertas.unshift(ALERTA_SEM_RECEITA);
  const dias = await diasDeTeste();

  const tenant = await DB.insert('tenants', {
    slug: slugDe(nomeEmpresa),
    nome: nomeEmpresa,
    cnpj: cnpjLimpo,
    email_admin: emailNorm,
    telefone: texto(telefone, 30) || resumo.telefone || null,
    plano: 'teste',
    teste_ate: new Date(Date.now() + dias * 24 * 3600 * 1000).toISOString(),
    status: 'ativo',
    regiao: UFS.has(uf) ? uf : 'SP', // mesmo padrão do cadastro antigo
    participa_benchmark: 1,
    aprovacao_status: 'pendente',
    cadastro_origem: 'signup',
    alertas_cadastro: alertas,
    dados_cnpj: conf.resumo,
  });
  if (!tenant) throw new Error('Erro ao criar a transportadora');

  let usuario;
  try {
    usuario = await DB.insert('usuarios', {
      nome: nomeResp,
      email: emailNorm,
      senha_hash: senhaHash,
      perfil: 'gestor',
      ativo: 1,
    }, tenant.id);
    if (!usuario) throw new Error('Erro ao criar o usuário');
  } catch (err) {
    try { await DB.delete('tenants', tenant.id); } catch { /* registra abaixo */ }
    throw err;
  }

  // Multi-perfil (M4.6): gestor + admin (admin para cadastrar a própria equipe)
  const perfis = ['gestor', 'admin'];
  try {
    const { error } = await supabase.from('usuario_perfis').insert(perfis.map((p) => ({ usuario_id: usuario.id, perfil_codigo: p })));
    if (error) throw error;
  } catch (err) {
    // não impede o acesso: o login cai no perfil principal (gestor)
    console.error('⚠️ signup: usuario_perfis não gravado:', err.message);
  }

  await avisarPlataforma({
    publico: 'cliente', nome: nomeEmpresa, cnpj: cnpjLimpo, resumo, email: emailNorm, alertas,
    sqlAprovar: `UPDATE tenants SET aprovacao_status = 'aprovado', aprovado_em = now() WHERE id = ${tenant.id};`,
  });

  return { tenant, usuario, perfis };
}

// ─── Fornecedor ─────────────────────────────────────────────────────────────
async function loginFornecedorPorEmail(email) {
  const exato = await DB.selectOne('fornecedor_usuarios', { email });
  if (exato) return exato;
  const todos = (await DB.select('fornecedor_usuarios', {})) || [];
  return todos.find((u) => normEmail(u.email) === email) || null;
}

// → { fornecedor, usuario } ou { status, erro, motivo? }
async function cadastrarFornecedor({ cnpj, nome, email, senhaHash, empresa }) {
  const emailNorm = normEmail(email);
  const nomeResp = texto(nome, 120);
  const e = empresa || {};
  if (!nomeResp) return { status: 400, erro: 'Informe o seu nome.' };
  if (!EMAIL_VALIDO.test(emailNorm)) return { status: 400, erro: 'Informe um e-mail válido.' };
  if (await loginFornecedorPorEmail(emailNorm)) {
    return { status: 409, erro: 'Este e-mail já tem acesso ao portal de fornecedores. Entre com ele ou use "Esqueci minha senha".' };
  }

  const cnpjLimpo = soDigitos(cnpj);
  if (cnpjLimpo.length === 14) {
    const mesmos = (await DB.select('fornecedores', { cnpj: cnpjLimpo })) || [];
    if (mesmos.some((f) => f.tipo === 'global' || f.tipo === 'candidato')) {
      return {
        status: 409,
        motivo: 'cnpj_ja_cadastrado',
        erro: 'Esta empresa já tem cadastro no portal QuotaFlow. Entre com o login dela (ou use "Esqueci minha senha"). Se ninguém da empresa tem acesso, fale com o suporte.',
      };
    }
  }

  const conf = await conferirCnpj(cnpjLimpo, { quem: 'empresa', permitirSemReceita: true });
  if (conf.erro) return conf;
  const resumo = conf.resumo || {};

  const nomeFantasia = texto(e.nome_fantasia, 120) || nomeDaReceita(resumo);
  if (!nomeFantasia) return { status: 400, erro: 'Informe o nome fantasia da empresa.' };
  const alertas = alertasCadastro('fornecedor', resumo, emailNorm);
  if (conf.semReceita) alertas.unshift(ALERTA_SEM_RECEITA);

  let fornecedor = await DB.insert('fornecedores', {
    tipo: 'candidato',          // aguardando aprovação da plataforma
    tenant_id: null,
    nome_fantasia: nomeFantasia,
    nome: nomeFantasia,
    razao_social: resumo.razao_social || null,
    cnpj: cnpjLimpo,
    // endereço oficial da Receita (o fornecedor ajusta depois em Meus Dados, se preciso)
    endereco: resumo.endereco,
    numero: resumo.numero,
    complemento: resumo.complemento,
    bairro: resumo.bairro,
    cidade: resumo.cidade,
    estado: resumo.estado,
    cep: resumo.cep,
    telefone: texto(e.telefone, 30) || resumo.telefone,
    whatsapp: texto(e.whatsapp, 30),
    nome_contato: nomeResp,
    email: emailNorm,           // e-mail oficial: cotações, pedidos e NCs
    ativo: 1,
    plano: 'gratuito',
    cadastro_origem: 'autocadastro',
    alertas_cadastro: alertas,
    dados_cnpj: conf.resumo,
    situacao_cnpj: resumo.situacao || null,
    ultima_consulta_cnpj: conf.semReceita ? null : new Date().toISOString(),
  });
  if (!fornecedor) throw new Error('Erro ao criar o fornecedor');

  let usuario;
  try {
    usuario = await DB.insert('fornecedor_usuarios', {
      fornecedor_id: fornecedor.id,
      nome: nomeResp,
      email: emailNorm,
      senha_hash: senhaHash,
    });
    if (!usuario) throw new Error('Erro ao criar o login');
  } catch (err) {
    try { await DB.delete('fornecedores', fornecedor.id); } catch { /* registra abaixo */ }
    throw err;
  }

  // Atuação (opcional) — depois de existir o fornecedor, para a "Outra marca"
  // sugerida ficar em nome dele
  try {
    const atuacao = await normalizarAtuacao(DB, e, { fornecedorId: fornecedor.id });
    if (Object.keys(atuacao).length) {
      await DB.update('fornecedores', fornecedor.id, atuacao);
      fornecedor = { ...fornecedor, ...atuacao };
    }
  } catch (err) {
    console.error('⚠️ signup fornecedor: atuação não gravada:', err.message);
  }

  await avisarPlataforma({
    publico: 'fornecedor', nome: nomeFantasia, cnpj: cnpjLimpo, resumo, email: emailNorm, alertas,
    sqlAprovar: `UPDATE fornecedores SET tipo = 'global' WHERE id = ${fornecedor.id} AND tipo = 'candidato';`,
  });

  return { fornecedor, usuario };
}

// Situação do teste/aprovação do tenant, para o aviso no topo do sistema
function situacaoDoTenant(tenant, plano) {
  const t = tenant || {};
  const emTeste = t.plano === 'teste' && !!t.teste_ate;
  const msRestantes = emTeste ? new Date(t.teste_ate).getTime() - Date.now() : null;
  return {
    plano: t.plano || null,
    plano_nome: plano?.nome || null,
    em_teste: emTeste,
    teste_ate: t.teste_ate || null,
    dias_restantes_teste: emTeste ? Math.max(0, Math.ceil(msRestantes / (24 * 3600 * 1000))) : null,
    teste_encerrado: emTeste ? msRestantes <= 0 : false,
    aprovacao_status: t.aprovacao_status || 'aprovado',
    pode_publicar_spot: (t.aprovacao_status || 'aprovado') === 'aprovado',
  };
}

module.exports = { cadastrarTransportadora, cadastrarFornecedor, situacaoDoTenant };
