const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const fornecedorMiddleware = require('../middleware/fornecedorMiddleware');
const PortalRespostaService = require('../services/PortalRespostaService');
const ValidacaoXmlService = require('../services/ValidacaoXmlService');
const NfeXmlParser = require('../services/NfeXmlParser');
const { supabase } = require('../db');

// ─── ROTAS PROTEGIDAS PARA FORNECEDOR ───

// GET /api/fornecedor/me - Dados do fornecedor logado
router.get('/me', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedor = await DB.selectOne('fornecedores', { id: req.fornecedorId });
    const usuario = await DB.selectOne('fornecedor_usuarios', { id: req.userId });
    
    res.json({
      fornecedor,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil
      }
    });
  } catch (err) {
    console.error('❌ Erro em /me:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/fornecedor/interesse - Manifestar interesse em demanda spot
router.post('/interesse', fornecedorMiddleware, async (req, res) => {
  try {
    const { demanda_id, mensagem } = req.body;
    const fornecedorId = req.fornecedorId;

    if (!demanda_id) {
      return res.status(400).json({ erro: 'demanda_id é obrigatório' });
    }

    // Buscar tenant do fornecedor
    const fornecedor = await DB.selectOne('fornecedores', { id: fornecedorId });
    if (!fornecedor) {
      return res.status(404).json({ erro: 'Fornecedor não encontrado' });
    }
    const tenantId = fornecedor.tenant_id;

    // Verificar se já existe interesse
    const existente = await DB.selectOne('interesses_spot', {
      demanda_id,
      fornecedor_id: fornecedorId
    }, tenantId);

    if (existente) {
      return res.status(409).json({ erro: 'Você já manifestou interesse nesta demanda' });
    }

    // Registrar interesse
    const interesse = await DB.insert('interesses_spot', {
      tenant_id: tenantId,
      demanda_id,
      fornecedor_id: fornecedorId,
      mensagem: mensagem || '',
      status: 'pendente'
    }, tenantId);

    res.status(201).json({ ok: true, interesse });
  } catch (err) {
    console.error('❌ Erro ao registrar interesse:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/fornecedor/interesses - Listar interesses do fornecedor
// FIX (2026-09, grave): mesmo problema do GET /catalogo — esse JOIN de 3
// tabelas não bate com nenhum padrão que DB.raw() reconhece, então caía no
// fallback genérico ("SELECT * FROM interesses_spot" só com o filtro de
// tenant_id, quando a regex do fallback conseguia achar esse pedaço da
// query — o filtro de fornecedor_id era sempre ignorado). Confirmado com
// teste real: fornecedor 1 via a mensagem privada de interesse do
// fornecedor 2 na mesma demanda, e nenhum dos campos da OS/demanda
// (componente, urgência etc.) vinha preenchido. Reescrito sem raw().
router.get('/interesses', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const fornecedor = await DB.selectOne('fornecedores', { id: fornecedorId });
    const tenantId = fornecedor.tenant_id;

    const meusInteresses = await DB.select('interesses_spot', { fornecedor_id: fornecedorId }, tenantId);

    const interessesCompletos = await Promise.all(meusInteresses.map(async (i) => {
      const demanda = await DB.selectOne('demandas_spot', { id: i.demanda_id });
      const tenant = demanda ? await DB.selectOne('tenants', { id: demanda.tenant_id }) : null;
      return {
        ...i,
        componente: demanda?.componente ?? null,
        descricao_equipamento: demanda?.descricao_equipamento ?? null,
        quantidade: demanda?.quantidade ?? null,
        urgencia: demanda?.urgencia ?? null,
        demanda_status: demanda?.status ?? null,
        empresa_nome: tenant?.nome ?? null
      };
    }));

    interessesCompletos.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

    res.json(interessesCompletos);
  } catch (err) {
    console.error('❌ Erro ao listar interesses:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/fornecedor/catalogo - Listar produtos do fornecedor
// FIX (2026-09, grave): esse JOIN não está entre os poucos padrões de SQL
// que DB.raw() reconhece de verdade, então caía no fallback genérico —
// que faz "SELECT * FROM <primeira tabela do FROM>" IGNORANDO o JOIN, as
// colunas pedidas E o WHERE fi.fornecedor_id = $1. Na prática, todo
// fornecedor autenticado via essa rota via o catálogo de preços de TODOS
// os fornecedores da base, não só o próprio — vazamento de dado
// confidencial (confirmado com teste real: fornecedor 1 via o preço do
// fornecedor 2). Reescrito sem raw(): busca só os itens do próprio
// fornecedor via DB.select (filtro de verdade), depois busca os dados do
// catálogo relacionado e junta em JS.
router.get('/catalogo', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;

    const meusItens = await DB.select('fornecedor_itens', {
      fornecedor_id: fornecedorId,
      ativo: true
    });

    const itensComCatalogo = await Promise.all(meusItens.map(async (fi) => {
      const ci = await DB.selectOne('catalogo_itens', { id: fi.item_catalogo_id });
      return {
        id: fi.id,
        preco_unitario: fi.preco_unitario,
        estoque_status: fi.estoque_status,
        data_tabela: fi.data_tabela,
        item_catalogo_id: ci?.id ?? fi.item_catalogo_id,
        nome: ci?.nome ?? null,
        codigo: ci?.codigo ?? null,
        categoria: ci?.categoria ?? null
      };
    }));

    itensComCatalogo.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    res.json(itensComCatalogo);
  } catch (err) {
    console.error('❌ Erro ao listar catálogo:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/fornecedor/catalogo - Adicionar produto ao catálogo
// FIX (2026-09): fornecedor_itens.tenant_id é NOT NULL, mas o insert nunca
// preenchia esse campo (DB.insert só recebia 2 argumentos) — toda chamada
// quebrava com "null value in column tenant_id violates not-null
// constraint". O tenant_id certo aqui não é o do fornecedor (fornecedores.
// tenant_id é quem cadastrou esse fornecedor como vendor) — é o tenant DONO
// do item de catálogo (catalogo_itens.tenant_id), já que o preço que o
// fornecedor está cadastrando é especificamente pro catálogo daquele
// comprador. Também passou a validar que o item de catálogo existe antes de
// tentar o insert, em vez de deixar a FK estourar um erro cru.
router.post('/catalogo', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const { item_catalogo_id, preco_unitario, estoque_status } = req.body;

    if (!item_catalogo_id || !preco_unitario) {
      return res.status(400).json({ erro: 'item_catalogo_id e preco_unitario são obrigatórios' });
    }

    const itemCatalogo = await DB.selectOne('catalogo_itens', { id: item_catalogo_id });
    if (!itemCatalogo) {
      return res.status(404).json({ erro: 'Item de catálogo não encontrado' });
    }

    // Verificar se já existe
    const existente = await DB.selectOne('fornecedor_itens', {
      fornecedor_id: fornecedorId,
      item_catalogo_id
    });

    if (existente) {
      return res.status(409).json({ erro: 'Este produto já está no seu catálogo' });
    }

    const novo = await DB.insert('fornecedor_itens', {
      tenant_id: itemCatalogo.tenant_id,
      fornecedor_id: fornecedorId,
      item_catalogo_id,
      preco_unitario: parseFloat(preco_unitario),
      estoque_status: estoque_status || 'disponivel',
      ativo: true,
      criado_em: new Date()
    });

    res.status(201).json(novo);
  } catch (err) {
    console.error('❌ Erro ao adicionar produto:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/fornecedor/minhas-cotacoes
//
// Hub do fornecedor logado: lista TODAS as cotações que ele participou,
// com status derivado (aguardando minha resposta / em análise / venceu /
// não selecionada / cancelada) e informação da empresa compradora.
//
// NUNCA vaza: valor de concorrente, nome de quem ganhou (só diz se ELE
// ganhou), valores de outras cotações. O fornecedor vê o que é dele.
// ─────────────────────────────────────────────────────────────────────────
router.get('/minhas-cotacoes', fornecedorMiddleware, async (req, res) => {
  try {
    // 1. Todas as linhas de cotacao_fornecedores deste fornecedor.
    // DB.select com tenant_id=null não filtra por tenant (fornecedor é global).
    const todasCF = await DB.select('cotacao_fornecedores', {}, null);
    const minhas = todasCF.filter(
      cf => String(cf.fornecedor_id) === String(req.fornecedorId)
    );

    if (minhas.length === 0) {
      return res.json({ cotacoes: [] });
    }

    // 2. Cotações-mãe
    const cotacaoIds = [...new Set(minhas.map(m => m.cotacao_id))];
    const todasCotacoes = await DB.select('cotacoes', {}, null);
    const cotacoesPorId = {};
    todasCotacoes
      .filter(c => cotacaoIds.includes(c.id))
      .forEach(c => { cotacoesPorId[c.id] = c; });

    // 3. Chamados (RCs) e tenants (empresas compradoras)
    const chamadoIds = [...new Set(
      Object.values(cotacoesPorId)
        .map(c => c.chamado_id)
        .filter(Boolean)
    )];
    const todosChamados = await DB.select('chamados', {}, null);
    const chamadosPorId = {};
    todosChamados
      .filter(ch => chamadoIds.includes(ch.id))
      .forEach(ch => { chamadosPorId[ch.id] = ch; });

    const tenantIds = [...new Set(
      Object.values(chamadosPorId).map(ch => ch.tenant_id).filter(Boolean)
    )];
    const todosTenants = await DB.select('tenants', {}, null);
    const tenantsPorId = {};
    todosTenants
      .filter(t => tenantIds.includes(t.id))
      .forEach(t => { tenantsPorId[t.id] = t; });

    // 4. Ordens de venda — pra saber se ELE ganhou
    const todasOvs = await DB.select('ordens_venda', {}, null);
    const ovsDoFornecedor = todasOvs.filter(
      ov => String(ov.fornecedor_id) === String(req.fornecedorId)
    );

    // 4b. Buscar respostas por item deste fornecedor — pra detectar
    // renegociação real (valor ou frete renegociado em QUALQUER item
    // dele). Só marca "renegociado" quando houve mudança; abrir o
    // modal e salvar sem mexer não conta.
    const cfIds = minhas.map(m => m.id);
    const todosCFI = await DB.select('cotacao_fornecedor_itens', {}, null);
    const renegociadosPorCf = {};
    todosCFI
      .filter(cfi => cfIds.includes(cfi.cotacao_fornecedor_id))
      .forEach(cfi => {
        if (cfi.valor_renegociado != null || cfi.frete_renegociado != null) {
          renegociadosPorCf[cfi.cotacao_fornecedor_id] = true;
        }
      });

    // Helper: deriva status de validade a partir do `validade_em`.
    //   🟢 ok      → > 15 dias
    //   🟡 proxima → <= 15 dias
    //   🔴 urgente → <= 5 dias
    //   ⚫ vencida → já passou
    function calcularValidade(validadeEm) {
      if (!validadeEm) return { status: null, dias: null };
      const diffMs = new Date(validadeEm) - new Date();
      const dias = Math.ceil(diffMs / 86400000);
      let status;
      if (dias < 0) status = 'vencida';
      else if (dias <= 5) status = 'urgente';
      else if (dias <= 15) status = 'proxima';
      else status = 'ok';
      return { status, dias };
    }

    // 4c. Carregar itens que o fornecedor foi convidado a cotar em cada
    // cotação — pro filtro de busca casar por nome de item ou PN.
    // Só itens onde ele está em `fornecedores_ids` (não vaza item de
    // outro fornecedor).
    const cotacaoIdsDoForn = [...new Set(minhas.map(m => m.cotacao_id))];
    const todosCI = await DB.select('cotacao_itens', {}, null);
    const ciDoFornecedor = todosCI.filter(ci => {
      if (!cotacaoIdsDoForn.includes(ci.cotacao_id)) return false;
      const ids = Array.isArray(ci.fornecedores_ids) ? ci.fornecedores_ids : [];
      return ids.includes(Number(req.fornecedorId));
    });

    const chamadoItemIdsTodos = ciDoFornecedor
      .map(ci => ci.chamado_item_id)
      .filter(Boolean);
    const todosChamadoItensList = await DB.select('chamado_itens', {}, null);
    const chamadoItemPorId = {};
    todosChamadoItensList
      .filter(ch => chamadoItemIdsTodos.includes(ch.id))
      .forEach(ch => { chamadoItemPorId[ch.id] = ch; });

    const itensResumoPorCotacao = {};
    ciDoFornecedor.forEach(ci => {
      const ch = chamadoItemPorId[ci.chamado_item_id];
      if (!ch) return;
      if (!itensResumoPorCotacao[ci.cotacao_id]) {
        itensResumoPorCotacao[ci.cotacao_id] = [];
      }
      itensResumoPorCotacao[ci.cotacao_id].push({
        nome: ch.item_nome || '',
        codigo: ch.codigo || '',
      });
    });

    // 5. Montar retorno com status derivado
    const resultado = minhas.map(cf => {
      const cotacao = cotacoesPorId[cf.cotacao_id];
      if (!cotacao) return null;

      const chamado = chamadosPorId[cotacao.chamado_id];
      const empresa = chamado ? tenantsPorId[chamado.tenant_id] : null;

      // Status derivado — a ordem importa:
      //   1. cotação cancelada
      //   2. cotação finalizada: ganhou (tem OC) ou perdeu
      //   3. sem resposta minha → aguardando
      //   4. com resposta minha, cotação em curso → em análise
      let badge, cor;
      if (cotacao.status === 'cancelada') {
        badge = 'Cancelada';
        cor = '#6b7280';
      } else if (cotacao.status === 'finalizada') {
        const minhaOv = ovsDoFornecedor.find(
          ov => String(ov.cotacao_id) === String(cotacao.id)
        );
        if (minhaOv) {
          badge = 'Você venceu';
          cor = '#10b981';
        } else {
          badge = 'Não selecionada';
          cor = '#9ca3af';
        }
      } else if (cf.status === 'pendente') {
        badge = 'Aguardando você';
        cor = '#f59e0b';
      } else {
        badge = 'Em análise';
        cor = '#3b82f6';
      }

      const validade = calcularValidade(cf.validade_em);

      return {
        cotacao_fornecedor_id: cf.id,
        cotacao_id: cotacao.id,
        cotacao_numero: cotacao.numero,
        chamado_id: chamado?.id || null,
        chamado_numero: chamado?.numero || null,
        empresa_nome: empresa?.nome || '—',
        status_cotacao: cotacao.status,
        status_badge: badge,
        status_cor: cor,
        minha_resposta_status: cf.status,
        respondida_em: cf.data_resposta || null,
        prazo_entrega: cf.prazo || null,
        validade_dias: cf.validade_dias || null,
        validade_em: cf.validade_em || null,
        validade_status: validade.status,
        validade_dias_restantes: validade.dias,
        tem_renegociacao: !!renegociadosPorCf[cf.id],
        itens_resumo: itensResumoPorCotacao[cotacao.id] || [],
        token_acesso: cf.token_acesso || null,
        obs: cf.obs || null,
      };
    }).filter(Boolean);

    // 6. Ordenar: pendentes primeiro, depois por data desc
    const pesoStatus = {
      'Aguardando você': 0,
      'Em análise': 1,
      'Você venceu': 2,
      'Não selecionada': 3,
      'Cancelada': 4,
    };
    resultado.sort((a, b) => {
      const pa = pesoStatus[a.status_badge] ?? 99;
      const pb = pesoStatus[b.status_badge] ?? 99;
      if (pa !== pb) return pa - pb;
      return new Date(b.respondida_em || 0) - new Date(a.respondida_em || 0);
    });

    res.json({ cotacoes: resultado });
  } catch (err) {
    console.error('❌ Erro em /minhas-cotacoes:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/fornecedor/minhas-cotacoes/:cotacaoFornecedorId
//
// Detalhe de UMA cotação do fornecedor logado. Retorna:
//   - Cabeçalho (números, empresa, status, datas, validade)
//   - Lista de itens do que ele viu (só os que ele foi convidado, ou que
//     ele já respondeu — o resto é invisível)
//   - O que ELE respondeu por item (valor, frete, modalidade, renegociado)
//
// NUNCA vaza: valor de outro fornecedor, quem ganhou (só "você venceu"
// ou "não selecionada"), nome do vencedor, quantos concorrentes.
//
// Valida ownership: se `cotacaoFornecedorId` não pertencer ao fornecedor
// logado, retorna 403.
// ─────────────────────────────────────────────────────────────────────────
router.get('/minhas-cotacoes/:cotacaoFornecedorId', fornecedorMiddleware, async (req, res) => {
  try {
    const cfId = parseInt(req.params.cotacaoFornecedorId, 10);
    if (!cfId || isNaN(cfId)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    // 1. Buscar cotacao_fornecedores e validar ownership
    const cf = await DB.selectOne('cotacao_fornecedores', { id: cfId }, null);
    if (!cf) {
      return res.status(404).json({ erro: 'Cotação não encontrada' });
    }
    if (String(cf.fornecedor_id) !== String(req.fornecedorId)) {
      return res.status(403).json({ erro: 'Acesso negado a esta cotação' });
    }

    // 2. Cotação-mãe
    const cotacao = await DB.selectOne('cotacoes', { id: cf.cotacao_id }, null);
    if (!cotacao) return res.status(404).json({ erro: 'Cotação não encontrada' });

    // 3. Chamado (RC) e empresa compradora
    const chamado = cotacao.chamado_id
      ? await DB.selectOne('chamados', { id: cotacao.chamado_id }, null)
      : null;
    const empresa = chamado?.tenant_id
      ? await DB.selectOne('tenants', { id: chamado.tenant_id }, null)
      : null;

    // 4. Status derivado (mesma lógica da lista, pra consistência)
    let badge, cor;
    if (cotacao.status === 'cancelada') {
      badge = 'Cancelada'; cor = '#6b7280';
    } else if (cotacao.status === 'finalizada') {
      const ovs = await DB.select('ordens_venda', {}, null);
      const minhaOv = ovs.find(ov =>
        String(ov.fornecedor_id) === String(req.fornecedorId) &&
        String(ov.cotacao_id) === String(cotacao.id)
      );
      badge = minhaOv ? 'Você venceu' : 'Não selecionada';
      cor = minhaOv ? '#10b981' : '#9ca3af';
    } else if (cf.status === 'pendente') {
      badge = 'Aguardando você'; cor = '#f59e0b';
    } else {
      badge = 'Em análise'; cor = '#3b82f6';
    }

    // 5. Itens da cotação + dados do chamado_item
    const todosCI = await DB.select('cotacao_itens', {}, null);
    const itensDaCotacao = todosCI.filter(ci => ci.cotacao_id === cotacao.id);

    const chamadoItemIds = itensDaCotacao.map(ci => ci.chamado_item_id).filter(Boolean);
    const todosChamadoItens = await DB.select('chamado_itens', {}, null);
    const chamadosPorId = {};
    todosChamadoItens
      .filter(ch => chamadoItemIds.includes(ch.id))
      .forEach(ch => { chamadosPorId[ch.id] = ch; });

    // 6. Minhas respostas
    const todosCFI = await DB.select('cotacao_fornecedor_itens', {}, null);
    const minhasRespostas = todosCFI.filter(cfi => cfi.cotacao_fornecedor_id === cfId);
    const respostasPorItem = {};
    minhasRespostas.forEach(r => { respostasPorItem[String(r.cotacao_item_id)] = r; });

    // 7. Montar lista de itens visíveis pra ele:
    //    - itens onde ele foi convidado (fornecedores_ids inclui ele), OU
    //    - itens onde ele já tem resposta (defensivo — não deve acontecer
    //      se a validação do POST está funcionando, mas não custa cobrir)
    const itens = itensDaCotacao
      .filter(ci => {
        const ids = Array.isArray(ci.fornecedores_ids) ? ci.fornecedores_ids : [];
        const fuiConvidado = ids.includes(Number(req.fornecedorId));
        const tenhoResposta = respostasPorItem[String(ci.id)] != null;
        return fuiConvidado || tenhoResposta;
      })
      .map(ci => {
        const cham = chamadosPorId[ci.chamado_item_id];
        const resp = respostasPorItem[String(ci.id)];
        const ids = Array.isArray(ci.fornecedores_ids) ? ci.fornecedores_ids : [];
        return {
          cotacao_item_id: ci.id,
          numero_base: cham?.numero_base ?? null,
          nome: cham?.item_nome || 'Item sem nome',
          codigo: cham?.codigo || '',
          descricao: cham?.descricao || '',
          quantidade: ci.quantidade || 1,
          fui_convidado: ids.includes(Number(req.fornecedorId)),
          eu_respondi: resp != null,
          meu_valor: resp?.valor != null ? parseFloat(resp.valor) : null,
          meu_frete: resp?.frete != null ? parseFloat(resp.frete) : null,
          minha_modalidade: resp?.frete_modalidade || null,
          meu_valor_renegociado: resp?.valor_renegociado != null ? parseFloat(resp.valor_renegociado) : null,
          meu_frete_renegociado: resp?.frete_renegociado != null ? parseFloat(resp.frete_renegociado) : null,
        };
      })
      .sort((a, b) => {
        const ra = a.numero_base ?? 9999;
        const rb = b.numero_base ?? 9999;
        if (ra !== rb) return ra - rb;
        return a.cotacao_item_id - b.cotacao_item_id;
      });

    // Contato do comprador — mesma regra de visibilidade do
    // PortalRespostaService: só quando a cotação está viva. Como este
    // endpoint monta o payload na mão (não usa o service), replicamos
    // aqui a derivação via policies do tenant.
    const comprador = cotacao.criado_por
      ? await DB.selectOne('usuarios', { id: cotacao.criado_por }, null)
      : null;

    const usarEmpresaNome = (empresa?.comunicacao_nome_policy || 'empresa') === 'empresa';
    const usarEmpresaTel  = (empresa?.comunicacao_telefone_policy || 'empresa') === 'empresa';
    const usarEmpresaMail = (empresa?.comunicacao_email_policy || 'empresa') === 'empresa';

    const cotacaoViva = !['cancelada', 'finalizada'].includes(cotacao.status)
      && cf.status !== 'finalizado';

    const contato = cotacaoViva ? {
      nome: usarEmpresaNome ? (empresa?.nome || null) : (comprador?.nome || empresa?.nome || null),
      telefone: usarEmpresaTel
        ? (empresa?.telefone || null)
        : (comprador?.telefone || empresa?.telefone || null),
      email: usarEmpresaMail
        ? (empresa?.email_contato || empresa?.email_admin || null)
        : (comprador?.email || empresa?.email_contato || empresa?.email_admin || null),
    } : null;

    res.json({
      cabecalho: {
        cotacao_fornecedor_id: cf.id,
        cotacao_id: cotacao.id,
        cotacao_numero: cotacao.numero,
        chamado_numero: chamado?.numero || null,
        empresa_nome: empresa?.nome || '—',
        status_cotacao: cotacao.status,
        status_badge: badge,
        status_cor: cor,
        minha_resposta_status: cf.status,
        respondida_em: cf.data_resposta || null,
        prazo_entrega: cf.prazo || null,
        validade_dias: cf.validade_dias || null,
        validade_em: cf.validade_em || null,
        minha_obs: cf.obs || null,
        total_itens: itens.length,
        total_respondidos: itens.filter(i => i.eu_respondi).length,
      },
      itens,
      contato,
    });
  } catch (err) {
    console.error('❌ Erro em /minhas-cotacoes/:id:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.delete('/catalogo/:id', fornecedorMiddleware, async (req, res) => {
  try {
    const fornecedorId = req.fornecedorId;
    const { id } = req.params;

    const item = await DB.selectOne('fornecedor_itens', { id });
    if (!item) {
      return res.status(404).json({ erro: 'Item não encontrado' });
    }
    if (item.fornecedor_id !== fornecedorId) {
      return res.status(403).json({ erro: 'Este item não pertence ao seu catálogo' });
    }

    await DB.update('fornecedor_itens', id, { ativo: false }, item.tenant_id);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao remover produto:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/fornecedor/cotacoes/:cotacaoFornecedorId
//
// Porta AUTENTICADA do carregamento de resposta. Mesma semântica do
// GET /portal/cotacao/:cot/:token, mas resolve o `fornData` por id +
// ownership do JWT em vez de token na URL. Reusa o
// PortalRespostaService — a lógica (filtro de itens, join de chamado,
// estado item-a-item) é exatamente a mesma.
// ─────────────────────────────────────────────────────────────────────────
router.get('/cotacoes/:cotacaoFornecedorId', fornecedorMiddleware, async (req, res) => {
  try {
    const cfId = parseInt(req.params.cotacaoFornecedorId, 10);
    if (!cfId || isNaN(cfId)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const fornData = await DB.selectOne('cotacao_fornecedores', { id: cfId }, null);
    if (!fornData) {
      return res.status(404).json({ erro: 'Cotação não encontrada' });
    }
    if (String(fornData.fornecedor_id) !== String(req.fornecedorId)) {
      return res.status(403).json({ erro: 'Acesso negado a esta cotação' });
    }

    const payload = await PortalRespostaService.carregarParaResposta(fornData);
    return res.json(payload);

  } catch (erro) {
    console.error('❌ Erro em GET /fornecedor/cotacoes/:cfId:', erro.message);
    return res.status(500).json({ erro: erro.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/fornecedor/cotacoes/:cotacaoFornecedorId/responder
//
// Porta AUTENTICADA do envio de resposta. Mesmo payload do portal público
// (respostas[], validade_dias), mas autentica por JWT em vez de token.
// Valida ownership e chama o mesmo responderPortal — mesma regra, mesma
// auditoria, mesmos eventos.
// ─────────────────────────────────────────────────────────────────────────
router.post('/cotacoes/:cotacaoFornecedorId/responder', fornecedorMiddleware, async (req, res) => {
  try {
    const cfId = parseInt(req.params.cotacaoFornecedorId, 10);
    if (!cfId || isNaN(cfId)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const { respostas, validade_dias } = req.body;
    if (!Array.isArray(respostas) || respostas.length === 0) {
      return res.status(400).json({ erro: 'Nenhuma resposta enviada.' });
    }

    let validadeDias = parseInt(validade_dias, 10);
    if (!Number.isFinite(validadeDias) || validadeDias < 1) validadeDias = 30;
    if (validadeDias > 365) validadeDias = 365;

    const fornData = await DB.selectOne('cotacao_fornecedores', { id: cfId }, null);
    if (!fornData) {
      return res.status(404).json({ erro: 'Cotação não encontrada' });
    }
    if (String(fornData.fornecedor_id) !== String(req.fornecedorId)) {
      return res.status(403).json({ erro: 'Acesso negado a esta cotação' });
    }

    const { valorTotal } = await PortalRespostaService.responderPortal(
      fornData,
      respostas,
      validadeDias
    );

    return res.json({
      sucesso: true,
      message: 'Resposta registrada com sucesso!',
      valorTotal,
    });

  } catch (erro) {
    console.error('❌ Erro em POST /fornecedor/cotacoes/:cfId/responder:', erro.message);
    // Erros de validação (item não permitido, etc) sobem como 400 amigável
    return res.status(400).json({ erro: erro.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// M1 — MEUS PEDIDOS (OCs emitidas pro fornecedor logado)
//
// Lista e detalhe das ordens_venda do fornecedor. Read-only — o fornecedor
// não muda status da OC (isso é decisão do comprador). Confirmação e
// upload de XML entram em M2.
//
// Zero vazamento: só OVs do próprio req.fornecedorId.
// ─────────────────────────────────────────────────────────────────────────

function derivarStatusPedido(ov) {
  if (ov.status === 'cancelada') return { badge: 'Cancelada', cor: '#6b7280' };
  if (ov.status_recebimento === 'concluido') return { badge: 'Entregue', cor: '#10b981' };
  if (ov.xml_anexado_em) return { badge: 'Em trânsito', cor: '#3b82f6' };
  if (ov.fornecedor_confirmou_em) return { badge: 'Em preparação', cor: '#f59e0b' };
  return { badge: 'Aguardando confirmação', cor: '#9ca3af' };
}

// GET /api/fornecedor/meus-pedidos
router.get('/meus-pedidos', fornecedorMiddleware, async (req, res) => {
  try {
    const todasOvs = await DB.select('ordens_venda', {}, null);
    const minhas = todasOvs.filter(
      ov => String(ov.fornecedor_id) === String(req.fornecedorId)
    );
    if (minhas.length === 0) return res.json({ pedidos: [] });

    // Cotações-mãe
    const cotacaoIds = [...new Set(minhas.map(o => o.cotacao_id).filter(Boolean))];
    const todasCotacoes = await DB.select('cotacoes', {}, null);
    const cotacoesPorId = {};
    todasCotacoes
      .filter(c => cotacaoIds.includes(c.id))
      .forEach(c => { cotacoesPorId[c.id] = c; });

    // RCs
    const chamadoIds = [...new Set(
      Object.values(cotacoesPorId).map(c => c.chamado_id).filter(Boolean)
    )];
    const todosChamados = await DB.select('chamados', {}, null);
    const chamadosPorId = {};
    todosChamados
      .filter(ch => chamadoIds.includes(ch.id))
      .forEach(ch => { chamadosPorId[ch.id] = ch; });

    // Empresas (tenants)
    const tenantIds = [...new Set(
      Object.values(chamadosPorId).map(ch => ch.tenant_id).filter(Boolean)
    )];
    const todosTenants = await DB.select('tenants', {}, null);
    const tenantsPorId = {};
    todosTenants
      .filter(t => tenantIds.includes(t.id))
      .forEach(t => { tenantsPorId[t.id] = t; });

    // Itens — só pra contagem
    const ovIds = minhas.map(o => o.id);
    const todosItens = await DB.select('ordem_venda_itens', {}, null);
    const itensPorOv = {};
    todosItens
      .filter(it => ovIds.includes(it.ordem_venda_id))
      .forEach(it => {
        if (!itensPorOv[it.ordem_venda_id]) itensPorOv[it.ordem_venda_id] = [];
        itensPorOv[it.ordem_venda_id].push(it);
      });

    const pedidos = minhas.map(ov => {
      const cot = cotacoesPorId[ov.cotacao_id];
      const cham = cot ? chamadosPorId[cot.chamado_id] : null;
      const emp = cham ? tenantsPorId[cham.tenant_id] : null;
      const st = derivarStatusPedido(ov);
      const itens = itensPorOv[ov.id] || [];

      return {
        ordem_venda_id: ov.id,
        numero: ov.numero,
        empresa_nome: emp?.nome || '—',
        cotacao_numero: cot?.numero || null,
        chamado_numero: cham?.numero || null,
        valor_total: ov.valor_total || 0,
        valor_frete: ov.valor_frete || 0,
        prazo_entrega: ov.prazo_entrega || null,
        data_entrega_prevista: ov.data_entrega_prevista || null,
        criado_em: ov.criado_em,
        enviado_em: ov.enviado_em,
        status_interno: ov.status,
        status_recebimento: ov.status_recebimento,
        fornecedor_confirmou_em: ov.fornecedor_confirmou_em,
        xml_anexado_em: ov.xml_anexado_em,
        status_badge: st.badge,
        status_cor: st.cor,
        total_itens: itens.length,
      };
    }).sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));

    return res.json({ pedidos });
  } catch (err) {
    console.error('❌ Erro em /meus-pedidos:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// GET /api/fornecedor/meus-pedidos/:ordemVendaId
router.get('/meus-pedidos/:ordemVendaId', fornecedorMiddleware, async (req, res) => {
  try {
    const ovId = parseInt(req.params.ordemVendaId, 10);
    if (!ovId || isNaN(ovId)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const ov = await DB.selectOne('ordens_venda', { id: ovId }, null);
    if (!ov) return res.status(404).json({ erro: 'Pedido não encontrado' });
    if (String(ov.fornecedor_id) !== String(req.fornecedorId)) {
      return res.status(403).json({ erro: 'Acesso negado a este pedido' });
    }

    const cot = ov.cotacao_id
      ? await DB.selectOne('cotacoes', { id: ov.cotacao_id }, null)
      : null;
    const cham = cot?.chamado_id
      ? await DB.selectOne('chamados', { id: cot.chamado_id }, null)
      : null;
    const tenant = cham?.tenant_id
      ? await DB.selectOne('tenants', { id: cham.tenant_id }, null)
      : null;
    const itens = await DB.select('ordem_venda_itens', { ordem_venda_id: ovId }, null);

    const st = derivarStatusPedido(ov);

    // Contato do comprador — mesmo padrão do /minhas-cotacoes (policies
    // do tenant, respeitando 'empresa' vs 'usuario'). Só quando a OC está
    // viva (não cancelada, não concluída).
    let contato = null;
    const pedidoVivo = ov.status !== 'cancelada' && ov.status_recebimento !== 'concluido';
    if (pedidoVivo && tenant) {
      const comprador = cot?.criado_por
        ? await DB.selectOne('usuarios', { id: cot.criado_por }, tenant.id)
        : null;
      const usarEmpresaNome = (tenant.comunicacao_nome_policy || 'empresa') === 'empresa';
      const usarEmpresaTel = (tenant.comunicacao_telefone_policy || 'empresa') === 'empresa';
      const usarEmpresaMail = (tenant.comunicacao_email_policy || 'empresa') === 'empresa';

      contato = {
        nome: usarEmpresaNome
          ? tenant.nome
          : (comprador?.nome || tenant.nome),
        telefone: usarEmpresaTel
          ? tenant.telefone
          : (comprador?.telefone || tenant.telefone),
        email: usarEmpresaMail
          ? (tenant.email_contato || tenant.email_admin)
          : (comprador?.email || tenant.email_contato || tenant.email_admin),
      };
    }

    // NF-e atual — a última não-substituída. Se o fornecedor já anexou
    // (ou reenviou), vem preenchida; senão null. O frontend usa isso pra
    // decidir entre mostrar o banner da NF ou o botão "Anexar".
    const nfesDoPedido = await DB.select('ordem_venda_xmls', { ordem_venda_id: ovId }, null);
    const nfeAtual = (nfesDoPedido || [])
      .filter(x => x.status !== 'substituido')
      .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0))[0] || null;

    return res.json({
      cabecalho: {
        ordem_venda_id: ov.id,
        numero: ov.numero,
        empresa_nome: tenant?.nome || '—',
        cotacao_numero: cot?.numero || null,
        chamado_numero: cham?.numero || null,
        valor_total: ov.valor_total || 0,
        valor_frete: ov.valor_frete || 0,
        prazo_entrega: ov.prazo_entrega || null,
        data_entrega_prevista: ov.data_entrega_prevista || null,
        endereco_entrega: ov.endereco_entrega || null,
        condicao_pagamento: ov.condicao_pagamento || null,
        criado_em: ov.criado_em,
        enviado_em: ov.enviado_em,
        fornecedor_confirmou_em: ov.fornecedor_confirmou_em,
        xml_anexado_em: ov.xml_anexado_em,
        status_interno: ov.status,
        status_recebimento: ov.status_recebimento,
        status_badge: st.badge,
        status_cor: st.cor,
      },
      nfe_atual: nfeAtual ? {
        id: nfeAtual.id,
        numero_nf: nfeAtual.numero_nf,
        chave_acesso: nfeAtual.chave_acesso,
        status: nfeAtual.status,
        divergencias_count: nfeAtual.divergencias_count || 0,
        enviado_em: nfeAtual.criado_em,
        validacao: nfeAtual.validacao,
        resumo: nfeAtual.xml_resumo,
      } : null,
      itens: (itens || []).map(it => ({
        id: it.id,
        nome: it.nome_item || '—',
        quantidade: it.quantidade,
        valor_unitario: parseFloat(it.valor_unitario) || 0,
        valor_total: parseFloat(it.valor_total) || 0,
        unidade_medida: it.unidade_medida || 'UN',
        status_recebimento: it.status_recebimento || null,
        quantidade_recebida: parseFloat(it.quantidade_recebida) || 0,
      })),
      contato,
    });
  } catch (err) {
    console.error('❌ Erro em /meus-pedidos/:id:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// M2 — UPLOAD E DOWNLOAD DE NF-e PELO FORNECEDOR
//
// 3 rotas:
//   POST  /meus-pedidos/:ovId/anexar-nfe       — multipart, XML cru
//   GET   /meus-pedidos/:ovId/nfe/:xmlId       — download autenticado
//   GET   /meus-pedidos/:ovId/nfes             — histórico de versões
//
// Regras:
//   • Só o fornecedor dono da OC pode anexar/baixar
//   • Idempotente: mesma chave de acesso = retorna o existente (200)
//   • Reenvio: nova chave substitui a atual, mas mantém histórico
//   • XML cru vai pro bucket nfe-xmls (Supabase Storage), privado
//   • Validação roda sincronamente e o resultado é persistido
// ─────────────────────────────────────────────────────────────────────────

const BUCKET_NFE = 'nfe-xmls';

// POST /api/fornecedor/meus-pedidos/:ordemVendaId/anexar-nfe
router.post('/meus-pedidos/:ordemVendaId/anexar-nfe', fornecedorMiddleware, async (req, res) => {
  try {
    const ovId = parseInt(req.params.ordemVendaId, 10);
    if (!ovId || isNaN(ovId)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    // 1. Validar ownership
    const ov = await DB.selectOne('ordens_venda', { id: ovId }, null);
    if (!ov) return res.status(404).json({ erro: 'Pedido não encontrado' });
    if (String(ov.fornecedor_id) !== String(req.fornecedorId)) {
      return res.status(403).json({ erro: 'Acesso negado a este pedido' });
    }
    if (ov.status === 'cancelada') {
      return res.status(400).json({ erro: 'Pedido cancelado — não aceita NF-e.' });
    }

    // 2. Arquivo multipart
    const arquivo = req.files?.arquivo;
    if (!arquivo) {
      return res.status(400).json({ erro: 'Arquivo XML é obrigatório (campo "arquivo").' });
    }
    if (arquivo.size > 2 * 1024 * 1024) {
      return res.status(400).json({ erro: 'XML acima de 2MB — envie o arquivo original da SEFAZ.' });
    }

    const xmlRaw = arquivo.data.toString('utf8');

    // 3. Parse server-side
    let parsed;
    try {
      parsed = NfeXmlParser.parseNfeXml(xmlRaw);
    } catch (err) {
      return res.status(400).json({ erro: `XML inválido: ${err.message}` });
    }

    if (!parsed.chave_acesso || parsed.chave_acesso.length !== 44) {
      return res.status(400).json({
        erro: 'Chave de acesso (44 dígitos) não encontrada no XML.',
        warnings: parsed.warnings,
      });
    }

    // 4. Idempotência — mesma chave, mesma OC = retorna o existente
    const todosXmls = await DB.select('ordem_venda_xmls', { ordem_venda_id: ovId }, null);
    const existente = todosXmls.find(x => x.chave_acesso === parsed.chave_acesso);
    if (existente) {
      // Devolve o mesmo shape do 201 — o frontend não precisa saber que
      // é idempotente pra renderizar direito (só mostra mensagem diferente).
      return res.status(200).json({
        ok: true,
        idempotente: true,
        xml_id: existente.id,
        numero_nf: existente.numero_nf,
        chave_acesso: existente.chave_acesso,
        status: existente.status,
        divergencias_count: existente.divergencias_count || 0,
        validacao: existente.validacao,
        xml_resumo: existente.xml_resumo,
        mensagem: 'Esta NF-e já está anexada a este pedido.',
      });
    }

    // 5. Upload pro Storage
    // Path: tenant-{tenantId}/ov-{ovId}/{chave}-{timestamp}.xml
    // Timestamp garante unicidade mesmo se a mesma chave for reenviada
    // em outro tenant (não deve acontecer, mas Storage exige path único).
    const path = `tenant-${ov.tenant_id}/ov-${ovId}/${parsed.chave_acesso}-${Date.now()}.xml`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NFE)
      .upload(path, Buffer.from(parsed.xml_raw, 'utf8'), {
        contentType: 'application/xml',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Erro upload Storage:', uploadError.message);
      return res.status(500).json({ erro: `Falha ao gravar XML no storage: ${uploadError.message}` });
    }

    // 6. Validação contra a OC
    const resultado = await ValidacaoXmlService.validarXmlContraOc(
      parsed,
      ovId,
      ov.tenant_id
    );
    const validacao = resultado.validacao;
    const totalDiv = parseInt(validacao.totalDivergencias || 0);
    const statusXml = totalDiv === 0 ? 'ok' : 'divergencia';

    // 7. Marca versões anteriores como 'substituido' (mantém histórico)
    const atual = todosXmls.find(x => x.status !== 'substituido');
    if (atual) {
      await DB.update('ordem_venda_xmls', atual.id, {
        status: 'substituido',
        atualizado_em: new Date().toISOString(),
      }, null);
    }

    // 8. Insere nova linha
    const novo = await DB.insert('ordem_venda_xmls', {
      tenant_id: ov.tenant_id,
      ordem_venda_id: ovId,
      chave_acesso: parsed.chave_acesso,
      numero_nf: parsed.numero_nf,
      storage_path: uploadData.path,
      xml_resumo: {
        emitente: parsed.nome_emitente,
        cnpj_emitente: parsed.cnpj_emitente,
        destinatario: parsed.nome_destinatario,
        cnpj_destinatario: parsed.cnpj_destinatario,
        valor_total: parsed.valor_total,
        valor_produtos: parsed.valor_produtos,
        valor_frete: parsed.valor_frete,
        data_emissao: parsed.data_emissao,
        itens: parsed.itens.map(it => ({
          numero: it.numero,
          codigo: it.codigo,
          descricao: it.descricao,
          quantidade: it.quantidade,
          valor_unitario: it.valor_unitario,
          valor_total: it.valor_total,
        })),
      },
      validacao,
      status: statusXml,
      divergencias_count: totalDiv,
      enviado_por_user_id: req.userId,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    }, null);

    // 9. Atualiza cabeçalho da OC
    await DB.update('ordens_venda', ovId, {
      xml_anexado_em: new Date().toISOString(),
      xml_validacao_status: statusXml === 'ok' ? 'ok' : 'divergencia',
      atualizado_em: new Date().toISOString(),
    }, null);

    // 10. Email pro comprador — best-effort (não bloqueia resposta)
    try {
      const chamadoDaOv = ov.cotacao_id
        ? await DB.selectOne('cotacoes', { id: ov.cotacao_id }, null)
        : null;
      const cham = chamadoDaOv?.chamado_id
        ? await DB.selectOne('chamados', { id: chamadoDaOv.chamado_id }, null)
        : null;
      const comprador = chamadoDaOv?.criado_por
        ? await DB.selectOne('usuarios', { id: chamadoDaOv.criado_por }, ov.tenant_id)
        : null;

      if (comprador?.email) {
        const { enviarEmailCotacao } = require('../services/emailService');
        const assunto = totalDiv === 0
          ? `NF-e anexada — ${ov.numero} · validação OK`
          : `NF-e anexada — ${ov.numero} · ${totalDiv} divergência(s)`;

        const corpo = `
          <h2>NF-e anexada pelo fornecedor</h2>
          <p><strong>Fornecedor:</strong> ${parsed.nome_emitente}</p>
          <p><strong>OC:</strong> ${ov.numero}</p>
          <p><strong>NF-e:</strong> ${parsed.numero_nf} — chave ${parsed.chave_acesso}</p>
          <p><strong>Valor total:</strong> R$ ${parsed.valor_total.toFixed(2).replace('.', ',')}</p>
          <p style="font-size:16px;margin-top:16px;">
            ${totalDiv === 0
              ? '✅ <strong style="color:#10b981;">Validação 100% OK.</strong> Pedido pronto para recebimento.'
              : `⚠️ <strong style="color:#f59e0b;">${totalDiv} divergência(s) detectada(s).</strong> Revise antes do recebimento.`}
          </p>
          <p>Abra o QuotaFlow → Recebimento para conferir os detalhes.</p>
          <hr/>
          <p><small>Mensagem automática do QuotaFlow.</small></p>
        `;

        await enviarEmailCotacao(comprador.email, assunto, corpo);
      }
    } catch (mailErr) {
      console.warn('⚠ Falha ao notificar comprador (não bloqueante):', mailErr.message);
    }

    return res.status(201).json({
      ok: true,
      xml_id: novo.id,
      numero_nf: parsed.numero_nf,
      chave_acesso: parsed.chave_acesso,
      status: statusXml,
      divergencias_count: totalDiv,
      validacao,
      xml_resumo: novo.xml_resumo,
      mensagem: statusXml === 'ok'
        ? 'NF-e anexada e validada com sucesso.'
        : `NF-e anexada com ${totalDiv} divergência(s).`,
    });

  } catch (err) {
    console.error('❌ Erro em /meus-pedidos/:id/anexar-nfe:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// GET /api/fornecedor/meus-pedidos/:ordemVendaId/nfes
router.get('/meus-pedidos/:ordemVendaId/nfes', fornecedorMiddleware, async (req, res) => {
  try {
    const ovId = parseInt(req.params.ordemVendaId, 10);
    if (!ovId || isNaN(ovId)) return res.status(400).json({ erro: 'ID inválido' });

    const ov = await DB.selectOne('ordens_venda', { id: ovId }, null);
    if (!ov) return res.status(404).json({ erro: 'Pedido não encontrado' });
    if (String(ov.fornecedor_id) !== String(req.fornecedorId)) {
      return res.status(403).json({ erro: 'Acesso negado a este pedido' });
    }

    const todos = await DB.select('ordem_venda_xmls', { ordem_venda_id: ovId }, null);
    const lista = (todos || [])
      .sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0))
      .map(x => ({
        id: x.id,
        chave_acesso: x.chave_acesso,
        numero_nf: x.numero_nf,
        status: x.status,
        divergencias_count: x.divergencias_count || 0,
        enviado_em: x.criado_em,
      }));

    return res.json({ nfes: lista });
  } catch (err) {
    console.error('❌ Erro em /meus-pedidos/:id/nfes:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

// GET /api/fornecedor/meus-pedidos/:ordemVendaId/nfe/:xmlId
// Download autenticado via signed URL (bucket é privado).
router.get('/meus-pedidos/:ordemVendaId/nfe/:xmlId', fornecedorMiddleware, async (req, res) => {
  try {
    const ovId = parseInt(req.params.ordemVendaId, 10);
    const xmlId = parseInt(req.params.xmlId, 10);
    if (!ovId || !xmlId) return res.status(400).json({ erro: 'IDs inválidos' });

    const ov = await DB.selectOne('ordens_venda', { id: ovId }, null);
    if (!ov) return res.status(404).json({ erro: 'Pedido não encontrado' });
    if (String(ov.fornecedor_id) !== String(req.fornecedorId)) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const xmlRow = await DB.selectOne('ordem_venda_xmls', { id: xmlId }, null);
    if (!xmlRow || xmlRow.ordem_venda_id !== ovId) {
      return res.status(404).json({ erro: 'XML não encontrado para este pedido' });
    }
    if (!xmlRow.storage_path) {
      return res.status(404).json({ erro: 'XML sem arquivo no storage.' });
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET_NFE)
      .createSignedUrl(xmlRow.storage_path, 60 * 60); // 1h

    if (signErr || !signed?.signedUrl) {
      return res.status(500).json({ erro: `Falha ao gerar link: ${signErr?.message || 'sem URL'}` });
    }

    return res.json({
      url: signed.signedUrl,
      expira_em_segundos: 3600,
      numero_nf: xmlRow.numero_nf,
      chave_acesso: xmlRow.chave_acesso,
    });
  } catch (err) {
    console.error('❌ Erro em download XML:', err.message);
    return res.status(500).json({ erro: err.message });
  }
});

module.exports = router;