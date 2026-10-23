// backend/services/clientes.js — etapa 14b.3.1
//
// Cadastro de CLIENTES da transportadora — um por CNPJ/CPF na empresa (decidido com o Marcony, 23/10/2026):
//   • nasce no próprio contrato (CNPJ primeiro → já é cliente? usa o cadastro : busca na Receita — BrasilAPI e CNPJ.ws)
//   • o segundo contrato do mesmo CNPJ reaproveita o cadastro (nada de cliente duplicado)
//   • 👥 Clientes (aba em 📑 Contratos) lista e edita; a proposta comercial (15a) vai usar o mesmo cadastro.
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const RC = require('./receitaCnpj');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const dig = (v) => String(v || '').replace(/\D/g, '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function cpfValido(c) {
  const d = dig(c); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n) => { let t = 0; for (let i = 0; i < n; i++) t += Number(d[i]) * (n + 1 - i); const r = (t * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
/** null = sem documento · 'invalido' · dígitos */
function documento(v) {
  const d = dig(v); if (!d) return null;
  if (d.length === 14) return RC.cnpjValido(d) ? d : 'invalido';
  if (d.length === 11) return cpfValido(d) ? d : 'invalido';
  return 'invalido';
}

const CAMPOS = [['nome', 160], ['razao_social', 160], ['endereco', 160], ['numero', 20], ['complemento', 80], ['bairro', 80], ['cidade', 80], ['uf', 2], ['cep', 9], ['contato_nome', 120], ['contato_telefone', 30], ['obs', 1000]];
function validar(body, parcial = false) {
  const out = {}; const tem = (k) => body[k] !== undefined;
  for (const [k, n] of CAMPOS) if (tem(k)) out[k] = texto(body[k], n);
  if (out.uf) out.uf = out.uf.toUpperCase();
  if (out.cep) out.cep = dig(out.cep).slice(0, 8) || null;
  if (!parcial && !out.nome) return { erro: 'Informe o nome do cliente' };
  if (tem('nome') && !out.nome) return { erro: 'Informe o nome do cliente' };
  if (tem('documento')) { const d = documento(body.documento); if (d === 'invalido') return { erro: 'CNPJ/CPF inválido' }; out.documento = d; }
  if (tem('contato_email')) { const e = texto(body.contato_email, 160); if (e && !EMAIL.test(e)) return { erro: 'E-mail do contato inválido' }; out.contato_email = e ? e.toLowerCase() : null; }
  return { dados: out };
}

async function listar(supabase, tenantId) {
  const [cs, contratos] = await Promise.all([q(supabase.from('clientes').select('*').eq('tenant_id', tenantId)), q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId)).catch(() => [])]);
  return cs.filter((c) => c.ativo !== false).map((c) => { const m = contratos.filter((k) => String(k.cliente_id) === String(c.id));
    return { ...c, contratos: m.length, contratos_ativos: m.filter((k) => k.status === 'ativo').length }; }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}
async function porDocumento(supabase, tenantId, doc) {
  return doc ? (await q(supabase.from('clientes').select('*').eq('tenant_id', tenantId).eq('documento', doc)))[0] || null : null;
}
async function doTenant(supabase, tenantId, id) {
  return /^\d+$/.test(String(id || '')) ? (await q(supabase.from('clientes').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null : null;
}

/** "Buscar" do CNPJ/CPF: 1º o cadastro da empresa (já é cliente?), 2º a Receita (só CNPJ) */
async function consultar(supabase, tenantId, valor) {
  const d = documento(valor);
  if (!d) return { status: 400, erro: 'Digite o CNPJ ou o CPF' };
  if (d === 'invalido') return { status: 400, erro: 'CNPJ/CPF inválido — confira os números' };
  const ja = await porDocumento(supabase, tenantId, d);
  if (ja) return { existente: true, cliente: ja };
  if (d.length === 11) return { existente: false, cliente: { documento: d } }; // CPF: não há consulta pública
  const r = await RC.consultarReceita(d);
  if (r.status === 'nao_encontrado') return { status: 404, erro: 'CNPJ não encontrado na Receita' };
  if (r.status !== 'ok') return { existente: false, sem_receita: true, cliente: { documento: d } }; // Receita fora do ar: segue digitando
  const rf = RC.resumoReceita(r.dados);
  return { existente: false, situacao: rf.situacao, cliente: { documento: d, nome: rf.nome_fantasia || rf.razao_social, razao_social: rf.razao_social, endereco: rf.endereco, numero: rf.numero,
    complemento: rf.complemento, bairro: rf.bairro, cidade: rf.cidade, uf: rf.estado, cep: rf.cep, contato_email: rf.email, contato_telefone: rf.telefone } };
}

async function criar(supabase, tenantId, body = {}) {
  const v = validar(body); if (v.erro) return { status: 400, erro: v.erro };
  if (v.dados.documento) { const ja = await porDocumento(supabase, tenantId, v.dados.documento); if (ja) return { cliente: ja, existente: true }; }
  const { data, error } = await supabase.from('clientes').insert([{ ...v.dados, tenant_id: tenantId, ativo: true }]).select();
  if (error) {
    if (/clientes_documento_unico|duplicate/.test(error.message)) return { cliente: await porDocumento(supabase, tenantId, v.dados.documento), existente: true };
    throw new Error(error.message);
  }
  return { cliente: data[0], existente: false };
}
async function editar(supabase, tenantId, id, body = {}) {
  const c = await doTenant(supabase, tenantId, id); if (!c) return { status: 404, erro: 'Cliente não encontrado' };
  const v = validar(body, true); if (v.erro) return { status: 400, erro: v.erro };
  if (v.dados.documento && v.dados.documento !== c.documento) { const ja = await porDocumento(supabase, tenantId, v.dados.documento); if (ja) return { status: 409, erro: `Esse CNPJ/CPF já é do cliente ${ja.nome}` }; }
  const { data, error } = await supabase.from('clientes').update({ ...v.dados, atualizado_em: new Date().toISOString() }).eq('id', c.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { cliente: data[0] };
}
/** Para o contrato: cliente_id existente OU dados novos (reaproveita pelo CNPJ/CPF) */
async function resolverParaContrato(supabase, tenantId, body = {}) {
  if (body.cliente_id) { const c = await doTenant(supabase, tenantId, body.cliente_id); return c ? { cliente: c } : { status: 400, erro: 'Cliente não encontrado' }; }
  const dados = { nome: body.cliente_nome || body.cliente, razao_social: body.razao_social, documento: body.cliente_doc ?? body.documento, endereco: body.endereco, numero: body.numero, complemento: body.complemento,
    bairro: body.bairro, cidade: body.cidade, uf: body.uf, cep: body.cep, contato_nome: body.contato_nome, contato_email: body.contato_email, contato_telefone: body.contato_telefone };
  for (const k of Object.keys(dados)) if (dados[k] === undefined) delete dados[k];
  return criar(supabase, tenantId, dados);
}

module.exports = { documento, cpfValido, validar, listar, porDocumento, doTenant, consultar, criar, editar, resolverParaContrato };
