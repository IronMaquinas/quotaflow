// backend/routes/meusProcedimentos.js — etapa 18zz.2: 📘 "Procedimentos" do COLABORADOR logado (/api/meus-procedimentos)
//   Lista os documentos de gestão VIGENTES distribuídos para ele (todos ou a função dele), abre o texto e confirma
//   "Li e entendi" (por revisão — nova revisão pede nova leitura). Só leitura: nada do resto de 📁 Documentos.
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const DG = require('../services/documentosGestao');
const D = require('../services/documentos');
const P = require('../services/provaOnline');

async function eu(req, res) {
  const col = await P.colaboradorDoUsuario(supabase, req.tenantId, req.userId);
  if (!col) { res.status(409).json({ erro: 'Seu usuário não está ligado a um colaborador — peça ao RH/gestor para ligar em 👷 Pessoas → Acesso.', codigo: 'sem_colaborador' }); return null; }
  return col;
}
const falha = (res, err) => { if (/distribuicao|documentos_gestao/.test(String(err?.message || ''))) return res.json({ documentos: [], sem_tabela: true }); console.error('❌ [meus-procedimentos]', err.message); res.status(err.status || 500).json({ erro: err.status ? err.message : 'Erro ao carregar os procedimentos' }); };

router.get('/', async (req, res) => {
  try { const col = await eu(req, res); if (!col) return; res.json({ documentos: await DG.meusProcedimentos(supabase, req.tenantId, col, req.userId) }); } catch (err) { falha(res, err); }
});
router.get('/:id', async (req, res) => {
  try {
    const col = await eu(req, res); if (!col) return;
    const d = await DG.obter(supabase, req.tenantId, req.params.id);
    if (!d || d.status !== 'vigente' || !DG.alcanca(d.distribuicao, col)) return res.status(404).json({ erro: 'Documento não disponível para você' });
    const lido = (await DG.leituras(supabase, req.tenantId, d.id, d.revisao)).some((x) => String(x.usuario_id) === String(req.userId));
    const { rascunho, fluxo, ...doc } = d;
    res.json({ documento: { ...doc, arquivo_url: d.arquivo_path ? await D.linkArquivo(supabase, d.arquivo_path) : null, assinatura: DG.conferirAssinatura(d) }, lido });
  } catch (err) { falha(res, err); }
});
router.post('/:id/leitura', async (req, res) => {
  try {
    const col = await eu(req, res); if (!col) return;
    const d = await DG.obter(supabase, req.tenantId, req.params.id);
    if (!d || d.status !== 'vigente' || !DG.alcanca(d.distribuicao, col)) return res.status(404).json({ erro: 'Documento não disponível para você' });
    res.json(await DG.confirmarLeitura(supabase, req.tenantId, d.id, { usuarioId: req.userId, usuarioNome: col.nome }));
  } catch (err) { falha(res, err); }
});

module.exports = router;
