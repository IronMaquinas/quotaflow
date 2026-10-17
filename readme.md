# 📦 QuotaFlow — Estrutura Completa do Projeto

**Versão:** 4.7 (Canal Spot + Fornecedores Globais + Cadastro Único + Perfil de Atuação + Match Score + Edição de Demanda + Plano Pro do Fornecedor)
**Última atualização:** 16/10/2026
**Status:** núcleo de compras (OS → RM → RC → OV) em produção; marketplace de fornecedores com busca unificada em produção; módulo de Não Conformidades com fluxo ISO 9001 completo; multi-perfil e reset de senha entregues; **Canal Spot** (demandas urgentes/raras) com ciclo completo comprador ↔ fornecedor; **fornecedores globais** da plataforma visíveis a todos os tenants, com isolamento total dos fornecedores locais.

---

## 📋 ÍNDICE

1. [Visão Geral](#-visão-geral)
2. [Arquitetura](#️-arquitetura)
3. [Estrutura de Pastas](#-estrutura-de-pastas)
4. [Banco de Dados](#️-banco-de-dados)
5. [Fluxo de Negócio: OS → RM → RC → OV](#-fluxo-de-negócio-os--rm--rc--ov)
6. [Marketplace de Fornecedores e Busca Unificada de Item](#-marketplace-de-fornecedores-e-busca-unificada-de-item)
7. [Fornecedores Locais × Globais — Regras de Acesso](#-fornecedores-locais--globais--regras-de-acesso)
8. [Canal Spot — Demandas Urgentes e Itens Raros](#-canal-spot--demandas-urgentes-e-itens-raros)
9. [Benchmarking de Mercado](#-benchmarking-de-mercado)
10. [Módulo de Não Conformidades (M4.4 – M4.5)](#-módulo-de-não-conformidades-m44--m45)
11. [Multi-perfil, Reset de Senha e Meu Perfil (M4.6 – M4.7)](#-multi-perfil-reset-de-senha-e-meu-perfil-m46--m47)
12. [Como Rodar](#-como-rodar)
13. [Status das Features](#-status-das-features)
14. [Armadilhas Conhecidas do Backend](#️-armadilhas-conhecidas-do-backend)
15. [Processo de Entrega e Verificação](#-processo-de-entrega-e-verificação)
16. [Roadmap / Decisões em Aberto](#️-roadmap--decisões-em-aberto)

---

## 🎯 Visão Geral

**QuotaFlow** é um SaaS de automação de compras para **transportadoras** (frotistas de carretas e caminhões). O produto nasceu com uma referência de rigor de cadastro típica de óleo & gás, mas a validação com clientes reais mostrou que a maioria das transportadoras pequenas/médias não tem (nem quer ter) esse nível de burocracia — isso moldou duas decisões estruturais grandes descritas neste documento: a separação OS/RM/RC e o modelo de marketplace decoupled de fornecedores.

### Principais Atores
- 🚚 **Motorista / Mecânico / Encarregado** — abre a Ordem de Serviço (OS), monta a lista de materiais e serviços
- 💰 **Comprador** — revisa os itens de material marcados para compra, gera Requisição de Material (RM), depois Requisição de Compra (RC/cotação), escolhe fornecedor e emite Ordem de Venda (OV); publica demandas no Canal Spot
- 🏢 **Fornecedor** — cadastra catálogo de produtos (via CSV ou manualmente), responde cotações pelo portal próprio, trata NCs, responde demandas spot. Pode ser:
  - **Global** — convidado e qualificado pela plataforma; aparece para **todos** os tenants ("o ouro" que o cliente recebe ao contratar o SaaS)
  - **Local** — cadastrado por um tenant específico (fornecedor de preferência, serviço especial como solda/usinagem/caldeiraria); visível **só** para esse tenant

### Segmentação de clientes (decisão de produto confirmada)
Cerca de 20% dos clientes potenciais (geralmente com herança de controladoria tipo óleo & gás) querem catálogo próprio rigoroso, rastreável, com fornecedores "internos" qualificados. Os outros ~80% querem o mínimo de burocracia possível e vão comprar direto do marketplace agregado de fornecedores, sem nunca preencher o catálogo do próprio tenant. **O sistema foi desenhado para atender aos dois perfis ao mesmo tempo, sem forçar nenhum a se comportar como o outro** — ver seção 6.

### Visão de longo prazo da rede
Uma **rede nacional de fornecedores** de peças e componentes para transporte de cargas e operações especiais (guindastes, empilhadeiras, ônibus, caminhões, carretas, cavalos; elétrica, hidráulica, pneumática…). Quanto mais fornecedores e tenants, mais rápido o Canal Spot conecta quem precisa com quem tem — e mais preciso fica o Match Score (ver Roadmap).

---

## 🏗️ Arquitetura

```text
┌─────────────────┐
│    Frontend     │  (React + Vite)
│   (port 5173)   │
└────────┬────────┘
         │ HTTP/REST (JWT Bearer)
         ▼
┌─────────────────┐
│     Backend     │  (Node.js + Express)
│   (port 3001)   │
└────────┬────────┘
         │ Supabase JS client (supabase-js) + wrapper DB (backend/db.js)
         ▼
┌─────────────────┐
│    Supabase     │  (PostgreSQL + Auth + Storage + pg_trgm/unaccent)
│     (Cloud)     │
└─────────────────┘
```

### Stack Tecnológico
- **Frontend:** React 18 + Vite; `react-phone-number-input` (telefone internacional E.164)
- **Backend:** Node.js + Express
- **Banco:** PostgreSQL (Supabase), com extensões `pg_trgm` e `unaccent` para busca fuzzy
- **Storage:** Supabase Storage (bucket privado `nc-evidencias` para anexos de NC; bucket `nfe-xmls` para XML de NF-e; fotos de demandas spot via `services/StorageSpot.js`)
- **Auth:** JWT (`Authorization: Bearer <token>`)
  - Tenant: payload `{ user_id, tenant_id, email, perfil, perfis[] }`, validado em `middleware/tenantMiddleware.js` → `req.tenantId`, `req.userId`, `req.perfis`
  - Fornecedor: validado em `middleware/fornecedorMiddleware.js` → busca `fornecedor_usuarios` pelo `user_id` e injeta `req.fornecedorId = fornecedor_usuarios.fornecedor_id` (aponta para `fornecedores.id`), com `req.tenantId = null`
- **Multi-tenant:** toda tabela relevante tem `tenant_id`; middleware injeta `req.tenantId` (exceto tabelas N:N como `usuario_perfis`, cujo isolamento é por transitividade via FK do usuário). **Exceção importante:** `fornecedores` com `tipo = 'global'` têm `tenant_id` NULL — ver seção 7.

### `apiService.js` — convenção real (importante para quem for escrever chamadas novas)
`apiService.get(endpoint, params)` e os demais métodos **recebem os query params/body diretamente como objeto**, sem wrapper `{ params: {...} }` (essa é convenção do axios, não deste projeto). A assinatura real:

```js
get(endpoint, params = {})     // params vai direto pra URLSearchParams
post(endpoint, body, params = {})
put(endpoint, body, params = {})
patch(endpoint, body, params = {})
delete(endpoint, params = {})
```

Um `{ params: { x } }` passado como segundo argumento de `get` produz `?params=[object Object]` na URL — bug real encontrado e corrigido em `TelaChamadosNova.jsx` (dois pontos: `consultarSaldo` e a busca unificada de item) em 10/09/2026.

### Middleware global PATCH → PUT (M4.6, 13/10/2026)
O front (`apiService.js`) usa PATCH em várias rotas (`/chamados/:id`, `/cotacoes/:id`, `/fornecedores/:id`, `/equipamentos/:id`, `/tarefas/:id`), mas o backend registra tudo como PUT. Em vez de duplicar handlers em cada arquivo, um middleware no `server.js` normaliza `req.method = 'PUT'` antes do router. Se um dia precisar de PATCH com semântica diferente de PUT (update parcial real), remover o middleware e registrar rotas `.patch()` específicas.

---

## 📁 Estrutura de Pastas

```text
quotaflow/
│
├── backend/
│   ├── services/
│   │   ├── CotacaoService.js       (Lógica de cotações — buscarPorChamadoComFornecedores, etc)
│   │   ├── CatalogoService.js
│   │   ├── fornecedoresVisiveis.js (⭐ 10/2026 — FONTE ÚNICA da regra "fornecedores locais do tenant + globais")
│   │   ├── atuacao.js              (⭐ 10/2026 — perfil de atuação: validação contra atuacao_opcoes, marca sugerida, campos da demanda spot)
│   │   ├── matchSpot.js            (⭐ 10/2026 — Match Score do Canal Spot, fase 1 por regras: pontos, faixa e motivos)
│   │   ├── recomendacoesEmail.js   (⭐ 10/2026 — e-mails Pro: alerta imediato, resumo diário, cota diária, descadastro)
│   │   ├── emailService.js         (envio genérico + templates)
│   │   ├── NCService.js            (M4.1 — notificação de NC ao fornecedor + emissão de token)
│   │   ├── NCEmailTemplates.js     (M4.4 — templates de email da NC: corpoParaFornecedor / corpoParaComprador)
│   │   ├── PortalRespostaService.js (lógica compartilhada da resposta de cotação: link tokenizado + hub autenticado)
│   │   ├── ValidacaoXmlService.js  (validação de XML de NF-e contra a OC)
│   │   ├── StorageNC.js            (M4.5 — upload/signed URL/delete no bucket `nc-evidencias`)
│   │   ├── StorageSpot.js          (fotos das demandas spot — upload, signed URL, remoção)
│   │   └── PasswordResetService.js (M4.6 — geração/validação de token de reset de senha)
│   │
│   ├── routes/
│   │   ├── auth.js                 (login, signup, login-fornecedor, forgot-password, reset-password)
│   │   ├── cotacoes.js             (chamados/OS/RM, apontamentos, gerar-requisicao-material, cotações/RC, OV — arquivo grande e central)
│   │   ├── catalogo.js             (catálogo do tenant — CRUD "clássico")
│   │   ├── catalogoBusca.js        (NOVO 09/2026 — busca unificada catálogo+marketplace pra tela de OS)
│   │   ├── fornecedores.js         (lado do TENANT: lista locais + globais; global somente-leitura, "desativar para mim")
│   │   ├── fornecedor.js           (lado do FORNECEDOR logado: /me, catálogo, interesses)
│   │   ├── fornecedorProdutos.js   (NOVO 09/2026 — CRUD do catálogo do fornecedor: upload CSV, criar/editar/deletar item)
│   │   ├── buscaFornecedores.js    (busca no marketplace COM dado comercial, uso do comprador — filtrada por fornecedores visíveis ao tenant)
│   │   ├── portalFornecedor.js     (rota realmente usada pelo fornecedor pra responder cotação via token — sem middleware, autenticação por token na URL)
│   │   ├── fornecedorNC.js         (M4.2 – M4.4 — endpoints do portal do fornecedor para NC: listar, responder, anexar, reenviar)
│   │   ├── naoConformidades.js     (M4.2 – M4.5 — endpoints do comprador para NC: CRUD, devolver, marcar-interna, vincular-item, editar-item-avulso, buscar-item)
│   │   ├── ordensVenda.js          (listagem/detalhe/status de OV)
│   │   ├── atuacao.js              (GET /api/atuacao/opcoes — listas do perfil de atuação; sem autenticação, são listas de referência)
│   │   ├── recomendacoes.js        (POST /resumo-diario com x-cron-secret · GET /descadastrar/:token)
│   │   ├── spot.js                 (Canal Spot — comprador: demandas, foto, encerrar/reabrir; fornecedor: listar, visualizar, interesse)
│   │   ├── equipamentos.js
│   │   ├── usuarios.js             (CRUD + /me + /me/trocar-senha + requerAdmin)
│   │   ├── tarefas.js
│   │   ├── email.js
│   │   ├── cnpj.js
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
│   │   ├── tenantMiddleware.js     (valida JWT, injeta req.tenantId/req.userId/req.userEmail/req.userPerfil/req.perfis)
│   │   └── fornecedorMiddleware.js (valida JWT do portal, injeta req.fornecedorId via fornecedor_usuarios)
│   │
│   ├── constants/
│   │   └── fornecedorStatus.js     (whitelist canônica de status visíveis ao fornecedor em NC)
│   │
│   ├── scripts/                    (one-off / migrations manuais quando não cabem em SQL puro)
│   │
│   ├── db.js                       (exporta `supabase` — cliente supabase-js cru — e `DB`, wrapper com select/selectOne/insert/update/delete/deleteWhere/raw)
│   ├── server.js
│   ├── .env
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chamados/
│   │   │   │   └── TelaChamadosNova.jsx        (abre OS: lista única material+serviço, busca unificada de item)
│   │   │   │
│   │   │   ├── estoque/
│   │   │   │   ├── TelaGerarRequisicaoMaterial.jsx  (fila do comprador: OS → RM)
│   │   │   │   ├── TelaRecebimento.jsx
│   │   │   │   ├── TelaOrdemServico.jsx             (detalhe de OS, tracker 3 etapas no recebimento, ⚠️ item com NC ativa, bloqueio de conclusão)
│   │   │   │   └── modais/
│   │   │   │       ├── ModalReportarNC.jsx          (abertura de NC via OS)
│   │   │   │       └── ModalApontamento.jsx
│   │   │   │
│   │   │   ├── cotacoes/
│   │   │   │   ├── TelaCotacoesNovaComAbas.jsx (lista RM sem cotação, cria RC/cotação)
│   │   │   │   └── CotacaoAutomaticaView.jsx
│   │   │   │
│   │   │   ├── naoConformidades/
│   │   │   │   ├── TelaNaoConformidades.jsx         (lista do comprador: filtros por status/origem, chip "item fora do catálogo", KPI curadoria)
│   │   │   │   ├── ModalDetalheNC.jsx               (detalhe completo, edição de item, mini-modais de análise ISO 9001, trilha de auditoria, geração de PDF)
│   │   │   │   ├── ModalNovaNC.jsx                  (M4.5 — abertura manual de NC, autocomplete item, anexos com preview)
│   │   │   │   └── ModalGerarPdfNC.jsx              (geração de PDF: versão interna e versão fornecedor)
│   │   │   │
│   │   │   ├── fornecedores/
│   │   │   │   ├── TelaFornecedoresNova.jsx         (lado comprador: locais + globais; global com 🔒, ❌/✅ = desativar só para o tenant)
│   │   │   │   ├── TelaMeusDadosFornecedor.jsx      (portal do fornecedor: dados da empresa + login + troca de senha)
│   │   │   │   ├── TelaNaoConformidadesFornecedor.jsx (lista de NCs do fornecedor)
│   │   │   │   └── ModalDetalheNCFornecedor.jsx     (detalhe de NC no portal do fornecedor: contestar/resolver, anexos, PDF)
│   │   │   │
│   │   │   ├── usuarios/
│   │   │   │   ├── TelaUsuariosNova.jsx             (CRUD de usuários, multi-perfil com toggles)
│   │   │   │   ├── ModalMeuPerfil.jsx               (M4.7 — modal do próprio usuário: nome, telefone, trocar senha)
│   │   │   │   └── phone-input.css                  (override dark do react-phone-number-input)
│   │   │   │
│   │   │   ├── portal/
│   │   │   │   ├── TelaFornecedor.jsx               ("casca" do Portal Fornecedor logado: menu Cotações, Pedidos, NCs, Spot, Catálogo, Meus Dados)
│   │   │   │   ├── TelaFornecedorSpot.jsx           (Canal Spot do fornecedor — abas, cores, busca, resultado)
│   │   │   │   ├── TelaCatalogoFornecedor.jsx       (catálogo do fornecedor anunciante: CRUD + import CSV)
│   │   │   │   ├── TelaPortalFornecedor.jsx         (⚠ NÃO é o portal logado: página PÚBLICA de resposta de UMA cotação via link com token)
│   │   │   │   └── FormularioRespostaCotacao.jsx    (formulário compartilhado entre link público e hub autenticado)
│   │   │   │
│   │   │   ├── (spot) TelaCanalSpot.jsx             (Canal Spot do comprador — demandas, situações por cor, busca, encerrar/reabrir)
│   │   │   │
│   │   │   ├── shared/
│   │   │   │   └── SeletorAtuacao.jsx               (⭐ 10/2026 — chips do perfil de atuação, usado no portal, no cadastro do tenant e no Canal Spot; cache das opções)
│   │   │   │
│   │   │   ├── equipamentos/, catalogo/, historico/, relatorio/, financeiro/,
│   │   │   │   inteligencia/, plano/, benchmark/, layouts/, shared/
│   │   │
│   │   ├── hooks/
│   │   │   ├── useCotacoes.js, useChamados.js, useFornecedores.js, useAuth.js,
│   │   │   │   useCatalogo.js, useEquipamentos.js, useEmail.js, usePortal.js,
│   │   │   │   useTarefas.js, useUsuarios.js
│   │   │
│   │   ├── services/
│   │   │   ├── apiService.js       (cliente HTTP genérico)
│   │   │   └── ...Service.js por domínio
│   │   │
│   │   ├── utils/
│   │   │   ├── csvFornecedorUtils.js  (parser CSV quote-aware + sinônimos de coluna + normalização de preço BR/US)
│   │   │   └── gerarPdfNC.js          (M4.5 — gera o HTML printável da NC, CSS embutido)
│   │   │
│   │   ├── TelaLogin.jsx
│   │   ├── TelaEsqueciSenha.jsx       (M4.6)
│   │   ├── TelaResetSenha.jsx         (M4.6)
│   │   ├── TelaSignup.jsx
│   │   └── App.jsx, main.jsx
│   │
│   └── .env.local, package.json, vite.config.js
│
└── README.md (este arquivo)
```

---

## 🗄️ Banco de Dados

### Núcleo multi-tenant
- **tenants** — `id | slug | nome | cnpj | telefone | email_contato | email_admin | plano | status | regiao (UF da operação principal — editável em Configurações → Empresa) | participa_benchmark | custo_recebimento_nf | comunicacao_*_policy | nc_notificacao_policy | criado_em | atualizado_em`
- **usuarios** — `id | tenant_id | nome | email | telefone | perfil | ativo | criado_em | atualizado_em`. `perfil` continua sendo o "principal" (compatibilidade com checks legados); o multi-perfil de verdade vive em `usuario_perfis`. `telefone` em E.164 (`+5511999999999`).
- **perfis** ⭐ (M4.6) — catálogo dos 6 perfis canônicos: `admin | gestor | comprador | operacao | qualidade | financeiro`. Colunas: `codigo (PK) | nome | descricao | ordem`.
- **usuario_perfis** ⭐ (M4.6) — N:N entre usuários e perfis (multi-perfil). `usuario_id | perfil_codigo`. Não tem `tenant_id` — isolamento por transitividade (ver regra multi-tenant no `db.js`).
- **equipamentos** — `id | tenant_id | tag | nome | local | fabricante | modelo | serie | ativo | criado_em`.

### Fornecedores ⭐ (atualizado 16/10/2026 — ver seção 7)
- **fornecedores** — uma linha por empresa fornecedora. Colunas relevantes: `id (bigint) | tenant_id | tipo ('local' | 'global') | nome | nome_fantasia | razao_social | cnpj | email | email_contato | nome_contato | telefone | whatsapp | contatos (jsonb) | categorias (jsonb) | palavras_chave (text[]) | dados_cnpj (jsonb) | situacao_cnpj | ativo (integer) | ...endereço`.
  - **CHECK `fornecedores_tenant_por_tipo`** (migration 008): `global` ⇒ `tenant_id IS NULL`; `local` ⇒ `tenant_id IS NOT NULL`.
  - **Cadastro único (migration 009, gatilho `fornecedores_sincroniza_cadastro`):** os campos duplicados andam sempre juntos, em qualquer gravação:
    - `nome_fantasia` é o nome oficial → `nome` é cópia
    - `email` é o e-mail oficial (recebe cotação, OC e NC) → `email_contato` é cópia
    - `contatos` (lista de pessoas, com papel) × `nome_contato/telefone/whatsapp`: quem gravou a **lista** (tela do tenant) faz os campos soltos copiarem o 1º contato; quem gravou os **campos soltos** (Meus Dados do fornecedor) atualiza o 1º contato da lista
    - `contatos` é gravado como lista jsonb de verdade (o gatilho converte o texto que o backend ainda manda com `JSON.stringify`)
    - O gatilho **não** copia `email` para `contatos[0].email` quando o tenant edita a lista: o tenant pode ter um contato de cotação diferente do e-mail oficial
  - **Perfil de atuação (migration 010):** `atuacao_segmentos | atuacao_sistemas | atuacao_marcas | atuacao_ofertas | atuacao_ufs` (text[], códigos de `atuacao_opcoes`; `'BR'` em `atuacao_ufs` = Brasil todo). Índices GIN para o Match Score (operador `&&`). Global: preenchido pelo próprio fornecedor no portal; local: pelo tenant. Tudo opcional.
  - ⚠ `categorias` (lista antiga do tenant, com cara de indústria) foi **convertida** para `atuacao_sistemas` e não é mais usada; a coluna ficou só para conferência — apagar depois.
  - ⚠ `dados_cnpj` continua podendo vir como string dentro do jsonb. Ler sempre de forma tolerante aos dois formatos.
- **Plano (migration 012):** `plano ('gratuito' | 'pro') | plano_valido_ate (NULL = sem vencimento) | recomendacoes_email (opt-out do fornecedor) | descadastro_token (uuid do link do e-mail)`. O plano só muda pela plataforma (SQL/admin) — `PUT /fornecedor/me` aceita apenas `recomendacoes_email`.
- **recomendacoes_enviadas** (migration 012) — `fornecedor_id | demanda_id | tipo ('imediato' | 'resumo') | enviado_em`, PK (fornecedor, demanda): cada demanda é avisada no máximo uma vez a cada fornecedor.
- **recomendacoes_email_log** (migration 012) — um registro por e-mail de recomendação enviado; base da cota diária.
- **atuacao_opcoes** ⭐ (migration 010) — listas fechadas do perfil: `dimensao ('segmento' | 'sistema' | 'marca' | 'oferta' | 'uf') | codigo | nome | grupo | ordem | aprovado | sugerido_por_fornecedor_id | sugerido_por_tenant_id`, `UNIQUE(dimensao, codigo)`. Incluir opção = INSERT, sem deploy. Marca digitada em "Outra marca" entra com `aprovado = false` (aparece "em análise" só para quem sugeriu); aprovar com `UPDATE atuacao_opcoes SET aprovado = true WHERE dimensao = 'marca' AND codigo = '...'`.
- **tenant_fornecedores** ⭐ (migration 007) — vínculo privado tenant ↔ fornecedor: `id | tenant_id | fornecedor_id (FK CASCADE) | ativo | preferido | obs | criado_em | atualizado_em`, `UNIQUE(tenant_id, fornecedor_id)`. Hoje guarda o "desativar para mim" dos globais; na etapa 2 passa a guardar também o vínculo dos locais.
- **fornecedor_usuarios** — login do portal do fornecedor: `id (uuid) | fornecedor_id (integer → fornecedores.id) | nome | email | senha_hash | perfil | ativo | criado_em`. ⚠ A coluna de senha é **`senha_hash`** (não `senha`).
- **fornecedores_spot** — 🪦 **órfã**. Tinha `fornecedor_origem_id | segmentos | marcas | palavras_chave` (extensão de perfil spot). Nenhuma rota usa mais; será absorvida pelo perfil de atuação (Roadmap, etapa 4).

### Núcleo de compra: OS → RM → RC → OV
Ver seção 5 para o fluxo completo.
- **chamados** — OS e RM (`tipo_documento: 'os' | 'requisicao_material'`). Campos: `id | tenant_id | equipamento_id | numero | status | urgencia | categoria | descricao_geral | servico_nome | modo_programacao | data_inicio_prevista | data_fim_prevista | tipo_documento | origem_os_id | origem_os_numero | origem_rc_id | origem_rc_numero | bloqueado_em | criado_em`.
- **chamado_itens** — lista única material+serviço.
- **chamado_apontamentos** — apontamento por item de serviço.
- **cotacoes** ⭐ — a RC.
- **cotacao_itens** — itens da RC (`fornecedores_ids` define quais fornecedores veem cada item).
- **cotacao_fornecedores** ⭐ — resposta por fornecedor na RC.
- **cotacao_fornecedor_itens** — resposta item a item.
- **ordens_venda** — OV emitida após escolha do fornecedor.
- **nao_conformidades** — ver seção 10 para o schema completo.

### Canal Spot ⭐
- **demandas_spot** — `id | numero (DSP-YYYY-NNNN) | tenant_id | comprador_id | descricao_equipamento | marca_modelo | componente | part_number | quantidade | comentarios | urgencia | foto_path | status ('aberta' | 'encerrada') | visualizada_em | criado_em` + encerramento: `encerrada_em | encerramento_motivo ('comprado_canal' | 'comprado_fora' | 'nao_necessario' | 'outro') | fornecedor_vencedor_id | encerramento_observacao` + atuação (migration 010, opcionais): `segmento | sistema | ofertas_aceitas (text[])` + migration 011: `uf` (estado onde precisa da peça; padrão = `tenants.regiao`; CHECK 2 letras) `| editada_em`.
- **interesses_spot** — `id | demanda_id | tenant_id | fornecedor_id | mensagem | valor_estimado | observacao_fornecedor | status ('pendente' | 'escolhido' | 'nao_escolhido') | criado_em`.
- **demandas_spot_visualizacoes** — uma linha por (demanda, fornecedor) na 1ª visualização.

### Módulo de Não Conformidades (M4.4/M4.5)
- **nao_conformidades** — `numero_nc | tenant_id | ordem_venda_id | numero_pedido | fornecedor_id | fornecedor_nome | fornecedor_tratativa_status | fornecedor_ciente_em | fornecedor_ciente_por_nome | numero_nota_fiscal | data_recebimento | data_ocorrencia | inspetor_id | criado_por_nome | motivo_recusa | descricao_problema | quantidade | unidade_medida | lote | numero_serie | validade | item_catalogo_id (M4.5) | item_consumo_id (M4.5 — ponte pro estoque) | item_nome_avulso (M4.5 — texto livre quando item fora do catálogo) | item_sku_avulso (M4.5) | item_fora_catalogo (M4.5 — flag pra Qualidade revisar) | tipo_resolucao | rodada | status (aberta | em_analise | em_execucao | aguardando_validacao | resolvida | cancelada) | fornecedor_tratativa_status (nao_enviado | enviado | visualizado | contestada | resolvida_fornecedor | devolvida | null) | criado_em | atualizado_em`. Constraint CHECK em `fornecedor_tratativa_status` (whitelist). Bloco `causa_raiz` / `cinco_porques` (jsonb) / `acao_corretiva` / `encerrada_por_*` / `devolvida_validacao_*`.
- **nao_conformidade_eventos** — timeline: `nc_id | tipo | descricao | dados (jsonb) | criado_por | criado_por_nome | criado_em | visivel_fornecedor | autor_tipo`.
- **nao_conformidade_anexos** — `nc_id | url | nome_arquivo | mime_type | tamanho_bytes`. O `url` contém o path do bucket `nc-evidencias` (M4.5) — antes era data URI inline. Anexos antigos (data URI) continuam válidos e são detectados no `gerarPdfNC.js`.
- **nao_conformidade_plano_acao** — plano 3W opcional.

### Multi-perfil, reset de senha e afins
- **perfis / usuario_perfis** — descritos acima.
- **password_resets** ⭐ (M4.6) — `id | tenant_id | usuario_id | fornecedor_usuario_id | email | token_hash | expira_em | usado_em | criado_em`. Serve tenant e fornecedor (uma das duas FKs preenchida, a outra null). Token cru nunca é guardado — só o SHA-256.

### Estoque e reservas
- **itens_consumo** — almoxarifado com saldo físico. Coluna `item_sku_avulso` (M4.5 — part number livre quando o item não tem catálogo).
- **ordem_venda_itens, historico_contagens_cegas, estoque_reservas, movimentacoes_estoque, solicitacoes_retirada, config_estoque** — inalterados.

### Catálogo e marketplace
- **catalogo_itens** — catálogo do tenant.
- **fornecedor_itens, fornecedor_produtos** — inalterados. `fornecedor_produtos` é global (não tenant-scoped) — por isso toda busca nele precisa ser filtrada pelos fornecedores visíveis ao tenant (seção 7).
- **normalizar_pn / normalizar_texto** — inalteradas.

### Storage
- Bucket **nc-evidencias** (privado) — M4.5. Path: `tenant-{id}/nc-{id}/evidencia-NN.ext`. Acesso sempre via signed URL (1h TTL, `download: false`).
- Bucket **nfe-xmls** (privado) — XML de NF-e.
- Fotos de demandas spot — via `StorageSpot.js` (signed URL). A foto é comprimida no navegador antes do upload (ver seção 8).

### Migrations recentes
- **007_tenant_fornecedores.sql** — cria `tenant_fornecedores`.
- **008_fornecedores_globais_sem_tenant.sql** — `tenant_id` deixa de ser NOT NULL em `fornecedores`; globais passam a `tenant_id NULL`; CHECK `fornecedores_tenant_por_tipo`.
- **012_plano_fornecedor_recomendacoes.sql** — plano do fornecedor, opt-out, token de descadastro, tabelas de envio. Idempotente.
- **agendamento_supabase_resumo_diario.sql** — pg_cron + pg_net: acorda o Render às 06:57 e dispara o resumo às 07:00 (Brasília). Trocar URL e segredo antes de rodar.
- **011_demanda_spot_uf_edicao.sql** — `demandas_spot.uf` e `editada_em`; demandas existentes herdam `tenants.regiao`. Idempotente.
- **010_perfil_atuacao.sql** — tabela `atuacao_opcoes` com as listas iniciais (8 segmentos, 20 sistemas, 32 marcas, 4 ofertas, 27 UFs + Brasil todo); colunas `atuacao_*` em `fornecedores`; `segmento/sistema/ofertas_aceitas` em `demandas_spot`; conversão `categorias → atuacao_sistemas`. Idempotente.
- **009_fornecedores_cadastro_unico.sql** — corrige os dados atuais (contatos como lista, e-mail inválido descartado, cópias preenchidas) e cria o gatilho `fornecedores_sincroniza_cadastro`. Idempotente.
- **Encerramento spot** — colunas `encerrada_em`, `encerramento_motivo`, `fornecedor_vencedor_id`, `encerramento_observacao` em `demandas_spot`; `em_negociacao` convertido para `aberta`.

### Outras tabelas
`tarefas, tarefa_comentarios, fornecedor_preco_historico, cnpj_alertas, notas_periodo, cliente_frota, fornecedor_upload_log`.

**Órfãs, não usadas (mantidas):** `ordens_servico`, `ordem_servico_itens`, `fornecedores_spot`. (`backend/routes/useAuth.js` deletado em M4.6.)

---

## 🔄 Fluxo de Negócio: OS → RM → RC → OV

(Mantido integralmente da versão anterior — o fluxo não mudou.)

**Atualização 10/2026:** em todas as etapas que envolvem fornecedor (sugestão na cotação automática, vínculo na RC, envio de e-mail, OV, recebimento, NC, validação de XML), o tenant passa a enxergar **os próprios fornecedores locais + os globais**. Antes, o global só funcionava para o tenant em que tinha sido cadastrado.

---

## 🔎 Marketplace de Fornecedores e Busca Unificada de Item

(Mantido integralmente da versão anterior — a busca unificada e as duas rotas com contratos diferentes seguem como em 10/09/2026.)

**Adição M4.5:** a mesma busca unificada é usada pela NC na tela do comprador. O endpoint é `GET /nao-conformidades/buscar-item` — não reaproveita o `/catalogo/buscar-item` porque o contrato é diferente (a NC precisa saber se o item tem estoque — `itens_consumo` — além do catálogo). Retorna `{ item_consumo_id, catalogo_item_id, nome, sku, tem_estoque }` e o front usa 2 ícones: 📦 (tem estoque) / 📖 (só catálogo). Dedup por `catalogo_item_id`.

**Correção 10/2026 (vazamento):** `GET /busca-fornecedores/:catalogoItemId` chama `buscar_fornecedores_para_item`, que lê `fornecedor_produtos` (catálogo global) e devolvia nome **e preço** de fornecedor LOCAL de outro tenant. Agora a rota pede folga à função (`limite × 5`, máx. 100), filtra pelos fornecedores visíveis ao tenant e corta no limite pedido.

---

## 🤝 Fornecedores Locais × Globais — Regras de Acesso

### Regras de visibilidade (decisão de produto)

**Tenant (comprador)**
- Vê os fornecedores que ele mesmo cadastrou (**locais**) + os **globais** da plataforma.
- Emite cotações/OC para os próprios fornecedores e para os globais.
- Demandas spot que ele publica ficam visíveis para **todos** os fornecedores da rede.
- **Nunca, em hipótese alguma, vê dados de outro tenant.**

**Fornecedor**
- Recebe pedidos de cotação de qualquer tenant (somente os enviados a ele).
- Vê as demandas spot de todos os tenants.
- **Nunca vê cotações nem propostas spot de outros fornecedores.**

**Confidencial entre as partes (tenant ↔ fornecedor):** preço, prazo e condição de pagamento **negociados** (resposta de cotação, OV, proposta spot).

### Refinamentos
- **Preço de catálogo ≠ preço negociado.** O preço que o fornecedor publica no próprio catálogo é de tabela (aparece na busca do marketplace); o confidencial é o negociado. Mas catálogo de fornecedor **local** de outro tenant nunca aparece.
- **Identidade da empresa ≠ relacionamento.** Uma empresa = um registro em `fornecedores` (dados mantidos pelo próprio fornecedor). O que é privado do tenant (ativo/preferido para ele, observações) vai em `tenant_fornecedores`. Um tenant nunca fica sabendo do vínculo de outro.
- **Demanda spot expõe a identidade do comprador** (empresa, nome, e-mail, telefone) para toda a rede — decisão consciente, necessária para o contato. Possível opção futura: demanda anônima.

### Implementação
- **`services/fornecedoresVisiveis.js` é a fonte única da regra.** Funções:
  - `fornecedoresDoTenant(db, tenantId, { somenteAtivos })` — locais do tenant + globais (menos os globais que o tenant desativou para si)
  - `mapaFornecedoresDoTenant(db, tenantId, opcoes)` — o mesmo, indexado por id
  - `fornecedorDoTenant(db, tenantId, fornecedorId)` — um fornecedor, só se o tenant puder usá-lo (local dele ou global); local de outro tenant → `null`
  - `emailFornecedor(f)` — `email` do cadastro ou, na falta, `email_contato` do portal
- **Global é identificado por `tipo = 'global'`, nunca por `tenant_id`.**
- **`routes/fornecedores.js` (tela do tenant):**
  - GET lista locais + globais (globais primeiro, ordem alfabética), cada um com `editavel`
  - Global é **somente leitura**: PUT com campo cadastral → 403; DELETE → 403. O tenant só faz "ativar/desativar para mim" (+ `preferido`), gravado em `tenant_fornecedores`
  - Local de outro tenant → 404 em GET/PUT/DELETE
  - POST força `tipo = 'local'`; CNPJ que já é de um global → 409 ("já está na sua lista")
  - Alertas de CNPJ sem `DB.raw` (antes o nome não vinha e "marcar como lido" não gravava); PUT aceita `/alertas/cnpj/:id/ler` e `/alertas-cnpj/:id/ler`
- **Rotas/serviços que buscam fornecedor por id para um tenant** usam `fornecedorDoTenant`: `CotacaoService.js`, `cotacoes.js`, `naoConformidades.js`, `ordensVenda.js`, `estoque/movimentacoes.js`, `estoque/itensConsumo.js`, `NCService.js`, `PortalRespostaService.js`, `ValidacaoXmlService.js`, `buscaFornecedores.js`.
- **Mantidos de propósito sem a regra:** 3 buscas por e-mail em `ordensVenda.js` (modelo antigo de fornecedor-usuário do tenant); `cnpj.js` (tenant não reconsulta CNPJ de global — correto); rotas do próprio fornecedor (`fornecedor.js`, `fornecedorNC.js`, `auth.js`), que buscam pelo `req.fornecedorId`.

---

## ⚡ Canal Spot — Demandas Urgentes e Itens Raros

**Não é cotação de compras.** É o canal para itens raros ou urgentes: o comprador publica a demanda, a rede de fornecedores vê e marca "Tenho interesse". Quanto mais combinação, mais rápido se conecta quem precisa com quem tem.

### Fluxo
1. **Comprador publica** a demanda (equipamento, marca/modelo, componente, PN, quantidade, urgência, comentários, foto opcional). Número `DSP-YYYY-NNNN`.
2. **Fornecedores veem** em "Oportunidades Spot"; "● Nova" até abrir. A 1ª abertura registra visualização (o comprador vê 👁 N visualizações).
3. **Fornecedor clica "Tenho interesse"** (valor estimado e observação opcionais).
4. **Negociação fora do sistema** (e-mail/WhatsApp, botões dos dois lados com mensagem pré-montada).
5. **Comprador encerra** escolhendo com 1 clique: um dos fornecedores que responderam, "comprei fora do Canal Spot", "não preciso mais" ou "outro motivo". O backend marca o interesse do vencedor como `escolhido` e todos os outros como `nao_escolhido`.
6. **Reabrir:** demanda volta a `aberta` e todos os interesses a `pendente`.
7. **Editar (enquanto aberta):** `PUT /spot/demandas/:id` — todos os campos, inclusive segmento, sistema, "Aceita" e estado; grava `editada_em`. Comprador vê aviso se já há respostas; fornecedor que respondeu antes vê "⚠ O comprador editou a demanda depois da sua resposta". Foto continua no botão "Trocar imagem".
8. **Nova a partir desta:** outra peça do mesmo equipamento — formulário já preenchido (equipamento, marca, segmento, sistema, Aceita, urgência, estado), componente/PN/quantidade em branco. **Uma demanda = uma peça** (mantém o encerramento "quem forneceu?" e os indicadores simples).
9. **Estado onde precisa da peça:** padrão = região da empresa (`GET /spot/config`); pode ser trocado por demanda (transportadora com bases em vários estados).

### Comprador — situação calculada (não é status gravado)
| Cor | Situação |
|---|---|
| 🟡 | Sem resposta |
| 🟢 | Com resposta |
| 🔴 | Sem resposta há +7 dias |
| 🟣 | Com resposta há +7 dias |
| ⚫ | Encerrada |

Busca única (número, item, PN, equipamento; sem acento, ignora hífen/espaço em número e PN). Propostas ordenadas por valor, 🏆 no menor.

### Fornecedor — abas
- **Em andamento** (padrão): 🟡 resposta não enviada · 🟢 resposta enviada · 🔴 resposta enviada há +7 dias sem decisão do comprador
- **🏆 Vencidas** — resumo com total das propostas; visíveis por **90 dias** após o encerramento
- **Não vencidas** — comprador comprou de outro (no canal ou fora); **30 dias**
- **Canceladas** — "não preciso mais do item"; **30 dias**

Os prazos são aplicados **no backend** (o que expirou nem é enviado); o histórico completo fica no banco para indicadores. Encerradas somem para quem não respondeu. **Nunca** se mostra nome ou preço do vencedor aos demais. Busca única inclui empresa e nome do cliente.

### Foto
Upload antes ou depois de publicar ("Adicionar imagem" / "Trocar imagem"). Compressão no navegador (lado maior 1280px, JPEG 70% — foto de celular de 4–8 MB cai para ~150–400 KB); limite de 20 MB antes de comprimir. Ao trocar, a foto antiga é removida do storage (se `StorageSpot.removerArquivo` existir).

### Match Score — "Recomendadas para você" (etapa 6, fase 1)
Calculado em `services/matchSpot.js` a cada abertura da tela do fornecedor (sem tabela — mudou a atuação, mudou a recomendação) e devolvido em `match` no `GET /spot/fornecedor/demandas`.

| Critério | Pontos | Motivo mostrado |
|---|---|---|
| PN da demanda no catálogo do fornecedor (`fornecedor_produtos`, PN só alfanumérico) | 100 | "Você tem esse PN no catálogo" |
| Mesmo segmento | 30 | "Você atende Guindaste" |
| Mesmo sistema | 25 | "Você trabalha com Hidráulica" |
| Marca citada em Marca/Modelo, equipamento ou componente (palavra inteira; "VW / MAN" casa "MAN"; "Mercedes-Benz" casa "Mercedes") | 20 | "Você atende XCMG" |
| Atende o estado da demanda (`demandas_spot.uf`; se vazio, `tenants.regiao`) ou Brasil todo | 15 | "Você atende RJ" |
| Oferta aceita pela demanda ∩ oferta do fornecedor | 10 | "Aceita Usada / recondicionada" |

- Faixas: **≥ 60 combina muito · 30–59 combina · 1–29 pode interessar** (nunca porcentagem).
- **Estado e oferta só reforçam**: sem casamento de PN, segmento, sistema ou marca, não há recomendação (senão "Brasil todo" recomendaria tudo).
- **Ordena, não esconde**: na aba Em andamento, as recomendadas ainda não respondidas vêm no topo ("Recomendadas para você (n)"), com faixa e motivos; depois "Outras demandas". Detalhe mostra "Por que combina com você".
- Fornecedor sem atuação preenchida vê aviso para preencher em Meus Dados → Atuação.

### Plano do fornecedor e e-mails de recomendação (etapa 8)
| | Gratuito | Pro |
|---|---|---|
| Participar de cotações, receber pedido de cotação / OC / NC / "você foi escolhido" por e-mail | ✅ | ✅ |
| Canal Spot e "Recomendadas para você" no portal | ✅ | ✅ |
| **Alerta imediato** por e-mail (demanda "Combina muito", ou urgente que combina) | — | ✅ |
| **Resumo diário 7h** por e-mail (demandas abertas há até 7 dias que combinam, ainda não avisadas e não respondidas; máx. 10; sem novidade = sem e-mail) | — | ✅ |

- **E-mails transacionais nunca são pagos** — quem dispara é o tenant, que paga o SaaS.
- **"Prioridade" é de tempo, não de posição:** o Pro fica sabendo antes; a ordem das propostas que o comprador vê nunca é comprada.
- **Cota própria:** `RECOMENDACOES_LIMITE_DIA` (padrão 60) — recomendações nunca consomem a cota do Resend (grátis = 100/dia) que os transacionais precisam.
- **Uma demanda = no máximo um aviso por fornecedor** (imediato ou resumo, nunca os dois).
- **Descadastro** em todo e-mail (LGPD): link no rodapé + cabeçalho `List-Unsubscribe` / `List-Unsubscribe-Post` (botão nativo "Cancelar inscrição" do Gmail/Outlook, `POST /api/recomendacoes/descadastrar/:token`). Desliga só as recomendações; o fornecedor Pro religa em Meus Dados. **Sem `BACKEND_URL` nenhum e-mail de recomendação sai** (log `❌ [recomendacoes] BACKEND_URL não configurada`).
- **Conteúdo (etapa 9):** assunto começa pela demanda principal ("⭐ Bomba de Combustível e mais 2 demandas…", "URGENTE:" quando for o caso); cada demanda tem "Ver e responder →" que abre `FRONTEND_URL/?spot=<id>`; versão em texto puro junto com o HTML.
- **Link direto (`?spot=<id>`):** `TelaFornecedorSpot.jsx` guarda o id no `sessionStorage` já no carregamento da página (sobrevive ao login); `TelaFornecedor.jsx` abre direto em "Oportunidades Spot"; a demanda abre no detalhe, na aba certa; se não estiver mais disponível, aparece aviso. O parâmetro é limpo da URL depois de usado.
- Gratuito vê convite discreto para o Pro no Canal Spot e em Meus Dados.
- **Ativar Pro (até existir cobrança):** `UPDATE fornecedores SET plano = 'pro', plano_valido_ate = now() + interval '6 months' WHERE id = ...;`
- **Variáveis de ambiente (Render):** `CRON_SECRET` (≥ 16 caracteres, obrigatório), `BACKEND_URL` (link de descadastro), `FRONTEND_URL` (botão "Ver no portal"), `RECOMENDACOES_LIMITE_DIA` (opcional), `CRON_INTERNO=1` (só em servidor sempre ligado — aí o node-cron interno substitui o pg_cron).

### Decisões de produto registradas
- O clique em "Email/WhatsApp" **não** é usado como sinal de contato (o comprador pode ligar direto do celular) — a fonte confiável do desfecho é o encerramento.
- Campos internos do comprador (`fornecedor_vencedor_id`, `encerramento_observacao`) **não** são enviados ao fornecedor.

---

## 📊 Benchmarking de Mercado

### Visão geral
Página dedicada do tenant que compara **os preços que ele praticou** contra a **faixa de preços da rede QuotaFlow** — sem abrir valores de concorrentes nominalmente. O que o cliente vê é:

> "Você pagou R$ 1.000 neste item. A rede QuotaFlow registrou valores entre R$ 800 e R$ 1.200, com mediana R$ 950. **Considere incluir o fornecedor XYZ na próxima cotação** — este fornecedor tem histórico de venda do mesmo item por R$ 900."

### Como o número aparece
- **Só o tenant vê os próprios valores.** Nunca os de outro tenant.
- **Faixa da rede** só aparece quando há **≥ 5 fornecedores** com histórico do item (anonimato estatístico — mesmo princípio dos benchmarks de folha de pagamento).
- **Convite ao fornecedor** só aparece quando um fornecedor específico tem histórico do mesmo item a preço menor que o praticado — e ele não foi convidado na última cotação. Ação de 1 clique: "Incluir na próxima cotação".

### De onde vêm os dados
- `fornecedor_produtos` (marketplace) — catálogo do fornecedor anunciante, global. Alimentado por CSV ou manual pelo próprio fornecedor.
- `cotacao_fornecedor_itens` — preço praticado nas cotações fechadas.
- `fornecedor_preco_historico` — série temporal (preço por item, por fornecedor).
- `catalogo_itens.codigo` (PN) — chave de agregação entre tenants.

### Limitação atual (honesta)
Hoje o banco **não tem volume suficiente** para a faixa da rede aparecer na maioria dos itens (precisa de ≥ 5 fornecedores por item). A página existe e funciona; ela **cresce junto com o marketplace**. Enquanto o volume não vem, o que dá pra entregar:
- Comparação do tenant **contra ele mesmo** (mesmo item, mês anterior, média dos últimos 6 meses) — zero dependência de rede.
- "Você pagou R$ 1.000; na sua última compra deste item você pagou R$ 850."
- Recomendação "considere incluir fornecedor Y" quando o próprio tenant já comprou mais barato de outro fornecedor.

### Valor de produto
- **Retenção:** o cliente não sai porque perde o histórico de economia.
- **Monetização (fase 2):** fornecedor pode pagar **destaque** pra aparecer na recomendação "incluir na próxima cotação". Modelo análogo ao "patrocinado" do Google Shopping — cobrança por impressão ou por inclusão efetiva.
- **Efeito de rede:** quanto mais tenants usam, melhor o benchmark de todos. É um dos poucos features que **melhora com o tempo sem dev adicional**.

---

## 🧭 Módulo de Não Conformidades (M4.4 – M4.5)

### Fluxo completo (ISO 9001 cláusula 10.2)
1. **Abertura** — via OS/recebimento (origem `os_material`, `os_servico`, `recebimento`) ou manual (`ModalNovaNC`, origem `inspecao`).
2. **Notificação ao fornecedor** — gestor clica "📤 Notificar fornecedor"; `NCService.notificarFornecedorNC` (idempotente) envia e-mail + muda `fornecedor_tratativa_status` pra `enviado`. Funciona também para fornecedor **global** (10/2026).
3. **Tratativa** — fornecedor responde pelo portal (contestar ou resolver). Comprador analisa: pode validar (encerra NC), devolver (loop de rodadas), aceitar contestação (cancela NC) ou rejeitar contestação.
4. **Encerramento** — Qualidade registra causa raiz + 5 porquês (opcional), NC vira `resolvida`.

### Fluxos auxiliares da NC
- **Marcar como interna** — NC nasceu vinculada a fornecedor via OC, mas a triagem concluiu que não é problema dele. Zera `fornecedor_id`, mantém o histórico, fornecedor perde acesso ao portal.
- **Curadoria de item (M4.5)** — quando o operador abre NC com item fora do catálogo (texto livre), a Qualidade pode depois vincular ao catálogo (`POST /:id/vincular-item`) ou editar como item avulso (`POST /:id/editar-item-avulso`). Ícone ⚠ no chip enquanto pendente.

### Bloqueio de OS por NC ativa (M4.4-etapa-10d)
- **Backend:** `PUT /chamados/:id` (detalhe) recusa conclusão enquanto houver NC ativa vinculada via `chamado_id`.
- **Frontend:** botão "🔒 Concluir OS" fica com fundo preto e clique abre modal overlay (não substitui a tela) listando as NCs abertas com ação dupla (abrir NC / voltar). Item da OS com NC ativa ganha ⚠ clicável no header.
- **Regra:** qualquer NC com `status NOT IN ('resolvida','cancelada')` bloqueia.

### E-mails transacionais (M4.4-etapa-10d)
Todos os 5 eventos usam o mesmo template (`NCEmailTemplates.js`):
- Criação (`contexto: 'criacao'`) → fornecedor
- Devolução (E1 — `contexto: 'devolucao'`) → fornecedor
- Reenvio (E2) → comprador
- Contestação (E3) → comprador
- Resolução (E3) → comprador

O bloco de contexto (🏢 Cliente / 📋 NC / 📄 OC / 📦 Item / 🔖 PN / 🔢 Qtd / 🏷 Lote / 🔢 Série / 📆 Validade / 📝 Descrição) é sempre visível. Cabeçalho/rodapé são dinâmicos por contexto.

### PDF de NC (M4.5)
- Gerado no frontend via `window.print()` (não há dependência nova). O `gerarPdfNC.js` monta o HTML com CSS embutido.
- Duas versões: **interno** (comprador, com causa raiz / trilha de auditoria opcionais) e **fornecedor** (sem dados internos; com tratativa e histórico de devoluções).
- Sem links clicáveis pros anexos no PDF — fotos entram como miniatura (pixels), PDFs são listados só por nome. Decisão de segurança: PDF pode ser distribuído.
- Limitações conhecidas: sem "Página X de Y" no conteúdo (limitação do `window.print()`); fotos vão pra página seguinte se não couberem no bloco.

### Anexos no Storage (M4.5)
- Fotos e PDFs vão pro bucket `nc-evidencias`, path `tenant-{id}/nc-{id}/evidencia-NN.ext`.
- Signed URL gerada no `GET /:id` em batch (por `criarSignedUrlsEmBatch`).
- `download: false` → PDFs abrem em nova aba em vez de baixar.
- Anexos antigos (data URI inline) continuam válidos — o `gerarSignedUrl` detecta `data:` e devolve como está.

---

## 🔐 Multi-perfil, Reset de Senha e Meu Perfil (M4.6 – M4.7)

### Multi-perfil
- **Modelo:** `usuarios.perfil` continua sendo o "principal" (compatibilidade com checks antigos); `usuario_perfis` guarda o array de perfis do usuário.
- **JWT:** `auth.js` inclui `perfis: [...]` no payload. Fallback `[decoded.perfil]` cobre tokens emitidos antes da migração.
- **tenantMiddleware:** injeta `req.perfis` (array) e mantém `req.userPerfil` (single).
- **requerAdmin** (em `usuarios.js`): aceita se qualquer perfil do usuário é `admin`.
- **Frontend:** o `ModalMeuPerfil` e a `TelaUsuariosNova` usam 6 toggles (com `codigo` dos 6 perfis canônicos). `navItems` e `PERMISSOES` no `App.jsx` filtram por interseção de perfis.

### Reset de senha
- **Fluxo:** "Esqueci minha senha" → backend gera token → e-mail com link → `/reset-senha?token=...`.
- **Backend:** `PasswordResetService.js` (gerar/validar/consumir token, SHA-256, TTL 1h, rate limit 3/15min por e-mail).
- **Rotas:** `POST /api/auth/forgot-password`, `GET /api/auth/reset-password/validar`, `POST /api/auth/reset-password`.
- Resposta sempre 200 no `/forgot` (não vaza se o e-mail existe).
- Serve tenant e fornecedor — `encontrarUsuarioPorEmail` busca nas duas tabelas.
- **Frontend:** `TelaEsqueciSenha.jsx` + `TelaResetSenha.jsx`, rotas via state (`authRoute`) no `App.jsx`, não por hash (o Router do app intercepta o hash). Se o usuário sai, `setAuthRoute(null)` fecha.

### Meu perfil (M4.7a)
- `PUT /api/usuarios/me` — atualiza nome + telefone do próprio usuário (`req.userId` do JWT, nunca aceita id no body).
- `POST /api/usuarios/me/trocar-senha` — valida senha atual, atualiza.
- **Frontend:** `ModalMeuPerfil.jsx` (avatar com iniciais enquanto upload de foto não existe; 2 abas: dados + trocar senha). Botão no rodapé da sidebar abre o modal.
- ⚠ **Ordem de rotas:** `/me` e `/me/trocar-senha` precisam vir antes de `router.put("/:id")` e `router.post("/:id/...")` no `usuarios.js` — senão o Express casa `/me` com `/:id` e o handler tenta fazer `SELECT WHERE id = 'me'` → 500 UUID.

### Portal do fornecedor — Meus Dados
- `PUT /api/fornecedor/me` — fornecedor edita dados da empresa (`fornecedores`) e do próprio login (`fornecedor_usuarios`). Troca de senha usa a coluna **`senha_hash`** (corrigido 10/2026 — antes usava `senha` e nunca funcionava).

---

## 🚀 Como Rodar

### Pré-requisitos
Node.js 18+, npm, conta Supabase (Postgres + Storage), Git

### Iniciar Projeto
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

### Buckets do Supabase Storage
- **nc-evidencias** (privado) — obrigatório pro módulo de NC. Sem ele, `POST /nao-conformidades/:id/anexos` falha.
- **nfe-xmls** (privado) — pra XML de NF-e.
- Bucket das fotos de demanda spot — configurado em `services/StorageSpot.js`.

---

## ✅ Status das Features

### ✅ Em produção (histórico consolidado)
- Autenticação JWT, multi-tenant, cadastro de equipamentos
- Repaginação da OS: lista única material+serviço, numeração estável, apontamento de execução persistido
- Separação estrutural OS → RM → RC → OV completa
- Reserva de estoque + ponte `itens_consumo.catalogo_item_id ↔ catalogo_itens`
- Correção de vazamento de dados no portal do fornecedor
- Recebimento com e sem OV, NC, correção de bug de concatenação de saldo
- Catálogo do fornecedor (marketplace): CRUD + import CSV
- Busca unificada de item na OS (catálogo + marketplace, dual-source, sem curto-circuito)
- Recebimento reescrito com tracker visual de 3 etapas (Fiscal → Contagem → Entrada), com `entrada_por`/`entrada_em` gravados
- `itens_consumo` criado on-the-fly na primeira entrada
- Fuso horário corrigido no histórico de contagens (`contado_em` virou timestamptz)
- Cotações — Fase 1B: edição item a item, CIF/FOB por item, card "Vencedores por Item", Panorama executivo em 3 atos com Saving do Sistema / do Comprador
- Fluxos auxiliares da RC: remover/restaurar item, mover item pra nova RC (com herança de cotação), cancelar cotação, trava de edição
- Fixes pontuais: `excluirCotacao`, e-mails com `undefined`, `bloqueado_em` em `enviarCotacao`, filtro `'cancelado'` → `'cancelada'`

### ✅ Em produção (M4.4 – M4.7 — 13/10/2026)
- **M4.4:** e-mails transacionais de NC (5 eventos, template unificado), bloqueio de OS por NC ativa, modal overlay de bloqueio, chip "Devolvida ao fornecedor", banner "NC ativa" na OS com clique
- **M4.5:** abertura manual de NC (`ModalNovaNC`), item fora do catálogo com curadoria da Qualidade, vincular-item e editar-item-avulso, anexos no Supabase Storage com signed URL, PDF de NC (interno + fornecedor), contato empresa+comprador no PDF e no portal do fornecedor
- **M4.6:** reset de senha (forgot password com token por e-mail, TTL 1h), multi-perfil (backend + frontend + JWT + migração + varredura single→array), middleware global PATCH → PUT, telefone internacional (`react-phone-number-input`)
- **M4.7a:** modal "Meu perfil" com abas dados/senha, `PUT /api/usuarios/me` e `POST /api/usuarios/me/trocar-senha`

### ✅ Em produção (16/10/2026)
- **Canal Spot completo:** situações por cor (comprador), abas e expiração do histórico (fornecedor), busca única dos dois lados, encerrar com escolha do vencedor / reabrir, resultado para o fornecedor sem expor o vencedor, foto com compressão adicionada/trocada a qualquer momento
- **Plano Pro do fornecedor (etapa 8):** alerta imediato e resumo diário por e-mail só para Pro, cota diária, descadastro, convite Pro para o gratuito; agendamento via Supabase (Render grátis dorme)
- **Edição de demanda spot + região (etapa 7):** editar demanda aberta, "nova a partir desta", estado por demanda, aba Configurações → Empresa (região), Match Score lendo `tenants.regiao`
- **Match Score fase 1 (etapa 6):** "Recomendadas para você" no topo do Canal Spot do fornecedor, com faixa (combina muito / combina / pode interessar) e motivos; aviso para quem não preencheu a atuação
- **Perfil de atuação (etapa 4):** fornecedor marca segmentos, sistemas, marcas (+ "Outra marca" com aprovação), tipo de oferta e estados no Meus Dados; tenant marca o mesmo nos locais (substitui as antigas categorias, convertidas); demanda spot ganha segmento, sistema e "Aceita" (múltipla escolha) — tudo opcional
- **Cadastro único do fornecedor (etapa 3):** nome, e-mail e contato iguais em todas as telas (gatilho no banco); validação de e-mail no Meus Dados (antes aceitava "Peças" como e-mail)
- **Fornecedores globais (etapa 1 da unificação):** regra "locais + globais" em cadastro, cotação automática, vínculo e envio de RC, OV, NC, estoque, portal de resposta de cotação, validação de XML e marketplace; global somente leitura para o tenant com "desativar para mim"; migrations 007 e 008
- **Correções de segurança/integridade:** vazamento de nome/preço de fornecedor local de outro tenant no marketplace; RC aceitava vincular fornecedor local de outro tenant; interessado do spot lido de tabela errada (`fornecedores_spot` com id coincidente); troca de senha do portal (`senha_hash`)

### 🟡 Em progresso / próximo passo real
- **#5 Custo de recebimento por NF** — diferencial competitivo central
- **Unificação de fornecedores — etapas 2 a 5** (ver Roadmap)
- **Match Score do Canal Spot** (ver Roadmap)
- Tela única de consulta de estoque cobrindo consumíveis e peças/componentes juntos
- Validar `TelaGerarRequisicaoMaterial.jsx` na prática com um comprador de verdade usando dados reais

### ❌ Não iniciado
- **M4.7b** — Dashboard "Analista Sênior" (tela do zero, widgets por perfil, avatar clicável no canto superior direito, upload de foto). TODO marcado no `App.jsx`.
- **Painel do Fornecedor** (indicadores de sucesso: taxa de resposta, taxa de vitória, tempo médio de resposta, valor ganho; cotações)
- Tela consolidada de "grande marketplace" pro comprador
- E-mail/WhatsApp automático ao enviar cotação
- Dashboard, relatórios
- Reativação da aba "Manual" de `TelaCotacoesNovaComAbas.jsx`

---

## ⚠️ Armadilhas Conhecidas do Backend

### ⚠️ NUNCA filtrar `fornecedores` por `tenant_id` para o tenant (10/2026)
Fornecedor global tem `tenant_id` NULL. `DB.selectOne('fornecedores', { id }, tenantId)` **não encontra** o global — e falha em silêncio (nome vazio, e-mail não enviado, CNPJ "divergente"). Bug real: antes da etapa 1, o global só funcionava para o tenant 2 em 21 pontos do backend. **Regra:** toda rota nova que busca fornecedor para um tenant usa `services/fornecedoresVisiveis.js` (`fornecedorDoTenant`, `fornecedoresDoTenant`, `mapaFornecedoresDoTenant`). Global é identificado por `tipo`, nunca por `tenant_id`.

### ⚠️ Catálogos globais precisam ser filtrados pelo tenant
`fornecedor_produtos` e funções como `buscar_fornecedores_para_item` não conhecem tenant. Qualquer busca neles para um comprador precisa filtrar pelos fornecedores visíveis (`mapaFornecedoresDoTenant`) — senão vaza nome e preço de fornecedor local de outro tenant.

### ⚠️ Tabela de nome parecido ≠ mesma entidade
`routes/spot.js` buscava o interessado em `fornecedores_spot` pelo `id` — só funcionava porque o Global Peças tinha **id 7 nas duas tabelas**, por coincidência. Ao ligar tabelas, conferir a FK de verdade (`fornecedor_origem_id`) e de onde vem o id (`req.fornecedorId` vem de `fornecedor_usuarios.fornecedor_id` → `fornecedores.id`).

### ⚠️ jsonb gravado como string
`categorias` e `dados_cnpj` em `fornecedores` foram gravados com `JSON.stringify`, então chegam como **string** dentro do jsonb. `JSON.parse` direto quebra se algum registro vier como objeto. Ler sempre de forma tolerante: `typeof v === 'string' ? JSON.parse(v) : (v || padrao)`. (`contatos` já é normalizado pelo gatilho da migration 009, mas o leitor tolerante continua valendo.)

### ⚠️ Campos de cadastro do fornecedor têm gatilho
Gravar `nome`, `nome_fantasia`, `email`, `email_contato`, `contatos`, `nome_contato`, `telefone` ou `whatsapp` em `fornecedores` dispara a sincronização (migration 009). O valor que volta do `DB.update`/`DB.insert` pode ser diferente do que foi enviado (ex.: `contatos` volta como lista; `email_contato` volta igual a `email`). Para ler o e-mail do fornecedor, use `emailFornecedor(f)`; para o nome, `f.nome_fantasia || f.nome`.

### ⚠️ Coluna de senha do portal é `senha_hash`
`fornecedor_usuarios` usa `senha_hash`. Usar `.senha` faz `bcrypt.compare` falhar sempre ("Senha atual incorreta") e gravaria numa coluna inexistente.

### ⚠️ `DB.update` / `DB.delete` só filtram tenant quando ele tem valor
`if (tenant_id) query.eq("tenant_id", tenant_id)` — com `tenant_id` null/undefined, o filtro de tenant é **ignorado** e vale só o `id`. Isso é o que permite o fornecedor global salvar o "Meus Dados". Em contrapartida: em rota de tenant, **sempre** passar o `tenantId` explícito, senão o update vira por id puro.

### ⚠️ DB.delete só aceita ID único — não compõe filtro
`DB.delete(table, id, tenantId)` faz `.eq("id", id)`. Não funciona em tabelas N:N (`usuario_perfis`, `cotacao_fornecedores`) que não têm coluna `id`. Bug real: `DELETE FROM usuario_perfis WHERE id = '<uuid>'` retornava 0 linhas afetadas (nenhuma tinha `id`), e os perfis antigos ficavam. Corrigido com `DB.deleteWhere(table, where, tenantId)` (M4.6) — usa `DELETE WHERE` de verdade. **Sempre usar `deleteWhere` em tabelas N:N.**

### ⚠️ DB.raw cai no fallback genérico
`DB.raw()` só reconhece um punhado de padrões SQL hardcoded. Qualquer WHERE/ORDER BY/JOIN fora do reconhecido cai no fallback `SELECT * FROM <tabela>` ignorando o resto da query. Bugs reais: `GET /usuarios` (M4.5) e alertas de CNPJ em `fornecedores.js` (10/2026 — nome não vinha, UPDATE "marcar como lido" não gravava). **Regra:** se precisa de WHERE além de `tenant_id`, use `DB.select` + filtro em JS.

### ⚠️ DB.select / DB.selectOne ignoram null no filtro
Qualquer `null` no `where` é descartado silenciosamente. Sintoma perigoso: `DB.selectOne('itens_consumo', { catalogo_item_id: item.item_catalogo_id })` com `item_catalogo_id` null → vira `SELECT * FROM itens_consumo WHERE tenant_id = X LIMIT 1` → devolve o primeiro item do tenant. Sempre validar antes de passar pra `DB.selectOne`. Também não dá para filtrar `IS NULL` por aqui (ex.: globais) — por isso os globais são buscados por `{ tipo: 'global' }`.

### ⚠️ DB.select NÃO ordena
Ordem devolvida é arbitrária e pode mudar depois de qualquer UPDATE (heap físico do Postgres). Toda lista que o usuário vê precisa de `.sort()` em JS.

### ⚠️ bigint pode chegar como string — comparar ids com `String()`
`fornecedores.id` é bigint; `fornecedor_usuarios.fornecedor_id` é integer. Dependendo do caminho, o mesmo id chega como número ou string. Comparar sempre com `String(a) === String(b)` ou indexar mapas por `String(id)`.

### ⚠️ Ordem de rotas /me antes de /:id (M4.7a)
Rotas literais (`/me`, `/me/trocar-senha`) precisam vir antes de `router.put("/:id")`. Senão o Express casa `/me` com `/:id` e o handler tenta `SELECT WHERE id = 'me'` → erro UUID.

### ⚠️ Regra multi-tenant pra tabelas N:N sem tenant_id
Tabelas N:N (`usuario_perfis`, `cotacao_fornecedores`) não têm `tenant_id`. Isolamento é por transitividade via FK do usuário/entidade principal. Nunca consultar essas tabelas sem antes validar que a entidade principal pertence ao `req.tenantId`. Documentado no topo do `db.js`.

### ⚠️ Regra dos Hooks do React
Hooks (`useState`, `useEffect`, `useX`) nunca podem ser chamados depois de um `return` condicional. O número e a ordem de chamadas têm que ser idênticos em todo render. Bug real em `App.jsx`: rotas de auth por hash estavam antes dos hooks → React quebrava ao navegar. Corrigido movendo as rotas pra depois de todos os hooks.

### Demais armadilhas (mantidas da versão anterior)
`timestamp without time zone` é bug latente; trigger AFTER INSERT que referencia coluna renomeada aborta o INSERT; SQL Editor do Supabase não respeita BEGIN/COMMIT pra DDL; bigint/numeric voltam como string; `apiService.get(endpoint, { params })` é padrão errado; pg_trgm indexabilidade; LANGUAGE sql inlining; `DB.insert`/`DB.update` não fazem cast; constraint CHECK em coluna enum-like precisa de migration pra aceitar valor novo; NOT NULL herdado de modelo antigo (ex.: `fornecedores.tenant_id`) precisa ser revisto quando o modelo muda.

---

## 🧪 Processo de Entrega e Verificação

Lições da etapa 1 (10/2026), para as próximas entregas:

- **`node --check` não basta.** Na aplicação manual por DE→PARA apareceram 3 erros que compilam normalmente mas quebram em execução: `res.statusa(404)`, `const f = await` apagado (variável indefinida na linha seguinte) e uma troca esquecida.
- **Verificador por md5:** `backend/verificar-entrega.js` (fora do git) confere, em um comando, se cada arquivo entregue está idêntico ao testado (md5 normalizado — ignora quebra de linha final e CRLF), se a sintaxe é válida e se os `require` novos resolvem. Pegou todos os erros acima. Atualizar a lista de md5 a cada entrega.
- **Preferência de aplicação:** arquivo inteiro + verificador; ou, idealmente, PR direto no GitHub (revisão pelo diff, sem copiar/colar).
- **Arquivo novo não aparece no `git diff`** — lembrar do `git add` (ex.: `services/fornecedoresVisiveis.js`).
- **zsh (Mac):** em `node -e`, usar aspas simples por fora (`!` em aspas duplas dispara o histórico); em `grep --include`, usar `--include='*.js'`; `git diff` longo abre o paginador (`q` sai; `git --no-pager diff` evita).
- **Migrations:** testar em Postgres local antes (idempotência, CHECK, FK, CASCADE) e rodar dentro de `BEGIN; ... COMMIT;`.

---

## 🗺️ Roadmap / Decisões em Aberto

> **Sem datas.** A ordem abaixo é de prioridade, não de calendário. Cada item é atacado conforme tempo e necessidade de cliente.

### Prioridade alta — próximo passo real

- **Unificação de fornecedores (etapas 2 a 5).** Base para o Match Score.
  - **Etapa 2 — adiada (decisão 16/10/2026).** Diagnóstico: 5 fornecedores, nenhum CNPJ repetido. Mesmo CNPJ cadastrado como local por dois tenants é **correto** (cada um é privado). A junção só acontece quando a empresa assumir o próprio cadastro (etapa 5) ou for promovida a global. Ponto de atenção para essa junção: o id de fornecedor está em 3 formatos (`bigint` na maioria; `integer` em `fornecedor_usuarios`, `interesses_spot`, `movimentacoes_estoque`, `ordem_venda_itens`, `fornecedor_itens`, `fornecedor_upload_log`, `demandas_spot_visualizacoes`; **texto** em `itens_consumo.fornecedor_preferencial_id`) e em lista em `cotacao_itens.fornecedores_ids`.
  - **Etapa 3 — feita (16/10/2026, migration 009).** Gatilho mantém nome, e-mail e contato sincronizados (ver Banco de Dados). Aposentar as colunas-cópia (`nome`, `email_contato`) é opcional e só quando todos os leitores usarem as oficiais.
  - **Etapa 4 — feita (16/10/2026, migration 010).** Pendências: apagar `fornecedores_spot` (só dados de teste, nenhuma rota usa) e a coluna `fornecedores.categorias` depois de conferir; tela de admin para aprovar marcas sugeridas (hoje via SQL); catálogo aceitar item **sem preço** (portfólio).
  - **Etapa 5** — convite para o fornecedor local assumir o próprio cadastro (login no portal); locais viram candidatos a global (crescimento orgânico da rede).
- **Match Score do Canal Spot** ("vagas que combinam com você", estilo LinkedIn).
  - **Fase 1 — feita (16/10/2026, etapa 6), calculada na hora, sem tabela; ver seção Canal Spot.** Plano original: por regras — PN do catálogo = match máximo (reusa `buscar_fornecedores_para_item`); fora isso, segmento 30 + sistema 25 + marca 20 + texto 25. Calculado **na criação da demanda** e gravado em `demanda_fornecedor_match (demanda_id, fornecedor_id, score, motivos)`. Destaque "Recomendadas para você" no topo de Em andamento, com o motivo ("você trabalha com XCMG e hidráulica").
  - **Fase 2:** upload de catálogo (PDF/planilha) com extração por IA de segmentos, sistemas, marcas e PNs.
  - **Fase 3:** similaridade semântica (embeddings com `pgvector` no Supabase) + sinais de comportamento (respondeu/venceu demandas parecidas).
  - **Fase 4 — feita como recurso do plano Pro (etapa 8).** Plano original: — resumo diário em **um** e-mail ("pedidos que combinam com você"); e-mail individual só para "você foi escolhido".
  - **Princípios:** mostrar faixas ("combina muito / combina / pode interessar"), não porcentagem; **recomendação ordena, não esconde** (item raro escondido é o pior erro); responsabilidade final é do comprador.
- **M4.7b — Dashboard "Analista Sênior"** (TODO no `App.jsx`). Cada perfil vê um resumo do próprio dia: comprador (cotações aguardando resposta, OCs pendentes, aprovações), qualidade (NCs abertas, respostas de fornecedor, curadoria de item), operação (OS abertas, recebimentos, apontamentos), gestor (aprovações + KPIs consolidados), financeiro (contas do dia). Avatar clicável no canto superior direito → abre `ModalMeuPerfil`.
- **Relatórios PDF gerenciais estilo ISO.** Reaproveita `gerarPdfNC.js`. Entrega: PDF de OS, PDF de RC aprovada, PDF de OV, e um **Relatório Mensal/Trimestral gerencial** com status de OS / cotações / recebimento / NC / manutenções em andamento. **Snapshot imutável** ao gerar (congela o JSON analisado + PDF — se o cliente editar OS depois, o relatório do mês anterior continua mostrando o que era verdade). Campo "Aprovado por [gestor] em [data]" com hash do conteúdo. Agendamento por cron (dia 1º, 8h, e-mail pro gestor). Auditoria ISO ama.
- **Calendário de Manutenção + MRP.** Visão mês/semana com cards por OS (dados já existem em `chamados` e `chamado_itens` — zero migration). Botão "Rodar MRP" projeta consumo + custo médio dos últimos 6 meses, gera previsão orçamentária. Diferencial de venda forte: "você tem R$ 47k de manutenção prevista pro Q1".
- **Export Excel em massa.** OS, RC, OV, NC, itens de estoque. Pequena transportadora vive em Excel — tira 30% dos tickets de suporte.
- **M4.8a — IA Embarcada (nível gestor).** Ver seção IA abaixo.

### Prioridade média — features de valor real

- **Painel do Fornecedor.** Indicadores já gravados pelo Canal Spot: taxa de resposta (interesses ÷ visualizações), taxa de vitória (`escolhido` ÷ interesses em demandas encerradas, **excluindo** canceladas), tempo médio de resposta, valor ganho; mais cotações.
- **Canal Spot — ajustes pendentes:**
  - Deixar explícito no campo de proposta se o valor é **unitário ou total** (antes de acumular histórico para o Painel).
  - **Encerramento automático** de demanda aberta sem decisão há muito tempo (ex.: 60 dias, motivo "expirada") — hoje demandas abertas não expiram.
  - Tela de **Notificações** (sininho) para resultados e eventos, usando uma tabela `notificacoes` genérica.
  - Opção de **demanda anônima**.
- **Validade das propostas.** Portal ganha campo "validade em dias"; monitor mostra badge 🟢🟡🔴; panorama avisa se venceu. Sem isso, valores vencidos invalidam o cálculo de custo de recebimento.
- **Aging de RC.** RC aberta há 30/60/90 dias gera aviso de cancelamento definitivo (o comprador decide se cancela). Sentido falta no SAP, segundo o usuário.
- **Webhooks / Zapier / Make.** Endpoints `nc.criada`, `ov.emitida`, `rc.aprovada`, `os.concluida`. Cliente conecta sozinho no Zapier/Make — custo zero pra você, valor percebido alto ("QuotaFlow integra com tudo").
- **#5 Custo de recebimento por NF.** Campo `custo_recebimento_nf` em `tenants`, tela de configuração, 4ª seção no Panorama executivo.
- **M4.8b — IA Embarcada (níveis operacionais).** Só quando houver clientes pedindo e métrica de uso dos perfis.
- **Upload de avatar do usuário.** Depende de coluna `usuarios.avatar_url` + Storage. Cosmético, mas melhora o onboarding.

### Prioridade baixa — sob demanda de cliente pagante

- **Inspeção de equipamento.** Checklist de pré-viagem (motorista) e check periódico (mecânico) + abertura de OS direto do item reprovado. Cuidado com UX: precisa funcionar em celular, com internet ruim, com 1 mão.
- **Inspeção de locação.** Reaproveita 90% da inspeção de equipamento — só muda o tipo (`pre_viagem | retorno_locacao | periodica`). Só faz sentido se ≥ 3 clientes pagantes pedirem.
- **Tela única de consulta de estoque** cobrindo consumíveis + peças juntos.
- **Marketplace monetizado.** Banner + destaque pago ao fornecedor na recomendação de cotação. Já tem infra; falta modelo de cobrança.
- **Requisitante abre nova RC referenciando RC bloqueada.** Reusa o fluxo do `/mover` que já existe.

### Visão de produto (sem prazo — constrói quando fizer sentido)

**Posicionamento final:** all-in-one-solution para o pequeno transportador brasileiro — do orçamento comercial até NPS e assistência técnica.

**Onde NÃO entramos (por escolha deliberada):**
- **Fiscal** (NFe/SPed/NFS-e) — barreira regulatória alta, Omie/Conta Azul dominam. Integração via API em vez de construção.
- **Financeiro completo** (contas a pagar/receber, conciliação) — mesma lógica.
- **RH / Ponto** — fora do nosso problema.

**Onde vamos estender (reaproveitando o que já existe):**
- **Propostas comerciais** — orçamento → OS, reaproveita `chamados` + `chamado_itens` com um novo `tipo_documento`.
- **Assistência técnica de cliente final** — mesma OS, muda o destinatário (cliente final em vez de equipamento interno).
- **NPS / CSAT** — 1 formulário, 1 e-mail automático, 1 dashboard. Gancho de venda forte ("seu cliente final aprovou o serviço com nota 9,2/10").
- **Benchmarking setorial anônimo** — quando houver 20+ tenants ativos, comparar contra a média do setor em vez de contra o próprio histórico.
- **Rede nacional de fornecedores** — fornecedores globais + locais promovidos via convite; Canal Spot + Match Score como motor de conexão.

**Decisão de verticalização vs. plataforma** fica pra quando houver 200-500 clientes pagantes. Não antecipar.

### M4.8 — IA Embarcada (arquitetura detalhada)

**Objetivo:** agente que analisa dados **agregados** do tenant e entrega ao gestor (e, em versão resumida, aos demais perfis) uma leitura "analista sênior": onde investir, o que está indo bem, o que pode melhorar, e alertas de comportamento atípico (compliance operacional).

**Arquitetura de 2 camadas (custo controlado):**
1. **Camada SQL (grátis):** queries agregadas no Postgres geram um "resumo estruturado" — KPIs por período, tendências, desvios de média, top fornecedores, custo por categoria, NCs por origem, aging de RC/OV, reincidência de item, economia acumulada.
2. **Camada LLM (paga por análise):** só o resumo agregado (2-5k tokens) vai pro modelo. Prompt com persona "analista sênior de compras" + framework SWOT. **Nunca envia dado bruto.**

**Exemplo real de cruzamento que só essa arquitetura produz:**
> "50% das cotações do trimestre terminaram com fornecedor único, apesar de a média de participação ser 2,4 fornecedores por cotação. Dessas, 80% tiveram renegociação só com esse fornecedor. **Padrão atípico** — vale revisar o processo de convite ou checar dependência de fornecedor."

Esse cruzamento existe em SQL (2 queries + 1 merge). O LLM só interpreta o resumo. **Custo por análise: < R$ 1.**

**Gatilhos de disparo (não é "a IA analisa o banco todo"):**
- Fim de mês / trimestre / ano → gera relatório SWOT + recomendações.
- Sob demanda (gestor clica "Analisar período").
- Alertas de compliance rodam **em background** (diário/semanal) e geram fila de revisão.

**Escopo por perfil (gated):**
- **Gestor / Admin:** SWOT completa (operacional + tática + estratégica), recomendações de investimento, análise de fornecedor, alertas de compliance comportamental.
- **Comprador / Qualidade / Operação:** 1 análise/semana em cache — resumo do próprio setor.
- **Limite por plano:** Essencial = 2 análises/mês; Operação = 8/mês; Completo = 30/mês; Enterprise = ilimitado com fair use.

**Compliance / anomaly detection (fase 2):**
- Padrões suspeitos: OS abertas fora do horário, RC emergencial recorrente do mesmo requisitante, fornecedor único em categoria competitiva, aprovação em cadeia por mesma pessoa, NC "resolvida" rápido demais, consumo de estoque sem OS vinculada.
- Saída sempre em linguagem neutra: **"padrão atípico detectado"** — nunca "funcionário X fez Y". Decisão final é sempre humana.
- Log de auditoria de quem consultou cada alerta.

**Monetização recomendada:**
- Add-on IA: +R$ 149/mês (5 análises incluídas)
- Pacote extra: R$ 39 por 10 análises adicionais
- Enterprise: ilimitado com fair use

**Pré-requisitos técnicos:**
- Tabela `ia_analises` (`tenant_id | tipo | periodo | resumo_sql (jsonb) | resposta_llm (text) | custo_tokens | criado_em | criado_por`) — cache de análise, evita reprocessar.
- Endpoint `POST /api/ia/analisar` com rate limit por tenant/plano.
- Chave do provedor (OpenAI/Anthropic/Groq) em env var, com fallback por tenant (Enterprise pode usar chave própria).
- Painel admin pra ver custo acumulado por tenant (se virar lucro negativo, corta antes).
- **A IA vende o PDF:** "Exportar análise como PDF" reaproveita `gerarPdfNC.js`. Custo zero, valor percebido alto.

**M4.8a (gestor) antes de M4.8b (demais perfis).** Motivo: cliente precisa de 6+ meses de dado acumulado pra IA ter o que analisar. M4.8a faz sentido depois que a base tiver histórico. M4.8b só quando houver pedido real.

### Outras decisões em aberto

- **Amarração de busca a Equipamento** (ranking, não filtro rígido). Só faz sentido quando `catalogo_itens.marca/modelo/ano_fabricacao_*` estiver povoado — hoje está majoritariamente vazio. Equipamento selecionado no topo da OS vira **boost de ranking**, nunca filtro que esconde opção.
- **Normalização de catálogo entre fornecedores** (`pn_raw` é por fornecedor; não há PN canônico cross-fornecedor). Decisão ainda em aberto — resolve via `normalizar_pn` + curadoria humana, ou via um dicionário próprio.
- **Hospedagem (decisão 16/10/2026):** MVP com Render grátis + Supabase grátis + Netlify grátis + Resend grátis. Antes do primeiro cliente pagante: Render pago (US$ 7/mês, sem dormir) e Supabase Pro (US$ 25/mês, sem pausa por inatividade e com backup diário). Netlify grátis segue bem para o front; domínio próprio quando o nome estiver definido (atualizar `allowedOrigins` no `server.js`, `FRONTEND_URL` e o remetente verificado no Resend).
- **Backend sem auto-restart em dev.** Considerar `nodemon` (dev) e `pm2` (prod). Hoje, se o processo cai, o app para.
- **Higiene:** `POST /signup` não cria linha em `usuario_perfis` (fallback cobre, mas fica feio se um dia listar).
- **Higiene:** `backend/routes_fornecedores_example.js` — provável código morto (confirmar que não é importado e remover).

### Deferidos (intencional, não é pendência ativa)

- Estilo visual do seletor "Programação da OS"
- Toggle de "verificar estoque no ato da programação" por tenant
- Limpeza de `ordens_servico` / `ordem_servico_itens` (órfãs) e `fornecedores_spot` (após a etapa 4)
- Decidir se apontamento de execução vira histórico versionado
- Remoção de `/api/cotacao/:token` inline em `server.js` (provável código morto)
- Drag-and-drop pra reordenar itens da OS
- **Merge de e-mail duplicado** entre `usuarios` e `fornecedor_usuarios` (caso apareça de novo — solução conhecida: renomear/desativar o lixo)
- **PATCH diferenciado de PUT** (hoje o middleware normaliza tudo — remover só se algum dia precisar de update parcial real)
- **Decidir modelo de monetização da IA:** add-on vs. incluso vs. híbrido (hoje recomendação: híbrido — 5 grátis/mês + pacote extra)
- 3 buscas de fornecedor por e-mail em `ordensVenda.js` (modelo antigo de fornecedor como usuário do tenant) — revisar quando o modelo antigo for aposentado

---

## 📞 Contatos do Projeto

**Desenvolvedor:** Marcony
**Plataforma:** QuotaFlow
**Última atualização deste documento:** 16/10/2026
