# 📦 QuotaFlow - Estrutura Completa do Projeto

**Versão:** 2.0 (Ordem de Venda Completa)  
**Data:** 19/08/2026  
**Status:** 75% Completo (OV Implementada! 🎉)  
**Última Atualização:** 19/08/2026 - Implementação Completa de Ordem de Venda

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Estrutura de Pastas](#estrutura-de-pastas)
4. [Banco de Dados](#banco-de-dados)
5. [Fluxo de Negócio](#fluxo-de-negócio)
6. [Como Rodar](#como-rodar)
7. [Status das Features](#status-das-features)

---

## 🎯 Visão Geral

**QuotaFlow** é um SaaS para otimizar o fluxo de solicitação de manutenção de peças e componentes para **frotistas de carretas e caminhões**.

### Principais Atores:
- 🚚 **Motorista** - Notifica sobre falhas
- 🔧 **Mecânico** - Identifica falhas durante manutenção
- 👨‍💼 **Supervisor de Manutenção** - Cria chamados
- 💰 **Comprador** - Solicita cotações
- 🏢 **Fornecedor** - Responde cotações

---

## 🏗️ Arquitetura

```
┌─────────────────┐
│   Frontend      │  (React + Vite)
│   (port 5173)   │
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────┐
│   Backend       │  (Node.js + Express)
│   (port 3001)   │
└────────┬────────┘
         │ REST API
         ▼
┌─────────────────┐
│  Supabase       │  (PostgreSQL + Auth)
│  (Cloud)        │
└─────────────────┘
```

### Stack Tecnológico:
- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express
- **Banco:** PostgreSQL (Supabase)
- **Auth:** JWT (localStorage)
- **Email:** emailService.js (não integrado ainda)
- **Hospedagem:** Local (desenvolvimento)

---

## 📁 Estrutura de Pastas

```
quotaflow/
│
├── backend/
│   ├── services/
│   │   ├── CotacaoService.js       (Lógica de cotações)
│   │   ├── CatalogoService.js      (Lógica de catálogo)
│   │   └── emailService.js         (Envio de emails - TODO)
│   │
│   ├── routes/
│   │   ├── auth.js                 (Login/Signup)
│   │   ├── cotacoes.js             (Endpoints de cotações)
│   │   ├── catalogo.js             (Endpoints de catálogo)
│   │   ├── fornecedores.js         (Endpoints de fornecedores)
│   │   ├── equipamentos.js         (Endpoints de equipamentos)
│   │   ├── usuarios.js             (Endpoints de usuários)
│   │   ├── tarefas.js              (Endpoints de tarefas)
│   │   ├── email.js                (Endpoints de email)
│   │   └── cnpj.js                 (Endpoints de CNPJ)
│   │
│   ├── middleware/
│   │   └── tenantMiddleware.js     (Validação JWT + tenant_id)
│   │
│   ├── db.js                       (Cliente Supabase + wrapper DB)
│   ├── server.js                   (Express setup)
│   ├── .env                        (Variáveis de ambiente)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chamados/
│   │   │   │   └── TelaChamadosNova.jsx        (Criar/editar chamados)
│   │   │   │
│   │   │   ├── cotacoes/
│   │   │   │   ├── TelaCotacoesNovaComAbas.jsx (Modo Manual + Automático)
│   │   │   │   ├── CotacaoAutomaticaView.jsx   (View automática)
│   │   │   │   └── SearchItemComAutocomplete.jsx
│   │   │   │
│   │   │   ├── fornecedores/
│   │   │   │   └── TelaFornecedoresNova.jsx    (Cadastro de fornecedores)
│   │   │   │
│   │   │   ├── portal/
│   │   │   │   └── TelaPortalFornecedor.jsx    (Portal fornecedor - TODO)
│   │   │   │
│   │   │   ├── equipamentos/
│   │   │   ├── catalogo/
│   │   │   ├── historico/
│   │   │   ├── relatorio/
│   │   │   ├── financeiro/
│   │   │   ├── inteligencia/
│   │   │   ├── plano/
│   │   │   ├── benchmark/
│   │   │   ├── usuarios/
│   │   │   ├── layouts/
│   │   │   │   └── AppLayout.jsx
│   │   │   └── shared/
│   │   │       └── (Button, Input, Modal, Card, etc)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useCotacoes.js          (Gerenciar cotações)
│   │   │   ├── useChamados.js          (Gerenciar chamados)
│   │   │   ├── useFornecedores.js      (Gerenciar fornecedores)
│   │   │   ├── useAuth.js              (Autenticação)
│   │   │   ├── useCatalogo.js          (Catálogo)
│   │   │   ├── useEquipamentos.js      (Equipamentos)
│   │   │   ├── useEmail.js             (Emails)
│   │   │   ├── usePortal.js            (Portal fornecedor)
│   │   │   ├── useTarefas.js           (Tarefas)
│   │   │   └── useUsuarios.js          (Usuários)
│   │   │
│   │   ├── services/
│   │   │   ├── apiService.js              (Cliente HTTP genérico)
│   │   │   ├── cotacoesService.js         (API calls de cotações)
│   │   │   ├── chamadosService.js         (API calls de chamados)
│   │   │   ├── fornecedoresService.js     (API calls de fornecedores)
│   │   │   ├── catalogoService.js         (API calls de catálogo)
│   │   │   ├── equipamentosService.js     (API calls de equipamentos)
│   │   │   ├── portalService.js           (API calls do portal)
│   │   │   ├── tarefasService.js          (API calls de tarefas)
│   │   │   └── usuariosService.js         (API calls de usuários)
│   │   │
│   │   ├── utils/
│   │   │   └── constants.js          (API_URL, etc)
│   │   │
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── .env.local
│   ├── package.json
│   └── vite.config.js
│
└── README.md (este arquivo)
```

---

## 🗄️ Banco de Dados

### Tabelas Principais

#### 1. **tenants**
```sql
id | nome | criado_em
```
- Multi-tenant: cada cliente tem seu próprio tenant

#### 2. **usuarios**
```sql
id | tenant_id | nome | email | perfil | ativo | criado_em
```
- Perfil: admin, comprador, supervisor, fornecedor

#### 3. **chamados**
```sql
id | tenant_id | chamado_id | equipamento_id | numero | status | urgencia_geral
| descricao_geral | criado_em | aberto_em
```
- Status: aberto, em_andamento, fechado
- Criado por: motorista ou mecânico

#### 4. **chamado_itens**
```sql
id | tenant_id | chamado_id | item_catalogo_id | item_nome | quantidade
| urgencia | categoria | tipo_item | codigo | descricao | criado_em
```
- Itens específicos de cada chamado
- `item_catalogo_id`: link com catálogo (NEW)

#### 5. **cotacoes** ⭐ CRÍTICA
```sql
id | tenant_id | chamado_id | status | modo | numero | notas
| confirmado_em | confirmado_por | enviado_em | finalizado_em | criado_em
```
- Status: rascunho → enviada → respondida → finalizada
- Modo: manual ou automática

#### 6. **cotacao_itens**
```sql
id | tenant_id | cotacao_id | chamado_item_id | item_catalogo_id
| quantidade | preco_estimado | fornecedores_ids (ARRAY) | criado_em
```
- `fornecedores_ids`: Array de IDs dos fornecedores selecionados

#### 7. **cotacao_fornecedores** ⭐ CRÍTICA
```sql
id | tenant_id | cotacao_id | fornecedor_id | fornecedor_nome
| fornecedor_email | token | status | valor | prazo | frete | valor_frete
| obs | data_resposta | enviado_em | token_acesso
```
- Status: pendente → respondido
- Token: link único pra fornecedor responder

#### 8. **fornecedores**
```sql
id | tenant_id | nome | razao_social | cnpj | email | endereco
| cidade | estado | cep | ativo | criado_em
```

#### 9. **fornecedor_itens**
```sql
id | tenant_id | fornecedor_id | item_catalogo_id | codigo_fornecedor
| descricao_fornecedor | sku_fornecedor | preco_unitario | moeda
| estoque_status | tempo_entrega_dias | quantidade_minima | ativo | criado_em
```
- Vincula fornecedor com itens específicos do catálogo
- Contém preços e prazos

#### 10. **catalogo_itens**
```sql
id | tenant_id | nome | codigo | categoria | ativo | criado_em
```
- Catálogo mestre de todos os itens

#### 11. **ordens_venda** 🆕 (CRIADA EM 19/08/2026)
```sql
id | tenant_id | cotacao_id | fornecedor_id | numero | status
| valor_total | valor_frete | prazo_entrega | criado_em | enviado_em | entregue_em
```
- Status: pendente → enviada → entregue → cancelada
- Referencia: cotacao_id e fornecedor_id

### Outras Tabelas:
- **equipamentos** - Veículos/equipamentos da frota
- **tarefas** - Tarefas do sistema
- **tarefa_comentarios** - Comentários em tarefas
- **fornecedor_preco_historico** - Histórico de preços
- **cnpj_alertas** - Alertas de CNPJ
- **notas_periodo** - Notas de período
- **cliente_frota** - Relação cliente-frota
- **fornecedor_upload_log** - Log de uploads

---

## 🔄 Fluxo de Negócio (COMPLETO E TESTADO)

```
1. CHAMADO CRIADO ✅
   └─ Motorista/Mecânico notifica falha
   └─ Sistema cria CHAMADO
   └─ Supervisor recebe

2. COTAÇÃO SOLICITADA ✅
   └─ Comprador abre TelaCotacoesNovaComAbas
   └─ Seleciona CHAMADO
   └─ Sistema busca itens agrupados por categoria
   └─ Sistema recomenda TOP 3 fornecedores (menor preço)
   └─ Comprador seleciona fornecedores (checkboxes)

3. COTAÇÃO ENVIADA ✅
   └─ Comprador clica "Salvar & Enviar"
   └─ Sistema cria COTACAO (status: rascunho → enviada)
   └─ Sistema cria COTACAO_FORNECEDORES (para cada fornecedor)
   └─ Cotação move para aba "Em Curso"
   └─ Email/WhatsApp enviado com link único (token) [PRÓXIMO]

4. MONITORAR RESPOSTAS ✅ (NOVO - IMPLEMENTADO HOJE)
   └─ Comprador clica na cotação "Em Curso"
   └─ Abre TelaMonitorarRespostas (item-cêntrica)
   └─ Vê: respondidos vs pendentes
   └─ Vê: melhor proposta em destaque 🏆
   └─ Pode editar valores manualmente
   └─ Salva edições no banco

5. FORNECEDOR RESPONDE [PRÓXIMO]
   └─ Fornecedor clica link na cotação
   └─ TelaPortalFornecedor abre
   └─ Fornecedor preenche: valor, prazo, frete, obs
   └─ COTACAO_FORNECEDORES atualizado (status: respondido)
   └─ Sistema atualiza "respondidos" na tela do comprador

6. ORDEM DE VENDA EMITIDA ✅ (NOVO - IMPLEMENTADO HOJE)
   └─ Comprador clica "📋 Emitir OV" no fornecedor selecionado
   └─ Sistema agrupa TODOS os itens onde esse fornecedor foi selecionado
   └─ Sistema calcula valor total = SOMA dos itens
   └─ Sistema cria ORDENS_VENDA com N itens
   └─ Sistema cria ORDEM_VENDA_ITENS (rastreamento)
   └─ COTACAO finalizada
   └─ Cotação move para aba "Finalizadas"
   
7. PROCESSO CONCLUÍDO [PRÓXIMO]
   └─ Fornecedor recebe OV e entrega itens
   └─ Comprador marca como entregue
   └─ Processo arquivado
```

---

## 🚀 Como Rodar

### Pré-requisitos:
- Node.js 18+
- npm ou yarn
- Supabase account (free tier reativado ✅)
- Git

### Variáveis de Ambiente:

**backend/.env:**
```

**frontend/.env.local:**
```

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

### Login de Teste:
```
Email: teste@xyz.com.br
Senha: (sua senha)
Tenant: 2
```

---

## ✅ Status das Features

### ✅ CONCLUÍDO (100%) - ATUALIZADO EM 19/08/2026

**HOJE (19/08/2026) - IMPLEMENTAÇÃO COMPLETA DE ORDEM DE VENDA:**
- [x] Criar tabela `ordens_venda` com FK pra fornecedor
- [x] Criar tabela `ordem_venda_itens` para rastreamento
- [x] Método `criarOrdenVenda()` que agrupa itens por fornecedor
- [x] Método `gerarNumeroOrdenVenda()` com formato OV-YYYYMM-NNNN
- [x] Método `obterStatusCotacao()` com resumo de respostas
- [x] Endpoint `GET /api/cotacoes/:cotacaoId/status` 
- [x] Endpoint `POST /api/cotacoes/:cotacaoId/ordem-venda` 
- [x] Endpoint `PUT /api/cotacoes/:cotacaoId/fornecedor/:fornecedorId/atualizar-resposta`
- [x] `TelaMonitorarRespostas.jsx` (tela item-cêntrica de monitoramento)
- [x] Filtro de abas: "enviada" → "Em Curso", "finalizada" → "Finalizadas"
- [x] Botão "📋 Emitir OV" em cada fornecedor respondido
- [x] Integração completa do fluxo de OV
- [x] Visualizar respostas recebidas com status
- [x] Comparar propostas com destaque pra melhor preço
- [x] Editar respostas manualmente

**ANTES (Já Existente):**
- [x] Autenticação JWT
- [x] Multi-tenant
- [x] Cadastro de equipamentos
- [x] Criação de chamados
- [x] Autocomplete Levenshtein (itens)
- [x] Busca de fornecedores por item
- [x] Recomendação de TOP 3 (menor preço)
- [x] Cotação modo MANUAL
- [x] Cotação modo AUTOMÁTICO (agrupado por categoria)
- [x] Salvar cotação em rascunho
- [x] Envio de cotação (backend + frontend completo)

### 🟡 EM PROGRESSO (75%)
- [ ] Email/WhatsApp para fornecedor (PRÓXIMO)
- [ ] Portal do fornecedor (responder cotação) (PRÓXIMO)

### ❌ TODO (0%)
- [ ] Finalizar processo (marcar como concluído)
- [ ] Arquivar cotação
- [ ] Relatórios
- [ ] Dashboard

---

## 📞 Contatos do Projeto

**Desenvolvedor:** Marcony  
**Plataforma:** QuotaFlow  
**Última atualização:** 19/08/2026  
**Supabase Status:** ✅ Ativo (Free tier)

---

## 🔐 Segurança

- ✅ Autenticação via JWT
- ✅ Validação de tenant_id em todas as queries
- ✅ Service Role Key (não expor no frontend)
- ✅ CORS habilitado para http://localhost:5173
- ⚠️ TODO: Rate limiting
- ⚠️ TODO: Validação de input

---

## 📝 Notas Importantes

1. **Supabase Free Tier:** Reativado em 19/08/2026. Cuidado com inatividade > 1 semana!
2. **Token JWT:** Válido por ~1 dia. Armazenado em localStorage.accessToken
3. **Fornecedores:** Requer cadastro no sistema (nome, email, CNPJ)
4. **Preços:** Importados via CSV ou API do fornecedor
5. **Email:** Ainda não integrado - usar mock por enquanto

---

## 🎯 Próximos Passos (Prioridade)

**HOJE COMPLETOU (19/08/2026):**
1. ✅ Criar tabela ordens_venda (FEITO)
2. ✅ Criar tabela ordem_venda_itens (FEITO)
3. ✅ Implementar lógica de OV (FEITO)
4. ✅ Tela de monitoramento TelaMonitorarRespostas.jsx (FEITO)
5. ✅ Botão "Emitir OV" no frontend (FEITO)

**PRÓXIMAS SESSÕES:**
1. 🔲 Implementar envio de email/WhatsApp ao enviar cotação
2. 🔲 Criar TelaPortalFornecedor (responder cotações)
3. 🔲 Integrar Portal do Fornecedor no fluxo
4. 🔲 Finalizar processo (marcar como concluído)
5. 🔲 Dashboard com métricas
6. 🔲 Relatórios

**Referência de Arquivos Criados em 19/08/2026:**
- `/outputs/CORRIGIR-CRIAR-ORDEM-VENDA-COM-ITENS.md` - Método com agrupamento
- `/outputs/TELA-MONITORAR-RESPOSTAS-COMPLETA.md` - Tela completa + backend
- `/outputs/PATCH-FILTRO-ABAS-RESPOSTAS.md` - Integração nas abas
- `/outputs/PROXIMOS-3-PASSOS.md` - Email + Portal Fornecedor
- `/outputs/PENDENCIAS-QUOTAFLOW.md` - Checklist de pendências

---

**Este README é a referência principal do projeto. Atualize-o conforme novas features forem adicionadas.**
