// backend/routes/spot.js
const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const fornecedorMiddleware = require('../middleware/fornecedorMiddleware');

const StorageSpot = require('../services/StorageSpot');
const { normalizarDemanda } = require('../services/atuacao'); // segmento, sistema, ofertas aceitas (etapa 4)
const { contextoDoFornecedor, pontuarDemanda, normalizarUF, ufDoTenant } = require('../services/matchSpot'); // Match Score (etapa 6)

const { enviarAlertaImediato } = require('../services/recomendacoesEmail'); // e-mail Pro (etapa 8)
const { exigirAcessoSpot } = require('../services/acessoSpot'); // só fornecedor verificado (global) vê o Spot (etapa 10c)

const URGENCIAS = ['baixa', 'media', 'alta'];

// Campos que o comprador preenche — usados na criação e na edição da demanda.
// Devolve { erro } ou { dados }.
async function lerCamposDemanda(b, tenantId) {
  const descricao = String(b.descricao_equipamento || '').trim();
  const componente = String(b.componente || '').trim();
  const quantidade = Number(b.quantidade);
  if (!descricao || !componente || !(quantidade >= 1)) {
    return { erro: 'Equipamento, componente e quantidade (mínimo 1) são obrigatórios' };
  }
  // Estado onde precisa da peça: o informado, ou a região da empresa
  let uf = normalizarUF(b.uf);
  if (!uf) uf = ufDoTenant(await DB.selectOne('tenants', { id: tenantId }));
  return {
    dados: {
      descricao_equipamento: descricao,
      marca_modelo: b.marca_modelo ? String(b.marca_modelo).trim() : null,
      componente,
      part_number: b.part_number ? String(b.part_number).trim() : null,
      quantidade,
      comentarios: b.comentarios ? String(b.comentarios).trim() : null,
      urgencia: URGENCIAS.includes(b.urgencia) ? b.urgencia : 'media',
      uf,
      ...(await normalizarDemanda(DB, b)),
    },
  };
}

// ─── COMPRADOR ────────────────────────────────────────────────

router.get('/demandas', tenantMiddleware, async (req, res) => {
  try {
    const demandas = await DB.select('demandas_spot', {}, req.tenantId);
    const interesses = await DB.select('interesses_spot', {}, req.tenantId);

    const visualizacoes = await DB.select('demandas_spot_visualizacoes', {});
    const visPorDemanda = {};
    for (const v of visualizacoes) {
      visPorDemanda[v.demanda_id] = (visPorDemanda[v.demanda_id] || 0) + 1;
    }

    const fornIds = [...new Set(interesses.map(i => i.fornecedor_id))];
    // req.fornecedorId (fornecedorMiddleware) vem de fornecedor_usuarios.fornecedor_id,
    // que aponta para a tabela `fornecedores`. Antes isto lia `fornecedores_spot` e só
    // funcionava porque o Global Peças tem o mesmo id (7) nas duas tabelas.
    const fornecedores = fornIds.length ? await DB.select('fornecedores', {}) : [];
    const fornById = {};
    const idsInteressados = new Set(fornIds.map(String)); // bigint pode vir como string do node-pg
    for (const f of fornecedores) if (idsInteressados.has(String(f.id))) fornById[f.id] = f;

    // Gera signed URLs das fotos (batch)
    const pathsFoto = (demandas || []).map(d => d.foto_path).filter(Boolean);
    const fotosMap = {};
    for (const p of pathsFoto) {
      fotosMap[p] = await StorageSpot.gerarSignedUrl(p);
    }

    const result = (demandas || []).map(d => {
      const meus = interesses.filter(i => i.demanda_id === d.id);
      return {
        ...d,
        foto_url: d.foto_path ? (fotosMap[d.foto_path] || null) : null,
        total_interesses: meus.length,
        total_visualizacoes: visPorDemanda[d.id] || 0,
        visualizada: !!d.visualizada_em,
        visualizada_em: d.visualizada_em || null,
        interesses: meus.map(i => {
          const f = fornById[i.fornecedor_id] || {};
          return {
            id: i.id,
            fornecedor_id: i.fornecedor_id,
            // nome_fantasia/email_contato vêm do "Meus Dados" do fornecedor; nome/email, do cadastro do tenant
            fornecedor_nome: f.nome_fantasia || f.nome || 'Fornecedor',
            fornecedor_email: f.email_contato || f.email || null,
            fornecedor_telefone: f.telefone || null,
            fornecedor_whatsapp: f.whatsapp || null,
            mensagem: i.mensagem,
            valor_estimado: i.valor_estimado,
            observacao_fornecedor: i.observacao_fornecedor,
            status: i.status,
            criado_em: i.criado_em,
          };
        }).sort((a, b) => {
          // quem informou valor vem primeiro, menor valor primeiro
          const va = a.valor_estimado != null ? Number(a.valor_estimado) : Infinity;
          const vb = b.valor_estimado != null ? Number(b.valor_estimado) : Infinity;
          return va - vb;
        }),
      };
    });

    res.json(result);
  } catch (err) {
    console.error('❌ GET /spot/demandas:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /spot/demandas/:id/foto — upload de foto (comprador)
router.post('/demandas/:id/foto', tenantMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const demanda = await DB.selectOne('demandas_spot', { id }, req.tenantId);
    if (!demanda) return res.status(404).json({ erro: 'Demanda não encontrada' });

    const arquivo = req.files?.foto;
    if (!arquivo) return res.status(400).json({ erro: 'Arquivo não enviado' });
    if (!String(arquivo.mimetype || '').startsWith('image/')) {
      return res.status(400).json({ erro: 'O arquivo precisa ser uma imagem' });
    }

    const fotoAntiga = demanda.foto_path || null;

    const path = await StorageSpot.subirFotoDemanda({
      tenantId: req.tenantId,
      numero: demanda.numero || `DSP-${String(demanda.id).padStart(4, '0')}`,
      mimeType: arquivo.mimetype,
      buffer: arquivo.data,
    });

    await DB.update('demandas_spot', id, { foto_path: path }, req.tenantId);

    // Ao trocar a foto, apaga a anterior do storage (se o caminho for diferente).
    // Falha aqui não deve quebrar o upload: só registra no log.
    if (fotoAntiga && fotoAntiga !== path && typeof StorageSpot.removerArquivo === 'function') {
      try {
        await StorageSpot.removerArquivo(fotoAntiga);
      } catch (e) {
        console.warn('⚠️ Não foi possível remover a foto antiga:', fotoAntiga, e.message);
      }
    }
    const foto_url = await StorageSpot.gerarSignedUrl(path);
    res.json({ ok: true, foto_path: path, foto_url });
  } catch (err) {
    console.error('❌ POST /spot/demandas/:id/foto:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /spot/demandas/:id/encerrar — comprador encerra a demanda
const MOTIVOS_VALIDOS = ['comprado_canal', 'comprado_fora', 'nao_necessario', 'outro'];

router.post('/demandas/:id/encerrar', tenantMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const demanda = await DB.selectOne('demandas_spot', { id }, req.tenantId);
    if (!demanda) return res.status(404).json({ erro: 'Demanda não encontrada' });
    if (demanda.status === 'encerrada') return res.status(400).json({ erro: 'Demanda já está encerrada' });

    const { motivo, fornecedor_vencedor_id, observacao } = req.body || {};
    if (!MOTIVOS_VALIDOS.includes(motivo)) {
      return res.status(400).json({ erro: 'Motivo de encerramento inválido' });
    }

    let vencedorId = null;
    if (motivo === 'comprado_canal') {
      vencedorId = Number(fornecedor_vencedor_id);
      if (!vencedorId) return res.status(400).json({ erro: 'Informe o fornecedor escolhido' });
      // O vencedor precisa ser um dos fornecedores que manifestaram interesse
      const interesse = await DB.selectOne('interesses_spot', { demanda_id: id, fornecedor_id: vencedorId });
      if (!interesse) return res.status(400).json({ erro: 'Esse fornecedor não manifestou interesse na demanda' });
    }

    await DB.update('demandas_spot', id, {
      status: 'encerrada',
      encerrada_em: new Date().toISOString(),
      encerramento_motivo: motivo,
      fornecedor_vencedor_id: vencedorId,
      encerramento_observacao: observacao ? String(observacao).trim() || null : null,
    }, req.tenantId);

    // Retorno para os fornecedores: marca quem foi escolhido e quem não foi.
    // (A tela do fornecedor vai usar esse status para mostrar o resultado.)
    const interesses = await DB.select('interesses_spot', { demanda_id: id }, req.tenantId);
    for (const i of interesses) {
      const novoStatus = vencedorId && i.fornecedor_id === vencedorId ? 'escolhido' : 'nao_escolhido';
      await DB.update('interesses_spot', i.id, { status: novoStatus }, req.tenantId);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /spot/demandas/:id/encerrar:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /spot/demandas/:id/reabrir — comprador reabre a demanda
router.post('/demandas/:id/reabrir', tenantMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const demanda = await DB.selectOne('demandas_spot', { id }, req.tenantId);
    if (!demanda) return res.status(404).json({ erro: 'Demanda não encontrada' });
    if (demanda.status !== 'encerrada') return res.status(400).json({ erro: 'Demanda não está encerrada' });

    await DB.update('demandas_spot', id, {
      status: 'aberta',
      encerrada_em: null,
      encerramento_motivo: null,
      fornecedor_vencedor_id: null,
      encerramento_observacao: null,
    }, req.tenantId);

    // Volta os interesses para pendente
    const interesses = await DB.select('interesses_spot', { demanda_id: id }, req.tenantId);
    for (const i of interesses) {
      await DB.update('interesses_spot', i.id, { status: 'pendente' }, req.tenantId);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /spot/demandas/:id/reabrir:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── FORNECEDOR ───────────────────────────────────────────────
// Todas exigem fornecedor VERIFICADO (global) — ver services/acessoSpot.js.
// Local recebe 403 { codigo: 'spot_requer_verificacao' }.

// Marca que o fornecedor viu a demanda (idempotente: só grava a 1ª vez)
router.post('/fornecedor/demandas/:id/visualizar', fornecedorMiddleware, exigirAcessoSpot, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const demanda = await DB.selectOne('demandas_spot', { id });
    if (!demanda) return res.status(404).json({ erro: 'Demanda não encontrada' });

    // Registra visualização única por fornecedor
    const ja = await DB.selectOne('demandas_spot_visualizacoes', {
      demanda_id: id,
      fornecedor_id: req.fornecedorId,
    });
    if (!ja) {
      await DB.insert('demandas_spot_visualizacoes', {
        demanda_id: id,
        fornecedor_id: req.fornecedorId,
      });
    }

    // Marca a primeira visualização global (compatibilidade)
    if (!demanda.visualizada_em) {
      await DB.update('demandas_spot', id, {
        visualizada_em: new Date().toISOString(),
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /spot/fornecedor/demandas/:id/visualizar:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.get('/fornecedor/demandas', fornecedorMiddleware, exigirAcessoSpot, async (req, res) => {
  try {
    const todas = await DB.select('demandas_spot', {});
    const meusInteresses = await DB.select('interesses_spot', { fornecedor_id: req.fornecedorId });
    const meuPorDemanda = {};
    for (const i of meusInteresses) meuPorDemanda[i.demanda_id] = i;

    // Encerradas só aparecem para quem respondeu, e só por um tempo:
    // vencidas por 90 dias, não vencidas (perdidas/canceladas) por 30 dias.
    // O histórico completo continua no banco para os indicadores.
    const DIA_MS = 24 * 60 * 60 * 1000;
    const agora = Date.now();
    const demandas = (todas || []).filter(d => {
      if (d.status !== 'encerrada') return true;
      const mi = meuPorDemanda[d.id];
      if (!mi) return false;
      const dias = mi.status === 'escolhido' ? 90 : 30;
      const encerradaEm = new Date(d.encerrada_em || d.criado_em || 0).getTime();
      return agora - encerradaEm <= dias * DIA_MS;
    });

    const minhasVis = await DB.select('demandas_spot_visualizacoes', { fornecedor_id: req.fornecedorId });
    const visPorMim = {};
    for (const v of minhasVis) visPorMim[v.demanda_id] = v.criado_em;

    // Busca dados de contato de quem postou cada demanda
    const compradorIds = [...new Set(demandas.map(d => d.comprador_id).filter(Boolean))];
    const usuarios = compradorIds.length ? await DB.select('usuarios', {}) : [];
    const uById = {};
    for (const u of usuarios) uById[u.id] = u;

    const tenantIds = [...new Set(demandas.map(d => d.tenant_id).filter(Boolean))];
    const tenants = tenantIds.length ? await DB.select('tenants', {}) : [];
    const tById = {};
    for (const t of tenants) tById[t.id] = t;

    // Match Score: perfil de atuação + catálogo deste fornecedor, carregados uma vez
    const ctxMatch = await contextoDoFornecedor(DB, req.fornecedorId);

    // Gera signed URLs das fotos
    const fotosMap = {};
    for (const d of demandas) {
      if (d.foto_path) fotosMap[d.foto_path] = await StorageSpot.gerarSignedUrl(d.foto_path);
    }

    res.json(demandas.map(d => {
      // Campos internos do comprador que o fornecedor não deve ver
      const { fornecedor_vencedor_id, encerramento_observacao, ...publico } = d;
      const u = uById[d.comprador_id] || {};
      const t = tById[d.tenant_id] || {};
      const mi = meuPorDemanda[d.id];
      return {
        ...publico,
        foto_url: d.foto_path ? (fotosMap[d.foto_path] || null) : null,
        ja_interesse: !!mi,
        meu_interesse: mi ? {
          id: mi.id,
          status: mi.status,                 // pendente | escolhido | nao_escolhido
          valor_estimado: mi.valor_estimado,
          observacao_fornecedor: mi.observacao_fornecedor,
          criado_em: mi.criado_em,
        } : null,
        visto_por_mim: visPorMim[d.id] || null,
        // { pontos, faixa: combina_muito | combina | pode_interessar, motivos: [{tipo, texto}] } ou null
        match: pontuarDemanda(d, ctxMatch, t),
        cliente_nome: u.nome || null,
        cliente_email: u.email || null,
        cliente_telefone: u.telefone || null,
        empresa_nome: t.nome || null,
      };
    }));
  } catch (err) {
    console.error('❌ GET /spot/fornecedor/demandas:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /spot/demandas — criar demanda
router.post('/demandas', tenantMiddleware, async (req, res) => {
  try {
    const b = req.body || {};
    const { erro, dados } = await lerCamposDemanda(b, req.tenantId);
    if (erro) return res.status(400).json({ erro });

    // Gera número sequencial DSP-YYYY-NNNN
    const ano = new Date().getFullYear();
    const todas = await DB.select('demandas_spot', {});
    const doAno = todas.filter(d => d.numero && d.numero.startsWith(`DSP-${ano}-`));
    const proximo = doAno.length + 1;
    const numero = `DSP-${ano}-${String(proximo).padStart(4, '0')}`;

    const demanda = await DB.insert('demandas_spot', {
      numero,
      tenant_id: req.tenantId,
      comprador_id: req.userId,
      ...dados,
      status: 'aberta',
    }, req.tenantId);
    res.status(201).json({ ok: true, demanda });

    // Alerta imediato para fornecedores Pro (depois de responder: nunca atrasa
    // nem quebra a criação da demanda)
    enviarAlertaImediato(demanda).catch(e => console.error('❌ alerta imediato spot:', e.message || e));
  } catch (err) {
    console.error('❌ POST /spot/demandas:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /spot/demandas/:id — editar demanda (comprador), só enquanto aberta.
// Marca editada_em: o fornecedor que já respondeu vê "editada depois da sua resposta".
router.put('/demandas/:id', tenantMiddleware, async (req, res) => {
  try {
    const demanda = await DB.selectOne('demandas_spot', { id: req.params.id }, req.tenantId);
    if (!demanda || String(demanda.tenant_id) !== String(req.tenantId)) {
      return res.status(404).json({ erro: 'Demanda não encontrada' });
    }
    if (demanda.status === 'encerrada') {
      return res.status(400).json({ erro: 'Demanda encerrada: reabra antes de editar' });
    }
    const { erro, dados } = await lerCamposDemanda(req.body || {}, req.tenantId);
    if (erro) return res.status(400).json({ erro });

    const atualizada = await DB.update('demandas_spot', demanda.id, {
      ...dados,
      editada_em: new Date().toISOString(),
    }, req.tenantId);
    res.json({ ok: true, demanda: atualizada });
  } catch (err) {
    console.error('❌ PUT /spot/demandas/:id:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /spot/config — padrão do formulário de nova demanda (estado = região da empresa)
router.get('/config', tenantMiddleware, async (req, res) => {
  try {
    const tenant = await DB.selectOne('tenants', { id: req.tenantId });
    res.json({ regiao: ufDoTenant(tenant) });
  } catch (err) {
    console.error('❌ GET /spot/config:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.post('/fornecedor/interesse', fornecedorMiddleware, exigirAcessoSpot, async (req, res) => {
  try {
    const { demanda_id, mensagem, valor_estimado, observacao_fornecedor } = req.body;
    if (!demanda_id) return res.status(400).json({ erro: 'demanda_id obrigatório' });

    const demanda = await DB.selectOne('demandas_spot', { id: demanda_id });
    if (!demanda) return res.status(404).json({ erro: 'Demanda não encontrada' });
    if (demanda.status === 'encerrada') return res.status(400).json({ erro: 'Demanda encerrada' });

    const ja = await DB.selectOne('interesses_spot', { demanda_id, fornecedor_id: req.fornecedorId });
    if (ja) return res.status(409).json({ erro: 'Interesse já registrado' });

    const interesse = await DB.insert('interesses_spot', {
      demanda_id,
      tenant_id: demanda.tenant_id,
      fornecedor_id: req.fornecedorId,
      mensagem: (mensagem || '').trim(),
      valor_estimado: valor_estimado != null && valor_estimado !== '' ? Number(valor_estimado) : null,
      observacao_fornecedor: (observacao_fornecedor || '').trim() || null,
      status: 'pendente',
    });

    res.status(201).json({ ok: true, interesse });
  } catch (err) {
    console.error('❌ POST /spot/fornecedor/interesse:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;