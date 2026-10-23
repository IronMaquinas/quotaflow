// backend/services/contratosLocacao.js — etapa 14b.3
//
// 📑 Contratos de locação + perfil "Locatário" (decidido com o Marcony, 22/10/2026):
//   • contrato CL-AAAA-NNNN: cliente, obra, contato, início, fim previsto. Dentro dele, os equipamentos locados
//     (equipamento_locacoes.contrato_id — a locação de cada equipamento continua sendo a da 14b.2).
//   • a empresa cria o ACESSO do locatário (nome, e-mail, senha temporária) → usuário com perfil só "locatario",
//     ligado a um ou mais contratos (locacao_contrato_usuarios). Não conta na cobrança.
//   • o locatário só vê os contratos ATIVOS ligados a ELE: equipamentos, rotinas, inspecionar, histórico.
//     SEGURANÇA: tudo do locatário passa por escopoLocatario(usuarioId) — nunca por id de contrato vindo da tela.
//   • encerrar o contrato encerra as locações que ainda estão abertas e devolve os acessos que ficaram sem contrato
//     ativo (a tela oferece pausar).
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const bcrypt = require('bcryptjs');
const R = require('./rotinasInspecao');
const I = require('./inspecoes');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hojeBR = R.hojeBR;

async function perfisDe(supabase, u) {
  const p = (await q(supabase.from('usuario_perfis').select('*').eq('usuario_id', u.id)).catch(() => [])).map((x) => x.perfil_codigo);
  return p.length ? p : [u.perfil].filter(Boolean);
}
const soLocatario = (perfis) => perfis.length > 0 && perfis.every((p) => p === 'locatario');

async function proximoNumero(supabase, tenantId) {
  const pre = `CL-${hojeBR().slice(0, 4)}-`;
  const l = (await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId))).filter((c) => String(c.numero || '').startsWith(pre));
  const max = l.reduce((mx, c) => Math.max(mx, Number(String(c.numero).slice(pre.length)) || 0), 0);
  return `${pre}${String(max + 1).padStart(4, '0')}`;
}

function validar(body, parcial = false) {
  const out = {}; const tem = (k) => body[k] !== undefined;
  if (!parcial || tem('cliente')) { const c = texto(body.cliente, 160); if (!c) return { erro: 'Informe o cliente' }; out.cliente = c; }
  for (const [k, n] of [['cliente_doc', 20], ['local', 200], ['contato_nome', 120], ['contato_telefone', 30], ['obs', 1000]]) if (tem(k)) out[k] = texto(body[k], n);
  if (tem('contato_email')) { const e = texto(body.contato_email, 160); if (e && !EMAIL.test(e)) return { erro: 'E-mail do contato inválido' }; out.contato_email = e; }
  if (!parcial || tem('inicio')) { if (!DATA.test(String(body.inicio || ''))) return { erro: 'Informe a data de início' }; out.inicio = body.inicio; }
  if (tem('fim_previsto')) { if (body.fim_previsto && !DATA.test(String(body.fim_previsto))) return { erro: 'Fim previsto inválido' }; out.fim_previsto = body.fim_previsto || null; }
  if (out.inicio && out.fim_previsto && out.fim_previsto < out.inicio) return { erro: 'O fim previsto é antes do início' };
  return { dados: out };
}

// ─── visão da empresa (admin, gestor, operação) ─────────────────────────────
async function montar(supabase, tenantId, contratos, { comAcessos = true } = {}) {
  if (!contratos.length) return [];
  const [locs, vinc, usuarios, painel] = await Promise.all([
    q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId)),
    comAcessos ? q(supabase.from('locacao_contrato_usuarios').select('*').eq('tenant_id', tenantId)) : [],
    comAcessos ? q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId)) : [],
    R.painel(supabase, tenantId),
  ]);
  const equips = new Map((await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId))).map((e) => [String(e.id), e]));
  return contratos.map((c) => {
    const minhas = locs.filter((l) => String(l.contrato_id) === String(c.id));
    const equipamentos = minhas.map((l) => { const e = equips.get(String(l.equipamento_id)) || {}; const pe = painel[String(l.equipamento_id)] || {};
      return { locacao_id: l.id, equipamento_id: l.equipamento_id, tag: e.tag, nome: e.nome, ativa: l.status === 'ativa', inicio: l.inicio, fim_real: l.fim_real,
        entrega_inspecao_id: l.entrega_inspecao_id, devolucao_inspecao_id: l.devolucao_inspecao_id, bloqueado: l.status === 'ativa' && !!e.bloqueado,
        rotinas: l.status === 'ativa' ? (pe.rotinas || []).filter((r) => !r.locacao_id || String(r.locacao_id) === String(l.id)) : [] }; })
      .sort((a, b) => (b.ativa - a.ativa) || String(a.tag).localeCompare(String(b.tag)));
    const acessos = vinc.filter((v) => String(v.contrato_id) === String(c.id)).map((v) => { const u = usuarios.find((x) => String(x.id) === String(v.usuario_id)); return u ? { usuario_id: u.id, nome: u.nome, email: u.email, ativo: !!u.ativo } : null; }).filter(Boolean);
    const rot = equipamentos.flatMap((e) => e.rotinas);
    return { ...c, equipamentos, acessos, ativos: equipamentos.filter((e) => e.ativa).length, atrasadas: rot.filter((r) => r.estado === 'atrasada').length };
  });
}
async function listar(supabase, tenantId) {
  const cs = (await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId))).sort((a, b) => (a.status === 'ativo' ? 0 : 1) - (b.status === 'ativo' ? 0 : 1) || String(b.numero).localeCompare(String(a.numero)));
  return montar(supabase, tenantId, cs);
}
async function doTenant(supabase, tenantId, id) {
  return /^\d+$/.test(String(id)) ? (await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null : null;
}
async function criar(supabase, tenantId, quem, body = {}) {
  const v = validar(body); if (v.erro) return { status: 400, erro: v.erro };
  for (let t = 0; t < 5; t++) {
    const numero = await proximoNumero(supabase, tenantId);
    const { data, error } = await supabase.from('locacao_contratos').insert([{ ...v.dados, tenant_id: tenantId, numero, status: 'ativo', criado_por_nome: quem.usuarioNome || null }]).select();
    if (!error) return { contrato: data[0] };
    if (!/locacao_contratos_numero_unico|duplicate/.test(error.message)) throw new Error(error.message);
  }
  throw new Error('Não foi possível numerar o contrato — tente de novo');
}
async function editar(supabase, tenantId, id, body = {}) {
  const c = await doTenant(supabase, tenantId, id); if (!c) return { status: 404, erro: 'Contrato não encontrado' };
  const v = validar({ inicio: c.inicio, ...body }, true); if (v.erro) return { status: 400, erro: v.erro };
  const { data, error } = await supabase.from('locacao_contratos').update(v.dados).eq('id', c.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { contrato: data[0] };
}
async function adicionarEquipamento(supabase, tenantId, quem, id, body = {}) {
  const c = await doTenant(supabase, tenantId, id); if (!c || c.status !== 'ativo') return { status: 400, erro: 'Contrato não encontrado ou encerrado' };
  return R.locar(supabase, tenantId, quem, body.equipamento_id, { contrato_id: c.id, inicio: body.inicio || hojeBR(), local: body.local, rotina: body.rotina || null });
}
async function devolverEquipamento(supabase, tenantId, quem, id, equipId, body = {}) {
  const c = await doTenant(supabase, tenantId, id); if (!c) return { status: 404, erro: 'Contrato não encontrado' };
  const l = (await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id).eq('equipamento_id', equipId))).find((x) => x.status === 'ativa');
  if (!l) return { status: 400, erro: 'Este equipamento não está locado neste contrato' };
  return R.encerrarLocacao(supabase, tenantId, quem, equipId, body);
}
/** Encerra o contrato (e as locações abertas). Devolve os acessos que ficaram sem contrato ativo — a tela oferece pausar. */
async function encerrar(supabase, tenantId, quem, id, body = {}) {
  const c = await doTenant(supabase, tenantId, id); if (!c || c.status !== 'ativo') return { status: 400, erro: 'Contrato não encontrado ou já encerrado' };
  const fim = DATA.test(String(body.fim_real || '')) ? body.fim_real : hojeBR();
  for (const l of (await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id))).filter((x) => x.status === 'ativa')) {
    const r = await R.encerrarLocacao(supabase, tenantId, quem, l.equipamento_id, { fim_real: fim });
    if (r.erro) return r;
  }
  const { error } = await supabase.from('locacao_contratos').update({ status: 'encerrado', fim_real: fim, encerrado_por_nome: quem.usuarioNome || null }).eq('id', c.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return { ok: true, sem_contrato: await acessosSemContratoAtivo(supabase, tenantId, c.id) };
}
async function acessosSemContratoAtivo(supabase, tenantId, contratoId) {
  const vinc = await q(supabase.from('locacao_contrato_usuarios').select('*').eq('tenant_id', tenantId));
  const ativos = new Set((await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId))).filter((c) => c.status === 'ativo').map((c) => String(c.id)));
  const out = [];
  for (const v of vinc.filter((x) => String(x.contrato_id) === String(contratoId))) {
    if (vinc.some((x) => String(x.usuario_id) === String(v.usuario_id) && ativos.has(String(x.contrato_id)))) continue;
    const u = (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId).eq('id', v.usuario_id)))[0];
    if (u && u.ativo) out.push({ usuario_id: u.id, nome: u.nome, email: u.email });
  }
  return out;
}

// ─── acessos do locatário ───────────────────────────────────────────────────
/** Cria (ou liga, se o e-mail já é de um locatário desta empresa) o acesso do locatário ao contrato */
async function criarAcesso(supabase, tenantId, id, body = {}) {
  const c = await doTenant(supabase, tenantId, id); if (!c || c.status !== 'ativo') return { status: 400, erro: 'Contrato não encontrado ou encerrado' };
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL.test(email)) return { status: 400, erro: 'Informe um e-mail válido' };
  let u = (await q(supabase.from('usuarios').select('*').eq('email', email)))[0]; let novo = false;
  if (u) {
    if (String(u.tenant_id) !== String(tenantId)) return { status: 409, erro: 'Esse e-mail já é usado por outro usuário do QuotaFlow' };
    if (!soLocatario(await perfisDe(supabase, u))) return { status: 409, erro: `${email} é um usuário da empresa — o acesso de locatário precisa de um e-mail só dele` };
    const upd = { ativo: 1 };
    if (body.senha) { if (String(body.senha).length < 6) return { status: 400, erro: 'Senha com no mínimo 6 caracteres' }; upd.senha_hash = bcrypt.hashSync(String(body.senha), 10); }
    await supabase.from('usuarios').update(upd).eq('id', u.id).eq('tenant_id', tenantId);
  } else {
    const nome = texto(body.nome, 120); if (!nome) return { status: 400, erro: 'Informe o nome de quem vai acessar' };
    const senha = String(body.senha || ''); if (senha.length < 6) return { status: 400, erro: 'Senha temporária com no mínimo 6 caracteres' };
    const { data, error } = await supabase.from('usuarios').insert([{ tenant_id: tenantId, nome, email, telefone: texto(body.telefone, 30), senha_hash: bcrypt.hashSync(senha, 10), perfil: 'locatario', ativo: 1 }]).select();
    if (error) { if (/check constraint|perfil/.test(error.message)) return { status: 409, erro: 'Rode a migration 043 antes (perfil Locatário)' }; throw new Error(error.message); }
    u = data[0]; novo = true;
    const e1 = await supabase.from('usuario_perfis').insert([{ usuario_id: u.id, perfil_codigo: 'locatario' }]);
    if (e1.error) { await supabase.from('usuarios').delete().eq('id', u.id).eq('tenant_id', tenantId); return { status: 409, erro: 'Rode a migration 043 antes (perfil Locatário)' }; }
  }
  const ja = (await q(supabase.from('locacao_contrato_usuarios').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id).eq('usuario_id', u.id)))[0];
  if (!ja) { const { error } = await supabase.from('locacao_contrato_usuarios').insert([{ tenant_id: tenantId, contrato_id: c.id, usuario_id: u.id }]); if (error) throw new Error(error.message); }
  return { ok: true, usuario: { usuario_id: u.id, nome: u.nome, email: u.email }, novo };
}
async function removerAcesso(supabase, tenantId, id, usuarioId) {
  const c = await doTenant(supabase, tenantId, id); if (!c) return { status: 404, erro: 'Contrato não encontrado' };
  const { error } = await supabase.from('locacao_contrato_usuarios').delete().eq('tenant_id', tenantId).eq('contrato_id', c.id).eq('usuario_id', usuarioId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
/** Pausar (ou reativar) o usuário — só se ele for SÓ locatário */
async function pausarUsuario(supabase, tenantId, usuarioId, ativo = false) {
  const u = (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId).eq('id', usuarioId)))[0];
  if (!u) return { status: 404, erro: 'Usuário não encontrado' };
  if (!soLocatario(await perfisDe(supabase, u))) return { status: 409, erro: 'Não é um acesso de locatário — use 👥 Usuários' };
  const { error } = await supabase.from('usuarios').update({ ativo: ativo ? 1 : 0 }).eq('id', u.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ─── visão do LOCATÁRIO (escopo pelo usuário logado) ────────────────────────
/** Contratos ativos ligados ao usuário + locações ativas desses contratos. É a ÚNICA porta do locatário. */
async function escopoLocatario(supabase, tenantId, usuarioId) {
  const vinc = await q(supabase.from('locacao_contrato_usuarios').select('*').eq('tenant_id', tenantId).eq('usuario_id', usuarioId));
  const ids = new Set(vinc.map((v) => String(v.contrato_id)));
  const contratos = ids.size ? (await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId))).filter((c) => ids.has(String(c.id)) && c.status === 'ativo') : [];
  const cids = new Set(contratos.map((c) => String(c.id)));
  const locacoes = cids.size ? (await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId))).filter((l) => cids.has(String(l.contrato_id))) : [];
  return { contratos, locacoes, ativas: locacoes.filter((l) => l.status === 'ativa') };
}
async function painelLocatario(supabase, tenantId, usuarioId) {
  const esc = await escopoLocatario(supabase, tenantId, usuarioId);
  const cs = (await montar(supabase, tenantId, esc.contratos, { comAcessos: false })).map((c) => ({
    id: c.id, numero: c.numero, cliente: c.cliente, local: c.local, inicio: c.inicio, fim_previsto: c.fim_previsto, ativos: c.ativos, atrasadas: c.atrasadas,
    equipamentos: c.equipamentos.filter((e) => e.ativa).map((e) => ({ equipamento_id: e.equipamento_id, tag: e.tag, nome: e.nome, bloqueado: e.bloqueado, inicio: e.inicio,
      rotinas: e.rotinas.map((r) => ({ id: r.id, modelo_id: r.modelo_id, modelo_nome: r.modelo_nome, frequencia_nome: r.frequencia_nome, responsavel: r.responsavel, estado: r.estado, dias: r.dias, proxima: r.proxima, ultima: r.ultima })) })),
  }));
  const lids = new Set(esc.locacoes.map((l) => String(l.id)));
  const inspecoes = lids.size ? (await I.listar(supabase, tenantId, {})).filter((i) => i.locacao_id != null && lids.has(String(i.locacao_id))) : [];
  return { contratos: cs, inspecoes };
}
/** O locatário só inspeciona equipamento de locação ATIVA dele, com um modelo das rotinas desse equipamento */
async function permissaoInspecao(supabase, tenantId, usuarioId, equipId, modeloId) {
  const esc = await escopoLocatario(supabase, tenantId, usuarioId);
  const l = esc.ativas.find((x) => String(x.equipamento_id) === String(equipId));
  if (!l) return { status: 404, erro: 'Equipamento não encontrado nos seus contratos' };
  const rot = (await q(supabase.from('equipamento_rotinas').select('*').eq('tenant_id', tenantId).eq('equipamento_id', l.equipamento_id))).filter((r) => r.ativo !== false);
  const mid = modeloId || rot[0]?.modelo_id;
  if (!mid || !rot.some((r) => String(r.modelo_id) === String(mid))) return { status: 400, erro: 'A empresa ainda não definiu a inspeção de rotina deste equipamento' };
  return { locacao: l, modeloId: mid, contrato: esc.contratos.find((c) => String(c.id) === String(l.contrato_id)) };
}
async function prepararLocatario(supabase, tenantId, usuarioId, equipId, modeloId) {
  const p = await permissaoInspecao(supabase, tenantId, usuarioId, equipId, modeloId); if (p.erro) return p;
  return I.preparar(supabase, tenantId, p.locacao.equipamento_id, p.modeloId);
}
async function enviarLocatario(supabase, tenantId, usuario, body = {}) {
  const p = await permissaoInspecao(supabase, tenantId, usuario.id, body.equipamento_id, body.modelo_id); if (p.erro) return p;
  return I.enviar(supabase, tenantId, { tipo: 'usuario', usuario_id: usuario.id, nome: usuario.nome || usuario.email, terceiro: { locatario: true, empresa: p.contrato?.cliente || null, contrato: p.contrato?.numero || null } },
    { ...body, equipamento_id: p.locacao.equipamento_id, modelo_id: p.modeloId });
}
async function detalheLocatario(supabase, tenantId, usuarioId, inspId) {
  const esc = await escopoLocatario(supabase, tenantId, usuarioId);
  const r = await I.detalhe(supabase, tenantId, inspId);
  if (r.erro || r.inspecao.locacao_id == null || !esc.locacoes.some((l) => String(l.id) === String(r.inspecao.locacao_id))) return { status: 404, erro: 'Inspeção não encontrada' };
  return r;
}

module.exports = { soLocatario, perfisDe, validar, listar, criar, editar, adicionarEquipamento, devolverEquipamento, encerrar, criarAcesso, removerAcesso, pausarUsuario,
  escopoLocatario, painelLocatario, permissaoInspecao, prepararLocatario, enviarLocatario, detalheLocatario };
