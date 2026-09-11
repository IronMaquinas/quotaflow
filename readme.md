# 📦 QuotaFlow — Estrutura Completa do Projeto

**Versão:** 3.0 (Separação OS/RM/RC + Marketplace de Fornecedores)
**Última atualização:** 10/09/2026
**Status:** núcleo de compras (OS → RM → RC → OV) em produção; marketplace de fornecedores com busca unificada (catálogo local + marketplace) em produção.

Este README foi reescrito em 10/09/2026 — a versão anterior (19/08/2026) estava defasada em relação ao que de fato está em produção. Tudo aqui reflete o estado real confirmado pelo usuário, não um plano.

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Estrutura de Pastas](#estrutura-de-pastas)
4. [Banco de Dados](#banco-de-dados)
5. [Fluxo de Negócio: OS → RM → RC → OV](#fluxo-de-negócio-os--rm--rc--ov)
6. [Marketplace de Fornecedores e Busca Unificada de Item](#marketplace-de-fornecedores-e-busca-unificada-de-item)
7. [Como Rodar](#como-rodar)
8. [Status das Features](#status-das-features)
9. [Armadilhas Conhecidas do Backend](#armadilhas-conhecidas-do-backend)
10. [Roadmap / Decisões em Aberto](#roadmap--decisões-em-aberto)

---

## 🎯 Visão Geral

**QuotaFlow** é um SaaS de automação de compras para **transportadoras** (frotistas de carretas e caminhões). O produto nasceu com uma referência de rigor de cadastro típica de óleo & gás, mas a validação com clientes reais mostrou que a maioria das transportadoras pequenas/médias não tem (nem quer ter) esse nível de burocracia — isso moldou duas decisões estruturais grandes descritas neste documento: a separação OS/RM/RC e o modelo de marketplace decoupled de fornecedores.

### Principais Atores:
- 🚚 **Motorista / Mecânico / Encarregado** — abre a Ordem de Serviço (OS), monta a lista de materiais e serviços
- 💰 **Comprador** — revisa os itens de material marcados para compra, gera Requisição de Material (RM), depois Requisição de Compra (RC/cotação), escolhe fornecedor e emite Ordem de Venda (OV)
- 🏢 **Fornecedor** — cadastra catálogo de produtos (via CSV ou manualmente), responde cotações pelo portal próprio

### Segmentação de clientes (decisão de produto confirmada)
Cerca de 20% dos clientes potenciais (geralmente com herança de controladoria tipo óleo & gás) querem catálogo próprio rigoroso, rastreável, com fornecedores "internos" qualificados. Os outros ~80% querem o mínimo de burocracia possível e vão comprar direto do marketplace agregado de fornecedores, sem nunca preencher o catálogo do próprio tenant. **O sistema foi desenhado para atender aos dois perfis ao mesmo tempo, sem forçar nenhum a se comportar como o outro** — ver seção 6.

---

## 🏗️ Arquitetura

```
┌─────────────────┐
│   Frontend      │  (React + Vite)
│   (port 5173)   │
└────────┬────────┘
         │ HTTP/REST (JWT Bearer)
         ▼
┌─────────────────┐
│   Backend       │  (Node.js + Express)
│   (port 3001)   │
└────────┬────────┘
         │ Supabase JS client (supabase-js) + wrapper DB (backend/db.js)
         ▼
┌─────────────────┐
│  Supabase       │  (PostgreSQL + Auth + pg_trgm/unaccent)
│  (Cloud)        │
└─────────────────┘
```

### Stack Tecnológico:
- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express
- **Banco:** PostgreSQL (Supabase), com extensões `pg_trgm` e `unaccent` para busca fuzzy
- **Auth:** JWT (`Authorization: Bearer <token>`), payload `{ user_id, tenant_id, email, perfil }`, validado em `middleware/tenantMiddleware.js`
- **Multi-tenant:** toda tabela relevante tem `tenant_id`; middleware injeta `req.tenantId`

### `apiService.js` — convenção real (importante para quem for escrever chamadas novas)
`apiService.get(endpoint, params)` e os demais métodos **recebem os query params/body diretamente como objeto**, sem wrapper `{ params: {...} }` (essa é convenção do axios, não deste projeto). A assinatura real:
```js
get(endpoint, params = {})     // params vai direto pra URLSearchParams
post(endpoint, body, params = {})
put(endpoint, body, params = {})
patch(endpoint, body, params = {})
delete(endpoint, params = {})
```
Um `{ params: { x } }} passado como segundo argumento de `get` produz `?params=[object Object]` na URL — bug real encontrado e corrigido em `TelaChamadosNova.jsx` (dois pontos: `consultarSaldo` e a busca unificada de item) em 10/09/2026.

---

## 📁 Estrutura de Pastas

```
quotaflow/
│
├── backend/
│   ├── services/
│   │   ├── CotacaoService.js       (Lógica de cotações — buscarPorChamadoComFornecedores, etc)
│   │   ├── CatalogoService.js
│   │   └── emailService.js         (parcialmente integrado — usado em resposta de cotação)
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── cotacoes.js             (chamados/OS/RM, apontamentos, gerar-requisicao-material, cotações/RC, OV — arquivo grande e central)
│   │   ├── catalogo.js             (catálogo do tenant — CRUD "clássico")
│   │   ├── catalogoBusca.js        (NOVO 09/2026 — busca unificada catálogo+marketplace pra tela de OS)
│   │   ├── fornecedores.js         (fornecedor "cliente" — cadastro simples do lado comprador)
│   │   ├── fornecedor.js           (fornecedor "anunciante" — perfil de fornecedor com catálogo próprio)
│   │   ├── fornecedorProdutos.js   (NOVO 09/2026 — CRUD do catálogo do fornecedor: upload CSV, criar/editar/deletar item)
│   │   ├── buscaFornecedores.js    (NOVO 09/2026 — busca no marketplace COM dado comercial, uso do comprador)
│   │   ├── portalFornecedor.js     (rota realmente usada pelo fornecedor pra responder cotação via token — sem middleware, autenticação por token na URL)
│   │   ├── equipamentos.js
│   │   ├── usuarios.js
│   │   ├── tarefas.js
│   │   ├── email.js
│   │   ├── cnpj.js
│   │   ├── spot.js
│   │   └── estoque/
│   │       ├── itensConsumo.js
│   │       ├── movimentacoes.js    (entrada/saída/recebimento, com e sem OV)
│   │       ├── recompra.js
│   │       ├── configuracoes.js
│   │       ├── solicitacoes.js     (retirada avulsa de consumível — RET-YYYY-NNNN)
│   │       ├── ordemServico.js
│   │       └── reservas.js         (reserva de estoque pra OS — GET /saldo, POST/DELETE /reservas)
│   │
│   ├── middleware/
│   │   ├── tenantMiddleware.js     (valida JWT, injeta req.tenantId/req.userId/req.userEmail/req.userPerfil)
│   │   └── fornecedorMiddleware.js
│   │
│   ├── db.js                       (exporta `supabase` — cliente supabase-js cru — e `DB`, wrapper com select/selectOne/insert/update/delete/raw)
│   ├── server.js
│   ├── .env
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chamados/
│   │   │   │   └── TelaChamadosNova.jsx        (abre OS: lista única material+serviço, busca unificada de item — ver seção 6)
│   │   │   │
│   │   │   ├── estoque/
│   │   │   │   └── TelaGerarRequisicaoMaterial.jsx  (fila do comprador: OS → RM)
│   │   │   │
│   │   │   ├── cotacoes/
│   │   │   │   ├── TelaCotacoesNovaComAbas.jsx (lista RM sem cotação, cria RC/cotação)
│   │   │   │   └── CotacaoAutomaticaView.jsx
│   │   │   │
│   │   │   ├── fornecedores/
│   │   │   │   ├── TelaFornecedoresNova.jsx       (fornecedor "cliente", lado comprador)
│   │   │   │   └── TelaCatalogoFornecedor.jsx     (NOVO 09/2026 — perfil do fornecedor anunciante: CRUD + import CSV do catálogo próprio)
│   │   │   │
│   │   │   ├── portal/
│   │   │   │   └── TelaPortalFornecedor.jsx    (fornecedor responde cotação via link/token)
│   │   │   │
│   │   │   ├── equipamentos/, catalogo/, historico/, relatorio/, financeiro/,
│   │   │   │   inteligencia/, plano/, benchmark/, usuarios/, layouts/, shared/
│   │   │
│   │   ├── hooks/
│   │   │   ├── useCotacoes.js, useChamados.js, useFornecedores.js, useAuth.js,
│   │   │   │   useCatalogo.js, useEquipamentos.js, useEmail.js, usePortal.js,
│   │   │   │   useTarefas.js, useUsuarios.js
│   │   │
│   │   ├── services/
│   │   │   ├── apiService.js       (cliente HTTP genérico — ver convenção na seção Arquitetura)
│   │   │   └── ...Service.js por domínio
│   │   │
│   │   ├── utils/csvFornecedorUtils.js  (NOVO 09/2026 — parser CSV quote-aware + sinônimos de coluna + normalização de preço BR/US, usado no import do catálogo do fornecedor)
│   │   │
│   │   ├── App.jsx, main.jsx
│   │
│   ├── .env.local, package.json, vite.config.js
│
└── README.md (este arquivo)
```

---

## 🗄️ Banco de Dados

### Núcleo multi-tenant
- **`tenants`** — `id | nome | criado_em`
- **`usuarios`** — `id | tenant_id | nome | email | perfil | ativo | criado_em` (perfil: admin, comprador, supervisor, fornecedor)
- **`equipamentos`** — `id | tenant_id | tag | nome | local | fabricante | modelo | serie | ativo | criado_em`. `fabricante`/`modelo` existem mas são opcionais e hoje raramente preenchidos — ver seção Roadmap sobre amarração de busca a equipamento.

### Núcleo de compra: OS → RM → RC → OV
Ver seção 5 para o fluxo completo. Resumo de tabelas:

- **`chamados`** — serve tanto para OS quanto RM, discriminado por `tipo_documento` (`'os'` | `'requisicao_material'`, `NOT NULL DEFAULT 'os'`). Campos relevantes: `id | tenant_id | equipamento_id | numero | status | urgencia | categoria | descricao_geral | servico_nome | modo_programacao | data_inicio_prevista | data_fim_prevista | tipo_documento | origem_os_id | origem_os_numero | criado_em`. `origem_os_id`/`origem_os_numero` só são preenchidos em linhas RM, apontando pra OS-mãe.
- **`chamado_itens`** — lista única de itens (material OU serviço, discriminado por `tipo`). Campos: `id | tenant_id | chamado_id | tipo | origem (planejado|adicionado) | status (ativo|cancelado) | numero_base | posicao | origem_os_item_id` + campos de material (`item_nome, codigo, item_catalogo_id, quantidade, tipo_item, descricao, status_estoque, saldo_disponivel`) + campos de serviço (`nome, descricao, qtd_pessoas_planejada, data_inicio_prevista, data_fim_prevista`). `origem_os_item_id` só preenchido em itens de RM, apontando pro item de material original da OS.
- **`chamado_apontamentos`** — apontamento de execução por item de serviço, `UNIQUE(chamado_item_id)` (valor único, não histórico versionado — decisão de produto ainda em aberto se deve virar histórico).
- **`cotacoes`** ⭐ — a RC. `id | tenant_id | chamado_id (aponta pra uma RM, não mais pra OS diretamente) | status | modo | numero | notas | confirmado_em | confirmado_por | enviado_em | finalizado_em | criado_em`.
- **`cotacao_itens`** — `id | tenant_id | cotacao_id | chamado_item_id | item_catalogo_id | quantidade | preco_estimado | fornecedores_ids (ARRAY) | criado_em`.
- **`cotacao_fornecedores`** ⭐ — `id | tenant_id | cotacao_id | fornecedor_id | fornecedor_nome | fornecedor_email | token | status | valor | prazo | frete (modalidade agregada: CIF/FOB/MISTO) | valor_frete | obs | data_resposta | enviado_em`.
- **`cotacao_fornecedor_itens`** — detalhamento por item da resposta do fornecedor: `valor_unitario`, `frete_modalidade` (por item — pode variar dentro da mesma cotação, ex: peça leve por CIF/correio, peça pesada FOB por peso), `chamado_item_id` (derivado no backend, nunca vem do frontend).
- **`ordens_venda`** — `id | tenant_id | cotacao_id | fornecedor_id | numero | status | valor_total | valor_frete | prazo_entrega | criado_em | enviado_em | entregue_em`.
- **`nao_conformidades`** — recebimento recusado: `numero_nc | ordem_venda_id | numero_pedido | fornecedor_nome | numero_nota_fiscal | data_recebimento | inspetor_id | motivo_recusa (NOT NULL) | quantidade (NOT NULL) | unidade_medida | lote | numero_serie | validade | criado_em`.

### Estoque e reservas
- **`itens_consumo`** — almoxarifado com saldo físico real: `saldo_atual, limite_recompra, limite_inferior_controle, lote_minimo_compra, quantidade_lotes_automatico, catalogo_item_id (ponte pra catalogo_itens, nullable — ver abaixo)`.
- **`estoque_reservas`** — reserva "promessa", não altera `saldo_atual` nem gera `movimentacoes_estoque`: `item_catalogo_id, chamado_id, chamado_item_id, quantidade, criado_em, liberado_em (null = ativa), liberado_motivo`. **Disponível = físico − soma(reservas ativas)**.
- **`movimentacoes_estoque`** — todo movimento JÁ realizado (`tipo`: entrada/saida/ajuste). `saldo_atual` muda no mesmo instante do insert.
- **`solicitacoes_retirada`** / **`solicitacao_retirada_itens`** — retirar material que já está fisicamente no almoxarifado (`RET-YYYY-NNNN`). Sem FK real com OS (campo "Origem" é texto livre). **Não confundir com RM** (ver terminologia na seção 5).
- **`config_estoque`** — única tabela de configuração de estoque real (a duplicata `configuracoes_estoque` foi removida).

### Catálogo e marketplace de fornecedores
- **`catalogo_itens`** — catálogo **do tenant** (cliente comprador), tenant-scoped. `id | tenant_id | codigo (NOT NULL) | nome (NOT NULL) | categoria | ativo | subcategoria | marca | modelo | tipo_fabricante | ano_fabricacao_inicio | ano_fabricacao_fim | descricao | especificacoes (jsonb) | unidade | tags (text[]) | verificado | criado_em | atualizado_em | atualizado_por`. `marca`/`modelo`/`ano_fabricacao_*` existem no schema mas raramente preenchidos hoje — ver Roadmap.
- **`fornecedores`** — cadastro do fornecedor "cliente" (lado comprador) — `id | tenant_id | nome | razao_social | cnpj | email | endereco | cidade | estado | cep | ativo | criado_em`.
- **`fornecedor_itens`** — vínculo antigo fornecedor↔catalogo_itens do tenant (preço/prazo por item do catálogo do cliente) — modelo "cliente cadastra fornecedor + preço", ainda existe mas é o modelo mais burocrático (perfil ~20%).
- **`fornecedor_produtos`** ⭐ (NOVO 09/2026) — catálogo **do fornecedor anunciante**, global (não tenant-scoped) — é o marketplace de fato. `id | fornecedor_id | pn_raw | pn_normalizado (generated) | nome_raw | descricao_raw | texto_normalizado (generated) | categoria | marca | preco_unitario | moeda | unidade | ativo | atualizado_em`. Alimentado via upload de CSV ou cadastro manual pelo próprio fornecedor no seu perfil.
- **`normalizar_pn(text)`** / **`normalizar_texto(text)`** — funções SQL auxiliares (uppercase+strip de PN; lowercase+unaccent de texto), usadas tanto em `catalogo_itens` quanto `fornecedor_produtos` pra busca fuzzy consistente.

### Outras tabelas
- `tarefas`, `tarefa_comentarios`, `fornecedor_preco_historico`, `cnpj_alertas`, `notas_periodo`, `cliente_frota`, `fornecedor_upload_log`, `demandas_spot`.
- **Órfãs, não usadas por nenhuma tela/rota ativa** (mantidas, não apagadas): `ordens_servico`, `ordem_servico_itens`.

---

## 🔄 Fluxo de Negócio: OS → RM → RC → OV

Separação estrutural em quatro documentos com rastreabilidade em cadeia, decidida e implementada em 09/09/2026 (ver detalhes técnicos completos no doc do projeto `schema-real-e-tabelas-orfas.md`, item 9).

```
1. OS (Ordem de Serviço) — TelaChamadosNova.jsx
   └─ Encarregado/mecânico monta a OS: lista única de materiais + serviços
   └─ Busca de item agora é UNIFICADA (catálogo local + marketplace) — ver seção 6
   └─ chamados.tipo_documento = 'os', origem_os_id = NULL

2. RM (Requisição de Material) — TelaGerarRequisicaoMaterial.jsx
   └─ Fila do comprador: lista OS com itens de material ainda sem RM vinculada
   └─ Comprador escolhe quais itens (e ajusta quantidade — nunca maior que o planejado)
   └─ Uma OS pode gerar VÁRIAS RM ao longo do tempo (itens urgentes agora, resto depois)
   └─ POST /cotacoes/chamados/:id/gerar-requisicao-material
   └─ chamados.tipo_documento = 'requisicao_material', origem_os_id → OS-mãe

3. RC (Requisição de Compra) = cotações — TelaCotacoesNovaComAbas.jsx
   └─ Dropdown de "nova cotação" lista só RM (nunca OS diretamente)
   └─ Sistema busca fornecedores (catálogo local + marketplace) e sugere os melhores
   └─ Comprador seleciona fornecedores → cotação enviada (token único por fornecedor)
   └─ cotacoes.chamado_id → aponta pra RM

4. Fornecedor responde — TelaPortalFornecedor.jsx (via link/token, sem login)
   └─ cotacao_fornecedores atualizado (status: respondido), com frete discriminado por item

5. OV (Ordem de Venda) — TelaMonitorarRespostas.jsx / fluxo de cotação
   └─ Comprador compara respostas, emite OV pro fornecedor escolhido
   └─ ordens_venda criada, cotação finalizada

6. Recebimento
   └─ /entrada (com OV: 3-way match) ou sem OV (compra emergencial, flag "Compra sem OV")
   └─ /recebimento (parcial vinculado a OV)
   └─ Divergência → nao_conformidades (NC-YYYY-NNNN)
```

### Terminologia — RET vs. RM (não confundir)
- **RET** (`RET-YYYY-NNNN`): retirar material que **já está fisicamente no almoxarifado**. Fluxo independente, sem FK real com OS.
- **RM** (`RM-YYYY-NNNN`): requisitar material que **precisa ser comprado**. É o filho estrutural da OS nesta separação, alimenta a RC.

---

## 🔎 Marketplace de Fornecedores e Busca Unificada de Item

Esta é a área de trabalho mais recente (09-10/09/2026) e a que sustenta a proposta de valor central do produto para o perfil de cliente que não quer manter catálogo próprio.

### Por que dois catálogos coexistem (decisão de produto confirmada)
- **`catalogo_itens`** (tenant-scoped): pensado originalmente pro perfil ~20% (herança óleo&gás), que quer rastreabilidade e só comprar de fornecedores "internos" qualificados.
- **`fornecedor_produtos`** (global, marketplace): pra que os ~80% restantes — que não vão se dar ao trabalho de cadastrar catálogo próprio — ainda consigam abrir uma OS e ter o item reconhecido, puxando de qualquer fornecedor cadastrado no sistema. **O marketplace não é um canal de vendas desconectado do fluxo do SaaS — ele funciona como o catálogo de fato para a maioria dos clientes.**

### Catálogo do fornecedor (`fornecedor_produtos`) — CRUD completo
- `TelaCatalogoFornecedor.jsx`: modal único de criar/editar item (PN, nome, descrição, categoria, marca, preço, unidade) + import de CSV.
- `routes/fornecedorProdutos.js`: `POST /produtos/upload` (bulk CSV), `GET /produtos/meus`, `POST /produtos` (item único), `PUT /produtos/:id`, `DELETE /produtos/:id` (soft delete via `ativo:false`). Todas com checagem de ownership por `fornecedor_id`.
- `frontend/src/utils/csvFornecedorUtils.js`: parser CSV quote-aware, detecção de coluna por sinônimos (pn/nome/descricao/categoria/marca/preco_unitario/unidade, cada um com múltiplos aliases), normalização de preço BR/US (`1.234,56`, `89,90`, `1234.56`).

### Busca de fornecedores — duas rotas com contratos DIFERENTES de propósito
- **`GET /busca-fornecedores/por-texto`** (`routes/buscaFornecedores.js`) — uso do **comprador**, retorna `fornecedor_nome` e `preco_unitario` de propósito (é a base do "grande marketplace" consolidado, com potencial de monetização — banner, posicionamento pago — mencionado pelo usuário como visão futura, não construído ainda).
- **`GET /catalogo/buscar-item`** (`routes/catalogoBusca.js`, NOVO) — uso do **encarregado/mecânico na tela de OS**, contrato DELIBERADAMENTE restrito: **nunca retorna fornecedor nem preço**. Quem abre uma OS não deve ver dado comercial — isso é dado do comprador, não de quem está no chão de fábrica/pátio. PN (`codigo`) não é considerado dado comercial e aparece nas duas rotas.
- Essa separação de contrato é proposital, não só de UI: existe pra nunca vazar dado comercial por engano se o endpoint de OS for reaproveitado em outro lugar no futuro.

### `buscar_itens_catalogo_tenant` e `buscar_fornecedores_para_item` — funções SQL de busca
Ambas seguem o mesmo padrão em 3 estágios:
1. **Código/PN exato** (normalizado) → confiança 100, autoritativo.
2. **Nome sozinho** via `pg_trgm` (operador `%`, indexado) → evita diluição de similaridade por descrição longa (ver bug abaixo).
3. **Fallback: nome+descrição concatenados** → só roda se o estágio 2 não achou nada; cobre termo técnico que só aparece na ficha técnica, não no nome comercial.

`GET /catalogo/buscar-item` chama as duas funções **sempre em paralelo** (nunca com curto-circuito condicional), mescla os resultados por confiança (empate: catálogo local primeiro, é a fonte com estoque real vinculável) e corta no `limit` só no final. Um round de busca não pode "esconder" o outro — bug real encontrado e corrigido: a versão anterior parava de buscar no marketplace assim que o catálogo local sozinho já preenchia o limite, escondendo itens do marketplace em buscas com termos genéricos que batiam com muitos itens locais (ex: "lâmpada").

### PN no hint da sugestão (10/09/2026)
A sugestão no dropdown de busca da OS mostra o PN junto ao nome quando disponível (`"Lâmpada farol direito — PN: LMP-FRD-001"`), tanto para itens do catálogo local quanto do marketplace. Ajuda o funcionário a diferenciar itens de nome parecido mas de veículo/aplicação diferente, sem precisar de um campo de busca por código separado — como o backend já testa PN exato antes de nome, digitar o PN direto no campo de busca já resolve o item exato. PN do marketplace é o PN de UM fornecedor específico que respondeu o match — tratado como referência informativa, não como código "oficial" unificado do item (`fornecedor_produtos` não tem noção de PN canônico entre fornecedores diferentes — ver Roadmap sobre normalização).

### Dual-display: estoque real vs. "reconhecido"
Ao selecionar uma sugestão na OS:
- **Origem `catalogo`**: preenche `item_catalogo_id`, consulta `GET /estoque/saldo` de verdade, mostra badge real (🟢 atende / 🟡 parcial / 🔴 sem estoque).
- **Origem `fornecedores`**: `item_catalogo_id` fica `null` (não força vínculo de estoque falso), status vira `reconhecido_sem_estoque_local` — rótulo neutro, nunca mostra fornecedor/preço.

---

## 🚀 Como Rodar

### Pré-requisitos:
- Node.js 18+, npm, conta Supabase, Git

### Iniciar Projeto:
```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev
# ✅ Servidor em http://localhost:3001

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
# ✅ App em http://localhost:5173
```

---

## ✅ Status das Features

### ✅ Em produção, confirmado (histórico condensado — cronológico)
- Autenticação JWT, multi-tenant, cadastro de equipamentos
- Repaginação da OS: lista única material+serviço, numeração estável (`numero_base`/`posicao`), apontamento de execução persistido
- Separação estrutural **OS → RM → RC → OV** completa (migration 005, Fases B/C/D)
- Reserva de estoque (`estoque_reservas`, modelo "available to promise") + ponte `itens_consumo.catalogo_item_id ↔ catalogo_itens`
- Correção de vazamento de dados no portal do fornecedor (itens entre fornecedores diferentes na mesma cotação, resposta cruzada, frete discriminado por item — CIF/FOB/MISTO)
- Recebimento com e sem OV (compra emergencial), não conformidade (NC), correção de bug de concatenação de saldo
- **Catálogo do fornecedor (marketplace)**: CRUD completo + import CSV, testado e confirmado funcionando pelo usuário em produção
- **Busca unificada de item na OS** (catálogo local + marketplace, dual-source, sem curto-circuito), migração de Levenshtein client-side pra trigram server-side, com PN no hint — confirmado funcionando pelo usuário em produção (10/09/2026)

### 🟡 Em progresso / próximo passo real
- Tela única de consulta de estoque cobrindo consumíveis e peças/componentes juntos (hoje só existe pra consumíveis)
- Validar `TelaGerarRequisicaoMaterial.jsx` na prática com um comprador de verdade usando dados reais

### ❌ Não iniciado
- Tela consolidada de "grande marketplace" pro comprador (reaproveita `/busca-fornecedores/por-texto`, não deve tocar o comportamento de top-3 da tela de cotação existente) — potencial de monetização (banner, posicionamento pago) mencionado pelo usuário, visão futura
- Email/WhatsApp automático ao enviar cotação
- Dashboard, relatórios
- Reativação da aba "Manual" de `TelaCotacoesNovaComAbas.jsx` (emitir RC sem passar por concorrência) — lógica já existe, só falta botão de acesso

---

## ⚠️ Armadilhas Conhecidas do Backend

Registradas para não repetir a investigação. Ver `schema-real-e-tabelas-orfas.md` (doc do projeto) para o detalhamento completo de cada bug encontrado/corrigido.

- **`DB.select`/`DB.selectOne` (backend/db.js) não sabem expressar `IS NULL`**: qualquer `null` no `where` é descartado silenciosamente em vez de virar filtro. Precisa filtrar em JS depois de buscar. Já corrigido em `reservas.js`, `movimentacoes.js`.
- **`DB.select`/`DB.selectOne` não sabem expressar array como filtro (`IN (...)`)**: mesmo padrão de contorno — buscar tudo, filtrar com `.includes()` em JS.
- **`DB.raw()` só reconhece um punhado de padrões SQL hardcoded**: qualquer JOIN/WHERE fora do reconhecido cai num fallback perigoso (`SELECT * FROM <tabela>` ignorando WHERE/JOIN/ORDER BY) — já causou vazamento real de dados entre tenants/fornecedores em várias rotas, todas corrigidas reescrevendo sem `raw()`. Não auditado por completo — vale grep geral por `DB.raw(` se algo se comportar de forma "sempre retorna tudo".
- **`bigint`/`numeric` do Postgres voltam como STRING via node-pg**: comparação ingênua (`===`) ou soma sem `parseFloat()`/`Number()` quebra silenciosamente (já causou concatenação de string em vez de soma em `/recebimento`, e falso-negativo de comparação de id em `PUT /chamados/:id`).
- **`apiService.get(endpoint, { params: {...} })` é o padrão ERRADO neste projeto** — ver seção Arquitetura. Produz `?params=[object Object]`.
- **Postgres não permite mudar o `RETURNS TABLE` de uma função existente via `CREATE OR REPLACE`** — precisa `DROP FUNCTION` (com assinatura exata) + `CREATE`. Confirmado ao adicionar `pn_raw` ao retorno de `buscar_fornecedores_para_item` (migration 011).
- **`pg_trgm`: `similarity(a,b) > limiar` no WHERE não é indexável** — força Seq Scan mesmo com índice GIN existente. Usar o operador `%` com `PERFORM set_limit(limiar)` antes, que É indexável (Bitmap Index Scan).
- **`pg_trgm`: comparar contra nome+descrição concatenados dilui a similaridade de termos curtos** — uma descrição técnica longa faz um termo de busca curto (ex: "farol") cair abaixo do limiar mesmo quando o nome comercial sozinho bateria bem. Resolvido com busca em estágios: nome sozinho primeiro, descrição como fallback.
- **Funções SQL `LANGUAGE sql` podem ser "inlined" pelo planner** (dentro de índice funcional ou corpo de outra função) — nomes não qualificados dentro do corpo são re-resolvidos contra o `search_path` da sessão CHAMADORA, não da criação, o que pode quebrar em contextos específicos (`function unaccent(text) does not exist... during inlining`) mesmo funcionando em chamada direta. Fix: `ALTER FUNCTION ... SET search_path = public;` (também desativa a inlineação como efeito colateral, prevenindo recorrência).

---

## 🗺️ Roadmap / Decisões em Aberto

### Curto prazo, sem mudança de schema
- Nenhuma pendência técnica conhecida na busca unificada de item — considerada fechada em 10/09/2026.

### Médio prazo — amarração de busca a Equipamento
Problema identificado: um nome de item pode ser ambíguo entre veículos/modelos diferentes (ex: "lâmpada farol direito" pode servir a vários veículos, com PNs diferentes por fornecedor). `equipamentos.fabricante`/`modelo` e `catalogo_itens.marca`/`modelo`/`ano_fabricacao_*` já existem no schema — não precisam de migration — mas hoje estão majoritariamente vazios (nunca foram expostos em tela de cadastro nem usados em busca). Plano acordado: NÃO forçar preenchimento agora (contradiria a decisão de baixa fricção pros 80% dos clientes). Quando fizer sentido (catálogo com dado real preenchido), usar o Equipamento já selecionado no topo da OS como **reforço de ranking** (boost, não filtro rígido) contra `catalogo_itens.marca`/`modelo` — só se aplica ao catálogo local, o marketplace não tem esse campo. A checagem final de compatibilidade continua humana (comprador revisando a cotação, fornecedor validando ao responder).

### Longo prazo — normalização de catálogo entre fornecedores
Sem normalização, dois fornecedores podem cadastrar o "mesmo" item físico com nomes/PNs diferentes (ex: "lâmpada farol direito" vs. "lâmpada do farol direito", cada um com seu próprio PN) — a busca hoje trata como itens distintos. Ideia levantada: campo opcional de compatibilidade (marca/modelo atendidos) no cadastro do fornecedor — **opcional, não pré-requisito de onboarding**, pra não repetir o erro de exigir rigor de cadastro dos 80% que não querem isso. Só vale a pena investir quando houver volume real de fornecedores cadastrados. Visão ainda mais distante, sem ação concreta: montadoras compartilhando BOM (lista de materiais) por equipamento.

### Deferidos (intencional, não é pendência ativa)
- Estilo visual do seletor "Programação da OS"
- Toggle de "verificar estoque no ato da programação" por tenant (mesmo toggle decidirá RM automática vs. manual, e tratamento de peça sem vínculo de estoque)
- Limpeza de `ordens_servico`/`ordem_servico_itens` (órfãs)
- Decidir se apontamento de execução vira histórico versionado (remover `UNIQUE(chamado_item_id)`)
- Remoção de `/api/cotacao/:token` inline em `server.js` (provável código morto — rota ativa real é `/api/portal/cotacao/...`)
- Drag-and-drop pra reordenar itens da OS (hoje é ▲▼) — avaliar depois que o volume real de itens por OS mostrar se é necessário

---

## 📞 Contatos do Projeto

**Desenvolvedor:** Marcony
**Plataforma:** QuotaFlow
**Última atualização deste documento:** 10/09/2026