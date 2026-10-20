// routes/manutencao.js — etapas 12a/12b: calendário de manutenção, planos recorrentes, valor da hora
// Registrado no server.js com tenantMiddleware: app.use('/api/manutencao', tenantMiddleware, ...)
//
// Leitura: todo usuário do tenant. Gravação (planos, gerar OS, valor da hora):
// perfis admin, gestor ou operacao (os mesmos que criam OS).
// Transferir responsabilidade (12b.2): só admin e gestor.
const express = require('express');
const router = express.Router();
const { supabase, DB } = require('../db');
const { montarCalendario, carregar, buscarValorHora } = require('../services/calendarioManutencao');
const planos = require('../services/planosManutencao');
const documentosSrv = require('../services/documentos'); // 12c: camada Documentos no calendário
const epiEntregasSrv = require('../services/epiEntregas'); // 12d.3: camada 🦺 EPI no calendário
const treinamentosSrv = require('../services/treinamentos'); // 12e.1: camada 🎓 Treinamentos no calendário

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const PODE_EDITAR = ['admin', 'gestor', 'operacao'];
const PODE_TRANSFERIR = ['admin', 'gestor'];
const perfisDe = (req) => (Array.isArray(req.perfis) && req.perfis.length ? req.perfis : [req.userPerfil].filter(Boolean));

function podeEditar(req) {
  return perfisDe(req).some((p) => PODE_EDITAR.includes(p));
}
function exigirEdicao(req, res, next) {
  if (!req.tenantId) return res.status(401).json({ erro: 'Não autenticado' });
  if (!podeEditar(req)) return res.status(403).json({ erro: 'Seu perfil não pode alterar planos de manutenção' });
  next();
}
function exigirTenant(req, res, next) {
  if (!req.tenantId) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}
const q = async (p) => { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; };

async function usuarioAtual(req) {
  let nome = null;
  try { nome = (await DB.selectOne('usuarios', { id: req.userId }, req.tenantId))?.nome || null; } catch (_) {}
  return { id: req.userId || null, nome, email: req.userEmail || null };
}

// Plano do tenant (ou null). Nunca devolve plano de outro tenant.
async function planoDoTenant(req, id) {
  if (!/^\d+$/.test(String(id))) return null;
  const l = await q(supabase.from('planos_manutencao').select('*').eq('tenant_id', req.tenantId).eq('id', id));
  return l[0] || null;
}

// Usuários ativos do tenant (para "responsável")
async function usuariosDoTenant(req) {
  const l = await q(supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId));
  return l.filter((u) => u.ativo !== false && u.ativo !== 0)
    .map((u) => ({ id: u.id, nome: u.nome || u.email || 'Usuário', perfil: u.perfil || null }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}
async function usuarioDoTenant(req, id) {
  if (!id) return null;
  const l = await q(supabase.from('usuarios').select('*').eq('tenant_id', req.tenantId).eq('id', id));
  return l[0] || null;
}

// Equipamento, modelo e responsável precisam ser do próprio tenant
async function conferirVinculos(req, dados) {
  if (dados.responsavel_id) {
    const u = await usuarioDoTenant(req, dados.responsavel_id).catch(() => null);
    if (!u || u.ativo === false || u.ativo === 0) return 'Responsável não encontrado (ou inativo)';
  }
  if (dados.equipamento_id) {
    const e = await DB.selectOne('equipamentos', { id: dados.equipamento_id }, req.tenantId);
    if (!e || String(e.tenant_id) !== String(req.tenantId)) return 'Equipamento não encontrado';
  }
  if (dados.template_id) {
    const t = await DB.selectOne('os_templates', { id: dados.template_id }, req.tenantId);
    if (!t || String(t.tenant_id) !== String(req.tenantId)) return 'Modelo de manutenção não encontrado';
  }
  return null;
}

// Coluna de migration ainda não rodada → 409 com o que fazer
function erroMigration(res, err) {
  const m = String(err?.message || '');
  if (/responsavel_id|regra_dia_util/.test(m)) return res.status(409).json({ erro: 'Rode a migration 021 antes (responsável / dia útil)' });
  if (/termina_em/.test(m)) return res.status(409).json({ erro: 'Rode a migration 020 antes (coluna termina_em não existe)' });
  return null;
}

function erro500(res, onde, err) {
  console.error(`❌ [manutencao/${onde}]`, err.message);
  res.status(500).json({ erro: 'Erro interno — veja o log do servidor' });
}

// ─── Calendário (12a) ────────────────────────────────────────────────────
// GET /api/manutencao/calendario?de=2026-01-01&ate=2026-12-31&equipamento_id=
router.get('/calendario', exigirTenant, async (req, res) => {
  try {
    const { de, ate } = req.query;
    if (!DATA.test(String(de || '')) || !DATA.test(String(ate || ''))) {
      return res.status(400).json({ erro: 'Informe de e ate no formato AAAA-MM-DD' });
    }
    if (de > ate) return res.status(400).json({ erro: '"de" depois de "ate"' });
    if ((new Date(ate) - new Date(de)) / 86400000 > 400) return res.status(400).json({ erro: 'Intervalo máximo de 400 dias' });

    const equipamentoId = req.query.equipamento_id ? String(req.query.equipamento_id) : null;
    const dados = await carregar(supabase, req.tenantId, { de, ate, equipamentoId });
    const cal = montarCalendario(dados);
    const nomes = new Map((await usuariosDoTenant(req).catch(() => [])).map((u) => [String(u.id), u.nome]));
    for (const o of cal.os) o.responsavel = o.responsavel_id ? (nomes.get(String(o.responsavel_id)) || null) : null;

    // 12b.4: ocorrências dos planos que ainda não viraram OS (sem migration; se a 019 não rodou, vem vazio)
    let previstas = [];
    try {
      previstas = await planos.previstasNoIntervalo(supabase, req.tenantId, de, ate, { equipamentoId });
      const eqIds = [...new Set(previstas.map((p) => p.equipamento_id).filter(Boolean))];
      const eqs = eqIds.length ? await q(supabase.from('equipamentos').select('id, tag, nome').eq('tenant_id', req.tenantId).in('id', eqIds)) : [];
      const eqPor = new Map(eqs.map((e) => [String(e.id), `${e.tag ? e.tag + ' - ' : ''}${e.nome || ''}`]));
      for (const p of previstas) {
        p.equipamento = p.equipamento_id ? (eqPor.get(String(p.equipamento_id)) || null) : null;
        p.responsavel = p.responsavel_id ? (nomes.get(String(p.responsavel_id)) || null) : null;
      }
    } catch (e) {
      console.warn('⚠ [manutencao/calendario] previstas indisponíveis:', e.message);
    }
    const totalPrevisto = Math.round(previstas.reduce((s, p) => s + (p.custo?.total || 0), 0) * 100) / 100;

    // 12c: camada "Documentos" — vencimentos no intervalo (sem a migration 022, vem vazio)
    let documentos = [];
    try {
      const docs = await documentosSrv.documentosNoIntervalo(supabase, req.tenantId, de, ate,
        equipamentoId ? { alvoTipo: 'equipamento', equipamentoId } : {});
      documentos = docs.map((d) => ({ id: d.id, alvo_tipo: d.alvo_tipo, alvo_nome: d.alvo_nome, tipo_nome: d.tipo_nome, numero: d.numero,
        vence_em: String(d.vence_em).slice(0, 10), situacao: d.situacao, dias: d.dias, tem_arquivo: d.tem_arquivo,
        responsavel_id: d.responsavel_id || null, responsavel: d.responsavel_id ? (nomes.get(String(d.responsavel_id)) || null) : null }));
    } catch (e) {
      if (!/documentos|relation|does not exist/.test(e.message)) console.warn('⚠ [manutencao/calendario] documentos indisponíveis:', e.message);
    }
    // 12d.3: camada "EPI" — trocas de EPI em uso e validade de CA (sem as migrations 026/028, vem vazio)
    let epi = [];
    if (!equipamentoId) {
      try { epi = await epiEntregasSrv.eventosNoIntervalo(supabase, req.tenantId, de, ate); }
      catch (e) { if (!/epi_|colaboradores|relation|does not exist|schema cache/.test(e.message)) console.warn('⚠ [manutencao/calendario] EPI indisponível:', e.message); }
    }
    // 12e.1: camada "Treinamentos" — turmas agendadas e vencimentos (sem a migration 030, vem vazio)
    let treinamentos = [];
    if (!equipamentoId) {
      try { treinamentos = await treinamentosSrv.eventosNoIntervalo(supabase, req.tenantId, de, ate); }
      catch (e) { if (!/treinamento|funcoes|colaboradores|relation|does not exist|schema cache/.test(e.message)) console.warn('⚠ [manutencao/calendario] treinamentos indisponíveis:', e.message); }
    }
    res.json({ de, ate, valor_hora: dados.valorHora || null, eu: req.userId || null, ...cal,
      previstas, totais_previstas: { quantidade: previstas.length, total: totalPrevisto }, documentos, epi, treinamentos });
  } catch (err) { erro500(res, 'calendario', err); }
});

// ─── Valor da hora (12b) ─────────────────────────────────────────────────
router.get('/config', exigirTenant, async (req, res) => {
  try {
    res.json({ valor_hora: await buscarValorHora(supabase, req.tenantId), pode_editar: podeEditar(req) });
  } catch (err) { erro500(res, 'config', err); }
});

router.put('/config', exigirEdicao, async (req, res) => {
  try {
    const bruto = req.body?.valor_hora;
    const v = bruto === null || bruto === '' || bruto === undefined ? null : Number(String(bruto).replace(',', '.'));
    if (v !== null && !(v >= 0 && v <= 100000)) return res.status(400).json({ erro: 'Valor da hora inválido' });
    const { error } = await supabase.from('tenants').update({ valor_hora: v }).eq('id', req.tenantId);
    if (error) {
      if (/valor_hora/.test(error.message)) return res.status(409).json({ erro: 'Rode a migration 019 antes (coluna valor_hora não existe)' });
      throw new Error(error.message);
    }
    res.json({ ok: true, valor_hora: v });
  } catch (err) { erro500(res, 'config', err); }
});

// ─── Planos (12b) ────────────────────────────────────────────────────────
// GET /api/manutencao/planos — lista com nome do equipamento/modelo e OS futuras já geradas
router.get('/planos', exigirTenant, async (req, res) => {
  try {
    const lista = await q(supabase.from('planos_manutencao').select('*').eq('tenant_id', req.tenantId));
    const eqIds = [...new Set(lista.map((p) => p.equipamento_id).filter(Boolean))];
    const tpIds = [...new Set(lista.map((p) => p.template_id).filter(Boolean))];
    const eqs = eqIds.length ? await q(supabase.from('equipamentos').select('id, tag, nome').eq('tenant_id', req.tenantId).in('id', eqIds)) : [];
    const tps = tpIds.length ? await q(supabase.from('os_templates').select('id, nome').eq('tenant_id', req.tenantId).in('id', tpIds)) : [];
    const ids = lista.map((p) => p.id);
    const osGeradas = ids.length
      ? await q(supabase.from('chamados').select('origem_plano_id, origem_plano_data, cancelada_em').eq('tenant_id', req.tenantId).in('origem_plano_id', ids))
      : [];
    const hoje = planos.janela().de;
    const nomes = new Map((await usuariosDoTenant(req).catch(() => [])).map((u) => [String(u.id), u.nome]));
    const eqPor = new Map(eqs.map((e) => [String(e.id), e]));
    const tpPor = new Map(tps.map((t) => [String(t.id), t]));
    const out = lista.map((p) => {
      const os = osGeradas.filter((o) => String(o.origem_plano_id) === String(p.id) && !o.cancelada_em);
      const futuras = os.filter((o) => String(o.origem_plano_data) >= hoje).map((o) => String(o.origem_plano_data)).sort();
      const e = eqPor.get(String(p.equipamento_id));
      return {
        ...p,
        equipamento: e ? `${e.tag ? e.tag + ' - ' : ''}${e.nome || ''}` : null,
        modelo: tpPor.get(String(p.template_id))?.nome || null,
        responsavel: p.responsavel_id ? (nomes.get(String(p.responsavel_id)) || 'Usuário inativo') : null,
        os_futuras: futuras.length,
        geradas_ate: futuras[futuras.length - 1] || null,
        // 12b.1: OS já geradas depois do término (término encurtado) — só avisa, não cancela
        os_apos_termino: p.termina_em ? futuras.filter((d) => d > String(p.termina_em).slice(0, 10)).length : 0,
        encerrado: !!(p.termina_em && String(p.termina_em).slice(0, 10) < hoje),
      };
    }).sort((a, b) => (b.ativo - a.ativo) || String(a.nome).localeCompare(String(b.nome)));
    res.json({ planos: out, pode_editar: podeEditar(req), pode_transferir: perfisDe(req).some((p) => PODE_TRANSFERIR.includes(p)) });
  } catch (err) {
    if (/planos_manutencao/.test(err.message)) return res.status(409).json({ erro: 'Rode a migration 019 antes (tabela planos_manutencao não existe)' });
    erro500(res, 'planos', err);
  }
});

router.post('/planos', exigirEdicao, async (req, res) => {
  try {
    const { erros, dados } = planos.validarPlano(req.body || {});
    if (erros.length) return res.status(400).json({ erro: erros[0], erros });
    const vinc = await conferirVinculos(req, dados);
    if (vinc) return res.status(400).json({ erro: vinc });
    const { data, error } = await supabase.from('planos_manutencao')
      .insert([{ ...dados, tenant_id: req.tenantId, criado_por: req.userId ? String(req.userId) : null }]).select();
    if (error) {
      if (erroMigration(res, error)) return;
      throw new Error(error.message);
    }
    res.status(201).json(data[0]);
  } catch (err) { erro500(res, 'planos', err); }
});

router.put('/planos/:id', exigirEdicao, async (req, res) => {
  try {
    const plano = await planoDoTenant(req, req.params.id);
    if (!plano) return res.status(404).json({ erro: 'Plano não encontrado' });
    const { erros, dados } = planos.validarPlano(req.body || {}, { parcial: true });
    if (erros.length) return res.status(400).json({ erro: erros[0], erros });
    // edição parcial: confere término × próxima data com o que já está gravado
    const prox = dados.proxima_data || String(plano.proxima_data).slice(0, 10);
    const fim = dados.termina_em !== undefined ? dados.termina_em : (plano.termina_em ? String(plano.termina_em).slice(0, 10) : null);
    if (fim && fim < prox) return res.status(400).json({ erro: 'O término não pode ser antes da próxima manutenção' });
    const vinc = await conferirVinculos(req, dados);
    if (vinc) return res.status(400).json({ erro: vinc });
    const { data, error } = await supabase.from('planos_manutencao')
      .update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', plano.id).eq('tenant_id', req.tenantId).select();
    if (error) {
      if (erroMigration(res, error)) return;
      throw new Error(error.message);
    }
    res.json(data[0]);
  } catch (err) { erro500(res, 'planos', err); }
});

// "Excluir" = desativar: as OS já geradas continuam (e a trava contra duplicar também)
router.delete('/planos/:id', exigirEdicao, async (req, res) => {
  try {
    const plano = await planoDoTenant(req, req.params.id);
    if (!plano) return res.status(404).json({ erro: 'Plano não encontrado' });
    const { error } = await supabase.from('planos_manutencao').update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', plano.id).eq('tenant_id', req.tenantId);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) { erro500(res, 'planos', err); }
});

// GET /api/manutencao/planos/:id/previa — o que "Gerar OS (12 meses)" vai criar (nada é gravado)
router.get('/planos/:id/previa', exigirTenant, async (req, res) => {
  try {
    const plano = await planoDoTenant(req, req.params.id);
    if (!plano) return res.status(404).json({ erro: 'Plano não encontrado' });
    res.json(await planos.previa(supabase, req.tenantId, plano));
  } catch (err) { erro500(res, 'previa', err); }
});

// POST /api/manutencao/planos/:id/gerar — cria as OS que faltam nos próximos 12 meses
router.post('/planos/:id/gerar', exigirEdicao, async (req, res) => {
  try {
    const plano = await planoDoTenant(req, req.params.id);
    if (!plano) return res.status(404).json({ erro: 'Plano não encontrado' });
    if (!plano.ativo) return res.status(400).json({ erro: 'Plano desativado — ative antes de gerar OS' });
    const datas = Array.isArray(req.body?.datas) ? req.body.datas.filter((d) => DATA.test(String(d))) : undefined;
    if (Array.isArray(req.body?.datas) && !datas.length) return res.status(400).json({ erro: 'Marque ao menos uma data' });
    let r;
    try {
      r = await planos.gerar(supabase, req.tenantId, plano, await usuarioAtual(req), { datas, semItens: req.body?.sem_itens === true });
    } catch (e) {
      if (e.code === 'sem_modelo') return res.status(400).json({ erro: e.message, codigo: 'sem_modelo' });
      throw e;
    }
    res.status(201).json({ ...r, mensagem: `${r.criadas.length} OS criada(s)${r.puladas ? `, ${r.puladas} já existia(m)` : ''}` });
  } catch (err) { erro500(res, 'gerar', err); }
});

// ─── Usuários e responsabilidade (12b.2) ─────────────────────────────────
// GET /api/manutencao/usuarios — usuários ativos do tenant (para escolher responsável)
router.get('/usuarios', exigirTenant, async (req, res) => {
  try { res.json({ usuarios: await usuariosDoTenant(req), eu: req.userId || null, pode_transferir: perfisDe(req).some((p) => PODE_TRANSFERIR.includes(p)), pode_editar: podeEditar(req) }); }
  catch (err) { erro500(res, 'usuarios', err); }
});

function exigirTransferencia(req, res, next) {
  if (!req.tenantId) return res.status(401).json({ erro: 'Não autenticado' });
  if (!perfisDe(req).some((p) => PODE_TRANSFERIR.includes(p))) return res.status(403).json({ erro: 'Só admin ou gestor transferem responsabilidade' });
  next();
}

// O que a transferência vai mover: planos do usuário + OS dele ainda não concluídas/canceladas
async function alvoTransferencia(req, de) {
  const pls = await q(supabase.from('planos_manutencao').select('id, nome, ativo').eq('tenant_id', req.tenantId).eq('responsavel_id', de));
  const os = (await q(supabase.from('chamados').select('id, numero, tipo_documento, concluida_em, cancelada_em, data_inicio_prevista')
    .eq('tenant_id', req.tenantId).eq('responsavel_id', de)))
    .filter((c) => (c.tipo_documento || 'os') === 'os' && !c.concluida_em && !c.cancelada_em);
  return { planos: pls, os };
}

async function validarTransferencia(req, de, para) {
  if (!de || !para) return 'Escolha de quem e para quem';
  if (String(de) === String(para)) return 'Escolha duas pessoas diferentes';
  const uDe = await usuarioDoTenant(req, de).catch(() => null);
  const uPara = await usuarioDoTenant(req, para).catch(() => null);
  if (!uDe) return 'Usuário de origem não encontrado';
  if (!uPara || uPara.ativo === false || uPara.ativo === 0) return 'Usuário de destino não encontrado (ou inativo)';
  return { uDe, uPara };
}

// GET /api/manutencao/responsaveis/previa?de=&para=
router.get('/responsaveis/previa', exigirTransferencia, async (req, res) => {
  try {
    const v = await validarTransferencia(req, req.query.de, req.query.para);
    if (typeof v === 'string') return res.status(400).json({ erro: v });
    const alvo = await alvoTransferencia(req, req.query.de);
    res.json({ de: v.uDe.nome, para: v.uPara.nome, planos: alvo.planos.length, os: alvo.os.length,
      os_numeros: alvo.os.map((o) => o.numero).sort().slice(0, 50) });
  } catch (err) { if (erroMigration(res, err)) return; erro500(res, 'transferir', err); }
});

// POST /api/manutencao/responsaveis/transferir { de, para }
router.post('/responsaveis/transferir', exigirTransferencia, async (req, res) => {
  try {
    const { de, para } = req.body || {};
    const v = await validarTransferencia(req, de, para);
    if (typeof v === 'string') return res.status(400).json({ erro: v });
    const alvo = await alvoTransferencia(req, de);
    const quem = await usuarioAtual(req);
    if (alvo.planos.length) {
      const { error } = await supabase.from('planos_manutencao').update({ responsavel_id: para, atualizado_em: new Date().toISOString() })
        .eq('tenant_id', req.tenantId).in('id', alvo.planos.map((p) => p.id));
      if (error) throw new Error(error.message);
    }
    for (let i = 0; i < alvo.os.length; i += 200) {
      const ids = alvo.os.slice(i, i + 200).map((o) => o.id);
      const { error } = await supabase.from('chamados').update({ responsavel_id: para }).eq('tenant_id', req.tenantId).in('id', ids);
      if (error) throw new Error(error.message);
    }
    // histórico em cada OS (não bloqueia)
    const desc = `Responsabilidade transferida de ${v.uDe.nome || 'usuário'} para ${v.uPara.nome || 'usuário'}${quem.nome ? ` por ${quem.nome}` : ''}`;
    for (let i = 0; i < alvo.os.length; i += 200) {
      try {
        await supabase.from('chamado_eventos').insert(alvo.os.slice(i, i + 200).map((o) => ({ tenant_id: req.tenantId, chamado_id: o.id, tipo: 'transferencia_responsavel',
          descricao: desc, dados: { de, para }, criado_por: quem.id, criado_por_nome: quem.nome })));
      } catch (_) {}
    }
    res.json({ ok: true, planos: alvo.planos.length, os: alvo.os.length,
      mensagem: `${alvo.planos.length} plano(s) e ${alvo.os.length} OS transferidos para ${v.uPara.nome}` });
  } catch (err) { if (erroMigration(res, err)) return; erro500(res, 'transferir', err); }
});

// PUT /api/manutencao/os/:id/responsavel { para, motivo } — define/transfere o responsável de UMA OS (12b.3)
// Só admin e gestor. Vale para OS do plano e OS avulsa; não mexe no plano (as próximas
// OS geradas continuam com o responsável do plano). OS concluída/cancelada não muda.
router.put('/os/:id/responsavel', exigirTransferencia, async (req, res) => {
  try {
    const { para, motivo } = req.body || {};
    if (!para) return res.status(400).json({ erro: 'Escolha o novo responsável' });
    const l = await q(supabase.from('chamados').select('*').eq('tenant_id', req.tenantId).eq('id', req.params.id));
    const os = l[0];
    if (!os || (os.tipo_documento || 'os') !== 'os') return res.status(404).json({ erro: 'OS não encontrada' });
    if (os.concluida_em || os.cancelada_em) return res.status(400).json({ erro: `${os.numero} está ${os.concluida_em ? 'concluída' : 'cancelada'} — o responsável não muda` });
    if (String(os.responsavel_id || '') === String(para)) return res.status(400).json({ erro: 'Essa pessoa já é a responsável' });
    const uPara = await usuarioDoTenant(req, para).catch(() => null);
    if (!uPara || uPara.ativo === false || uPara.ativo === 0) return res.status(400).json({ erro: 'Responsável não encontrado (ou inativo)' });
    const uDe = os.responsavel_id ? await usuarioDoTenant(req, os.responsavel_id).catch(() => null) : null;
    const { error } = await supabase.from('chamados').update({ responsavel_id: para }).eq('id', os.id).eq('tenant_id', req.tenantId);
    if (error) { if (erroMigration(res, error)) return; throw new Error(error.message); }
    const quem = await usuarioAtual(req);
    const obs = String(motivo || '').trim().slice(0, 300);
    const desc = (uDe ? `Responsabilidade transferida de ${uDe.nome || 'usuário'} para ${uPara.nome}` : `Responsável definido: ${uPara.nome}`)
      + (quem.nome ? ` por ${quem.nome}` : '') + (obs ? ` — ${obs}` : '');
    try {
      await supabase.from('chamado_eventos').insert([{ tenant_id: req.tenantId, chamado_id: os.id, tipo: 'transferencia_responsavel',
        descricao: desc, dados: { de: os.responsavel_id || null, para, motivo: obs || null }, criado_por: quem.id, criado_por_nome: quem.nome }]);
    } catch (_) {}
    res.json({ ok: true, responsavel_id: para, responsavel: uPara.nome, mensagem: `${os.numero} agora é de ${uPara.nome}` });
  } catch (err) { if (erroMigration(res, err)) return; erro500(res, 'os/responsavel', err); }
});

module.exports = router;
