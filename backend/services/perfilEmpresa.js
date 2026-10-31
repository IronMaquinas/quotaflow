// backend/services/perfilEmpresa.js — etapa 14d.5
//
// Perfil da empresa (transportadora = tenant): dados cadastrais, checklist "Complete o perfil", busca de CEP e da Receita,
// e o histórico de alterações (tenant_alteracoes, migration 049).
//
// CNPJ TRAVADO: a empresa não troca o CNPJ pelo sistema — só a administração da plataforma, no Console, com motivo.
// Toda troca de CNPJ (sistema, Console ou SQL direto) é gravada pelo gatilho do banco (tenants_cnpj_log).
// Os demais campos: cada alteração feita pela empresa vira uma linha no histórico (campo, antes, depois, quem).

const R = require('./receitaCnpj');

const CAMPOS = ['razao_social', 'nome_fantasia', 'cnpj', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'cep', 'telefone', 'email', 'inscricao_estadual', 'opcao_fiscal', 'base_endereco']; // 15a · 16e.3: pátio/base da frota: IE e opção fiscal (cabeçalho do BID)
const OPCOES_FISCAIS = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'];
const ROTULO = { razao_social: 'Razão social', nome_fantasia: 'Nome fantasia', cnpj: 'CNPJ', endereco: 'Endereço', numero: 'Número', complemento: 'Complemento',
  bairro: 'Bairro', cidade: 'Cidade', cep: 'CEP', telefone: 'Telefone', email: 'E-mail', regiao: 'Estado (região)', inscricao_estadual: 'Inscrição estadual', opcao_fiscal: 'Opção fiscal', base_endereco: 'Pátio / base da frota' };
const so = (v) => String(v || '').replace(/\D/g, '');
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const tenantDe = async (supabase, id) => (await q(supabase.from('tenants').select('*').eq('id', id)))[0] || null;

async function dados(supabase, tenantId) {
  const t = await tenantDe(supabase, tenantId) || {};
  const out = {}; for (const k of CAMPOS) out[k] = t[k] ?? null;
  if (!out.razao_social && !out.nome_fantasia) out.nome_fantasia = t.nome || null;
  return { ...out, regiao: t.regiao || null, migrada: 'razao_social' in t, cnpj_travado: !!so(t.cnpj), migrada_fiscal: 'inscricao_estadual' in t, opcoes_fiscais: OPCOES_FISCAIS }; // 15a
}

async function registrarAlteracoes(supabase, tenantId, linhas) {
  if (!linhas.length) return;
  const { error } = await supabase.from('tenant_alteracoes').insert(linhas.map((l) => ({ tenant_id: tenantId, ...l })));
  if (error) console.error('⚠️ tenant_alteracoes não gravado (rode a 049):', error.message);
}

/** Empresa salva os dados. CNPJ: só pode ser informado se ainda não existe (depois, só pela plataforma). */
async function salvar(supabase, tenantId, quem, body = {}) {
  const t0 = await tenantDe(supabase, tenantId); if (!t0) return { status: 404, erro: 'Empresa não encontrada' };
  const t = { ...t0 }; // retrato de antes (histórico)
  const upd = {};
  for (const k of CAMPOS) if (body[k] !== undefined) upd[k] = (body[k] == null ? '' : String(body[k]).trim().slice(0, 200)) || null;
  if (upd.cnpj !== undefined) {
    const novo = so(upd.cnpj) || null;
    if (so(t.cnpj)) {
      if (novo !== so(t.cnpj)) return { status: 403, erro: 'O CNPJ não pode ser alterado por aqui. Para trocar, fale com o suporte do QuotaFlow — a alteração é analisada e fica registrada.' };
      delete upd.cnpj;
    } else if (novo) {
      if (novo.length !== 14 || !R.cnpjValido(novo)) return { status: 400, erro: 'CNPJ inválido' };
      const outros = await q(supabase.from('tenants').select('id').eq('cnpj', novo));
      if (outros.some((o) => String(o.id) !== String(tenantId))) return { status: 409, erro: 'Este CNPJ já tem conta no QuotaFlow. Fale com o suporte.' };
      upd.cnpj = novo;
    } else delete upd.cnpj;
  }
  if (upd.cep) { upd.cep = so(upd.cep); if (upd.cep.length !== 8) return { status: 400, erro: 'CEP deve ter 8 dígitos' }; }
  if (upd.email && !R.EMAIL_VALIDO.test(upd.email)) return { status: 400, erro: 'E-mail inválido' };
  // 15a: IE = números (ou "ISENTO"); opção fiscal = lista fechada
  if (upd.inscricao_estadual) { const ie = upd.inscricao_estadual.toUpperCase(); upd.inscricao_estadual = /^ISENT[OA]$/.test(ie) ? 'ISENTO' : ie.replace(/[^\d.\-/]/g, ''); if (upd.inscricao_estadual !== 'ISENTO' && upd.inscricao_estadual.replace(/\D/g, '').length < 2) return { status: 400, erro: 'Inscrição estadual inválida (números ou ISENTO)' }; }
  if (upd.opcao_fiscal && !OPCOES_FISCAIS.includes(upd.opcao_fiscal)) return { status: 400, erro: 'Opção fiscal inválida' };
  if (!upd.razao_social && body.razao_social !== undefined) return { status: 400, erro: 'Informe a razão social' };
  const mud = Object.keys(upd).filter((k) => String(t[k] ?? '') !== String(upd[k] ?? ''));
  if (!mud.length) return { ok: true, alterados: 0 };
  const patch = {}; for (const k of mud) patch[k] = upd[k];
  const { error } = await supabase.from('tenants').update(patch).eq('id', tenantId);
  if (error) { if (/column|schema cache/i.test(error.message)) return { status: 409, erro: /inscricao_estadual|opcao_fiscal/.test(error.message) ? 'Rode a migration 051 antes (inscrição estadual e opção fiscal)' : 'Rode as migrations 048 e 049 antes (dados da empresa)' }; throw new Error(error.message); }
  // o CNPJ (1ª vez) é registrado pelo gatilho do banco; os demais aqui
  await registrarAlteracoes(supabase, tenantId, mud.filter((k) => k !== 'cnpj').map((k) => ({ campo: k, antes: t[k] ?? null, depois: patch[k], origem: 'empresa', usuario_id: quem?.id != null ? String(quem.id) : null, usuario_nome: quem?.nome || null })));
  return { ok: true, alterados: mud.length };
}

async function alteracoes(supabase, tenantId) {
  try {
    const { data, error } = await supabase.from('tenant_alteracoes').select('*').eq('tenant_id', tenantId).order('criado_em', { ascending: false }).limit(200);
    if (error) return { alteracoes: [], migrada: false };
    return { alteracoes: (data || []).map((a) => ({ ...a, rotulo: ROTULO[a.campo] || a.campo })), migrada: true };
  } catch { return { alteracoes: [], migrada: false }; }
}

/** Receita pelo CNPJ da empresa → campos para conferir (não grava) */
async function receita(supabase, tenantId) {
  const t = await tenantDe(supabase, tenantId);
  const c = so(t?.cnpj); if (c.length !== 14) return { status: 400, erro: 'A empresa ainda não tem CNPJ' };
  const r = await R.consultarReceita(c);
  if (r.status !== 'ok') return { status: 503, erro: r.status === 'nao_encontrado' ? 'CNPJ não encontrado na Receita' : 'A consulta à Receita não respondeu agora. Tente de novo em instantes.' };
  const x = R.resumoReceita(r.dados) || {};
  return { razao_social: x.razao_social, nome_fantasia: x.nome_fantasia, endereco: x.endereco, numero: x.numero, complemento: x.complemento, bairro: x.bairro,
    cidade: x.cidade, cep: x.cep, telefone: x.telefone, email: x.email, uf: x.estado, situacao: x.situacao };
}

/** CEP → { cep, endereco, bairro, cidade, uf } (BrasilAPI v1) */
async function cep(valor) {
  const c = so(valor); if (c.length !== 8) return { status: 400, erro: 'CEP deve ter 8 dígitos' };
  const r = await R.obterJson(`https://brasilapi.com.br/api/cep/v1/${c}`);
  if (r.status === 200 && r.corpo) return { cep: c, endereco: r.corpo.street || null, bairro: r.corpo.neighborhood || null, cidade: r.corpo.city || null, uf: r.corpo.state || null };
  if (r.status === 404) return { status: 404, erro: 'CEP não encontrado — preencha o endereço à mão' };
  return { status: 503, erro: 'A busca de CEP não respondeu — preencha o endereço à mão' };
}

/** Checklist "Complete o perfil da sua empresa" */
async function status(supabase, tenantId) {
  const t = await tenantDe(supabase, tenantId) || {};
  const jornada = await q(supabase.from('tenant_jornadas').select('id').eq('tenant_id', tenantId)).catch(() => []);
  const faltaDados = ['razao_social', 'cnpj', 'endereco', 'numero', 'cidade', 'cep', 'telefone'].filter((k) => !t[k]);
  const itens = [
    { id: 'dados', titulo: 'Dados cadastrais (razão social, endereço, telefone)', ok: !faltaDados.length, falta: faltaDados.map((k) => ROTULO[k]), aba: 'empresa' },
    { id: 'regiao', titulo: 'Estado da operação (Canal Spot)', ok: !!t.regiao, aba: 'empresa' },
    { id: 'logo', titulo: 'Logomarca nos documentos', ok: !!t.logo_path, aba: 'empresa' },
    { id: 'jornada', titulo: 'Jornada de trabalho', ok: jornada.length > 0, aba: 'jornada' },
  ];
  return { itens, feitos: itens.filter((i) => i.ok).length, total: itens.length, completo: itens.every((i) => i.ok) };
}

/** Console da plataforma: troca do CNPJ, com motivo (o gatilho do banco grava o histórico) */
async function alterarCnpjPlataforma(supabase, tenantId, admin, { cnpj, motivo } = {}) {
  const t = await tenantDe(supabase, tenantId); if (!t) return { status: 404, erro: 'Transportadora não encontrada' };
  const novo = so(cnpj); const mot = String(motivo || '').trim();
  if (novo.length !== 14 || !R.cnpjValido(novo)) return { status: 400, erro: 'CNPJ inválido' };
  if (mot.length < 10) return { status: 400, erro: 'Descreva o motivo (mínimo 10 caracteres) — fica no histórico' };
  if (novo === so(t.cnpj)) return { status: 400, erro: 'É o mesmo CNPJ' };
  const outros = await q(supabase.from('tenants').select('id').eq('cnpj', novo));
  if (outros.some((o) => String(o.id) !== String(tenantId))) return { status: 409, erro: 'Outra transportadora já usa este CNPJ' };
  const { error } = await supabase.from('tenants').update({ cnpj: novo, cnpj_alterado_por: admin?.email || 'plataforma', cnpj_alteracao_motivo: mot.slice(0, 500), cnpj_alterado_em: new Date().toISOString() }).eq('id', tenantId);
  if (error) { if (/column|schema cache/i.test(error.message)) return { status: 409, erro: 'Rode a migration 049 antes' }; throw new Error(error.message); }
  return { ok: true, antes: t.cnpj, depois: novo };
}

module.exports = { CAMPOS, OPCOES_FISCAIS, dados, salvar, alteracoes, receita, cep, status, alterarCnpjPlataforma };
