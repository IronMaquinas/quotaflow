// routes/catalogoBusca.js
//
// Busca UNIFICADA de item pra tela de abertura de OS/chamado — contrato
// DELIBERADAMENTE restrito: nunca retorna fornecedor nem preço, porque
// quem usa essa tela (encarregado/motorista) não deve ver dado comercial.
// Isso é feito em endpoint separado do GET /busca-fornecedores/por-texto
// (que é do comprador e retorna preço+fornecedor de propósito) — não é só
// uma escolha de UI, é separação de contrato pra nunca vazar dado comercial
// por engano se esse endpoint for reaproveitado em outro lugar no futuro.
// O PN (campo "codigo") NÃO entra nessa restrição — não é dado comercial,
// é só o identificador do item, então aparece nos dois endpoints (ver
// 011_pn_no_marketplace.sql).
//
// Estratégia: busca SEMPRE nas duas fontes em paralelo — catalogo_itens
// (tenant, via buscar_itens_catalogo_tenant; se achar, o candidato tem
// estoque real pra consultar em GET /estoque/saldo?item_catalogo_id=X, já
// existente, não mexido aqui) E fornecedor_produtos (via
// buscar_fornecedores_para_item, já existente) só pra saber SE o nome é
// reconhecido — sem devolver fornecedor_nome/preco_unitario ao frontend.
//
// IMPORTANTE: as duas fontes são independentes — o catálogo local do
// tenant pode ter vários itens de categorias diferentes batendo com um
// termo genérico (ex: "lâmpada" bate com "Lâmpada H4", "Lâmpada H7" etc,
// todos do catálogo) SEM que isso signifique que o marketplace não tenha
// também um item relevante e distinto (ex: "Lâmpada farol direito", só
// cadastrado por um fornecedor). Um round de busca não pode "esconder" o
// outro — por isso NÃO existe curto-circuito aqui: sempre busca nas duas
// fontes, mescla e ordena por confiança, corta no limite só no final.

const express = require('express');
const router = express.Router();
const { DB, supabase } = require('../db');

// GET /api/catalogo/buscar-item?termo=X&limit=5
router.get('/buscar-item', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const termo = (req.query.termo || '').trim();
    const limite = Math.min(parseInt(req.query.limit, 10) || 5, 10);

    if (termo.length < 2) {
      return res.json({ resultados: [] });
    }

    // Busca nas duas fontes em paralelo — nunca sequencial/condicional.
    const [respCatalogo, respFornecedores] = await Promise.all([
      supabase.rpc('buscar_itens_catalogo_tenant', {
        p_tenant_id: tenantId,
        p_codigo: termo,
        p_nome: termo,
        p_descricao: '',
        p_limite: limite
      }),
      supabase.rpc('buscar_fornecedores_para_item', {
        p_pn: termo,
        p_nome: termo,
        p_descricao: '',
        p_categoria: null,
        p_limite: limite
      })
    ]);

    if (respCatalogo.error) throw new Error(respCatalogo.error.message);
    if (respFornecedores.error) throw new Error(respFornecedores.error.message);

    const resultadosCatalogo = (respCatalogo.data || []).map(r => ({
      origem: 'catalogo',
      catalogo_item_id: r.catalogo_item_id,
      nome: r.nome,
      codigo: r.codigo,
      categoria: r.categoria,
      tipo_match: r.tipo_match,
      confianca: parseFloat(r.confianca)
    }));

    // Contrato restrito: nome e PN (identificador do item, não é dado
    // comercial). Sem fornecedor_nome, sem preco_unitario — isso continua
    // de fora, de propósito. O PN aqui ajuda a diferenciar visualmente
    // itens com nome parecido mas de veículos/aplicações diferentes (ex:
    // duas "lâmpada farol direito" de modelos distintos, com PNs
    // diferentes) — é só o PN de UM fornecedor específico (quem respondeu
    // o match), não um código autoritativo unificado; o frontend trata
    // como referência informativa, não como PN "oficial" do item.
    // Remove nomes já presentes no resultado do catálogo local, pra não
    // sugerir a mesma coisa duas vezes (comparação por nome normalizado
    // simples — dois cadastros com o mesmo nome exato não duplicam; nomes
    // diferentes pro "mesmo" item físico, ex: "Lâmpada farol direito" vs
    // "Lâmpada do farol direito", aparecem como sugestões distintas até
    // que o catálogo de fornecedores seja normalizado — ver observação
    // sobre normalização de nome/PN).
    const nomesJaSugeridos = new Set(resultadosCatalogo.map(r => (r.nome || '').trim().toLowerCase()));
    const resultadosFornecedores = (respFornecedores.data || [])
      .filter(r => !nomesJaSugeridos.has((r.nome_raw || '').trim().toLowerCase()))
      .map(r => ({
        origem: 'fornecedores',
        catalogo_item_id: null,
        nome: r.nome_raw,
        codigo: r.pn_raw || null,
        categoria: null,
        tipo_match: r.tipo_match,
        confianca: parseFloat(r.confianca)
      }));

    // Mescla e ordena por confiança (desc); em empate, catálogo local vem
    // primeiro — é a fonte mais confiável (tem estoque real vinculado).
    const todosResultados = [...resultadosCatalogo, ...resultadosFornecedores]
      .sort((a, b) => {
        if (b.confianca !== a.confianca) return b.confianca - a.confianca;
        if (a.origem === b.origem) return 0;
        return a.origem === 'catalogo' ? -1 : 1;
      })
      .slice(0, limite);

    res.json({ resultados: todosResultados });
  } catch (err) {
    console.error('❌ Erro na busca unificada de item:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;