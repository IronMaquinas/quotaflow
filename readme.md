# 📦 QuotaFlow — Estrutura Completa do Projeto

**Versão:** 4.37 (… + Painel e Convites do Fornecedor + Criar Conta + Console da Plataforma + Calendário de Manutenção + Planos Recorrentes + Pessoas e Documentos + Aviso de Vencimento por E-mail + Funções e Biblioteca + Detalhes da Função + EPI + Catálogo de EPI + Entrega de EPI e Selo de Conformidade + Histórico de Funções e Avisos de EPI + Treinamentos + Conteúdo, Prova, Biblioteca de Treinamentos e Horas + Prova Online, Perfil Colaborador e Aniversariantes + Certificado e Comprovante da Avaliação + Competências + Dossiê do Colaborador + Multas + Disciplinar + Autuações da Empresa + Comercial / BID + BID com o cliente + Pedido de Venda)
**Última atualização:** 27/10/2026
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
│   │   ├── calendarioManutencao.js (⭐ 12a — situação da OS e custo planejado/comprometido/realizado do calendário)
│   │   ├── planosManutencao.js     (⭐ 12b — datas dos planos recorrentes, prévia e "Gerar OS (12 meses)")
│   │   ├── avisosVencimento.js     (⭐ 12c.1 — e-mail diário de vencimento 30/15/5 dias e vencido; registra em documento_avisos)
│   │   ├── (services/rotinasInspecao.js ⭐ 14b.2 — rotinas, locação, cumprimento, calendário e avisos)
│   │   ├── contratos.js · locatario.js (⭐ 14b.3 — contratos de locação · área do locatário; services/contratosLocacao.js)
│   │   ├── inspecaoLink.js         (⭐ 14b.1 — link público de inspeção de terceiros)
│   │   ├── inspecoes.js            (⭐ 14a — inspeções de equipamento: modelos com vistas e pontos, biblioteca, envio idempotente/offline, bloqueio e liberação)
│   │   ├── autuacoes.js            (⭐ 12i — autuações da empresa: prazos de defesa/recurso, licença ligada, NC de causa raiz, tarefa no Plano)
│   │   ├── disciplinar.js          (⭐ 12h — medidas disciplinares: escala, ciência assinada/recusa com testemunhas, sugestão da próxima)
│   │   ├── multas.js               (⭐ 12g — multas: prazos, situação, desconto com aceite assinado, tarefa no Plano, calendário)
│   │   ├── dossie.js               (⭐ 12f — dossiê do colaborador: monta por período + registra quem gerou)
│   │   ├── competencias.js         (⭐ 12e.3 — escolaridade, CNH e lista atende/não atende → pilar 🧩)
│   │   ├── provaOnline.js          (⭐ 12e.2b — prova online: logado / link CPF+nascimento, tentativas, liberar, sessão do link)
│   │   ├── treinamentos.js         (⭐ 12e.1 — catálogo, turmas, presença assinada, registro manual, pilar 🎓, calendário; 12e.2a — conteúdo, prova, biblioteca, horas)
│   │   ├── historicoFuncoes.js     (⭐ 12d.3 — histórico de funções do colaborador: início, fim, motivo)
│   │   ├── avisosPessoas.js        (⭐ 12d.3 — avisos de troca de EPI, CA e documento faltando, no e-mail diário)
│   │   ├── epiEntregas.js          (⭐ 12d.2 — painel por colaborador, entrega com assinatura + baixa no estoque, devolução, histórico/ficha NR-6)
│   │   ├── conformidade.js         (⭐ 12d.2 — selo do colaborador: % por pilar, 🟢/🟡/🔴)
│   │   ├── epi.js                  (⭐ 12d.1 — EPI = item de consumo marcado como EPI: tipos, CA, endereço EPI, sugestão de kit pelos riscos)
│   │   ├── funcoes.js              (⭐ 12d.0 — funções/cargos: biblioteca, importar (cópia), versão nova, ficha do colaborador)
│   │   ├── documentos.js           (⭐ 12c — colaboradores/documentos: validação, situação do vencimento, arquivo no bucket privado)
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
│   │   ├── recomendacoes.js        (POST /resumo-diario com x-cron-secret — também dispara os avisos de vencimento (12c.1) · GET /descadastrar/:token)
│   │   ├── manutencao.js           (⭐ 12a/12b — calendário, planos recorrentes, valor da hora)
│   │   ├── pessoas.js              (⭐ 12c — /api/pessoas: colaboradores, tipos de documento, documentos, renovar, arquivo · 12d.0: funções, biblioteca, importar, atualizar, ficha)
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
│   │   ├── fornecedorMiddleware.js (valida JWT do portal, injeta req.fornecedorId via fornecedor_usuarios)
│   │   └── plataformaMiddleware.js (11b — token do Console da Plataforma, chave própria)
│   │
│   ├── constants/
│   │   └── fornecedorStatus.js     (whitelist canônica de status visíveis ao fornecedor em NC)
│   │
│   ├── scripts/                    (one-off; criarAdmin.js cria/troca senha de admin do console)
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
│   │   │   ├── manutencao/
│   │   │   │   ├── TelaCalendarioManutencao.jsx     (⭐ 12a — folhinha Ano/Mês/Semana, painel do dia, rodapé financeiro)
│   │   │   │   ├── TelaPlanosManutencao.jsx         (⭐ 12b — planos recorrentes + valor da hora; aberta pelo botão 🔁 Planos do calendário)
│   │   │   │   └── ModalTransferirOS.jsx            (⭐ 12b.3 — definir/transferir responsável de uma OS; usado no calendário e na OS)
│   │   │   │
│   │   │   ├── pessoas/
│   │   │   │   └── TelaPessoas.jsx                  (⭐ 12c/12d.0 — 👷 Pessoas: abas Documentos · Colaboradores (📋 Ficha) · 👔 Funções · 🦺 EPI · Treinamentos em breve)
│   │   │   │   ├── TelaEpi.jsx                      (⭐ 12d.1–12d.2 — aba 🦺 EPI: sub-abas 👷 Gestão de funcionários · 🧰 Kits por função · 📦 Estoque)
│   │   │   │   ├── TelaTreinamentos.jsx             (⭐ 12e.1 — aba 🎓: Por colaborador · Turmas e registros · ⏱ Horas (12e.2a) · Catálogo)
│   │   │   │   └── GestaoEpi.jsx                    (⭐ 12d.2 — painel por colaborador, entrega com assinatura, histórico/devolução, ficha NR-6)
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
- **tenants** — `id | slug | nome | cnpj | telefone | email_contato | email_admin | plano ('starter' antigos · 'teste' | 'bronze' | 'prata' | 'ouro') | teste_ate | aprovacao_status ('pendente' | 'aprovado' | 'recusado'; antigos = aprovado) | aprovado_em | aprovacao_obs | cadastro_origem | alertas_cadastro (jsonb) | dados_cnpj (jsonb) | status | regiao (UF da operação principal — editável em Configurações → Empresa) | participa_benchmark | custo_recebimento_nf | comunicacao_*_policy | nc_notificacao_policy | criado_em | atualizado_em`
- **usuarios** — `id | tenant_id | nome | email | telefone | perfil | ativo | criado_em | atualizado_em`. `perfil` continua sendo o "principal" (compatibilidade com checks legados); o multi-perfil de verdade vive em `usuario_perfis`. `telefone` em E.164 (`+5511999999999`).
- **perfis** ⭐ (M4.6) — catálogo dos 6 perfis canônicos: `admin | gestor | comprador | operacao | qualidade | financeiro`. Colunas: `codigo (PK) | nome | descricao | ordem`.
- **usuario_perfis** ⭐ (M4.6) — N:N entre usuários e perfis (multi-perfil). `usuario_id | perfil_codigo`. Não tem `tenant_id` — isolamento por transitividade (ver regra multi-tenant no `db.js`).
- **equipamentos** — `id | tenant_id | tag | nome | local | fabricante | modelo | serie | ativo | criado_em`.
- **tenants.valor_hora** ⭐ (migration 019) — R$/h da mão de obra própria (opcional, ≥ 0). Usado no custo planejado do calendário e na prévia dos planos.

### Pessoas e documentos ⭐ (etapa 12c, migration 022)
- **colaboradores** — `id (bigserial) | tenant_id | nome | cpf (só dígitos; UNIQUE por tenant quando preenchido) | funcao | admissao | situacao ('ativo' | 'afastado' | 'desligado') | telefone | email | usuario_id (→ usuarios, opcional, SET NULL) | obs | criado_em | atualizado_em`. Separado de `usuarios` (decisão 18/10): motorista/ajudante/mecânico sem login. **Colaborador com documentos não é apagado** (409) — marca "desligado" (histórico é prova legal); desligado sai do resumo e do calendário.
- **documento_tipos** — `id | tenant_id (NULL = lista padrão do sistema) | alvo ('colaborador' | 'equipamento' | 'empresa') | codigo | nome | validade_meses_padrao | ordem | ativo`. Padrão (12): CNH, MOPP, ASO, toxicológico · CRLV, ANTT/RNTRC, seguro, aferição do tacógrafo, certificado de calibração · alvará, licença ambiental, AVCB. O tenant cria os seus (código `p_…`); tipo do tenant com o mesmo código substitui o padrão.
- **documentos** — `id | tenant_id | alvo_tipo | colaborador_id (CASCADE) | equipamento_id (CASCADE) | tipo_id (SET NULL) | tipo_nome (cópia) | numero | emitido_em | vence_em (NULL = sem vencimento) | responsavel_id (→ usuarios) | arquivo_path | arquivo_nome | arquivo_mime | obs | substituido_por (renovado por) | criado_por | criado_em | atualizado_em`. CHECK de coerência alvo × ids e `vence_em >= emitido_em`.
- **Bucket privado `documentos`** (criado pela migration): `tenant-{id}/doc-{id}/{timestamp}-{aleatório}.{ext}`; PDF/JPG/PNG/WEBP até 10 MB, enviado em base64 no JSON (mesmo padrão da NC); aberto só por link assinado de 1 h.
- **documento_avisos** ⭐ (12c.1, migration 023) — `documento_id (→ documentos, CASCADE) | marco ('30' | '15' | '5' | 'vencido') | destinatarios | enviado_em`, PK `(documento_id, marco)`. Cada marco de cada documento é avisado uma vez só.
- **funcoes** ⭐ (12d.0, migration 024) — `id (bigserial) | tenant_id (NULL = BIBLIOTECA do QuotaFlow) | nome | descritivo | requisitos | documentos jsonb [{codigo, obs}] | epis jsonb (12d) | treinamentos jsonb (12e) | versao | origem_id (→ funcoes, SET NULL) | origem_versao | ativo | criado_em | atualizado_em`. Nome único por tenant (`funcoes_nome_unico`, só ativas). `documentos[].codigo` = `documento_tipos.codigo` de alvo colaborador (o tipo do tenant com mesmo código vale). Seed: 8 modelos de transportadora (motorista carreteiro, MOPP, mecânico, eletricista, borracheiro, ajudante/conferente, lavador, tráfego/administrativo).
- **funcoes — detalhes** ⭐ (12d.0.2, migration 025) — `cbo` (formato 0000-00) | `setor` | `escolaridade` (código: fundamental_incompleto … pos_graduacao) | `riscos jsonb` (códigos do PGR por grupo — físico, químico, biológico, ergonômico, acidente; a lista fica em `services/funcoes.js` → `RISCOS` e vai para o frontend pela API) | `responde_a` (cargo do superior, texto). A migration completou os 8 modelos da biblioteca (CBOs conferidos em 19/10: 7825-10 motorista, 9144-25 mecânico diesel, 9531-15 eletricista, 9921-15 borracheiro, 7832-25 ajudante, 5199-35 lavador; tráfego/administrativo sem CBO) e subiu a versão deles (cópias veem "versão nova"). Mudar qualquer desses campos no Console também sobe a versão.
- **colaboradores.funcao_id** ⭐ (migration 024) — função ligada (SET NULL). O texto `funcao` continua com o nome (histórico) e acompanha quando a função é renomeada.

### Manutenção programada ⭐ (etapa 12b, migration 019)
- **planos_manutencao** — `id (bigserial) | tenant_id | equipamento_id (FK SET NULL) | template_id (→ os_templates, FK SET NULL) | nome | descricao | categoria | urgencia | periodicidade_valor (1–3650) | periodicidade_unidade ('dias' | 'semanas' | 'meses') | proxima_data (date — âncora da série) | termina_em (date, migration 020 — NULL = sem término; CHECK ≥ proxima_data) | responsavel_id (→ usuarios, FK SET NULL, migration 021) | regra_dia_util ('proximo' padrão · 'anterior' · 'manter', migration 021) | hora_inicio (time) | duracao_horas | ativo | criado_por | criado_em | atualizado_em`. "Excluir" = `ativo = false` (as OS geradas ficam).
- **chamados.responsavel_id** ⭐ (migration 021, FK SET NULL → usuarios) — responsável pela OS, separado de quem abriu (`tecnico_id`). Herdado do plano; muda por transferência. OS avulsa ainda não tem campo de responsável no formulário.
- **chamados.origem_plano_id** (FK SET NULL) + **chamados.origem_plano_data** (date da ocorrência — sempre a data **nominal** da série, mesmo quando a OS foi movida para dia útil). Índice único parcial `chamados_plano_data_unico (origem_plano_id, origem_plano_data) WHERE origem_plano_id IS NOT NULL AND cancelada_em IS NULL` — nunca duas OS do mesmo plano na mesma data; OS cancelada libera a data.
- A migration lê os tipos de `tenants.id`, `equipamentos.id`, `os_templates.id` do próprio banco antes de criar as FKs (os tipos não estão no repositório).
- Os itens do plano vêm de **os_templates / os_template_itens** (o "Carregar modelo de manutenção" da OS) — o plano não guarda lista própria.

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
- **planos** ⭐ (migration 016) — `codigo (PK) | publico ('cliente' | 'fornecedor') | nome | preco_mensal | dias_teste | recursos (jsonb) | ordem | ativo`. Cliente: teste (15 dias), bronze, prata, ouro; fornecedor: gratuito, pro. Nada é bloqueado por plano ainda.
- **fornecedores.tipo `'candidato'`** (migration 016) — autocadastro aguardando aprovação; `tenant_id` NULL (CHECK `fornecedores_tenant_por_tipo` recriado: global/candidato ⇒ sem tenant; local ⇒ com tenant). Invisível para tenants e sem Canal Spot porque todo o código filtra por `'global'` ou pelo tenant. Aprovar = `UPDATE fornecedores SET tipo = 'global'`. Colunas novas: `cadastro_origem ('tenant' | 'convite' | 'autocadastro')`, `alertas_cadastro`, `aprovacao_obs`.
- **fornecedor_convites** (migrations 013, 014 e 015) — `id | token_hash (SHA-256; token cru nunca guardado) | fornecedor_id (FK CASCADE; **NULL = convite de fornecedor novo**, preenchido quando ele conclui o cadastro) | tenant_id | email | nome_sugerido | cnpj | dados_cnpj (resumo da Receita no envio — sem sócios) | criado_por | criado_em | expira_em (7 dias) | aceito_em | cancelado_em`. Novo convite cancela o pendente anterior (mesmo fornecedor; ou mesmo tenant + e-mail, no caso de fornecedor novo).
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
- **config_estoque.fluxo_aprovacao** — **toggle "requer aprovação de retirada"** (já existe; botão nas configurações de Estoque → Consumíveis, rota `routes/estoque/configuracoes.js`). Ligado: `POST /api/estoque/movimentacoes` com `tipo: 'saida'` vira `solicitacoes_retirada` e o gestor aprova. Desligado: a retirada é direta. Ideia do Marcony (19/10): levar o toggle também para o menu Configurações. **Decidido 19/10: a entrega de EPI (12d.2) NÃO passa por essa aprovação** — a ficha assinada pelo colaborador é o controle; a saída continua registrada no Estoque com o nº EPI.
- **epi_itens** ⭐ (12d.1, migration 026) — `id | tenant_id | item_consumo_id (→ itens_consumo, CASCADE; UNIQUE por tenant) | tipo (categoria: botina, luva_nitrilica… — lista em services/epi.js → TIPOS_EPI) | ca (só dígitos) | ca_validade | troca_dias | obs | ativo | criado_em | atualizado_em`. O EPI é o item do Estoque marcado como EPI — **sem estoque duplicado** (saldo = `itens_consumo.saldo_atual`/`itens_consumo_enderecos`). Desmarcar = `ativo false`. **Endereço `EPI`** (tipo armazem) criado sozinho pelo backend quando a aba 🦺 EPI abre.
- **funcoes.epis** (desde a 024; usado a partir da 12d.1) — kit da função `[{ tipo, quantidade, troca_dias }]` por **categoria** (a biblioteca vale para todos os tenants). A migration 026 pôs o kit sugerido nos 8 modelos e subiu a versão (v3).
- **epi_tipos** ⭐ (12d.1b, migration 027) — `id | tenant_id (NULL = CATÁLOGO do QuotaFlow, mantido no Console → 🦺 Catálogo de EPI) | codigo (único por tenant; do tenant começa com p_) | nome | grade ('calcado' | 'camisa' | 'calca' | 'luva' | NULL — qual tamanho do colaborador usar) | troca_dias_padrao | ordem | ativo`. Seed: 24 tipos (os mesmos códigos dos kits). Tipo do tenant com mesmo código substitui o do catálogo. `services/epi.js → TIPOS_EPI` virou só reserva enquanto a 027 não roda. Kits (funções e biblioteca) só aceitam códigos que existem.
- **epi_entregas** ⭐ (12d.2, migration 028) — `id | tenant_id | numero (EPI-AAAA-NNNN, único por tenant) | colaborador_id (RESTRICT) | funcao_nome (na época) | motivo (entrega/admissao/troca/reposicao/perda/dano/outro) | entregue_em | entregue_por (→ usuarios) | entregue_por_nome | assinatura_png (data URL ≤ 400 KB) | assinatura_hash (SHA-256 de nº + colaborador + itens + data + assinatura) | obs`. Histórico nunca é apagado.
- **epi_entrega_itens** ⭐ (migration 028) — `entrega_id (CASCADE) | colaborador_id | epi_item_id | item_consumo_id | tipo | item_nome · ca · tamanho (CÓPIA da data — prova legal) | quantidade | troca_dias | proxima_troca | endereco_saida | movimento_numero (MOV-…) | devolvido_em | devolucao_estado ('bom' volta ao endereço EPI com movimento de entrada · 'danificado' descarte · 'substituido' quando entrega outro do mesmo tipo) | devolucao_obs`.
- **treinamentos** ⭐ (12e.1, migration 030) — `id | tenant_id (NULL = BIBLIOTECA do QuotaFlow, usada na 12e.2) | codigo (único por tenant; é o que funcoes.treinamentos usa) | nome | norma | carga_horaria | validade_meses (NULL = não vence) | conteudo (programático) | tipo (regulatorio/integracao/desenvolvimento) | origem_id · origem_versao · versao (biblioteca) | ativo`. Tirar do catálogo = ativo false.
- **treinamento_turmas** ⭐ (migration 030) — `treinamento_id (SET NULL) | treinamento_nome · validade_meses (CÓPIA na data) | data · data_fim | carga_horaria | instrutor | local | modalidade ('presencial' | 'online' | 'manual' = registro de treinamento já feito) | status ('agendada' | 'concluida' | 'cancelada') | evidencia_path · nome · mime (bucket documentos, tenant-{id}/trein-{turma}/…) | obs | criado_por | concluida_em`.
- **031 (12e.2a)** ⭐ — `treinamentos.secoes` (jsonb `[{ titulo, texto, video_url, material_url }]`), `treinamentos.prova` (jsonb `{ nota_minima, tentativas_max, perguntas: [{ enunciado, alternativas, correta }] }` ou NULL), `treinamento_participacoes.horas` (horas creditadas; NULL = carga da turma se presente e concluída), `colaboradores.data_nascimento`. Semente: NR-6 — Uso de EPI na biblioteca.
- **032 (12e.2b)** ⭐ — **treinamento_tentativas** (`participacao_id · turma_id · colaborador_id · numero (único por participação) · respostas · prova (cópia com gabarito) · acertos · total · nota · aprovado · meio ('logado' | 'link') · usuario_id · ip · hash`), `treinamento_participacoes.tentativas_extra`, `treinamento_turmas.link_token · link_ativo`, perfil **colaborador** no catálogo `perfis` (e no CHECK de `usuarios.perfil`, se existir — recriado NOT VALID).
- **033 (12e.3)** ⭐ — `funcoes.cnh_categoria` (CNH mínima: A, B, C, D, E, AB, AC, AD, AE) · `funcoes.competencias` jsonb `[{ codigo, nome, reavaliar_meses }]` · `colaboradores.escolaridade` · `colaboradores.cnh_categoria` · **colaborador_competencias** (histórico de avaliações: `colaborador_id · codigo · nome (cópia) · atende · avaliado_em · valido_ate (avaliado_em + reavaliar_meses) · avaliado_por · avaliado_por_nome · evidencia_path/nome/mime (bucket documentos, tenant-{id}/comp-{colab}/…) · obs`).
- **034 (12e.3.1)** ⭐ — `colaborador_competencias.nivel` (1–4; antigas viram 3/1) · `nivel_esperado` (cópia) · `evidencia_treinamentos` jsonb (treinamentos ligados em dia na hora da avaliação). `funcoes.competencias[]` ganha `nivel_esperado` (padrão 3) e `treinamentos` [códigos] (jsonb, sem coluna).
- **035 (12f)** ⭐ — **dossie_registros** (`colaborador_id · codigo (DOS-XXXX-XXXX-XXXX, impresso) · periodo_de (NULL = desde o início) · periodo_ate · secoes jsonb · motivo · gerado_por · gerado_por_nome · ip · criado_em`) — LGPD: cada emissão fica registrada.
- **036 (12g)** ⭐ — **multas** (`equipamento_id (frota, SET NULL) · veiculo (placa/cópia) · colaborador_id · colaborador_nome · data_infracao · hora_infracao · local · auto_numero · orgao · infracao_codigo · infracao_descricao · gravidade (leve/media/grave/gravissima) · pontos · valor · recebida_em · prazo_indicacao (padrão recebida + 15 d) · vencimento · status (recebida → condutor_indicado → em_recurso → paga | descontada | cancelada) · finalizada_em · valor_pago · valor_descontado · parcelas_desconto · motivo_cancelamento · aceite_requerido (padrão false) · aceite_texto · aceite_png · aceite_hash · aceite_em · responsavel_id/nome (quem monitora) · tarefa_id (✅ Plano) · arquivo_path/nome/mime (notificação, bucket documentos tenant-{id}/multa-{id}/…) · obs · historico jsonb`).
- **037 (12h)** ⭐ — **medidas_disciplinares** (`colaborador_id · colaborador_nome · tipo (orientacao/advertencia/suspensao/justa_causa) · categoria · data_fato · data_aplicacao · descricao · dias_suspensao (1–30) · suspensao_inicio/fim · multa_id · texto (cópia do documento) · ciencia (assinada/recusa/verbal) · ciencia_png/hash/em · testemunhas jsonb [{nome, png, hash}] · arquivo_* · status (vigente/cancelada) · cancelamento_motivo · aplicado_por/_nome · historico`).
- **038 (12h.1)** ⭐ — CHECK de `medidas_disciplinares.ciencia` passa a aceitar `pendente` e `papel`.
- **039 (12i)** ⭐ — **autuacoes** (`orgao · esfera (ambiental/transporte/trabalhista/sanitaria/tributaria/seguranca/outra) · auto_numero · data_autuacao · recebida_em · descricao · base_legal · local · valor · prazo_defesa · prazo_recurso · vencimento · documento_id/_nome (licença/documento da empresa) · equipamento_id · veiculo · status (recebida → defesa_apresentada → em_recurso → paga | cancelada) · finalizada_em · valor_pago · motivo_cancelamento · nc_id · nc_numero (NC de causa raiz) · responsavel_id/_nome · tarefa_id · arquivo_* (auto) · defesa_* · obs · historico`).
- **040 (14a)** ⭐ — **inspecao_modelos** (`tenant_id NULL = biblioteca · nome · categoria · frequencia (pre_uso/diaria/semanal/mensal/avulsa) · descricao · vistas jsonb [{codigo, nome, imagem ("esquema:<codigo>" ou caminho no bucket), pontos [{id, rotulo, x, y (%), tipo ok_nok|numero|texto, foto nunca|se_nok|sempre, critico, unidade, ajuda}]}] · campos jsonb (km/horimetro/local/cliente) · origem_id · origem_versao · versao · ativo`) · **inspecoes** (`cliente_uid único por tenant (fila offline) · modelo (cópia) · equipamento · executor_tipo colaborador/usuario/terceiro · terceiro · km · horimetro · local · cliente · gps · resultado aprovado/ressalvas/reprovado · respostas jsonb · assinatura_png · hash · os_abertas · origem app/link`) · **equipamento_liberacoes** (quem liberou, quando, por quê — evidência) · equipamentos ganha `inspecao_modelo_id, bloqueado, bloqueio_motivo, bloqueio_inspecao_id, bloqueado_em`. Semente: 3 modelos na biblioteca (cavalo pré-uso, empilhadeira NR-11, carreta pré-uso).
- **041 (14b.1)** ⭐ — `inspecao_modelos.tipo` (equipamento | carregamento | transito | descarregamento) · `inspecoes.tipo, numero (INSP-AAAA-NNNN por empresa — as já feitas são numeradas na migration), link_id` · **inspecao_links** (`token · titulo · modelo_id · equipamento_id (NULL = veículo do próprio terceiro) · valido_ate · ativo · usos · ultimo_uso · criado_por/_nome`). Semente: 3 modelos de carga na biblioteca (carregamento, em trânsito, descarregamento).
- **042 (14b.2)** ⭐ — equipamentos `situacao (base | locado), locacao_id` · **equipamento_locacoes** (`cliente · contrato · local · contato_nome/_email/_telefone · inicio · fim_previsto · fim_real · status ativa|encerrada · entrega_inspecao_id · devolucao_inspecao_id · obs · criado_por_nome · encerrado_por_nome`) · **equipamento_rotinas** (`equipamento_id · modelo_id · frequencia diaria|semanal|quinzenal|mensal · responsavel empresa|locatario · locacao_id · inicio · ativo`) · `inspecao_modelos.tipo` + entrega/devolucao · `inspecoes.locacao_id`. Semente: "Locação — inspeção de entrega" e "… de devolução" (mesmos pontos).
- **043 (14b.3)** ⭐ — **locacao_contratos** (`numero CL-AAAA-NNNN · cliente · cliente_doc · local · contato_* · inicio · fim_previsto · fim_real · status ativo|encerrado · obs · criado_por_nome · encerrado_por_nome`) · **locacao_contrato_usuarios** (`contrato_id · usuario_id` — quais locatários veem o contrato) · `equipamento_locacoes.contrato_id` · perfil **locatario** no catálogo e nos CHECKs de `usuarios.perfil` / `usuario_perfis.perfil_codigo`.
- **044 (14b.3.1)** ⭐ — **clientes** (`nome · razao_social · documento (só dígitos: CNPJ 14 / CPF 11, único por empresa) · endereco · numero · complemento · bairro · cidade · uf · cep · contato_nome/_email/_telefone · obs · ativo`) · `locacao_contratos.cliente_id`. Os contratos já existentes ganham o cliente na migration (pelo documento; sem documento, pelo nome).
- **045 (14c)** ⭐ — `tenants.logo_path, logo_atualizada_em` (logomarca da empresa no bucket privado "documentos": `tenant-{id}/logo/…`).
- **046 (14d)** ⭐ — **contrato_modelos** (`tenant_id NULL = biblioteca · nome · descricao · corpo (texto com {{campos}}) · origem_id · origem_versao · versao · ativo`) · `locacao_contratos` + `modelo_id · condicoes jsonb · emitido_texto · emitido_tabela · emitido_em · emitido_por_nome · emitido_hash · emitido_versao · aceite_nome · aceite_usuario_id · aceite_em · aceite_png · aceite_hash` · `equipamento_locacoes.valor_mensal`. Semente: "Locação de equipamentos — modelo-base" na biblioteca.
- **047 (14d.3)** — atualiza o modelo-base da biblioteca para usar `{{representante.nome}}`, `{{representante.cargo}}`, `{{representante.cpf}}` (versão sobe → "✨ Versão nova" para quem importou).
- **048 (14d.4)** — dados cadastrais da empresa em `tenants` (razao_social, nome_fantasia, cnpj, endereco, numero, complemento, bairro, cidade, cep, telefone, email) + modelo-base com a sede da LOCADORA (`{{empresa.endereco_completo}}`, versão sobe).
- **049 (14d.5)** — `tenant_alteracoes` (histórico dos dados cadastrais: campo, antes, depois, origem empresa/plataforma/banco, quem, motivo) + gatilho `tenants_cnpj_log` (toda troca de `tenants.cnpj` é gravada, até por SQL direto) + colunas `cnpj_alterado_por/_motivo/_em` + preenche os dados vazios das contas antigas com `tenants.dados_cnpj` (Receita do cadastro).
- *(14d.6: sem migration — usa `equipamento_locacoes.fim_previsto`, que já existe desde a 042)*
- **054 (15c.1)** — `bid_atividades (+) atribuido_id, atribuido_nome` (tarefa do Comercial atribuída a um usuário).
- **055 (16a)** — `bid_modelos (+) tipo_execucao`, `pedidos_venda (+) tipo_execucao` (transporte · locacao · servico · venda — padrão transporte) e a tabela **`execucoes`** (genérica; tipo transporte = **AT-AAAA-NNNN**, uma por trecho do PV): itens do trecho sem valores, coleta/entrega (local, data/hora), motorista (+ retrato do selo e `liberacao` {por, em, justificativa}), `cavalo_id` + `conjunto` jsonb (cavalo + até 2 implementos), `anexos` jsonb (NF-e/CT-e/MDF-e no bucket `documentos`), status programada → em_execucao → concluida | cancelada. Idempotente.
- **053 (15c)** — Pedido de venda: **pedidos_venda** (`numero PV-AAAA-NNNN (único) · bid_id (único)/bid_numero/bid_versao · cliente_id/_nome · contato_* · titulo · referencia · conteudo · grupos (itens com status a_programar|programado|em_execucao|concluido|cancelado) · condicoes · valor_total_manual · valor_total · aditivo_atual · status (aberto|em_execucao|concluido|cancelado) · cancelado_motivo · aceite_nome/_em/_hash · responsavel`) · **pv_aditivos** (`pv_id · numero (único no PV) · bid_id/bid_versao · antes · depois · mudancas · valor_antes · valor_depois · aceite_*`) · `bids (+) tipo ('proposta'|'aditivo') · pv_id · aditivo_numero`.
- **052 (15b)** — BID com o cliente: fases novas em `bids.fase` (`elaboracao · aguardando_cliente · revisao_solicitada · aguardando_aceite · aceito · perdido`; converte as da 15a: enviado → aguardando_cliente, negociacao → revisao_solicitada, proposta_final → aguardando_aceite) · `bids (+) token (único) · versao_enviada · em_revisao · envio_para · visto_primeiro_em · visto_ultimo_em · visto_qtd · respondido_em · codigo_hash · codigo_expira · codigo_tentativas · aceite_nome · aceite_cargo · aceite_email · aceite_em · aceite_png · aceite_hash · aceite_versao · aceite_ip · aceite_canal (link|fora_sistema) · aceite_obs` · `bid_versoes (+) enviada_em · enviada_para · mensagem · vista_em · vista_qtd · respondida_em · resposta jsonb {nome, cargo, geral, itens {item_id: {decisao, motivo, comentario}}} · substituida_em` · **bid_visualizacoes** (`bid_id · versao · ip · agente · em`).
- **051 (15a)** — 📈 Comercial: `tenants.inscricao_estadual, opcao_fiscal` · perfil **comercial** (catálogo `perfis` + CHECKs de `usuarios.perfil` / `usuario_perfis.perfil_codigo`) · **bid_modelos** (`tenant_id NULL` = biblioteca · `titulo_documento · rotulo_grupo ('Trecho') · validade_dias · secoes jsonb [{titulo, texto, posicao antes|depois}] · colunas jsonb [{chave, rotulo, tipo texto|numero|sim_nao|data, unidade}] · condicoes jsonb [{chave, rotulo, tipo texto|moeda|numero, unidade, padrao, grupo comercial|pagamento}] · origem_id · origem_versao · versao · ativo`) · **bids** (`numero BID-AAAA-NNNN · titulo · referencia (do cliente, ex.: PC 551) · cliente_id/_nome · contato_* · modelo_id/_nome · conteudo (cópia do modelo, textos editáveis no BID) · grupos jsonb [{id, titulo, valor, itens [{id, valores, quantidade, valor}]}] · condicoes jsonb {chave, na[]} · valor_total_manual · valor_total · validade_dias · valido_ate (conta do envio) · previsao_fechamento · assinante {nome, cargo, registro, telefones} · responsavel_id/_nome · fase (elaboracao|enviado|negociacao|proposta_final|aceito|perdido) · fase_desde · enviado_em · ganho_em · perdido_em · motivo_perda · perda_obs · versao_atual · alterado_desde_versao`) · **bid_versoes** (`versao · snapshot · valor_total · mudancas jsonb · nota · hash`) · **bid_atividades** (`bid_id · cliente_id · tipo ligacao|email|reuniao|nota|tarefa|evento · texto · prevista_para · concluida_em · usuario`). Semente: modelo "Transporte de equipamentos" na biblioteca (6 seções, 10 colunas, 10 condições).
- **050 (14e)** — Monitor de CNPJs: `cnpj_monitor` (situação por CNPJ da plataforma inteira, mudança, revisão da plataforma), `cnpj_monitor_ciclos`, `cnpj_liberacoes` (justificativas para seguir com OC/nota de CNPJ irregular), `fornecedor_alteracoes` (histórico do cadastro do fornecedor), `cotacao_fornecedores.bloqueado_cnpj`; carrega o que já se sabia de `fornecedores.situacao_cnpj`.
- **treinamento_participacoes** ⭐ (migration 030) — `turma_id (CASCADE) | colaborador_id (RESTRICT) | presente | assinatura_png · assinatura_hash · assinado_em (lista de presença na tela) | aprovado · nota (prova — 12e.2) | valido_ate (data da turma, ou data_fim, + validade) | obs`. Único (turma, colaborador).
- **colaborador_funcoes** ⭐ (12d.3, migration 029) — histórico de funções: `colaborador_id (CASCADE) | funcao_id (SET NULL) | funcao_nome (cópia) | inicio | fim (NULL = atual; só 1 atual por colaborador — índice único parcial) | motivo (admissao/promocao/transferencia/readaptacao/correcao/outro) | obs | criado_por`. A 029 criou o 1º período de quem já tinha função (início = admissão ou o dia da migration).
- **avisos_enviados** ⭐ (12d.3, migration 029) — controle genérico de aviso já mandado: PK `(tenant_id, chave, marco)`. Chaves: `epi_troca:<entrega_item>` (marcos 15/vencido), `epi_ca:<epi_item>:<validade>` (30/vencido — CA renovado reinicia), `doc_falta:<colaborador>:<codigo>:<funcao>` (falta, uma vez).
- **epi_itens.tamanho** e **colaboradores.tam_calcado / tam_camisa / tam_calca / tam_luva** ⭐ (migration 027) — tamanho do item de EPI e da pessoa (a entrega da 12d.2 sugere o item do tamanho certo).
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
- **022_colaboradores_documentos.sql** — `colaboradores`, `documento_tipos` (+ 12 tipos padrão), `documentos`, bucket privado `documentos`. Idempotente; FKs com os tipos de id lidos do banco.
- **021_plano_responsavel_dia_util.sql** — `planos_manutencao.responsavel_id` + `regra_dia_util` (CHECK), `chamados.responsavel_id`; FKs com o tipo de `usuarios.id` lido do banco. Idempotente.
- **020_plano_termino.sql** — `planos_manutencao.termina_em` (NULL = sem término) + CHECK `termina_em >= proxima_data`. Idempotente.
- **019_planos_manutencao.sql** — `planos_manutencao`, `chamados.origem_plano_id/origem_plano_data` + índice único, `tenants.valor_hora`. Idempotente; FKs com o tipo de id lido do banco.
- **018_console_plataforma.sql** — `plataforma_admins`, `admin_acoes`, `fornecedores.aprovado_em/recusado_em`, chaves estrangeiras no Canal Spot (apaga órfãos antes). Idempotente.
- **017_confirmacao_email.sql** — `usuarios/fornecedor_usuarios.email_confirmado_em` (existentes já confirmados), `email_confirmacoes`. Idempotente.
- **016_cadastro_planos.sql** — tabela `planos`; `tenants` com teste e aprovação (remove CHECK antigo em `tenants.plano`); `fornecedores.tipo = 'candidato'`. Idempotente.
- **015_convite_com_cnpj.sql** — `fornecedor_convites.cnpj` e `dados_cnpj` (convite a fornecedor novo passa a exigir CNPJ). Idempotente.
- **014_convite_fornecedor_novo.sql** — `fornecedor_convites.fornecedor_id` aceita NULL (convite de fornecedor novo) + coluna `nome_sugerido`. Idempotente.
- **013_convite_fornecedor.sql** — tabela `fornecedor_convites`. Idempotente.
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
- Vê as demandas spot de todos os tenants — **somente se for verificado (global)**. Decisão 17/10/2026 (etapa 10c): fornecedor local (cadastrado/convidado por um tenant, sem análise da plataforma) **não** vê o Canal Spot. Motivo de compliance: a demanda expõe empresa e contatos do comprador para a rede; sem essa trava, uma empresa criaria uma conta de cliente, cadastraria fornecedores "laranja" e teria acesso às demandas e contatos de todos os tenants. Regra única em `services/acessoSpot.js`.
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

### Acesso ao Canal Spot — só fornecedor verificado (etapa 10c)
- Local recebe **403 `spot_requer_verificacao`** em todas as rotas de fornecedor do Spot (`/api/spot/fornecedor/*`, `/api/fornecedor/interesse`, `/api/fornecedor/interesses`) e em `GET /api/spot/publicas` — que **era pública, sem login** (listava todas as demandas abertas com o nome do comprador) e passou a exigir fornecedor verificado. O verificador avisa se alguma tela do front ainda chama `spot/publicas`.
- `GET /api/fornecedor/me` e `/painel` devolvem `spot_liberado`; o portal mostra "⚡ Oportunidades Spot 🔒" com tela explicando a verificação, o Painel troca o card do Spot por "🔒 exclusivo para verificados" e esconde os indicadores, e Meus Dados mostra o Pro como exclusivo de verificado.
- **Plano Pro só vale para verificado** (os recursos do Pro são do Spot); e-mails de recomendação só para global.
- Corrigido: `POST /api/fornecedor/interesse` (rota antiga) gravava o `tenant_id` do fornecedor no interesse — agora grava o da demanda e recusa demanda encerrada.

### Painel do Fornecedor (etapa 10)
`GET /api/fornecedor/painel` (só dados do próprio fornecedor, de todos os clientes). Primeira tela do portal (`TelaPainelFornecedor.jsx`; menu "📊 Painel"; o link `?spot=` do e-mail continua abrindo direto o Canal Spot).
- **Agora** (cada card leva à tela): cotações aguardando resposta (só cotação viva), pedidos para confirmar, NCs para responder (`enviado | visualizado | devolvida` e NC não encerrada), demandas spot que combinam e ainda não foram respondidas.
- **Canal Spot, 90 dias:** taxa de resposta (respondidas ÷ vistas), taxa de vitória (escolhido ÷ decididas — "decididas" exclui encerramento `nao_necessario`), tempo médio da publicação à resposta, valor ganho (soma do `valor_estimado` informado nas escolhidas — ver pendência unitário × total).
- **Cotações, 90 dias:** recebidas, respondidas, vencidas (cotações com OV para ele), valor em pedidos.

### Convite ao fornecedor local (etapa 10)
1. Tenant, na lista de Fornecedores, clica **✉** num local sem acesso → `POST /api/fornecedores/:id/convidar { email }` (padrão: e-mail do cadastro). E-mail **transacional** (grátis) com link `FRONTEND_URL/#convite?token=…`, válido 7 dias.
2. Fornecedor abre o link → `TelaAceitarConvite.jsx` (rota `convite` no `main.jsx`) → `GET /api/auth/convite/validar` → cria nome + senha → `POST /api/auth/convite/aceitar` cria o login em `fornecedor_usuarios` e devolve o JWT → entra direto no portal.
3. A partir daí o local é **dono dos próprios dados**: tenant recebe 403 ao editar cadastro/atuação e 409 ao excluir; continua podendo ativar/desativar. Lista mostra "🟢 No portal" / "✉ Convite enviado · vale até…".
- Bloqueios: global (já é da plataforma), local de outro tenant, fornecedor que já tem login, e-mail que já é login de outra empresa (juntar cadastros = etapa 2, adiada).
- A lista de fornecedores do tenant **não expõe mais** `descadastro_token` nem `recomendacoes_email` do fornecedor.

### Convite a fornecedor novo (etapa 10b)
Para quem ainda **não está** na lista do tenant: o tenant não digita cadastro nenhum.
1. Tenant clica **✉ Convidar fornecedor** (ao lado de "Novo Fornecedor") → e-mail + nome opcional → `POST /api/fornecedores/convidar-novo`. E-mail transacional "<tenant> quer receber cotações da sua empresa pelo QuotaFlow", botão "Cadastrar minha empresa", link 7 dias.
2. Fornecedor abre o mesmo `#convite?token=…`; `validar` devolve `novo: true` e a tela vira um cadastro curto: **empresa** (CNPJ com busca na Receita pelo navegador, nome fantasia, razão social, endereço, cidade/UF, telefone, WhatsApp), **atuação** (opcional, `PainelAtuacao`), **acesso** (nome + senha). `POST /api/auth/convite/aceitar { token, nome, senha, empresa }`.
3. O cadastro nasce como **local do tenant que convidou**, com login no portal ("🟢 No portal", 🔒 para o tenant). Quem convidou responde pelo fornecedor — por isso não passa pela fila "não verificado" do autocadastro (etapa 11).
- **Regras do aceite:** CNPJ com dígito verificador; CNPJ de **global** → não duplica, orienta a entrar com o login existente; CNPJ que o **próprio tenant** já tinha (sem login) → liga o login a esse cadastro (o que o fornecedor preencheu vale; e-mail oficial do tenant é mantido); CNPJ de local de **outro tenant** → nada é revelado, nasce cadastro novo; consulta à Receita (BrasilAPI) **também no servidor**: inexistente ou não ATIVA bloqueia, fora do ar não bloqueia (grava `dados_cnpj`, `situacao_cnpj`, `ultima_consulta_cnpj` quando responde; razão social oficial vem da Receita); falha ao criar o login desfaz o cadastro recém-criado; campos aceitos são uma lista fechada (não dá para mandar `tipo`, `tenant_id`, `plano`).
- **E-mail que já é login:** bloqueia no envio — a mensagem só diz de quem é se for global ou do próprio tenant.
- **CNPJ obrigatório (etapa 10c):** o tenant informa o CNPJ no modal (prévia da Receita pelo navegador, sugestão do e-mail da Receita); o servidor reconsulta no envio — inexistente, não ATIVO ou **Receita fora do ar = não envia** — e grava CNPJ + resumo da Receita no convite. No link, CNPJ, razão social e endereço chegam **travados** (o servidor ignora esses campos no aceite); o fornecedor completa nome fantasia, telefone, atuação e acesso. Um convite pendente por CNPJ por tenant. Convites antigos (sem CNPJ) seguem o fluxo da 10b; "Reenviar" deles abre o modal pedindo o CNPJ.
- **Lista "Convites aguardando cadastro"** abaixo da tabela (`GET /api/fornecedores/convites`), com **Reenviar** (novo link, cancela o anterior) e **Cancelar** (`DELETE /api/fornecedores/convites/:id`); convite expirado aparece em vermelho. Rotas declaradas antes de `/:id`.

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

### ✅ Em produção (18/10/2026)
- **👷 Pessoas e documentos (etapa 12c):** menu "👷 Pessoas" (admin, gestor, qualidade, operação; editar só admin, gestor, qualidade). Aba **Documentos**: cartões vencidos / vence em 30 dias / em dia (clicáveis como filtro), busca, filtro por alvo e colaborador, histórico de renovados; novo documento de pessoa, equipamento ou empresa com tipo, número, emissão (sugere o vencimento pela validade do tipo), vencimento, responsável por renovar e arquivo (PDF/foto); **↻ Renovar** (o anterior vai para o histórico); abrir arquivo por link assinado; excluir só para cadastro errado (modal do app). Aba **Colaboradores** (CPF validado; completo só para quem edita — LGPD; ligação opcional ao login). **Calendário** ganhou **camadas** (🛠 Manutenção · 📄 Documentos): documento aparece no dia do vencimento em verde-azulado, cartão com situação e "Ver em Pessoas"; rodapé "📄 N documento(s) vencendo · X já vencido(s)". Abas EPI e Treinamentos aparecem como "em breve".
- **📧 Aviso de vencimento por e-mail (etapa 12c.1):** todo dia às 7h (mesmo disparo do resumo do Canal Spot — pg_cron chamando `POST /api/recomendacoes/resumo-diario`, ou `CRON_INTERNO=1`) o sistema avisa documentos que chegaram a **30, 15 ou 5 dias** do vencimento e, uma vez, quando **vencem**. Recebem: usuários ativos **admin e gestor** (perfil em `usuarios.perfil` ou `usuario_perfis`) + o **responsável** do documento. **Um e-mail por pessoa por dia** com a lista; sem novidade = sem e-mail. Cada marco sai uma vez só (`documento_avisos`); se o servidor ficou dias fora, manda só o marco mais urgente. Substituído (renovado) e colaborador desligado não entram; renovar recomeça os avisos para o novo documento. Se o envio falhar para todos, tenta de novo no dia seguinte. Falha nos avisos nunca impede o resumo do Spot. A resposta do disparo traz `avisos_vencimento: { tenants, documentos, emails, falhas }`. Usa o Resend (conta na cota de 100/dia do plano grátis).
- **👔 Funções e biblioteca (etapa 12d.0):** aba **👔 Funções** em Pessoas (ver: admin, gestor, qualidade, operação; editar: admin, gestor, qualidade). Cada função tem **descritivo do cargo** (atividades/responsabilidades — requisito ISO), **requisitos** e **documentos exigidos** (tipos de pessoa: ASO, CNH, MOPP, toxicológico, tipos próprios). **📚 Importar da biblioteca**: modelos do QuotaFlow vistos por todos os tenants; importar **copia** para o tenant, que adapta. Se o modelo mudar no Console, a cópia mostra **✨ Versão nova na biblioteca** → "Atualizar" (modal do app) troca descritivo/requisitos/documentos e mantém o nome; nada muda sozinho. Excluir função só sem colaborador ligado (409). **Colaborador**: campo Função vira lista dos modelos; quem tinha só texto ganha a **sugestão** do modelo de mesmo nome (confirma ao salvar). **📋 Ficha** do colaborador: exigidos × o que ele tem (🔴 falta/vencido · 🟡 vencendo · 🟢 em dia), com "＋ Cadastrar"/"↻ Renovar" que abre o documento já preenchido e volta para a ficha. Ao ligar/trocar a função, a ficha abre sozinha (decisão b: só mostra as pendências novas — sem recolher nada). Lista de colaboradores mostra "Ficha · N pendência(s)". **🔍 Busca (12d.0.2)** na aba Funções, no modal da biblioteca e no Console: procura no nome, CBO, setor, descritivo, requisitos e documentos exigidos, sem acento e sem maiúscula (ex.: "freio" acha o mecânico, "mopp" acha o motorista de perigosos). Antes da migration 024 a tela funciona como na 12c (aba Funções pede a migration). **Console da Plataforma → 📚 Biblioteca de funções**: criar/editar modelos (editar descritivo, requisitos ou documentos sobe a versão), ver quantas empresas importaram, "Tirar da biblioteca" (só desativa; cópias ficam). Rotas: `GET/POST /api/plataforma/biblioteca/funcoes`, `PUT/DELETE …/:id` (auditoria em `admin_acoes`). Ainda não: e-mail diário de documento **faltando** (hoje o e-mail avisa só vencimento) — entra junto com EPI. **Detalhes (12d.0.2):** CBO, setor/área (sugere os já usados), escolaridade mínima (lista), "responde a" (sugere as funções da empresa) e **riscos da função** marcados por grupo do PGR, com cores — aparecem no cartão, na biblioteca e na ficha; vão alimentar a sugestão do kit de EPI na 12d.
- **🦺 EPI (etapa 12d.1):** aba **🦺 EPI** em Pessoas (ver: admin, gestor, qualidade, operação; marcar/editar: admin, gestor, qualidade). EPI = item de consumo do Estoque marcado como EPI (decisão 19/10: opção A, usar o Estoque — compra por RM → RC → cotação). Cada EPI tem tipo, **CA** e validade do CA (🔴 vencido · 🟡 vence em 30 dias), troca a cada X dias e mostra o saldo total e o saldo no endereço **📦 EPI**. "＋ Marcar item como EPI": escolhe um item que já está no Estoque (busca; não oferece o que já é EPI) ou cria um **item novo** no Estoque (saldo 0 — dar entrada pelo Estoque). "Desmarcar" não apaga o item. Cartões clicáveis (CA vencido, vence em 30 dias, sem saldo) e busca. **Kits das funções**: para cada função com kit, mostra se cada tipo tem item cadastrado (✓ com saldo · ○ sem saldo · ＋ falta — clicar abre o cadastro já com o tipo). **Kit de EPI na função** (aba Funções e Console): linhas tipo + quantidade + troca (dias), botão **✨ Sugerir pelos riscos** (só acrescenta o que falta; mapa risco→EPI em `services/epi.js` → `SUGESTAO_POR_RISCO`, é sugestão — confirmar com PGR/SESMT). Mudar o kit no Console sobe a versão. **Próxima: 12d.2** — entrega com o kit da função já carregado, nº `EPI-AAAA-NNNN`, assinatura na tela ("Limpar e refazer"), saída no Estoque (endereço EPI primeiro; sem passar pela aprovação de retirada), devolução/troca, ficha NR-6 em PDF, CA vencido e troca vencida no calendário e no e-mail diário.
- **🦺 EPI — revisão 12d.1b (decidido 19/10 com o Marcony):** o centro da aba é o **colaborador** (sub-aba **👥 Por colaborador** chega na 12d.2 com a entrega); o cadastro e o saldo ficam na sub-aba **📦 Estoque de EPI** — o time de EHS não precisa ir às telas de materiais (reclamação clássica do SAP). **"＋ Novo EPI" cria o item no Estoque por trás** (nome = descrição ou tipo + "— tam. X"; unidade PAR para calçado/luva); ligar item já existente é só um link ("Já tenho esse item cadastrado no Estoque"). **Tipo de EPI = busca com autocompletar** no catálogo (QuotaFlow + empresa), com "＋ Criar o tipo … na minha empresa" (escolhe o tamanho que ele usa); escolher o tipo preenche a troca padrão. **Recebimento**: o saldo liberado fica na doca RECEBIMENTO (fluxo normal do Estoque, sem mudança); a linha do EPI mostra "📥 N na doca → Guardar no EPI", que usa `POST /api/estoque/movimentacoes/transferir` (RECEBIMENTO → EPI). O backend garante os endereços EPI e RECEBIMENTO. **Tamanhos** (👟 👕 👖 🧤) no cadastro do colaborador. **Console → 🦺 Catálogo de EPI**: criar, editar (nome, tamanho, troca, ordem; o código não muda), tirar/voltar ao catálogo. Rotas: `POST /api/pessoas/epi/tipos`; `GET/POST /api/plataforma/biblioteca/epi-tipos`, `PUT …/:id`.
- **Fluxo-alvo de EPI (Marcony, 19/10):** função (o SESMT define o kit) → **treinamento básico de EHS aprovado** → central de EPI: o sistema conhece a função e os tamanhos e mostra a ficha pré-preenchida → o colaborador confere e **assina** → o técnico confirma → **baixa no estoque**. A Ficha do colaborador vira o **painel de conformidade**: função · requisitos/competências × descritivo · documentos · EPIs entregues · treinamentos.
- **🦺 Entrega de EPI e selo de conformidade (etapa 12d.2):** EPI ganha 3 sub-abas (decisão 19/10): **👷 Gestão de funcionários** — cada colaborador ativo com o kit da função e a situação de cada EPI (✓ em dia · ⚠ troca em até 15 dias · 🔴 troca vencida · ✗ não entregue), cartões-filtro e busca; **🦺 Entregar** abre a ficha pré-preenchida (kit da função, quantidade do kit, item sugerido pelo **tamanho** do colaborador e com saldo; o que está em dia vem desmarcado; "＋ Outro EPI" fora do kit), avisa CA vencido/sem CA/saldo, mostra o termo (NR-6) e o **quadro de assinatura** (dedo ou mouse, "↺ Limpar e refazer"); sem assinatura não confirma. Confirmar = **baixa no Estoque** (saldo total + endereço — EPI primeiro, depois os outros, RECEBIMENTO por último — com movimento `MOV-…` de saída "Entrega de EPI EPI-AAAA-NNNN — nome"), **sem passar pela aprovação de retirada**; se algo falhar no meio, desfaz a baixa. Entregar um tipo que já está em uso fecha o anterior como "substituído". **📋 Histórico** com **↩ Devolver** (bom → volta ao endereço EPI; danificado → descarte). **🖨 Ficha NR-6**: página para imprimir/salvar em PDF (paisagem) com empresa/CNPJ, colaborador/CPF (completo só para quem edita), termo, uma linha por EPI (data, nº, EPI, CA, tamanho, qtd, motivo, próxima troca, devolução) e a **assinatura** de cada entrega + os hashes. **🧰 Kits por função**: todas as funções com o kit e a cobertura no estoque (✓/○/＋), "Editar kit" com "✨ Sugerir pelos riscos" (base para custo por funcionário/tipo — futuro). **📦 Estoque**: o da 12d.1b. Quem entrega/devolve: admin, gestor, qualidade, operação. Rotas: `GET /api/pessoas/epi/painel`, `POST /epi/entregas`, `POST /epi/entrega-itens/:id/devolver`, `GET /epi/colaboradores/:id/historico`, `GET /epi/colaboradores/:id/ficha-nr6`.
- **🟢🟡🔴 Selo de conformidade (12d.2 — regra do Marcony, 19/10):** cada pilar com a sua % — 👔 Função (ligada) · 📄 Documentos (em dia ÷ exigidos) · 🦺 EPIs (em uso e em dia ÷ kit) · 🎓 Treinamentos (12e). Geral = média dos pilares que se aplicam. **🟢 Conforme** = 100% · **🟡 Em andamento** = falta registrar, nada vencido (*oportunidade de melhoria/observação* — o documento pode existir fora do sistema; **não é não conformidade**) · **🔴 Atenção** = algo vencido (documento ou troca de EPI — evidência objetiva de não conformidade). Aparece na lista de Colaboradores ("🟡 58% · 👔 ✓ 📄 1/4 🦺 0/6") e no topo da Ficha, que também ganhou a seção 🦺 EPIs da função. Antes da migration 028 o selo sai sem o pilar EPI.
- **Selo — regra revista (12d.3.1, 20/10, Marcony):** a média por pilar era generosa demais (Ana: função 100% + documentos 25% + EPI 0% → 42%, com só 1 item em dia de 10). Agora: **a função é pré-requisito, não ponto** (sem função → **⚪ Defina a função**, sem %); **geral = itens em dia ÷ itens exigidos** (cada documento, cada EPI do kit e, na 12e, cada treinamento vale 1 — Ana: 1/10 = **10% · faltam 9**); arredonda para baixo (99,7% mostra 99); função sem nenhuma exigência = 🟢 "nada exigido". Lista: "🟡 10% · faltam 9 · 📄 1/4 🦺 0/6"; Ficha: "1 de 10 itens em dia · faltam 9" + pilares. **12d.3.2:** a Ficha perdeu os cards "Pendências / Vencendo / Em dia" (só contavam documentos e competiam com o selo); cada seção ganhou a própria contagem no cabeçalho — "📄 Documentos · 1 de 4 em dia · 3 a cadastrar" e "🦺 EPIs da função · 0 de 6 em dia · 6 não entregue(s)" (🎓 Treinamentos seguirá o padrão). Cores iguais (🟢 100% · 🟡 falta registrar · 🔴 algo vencido).
- **Correção no Estoque (12d.2):** `POST /api/estoque/movimentacoes` com a aprovação de retirada **desligada** quebrava (`solicitacao is not defined` — usava `solicitacao.numero_solicitacao` fora do bloco da aprovação). Agora grava `numero_solicitacao: null`. Observação: essa rota e a aprovação de solicitações ainda não atualizam o saldo por endereço (`itens_consumo_enderecos`) — a entrega de EPI atualiza os dois.
- **🎓 Treinamentos (etapa 12e.1, 20/10):** aba **🎓 Treinamentos** em Pessoas, com 3 sub-abas. **👷 Por colaborador**: os treinamentos exigidos pela função (marcados em 👔 Funções → "Treinamentos exigidos") × o que cada um fez: ✓ em dia · ⚠ vence em 30 dias · 🔴 vencido · 📅 agendado (inscrito numa turma futura — ainda conta como falta no selo) · ✗ falta. Clicar no que falta ou venceu **agenda uma turma já com todos que precisam**. **📅 Turmas e registros**: "＋ Agendar turma" (treinamento, data/até, modalidade presencial/online, instrutor, carga — vem do catálogo —, local, participantes com o selo "precisa"); na turma, cada um **✍ assina a presença na tela** (mesmo quadro do EPI, com termo de participação e hash), "✓ Concluir" grava a validade de quem assinou (quem não assinou = faltou; assinar depois de concluída também vale), adicionar/tirar participante (quem assinou não sai), cancelar, **🖨 lista de presença** em PDF (empresa/CNPJ, treinamento/norma, instrutor, data, carga, local, validade, conteúdo programático, CPF/função/data-hora/assinatura de cada um, linhas para instrutor e responsável, hashes). **📝 Registrar treinamento já realizado** (ideia do Marcony): treinamento feito no modelo da empresa — instrutor e material internos — com data até hoje, quem participou e a **evidência anexa** (PDF/foto ≤ 10 MB); já nasce concluído, com 📎 Ver evidência. **📚 Catálogo**: nome, norma, carga horária, reciclagem (meses), tipo, conteúdo programático; editar e tirar do catálogo (histórico fica) — admin, gestor, qualidade. Turmas, presença e registro: também operação. **Selo**: entra o pilar 🎓 (por item; vencido = 🔴). **Ficha**: seção "🎓 Treinamentos · X de Y em dia · …". **Calendário**: camada **🎓 Treinamentos** (rosa #ec4899) com turmas agendadas e vencimentos; o cartão abre a aba. **E-mail diário** (admin/gestor): 🎓 treinamento vencendo (30 dias) e vencido, e 🎓 treinamento exigido não realizado (uma vez). Rotas `/api/pessoas/treinamentos` (catálogo), `/treinamentos/painel`, `/treinamentos/turmas` (+ `/:id`, `/participantes`, `/assinar`, `/concluir`, `/cancelar`, `/evidencia`, `/lista-presenca`), `/colaboradores/:id/treinamentos`.
- **📖 Conteúdo, prova, biblioteca e horas de treinamento (etapa 12e.2a, 20/10):** decidido com o Marcony — a "Academia QuotaFlow" é diferencial (SAP/Oracle não têm conteúdo próprio de EHS, lean e liderança ligado à função, ao selo e ao dossiê). **Conteúdo** em seções (texto, **vídeo por link YouTube/Vimeo — pode ser não listado; o QuotaFlow não hospeda vídeo**, material de apoio por link) e **prova** de múltipla escolha (2 a 6 alternativas, nota mínima %, até 3 tentativas — esgotou, o instrutor libera de novo), no editor compartilhado `EditorConteudoTreinamento.jsx` (pré-visualiza o vídeo). **Console → 🎓 Biblioteca de treinamentos**: cria/edita/tira modelos (tenant_id NULL); mudou nome/carga/conteúdo/prova → versão sobe. **Pessoas → 🎓 → 📚 Catálogo**: "📚 Importar da biblioteca" (cópia com origem_id/origem_versao; mesmo código reaproveita o treinamento da empresa), selos 📚 QuotaFlow · 📖 seções · 🎬 · 📝 prova, "✨ Versão nova" (confirmação no modal; turmas já feitas não mudam). **⏱ Horas creditadas**: carga da turma para quem esteve presente em turma concluída (no online, quem for aprovado — 12e.2b grava `horas`); **sub-aba ⏱ Horas** com período (padrão: ano), total da empresa, média por colaborador ativo e quebra **regulatório · integração · desenvolvimento** por colaborador (desligado com horas no período aparece esmaecido); card "Horas de treinamento no ano" e ⏱ por colaborador no painel; na Ficha, "⏱ X h no ano · Y h no total". **Data de nascimento** no colaborador (2º fator do link da prova e aniversariantes do mês; LGPD: só quem edita vê). Rotas `/api/pessoas/treinamentos/biblioteca`, `/treinamentos/importar`, `/treinamentos/:id/atualizar`, `/treinamentos/horas?de&ate`; Console `/api/plataforma/biblioteca/treinamentos`. Migration 031.
- **💻 Prova online, perfil Colaborador e aniversariantes (etapa 12e.2b, 20/10):** turma **online** (agendada) = o colaborador estuda o conteúdo e faz a prova. **Meio 1 (padrão) — logado**: perfil novo **colaborador** (decidido com o Marcony: **não conta na cobrança do plano**), criado em Pessoas → Colaborador → Editar → "🔑 Dar acesso" (e-mail único no sistema + senha; trocar senha/reativar; desativar). Esse perfil abre direto numa tela só com **🎓 Meus treinamentos** (sem o menu); o `tenantMiddleware` barra o resto da API para ele (só `/api/meus-treinamentos`, `/api/usuarios/me`, `/api/auth`). Qualquer outro usuário ligado a um colaborador também tem "🎓 Meus treinamentos" no menu. **Meio 2 (último caso) — link** `#prova?t=…` gerado na turma (📋 copiar, desativar): a pessoa entra com **CPF + data de nascimento** (têm de bater com um participante; 8 erros por link+IP a cada 15 min), sessão de 3 h com segredo próprio (não vale como login). **Prova**: até `tentativas_max` (padrão 3); reprovou → "Revisei o conteúdo" antes de tentar de novo; esgotou → o instrutor clica **↻ Liberar tentativas** na turma (novo ciclo). Cada tentativa guarda respostas, cópia da prova, nota, meio, IP e hash (= assinatura do exame); o gabarito nunca vai para o colaborador. **Aprovado = presente + nota + horas (carga da turma) + válido até (data da aprovação + validade)**, já conta no selo/horas mesmo com a turma aberta; "Concluir turma" mantém essa validade. Sem prova: "✓ Concluí o conteúdo" (declaração). Na turma: 📝 tentativas/melhor nota/meio por participante; a lista de presença mostra "Prova online — nota X%". **Conteúdo**: formatação leve no texto (`# título`, `- lista`, `**negrito**`, links) com "👁 Ver como o colaborador vê"; **📎 Enviar PDF** protegido (bucket `documentos`, `tenant-{id}/trein-material/…` ou `biblioteca/trein-material/…`, link de 1 h só para participante) além do link externo. **🎂 Aniversariantes do mês** na aba Colaboradores (só dia/mês; avisa quem está sem data). Rotas `/api/meus-treinamentos` (`/`, `/:turma`, `/material/:i`, `/prova`, `/concluir`), `/api/prova/:token` (público: `/entrar`, `/treinamento`, `/material/:i`, `/prova`, `/concluir`), `/api/pessoas/treinamentos/turmas/:id/link`, `/liberar/:colab`, `/treinamentos/material`, `/aniversariantes`, `/colaboradores/:id/acesso`. Migration 032. Ajustes 12e.2b.1–3: senha do acesso em branco = **CPF (só números)** (ideia do Marcony). **Decidido 21/10: NÃO obrigar troca de senha no 1º acesso** — público com baixa escolaridade esquece a senha e a recuperação por e-mail não funciona para quem não usa e-mail; padrão fica e-mail + CPF (logado) e CPF + data de nascimento (link). A troca continua possível a pedido ("Trocar senha / reativar"); clicar num treinamento em dia/agendado em 👷 Por colaborador abre a turma; lista de presença com fonte menor.
- **🎓 Certificado e 📄 comprovante da avaliação (etapa 12e.2c, 20/10):** `utils/gerarCertificado.js` (HTML printável, sem dependência). **Certificado** A4 paisagem (empresa/CNPJ, nome, CPF, função, treinamento, norma, modalidade, carga, data de conclusão, nota, validade, conteúdo programático, instrutor, **código de verificação** XXXX-XXXX-XXXX-XXXX = SHA-256 de tenant/turma/colaborador/hash da conclusão, rodapé "Emitido pelo QuotaFlow") — só para quem concluiu (presente, não reprovado; turma concluída ou online aprovada). Botão 🎓 Certificado por participante na turma (CPF mascarado para quem não edita), "🎓 Baixar certificado" no resultado e 🎓 em cada "Já realizado" de Meus treinamentos, e no link. **Comprovante da avaliação** A4 retrato (só admin/gestor/qualidade — mostra o gabarito): cada tentativa com data/hora, meio, IP, nota, pergunta × marcada × correta e hash; botão 📄 Avaliação na turma online. Rotas `GET /api/pessoas/treinamentos/turmas/:id/certificado/:colab` · `/avaliacao/:colab`, `GET /api/meus-treinamentos/:turma/certificado`, `GET /api/prova/:token/certificado`. Sem migration. Pendência: página pública para conferir o código de verificação.
- **🔒 Encerramento da turma (etapa 12e.2d, 20/10):** "✓ Concluir turma" virou **"🔒 Encerrar turma"**, com confirmação no modal dizendo quantos concluíram e quantos vão ficar como "faltou". Turma **online** encerra sozinha: (1) quando **todos** os participantes concluem (depois da aprovação/declaração); (2) quando passa o **prazo** — o campo "Até" vira "PRAZO PARA FAZER (ATÉ)" na online — conferido ao abrir a lista de turmas, o painel, a turma, Meus treinamentos ou o link (**sem rotina agendada e sem e-mail** — decidido com o Marcony: o colaborador vê pendências e prazos na tela dele). Encerrar desativa o link para novas tentativas; turma encerrada ainda abre pelo link para ver o resultado e baixar o certificado. Prazo aparece na turma (⏳), em Meus treinamentos e no link. Roadmap: **tela inicial do funcionário** com seção de treinamentos (pendentes, prazos, certificados). **12e.2d.1:** o e-mail diário do **gestor** (admin/gestor — o colaborador nunca recebe) ganha a seção **"🎓 Turma encerrada com faltas — reagendar"**: uma linha por turma encerrada nos últimos 7 dias, com quem não fez (até 4 nomes + "e mais N"), uma vez por turma (`avisos_enviados`, chave `trein_faltou:{turma}`); a rotina das 7h também encerra as online com prazo vencido.
- **🧩 Competências (etapa 12e.3, 21/10):** decidido com o Marcony: entra no selo como **pilar 🧩**, lista **por função com sugestões**, **reavaliação opcional** por competência. Três tipos de item: **escolaridade** do colaborador ≥ mínima da função; **categoria da CNH** cobre a mínima (E cobre D, C, B; "A" é à parte; a **validade** da CNH continua em 📄 Documentos); **lista atende/não atende** da função (texto livre + 19 sugestões de transporte/oficina; "reavaliar a cada N meses" opcional). Na **Ficha**: seção 🧩 com 🟢 atende · ⚪ não avaliado/não informado · 🟡 não atende · 🟡 reavaliar; "Avaliar" (✓ Atende / ✗ Não atende, data ≤ hoje, observação, evidência PDF/foto opcional) — cada avaliação fica no **histórico** (quem avaliou e quando); escolaridade/CNH faltando → "Preencher" abre o cadastro. **Selo**: pendente, não atende e reavaliar contam como falta (🟡), **nunca 🔴**. Função ganha "CNH mínima" e "Competências exigidas" (cartão mostra 🪪 e 🧩); colaborador ganha "Escolaridade" e "Categoria da CNH". Biblioteca de funções no Console também (importar/versão nova copiam). Rotas `POST/GET /api/pessoas/colaboradores/:id/competencias`, `GET /api/pessoas/competencias/:id/evidencia`; a ficha traz `competencias`. Migration 033.
- **🧩 Nota, nível esperado e treinamentos ligados (etapa 12e.3.1, 21/10):** decidido com o Marcony: **competência ≠ treinamento** (ISO 9001 7.2 — treinamento é meio, competência é demonstrar na prática) → ambos, ligados, e o treinamento **nunca** marca "atende" sozinho. **Nota de 1 a 4**: 1 Não atende (não faz/faz com risco) · 2 Em desenvolvimento (com supervisão) · 3 Atende (sozinho, no padrão) · 4 Referência (pode ensinar). Cada competência da função tem **nível esperado** (padrão 3); atende = nota ≥ esperado; abaixo = 🟡 "Abaixo do esperado". Competência pode ligar **treinamentos que a sustentam** ("＋ ligar treinamento" no editor da função e na biblioteca do Console): na Ficha aparecem como 🎓 em dia · 🎓 vencido · ⚠ sem o treinamento (e "falta a avaliação prática"); ao avaliar, os em dia entram como **evidência automática** (cópia no histórico). **Faixas júnior/pleno/sênior, "pronto para a próxima faixa" e matriz da equipe → deixadas para a versão 2.0** (decisão do Marcony, 21/10). **Layout de 👔 Funções**: acordeão **fechado por padrão** (linha resumida: 👥 colaboradores · 📄 🦺 🎓 🧩 ⚠ contagens); aberto, detalhes **agrupados com divisores**: Identificação · Descritivo · Requisitos · ⚠ Riscos · 🧩 Competências · 🎓 Treinamentos · 🦺 EPIs · 📄 Documentos (busca abre os que casam). Migration 034.
- **📑 Dossiê do colaborador (etapa 12f, 21/10):** na Ficha, "📑 Gerar dossiê" (só admin/gestor/qualidade): **período** (ano atual · últimos 12 meses · todo o histórico · intervalo), **seções** (Dados e selo · Função e histórico · Documentos · EPIs · Treinamentos · Competências) e **finalidade** (auditoria ISO/cliente · processo trabalhista · pedido do colaborador · desligamento · outro + detalhe). O backend (`services/dossie.js`) monta e **registra** a emissão (`dossie_registros`: quem, quando, período, seções, finalidade, IP) e devolve os dados; `utils/gerarDossie.js` abre o HTML A4 para imprimir/PDF: **capa** (empresa/CNPJ, colaborador, período, código DOS-…, emitido por/em, finalidade, aviso de confidencialidade LGPD) e uma seção por página — dados + selo na emissão; função atual (CBO, setor, escolaridade/CNH mínimas, riscos, descritivo, requisitos) + histórico de funções; documentos (vigentes + renovados no período; anexos ficam no sistema); entregas de EPI com assinatura e hash; treinamentos (horas no período, presença/nota, **tentativas**, validade, **código do certificado**) + exigidos na emissão; competências na emissão + **evolução nota a nota** (1 → 2 → 3) com quem avaliou, observação e evidência. Lista "EMITIDOS" no painel. O **histórico de competências na Ficha** passou a ser **agrupado por competência** com a evolução (mesmo formato do dossiê). Multas entram na 12g. Rotas `POST /api/pessoas/colaboradores/:id/dossie`, `GET /colaboradores/:id/dossies`. Migration 035. Ajustes 12f.1–2: botão "📑 Gerar dossiê" no rodapé da Ficha ao lado do "Fechar" (Fechar em azul, dossiê transparente — o Fechar é o mais usado).
- **🚦 Multas (etapa 12g, 21/10):** decidido com o Marcony. Aba **🚦 Multas** em Pessoas: cards (abertas · indicar condutor ≤ 5 d/vencido · vencendo · descontado no ano), filtros Abertas/Finalizadas/Todas, busca. **Cadastro**: veículo da frota (equipamentos) ou placa em texto; motorista responsável (a definir); data/hora, local, nº do auto, órgão; código CTB e descrição; **gravidade → sugere pontos e valor** (CTB art. 258: leve 3 pts R$ 88,38 · média 4 R$ 130,16 · grave 5 R$ 195,23 · gravíssima 7 R$ 293,47 — fatores multiplicadores à parte); recebida em → **prazo de indicação do condutor** = +15 dias (editável); vencimento; notificação anexa; **quem monitora** → cria **tarefa automática no ✅ Plano** (tabela `tarefas`, prioridade alta, prazo = próximo passo) que acompanha a situação e fecha (concluída/cancelada) quando a multa chega ao final. **Situação**: Recebida → 👤 Condutor indicado → ⚖ Em recurso → **final separado**: 💳 Paga (valor, data) | 📉 Descontada (valor, parcelas; **"Aceite do colaborador requerido"** desmarcado por padrão — marcado, o colaborador **assina na tela** o termo "reconheço a infração… autorizo o desconto… (CLT art. 462 § 1º)", gravado com PNG + hash; 🖨 termo assinado para imprimir) | ✖ Cancelada (motivo). Histórico de cada mudança. Excluir só enquanto "Recebida" (cadastro errado). **Calendário**: camada 🚦 Multas (vermelho #dc2626) com prazo de indicação e vencimento; filtra por veículo. **E-mail diário do gestor** (nunca do motorista): 🚦 indicar condutor e 🚦 multa vencendo (marcos 5 dias e vencido). **Ficha**: seção 🚦 Multas (12 meses, pontos, abertas, total descontado). **Dossiê**: seção 7 Multas (com aceite e hash). Valores descontados servem ao cálculo trabalhista/rescisão. ⚠️ O texto do termo é um modelo — a empresa deve validar com o jurídico/contador. **Roadmap**: tela de **saída de veículo / viagem do motorista** (nome a definir — "Ordem de Serviço" já é atividade interna de manutenção e confundiria; sugestões: "Saída de veículo", "Ordem de viagem", "Despacho") — o Marcony já tem um modelo; quando existir, a multa **sugere o motorista** que estava com o veículo na data/hora da infração. Rotas `GET/POST /api/pessoas/multas`, `PUT /multas/:id`, `POST /multas/:id/status`, `GET /multas/:id/arquivo`, `/termo`, `/previa-termo`, `DELETE /multas/:id`; calendário devolve `multas`. Migration 036.
- **Organização (decidida 21/10):** separar pelo "de quem é" — 🚦 multa de trânsito (pessoa + veículo) e ⚖ disciplinar (RH) ficam em **Pessoas**; **autuações da empresa** (INEA, IBAMA, ANTT, vigilância sanitária, Receita) vão para **⚠️ Não Conformidades** como tipo "Autuação / requisito legal" (órgão, auto, valor, prazos de defesa/recurso e vencimento no calendário e no e-mail, vínculo com a licença/documento da empresa, causa raiz e plano de ação) — **próxima etapa (12i)**. Mesmo motor: prazos, histórico, assinatura na tela, tarefa no ✅ Plano.
- **⚖ Disciplinar (etapa 12h, 21/10):** aba **⚖ Disciplinar** em Pessoas — **só admin, gestor e qualidade** (LGPD; a Ficha só traz a seção para quem edita). Medidas em escala: **orientação** (pode ser só verbal, registrada) → **advertência escrita** → **suspensão** (1–30 dias, CLT art. 474; início/fim) → **justa causa** (registro; não substitui a rescisão). Categoria do motivo (atraso/falta, EPI, segurança, conduta, direção/trânsito — liga a uma multa —, desempenho, patrimônio, outro), data do fato e da aplicação, descrição, anexo. **Texto do documento** gerado (modelo, com prévia) e gravado como cópia. **Ciência**: o colaborador **assina na tela**; se **recusar**, **2 testemunhas** (nome + assinatura; o próprio não pode). **Sugestão da próxima medida** pelo histórico vigente (≥ 1 suspensão em 12 m → avaliar justa causa com o jurídico; ≥ 2 advertências em 6 m → suspensão; 1 advertência ou ≥ 2 orientações em 6 m → advertência; 1 orientação → advertência na reincidência) — quem decide é o gestor. **Cancelar** não apaga (fica com o motivo e sai da progressão). 🖨 Documento com assinaturas e hashes. Ficha: seção ⚖ (12 meses por tipo, dias de suspensão, próxima sugerida). Dossiê: seção 8 Disciplinar. ⚠️ Textos são modelos — validar com o jurídico. **Correção**: o ✅ Plano mostrava o prazo com 1 dia a menos (data sem hora lida como UTC) — agora monta a data no horário local. Rotas `GET /api/pessoas/disciplinar`, `/disciplinar/sugestao/:colab`, `POST /disciplinar/previa`, `POST /disciplinar`, `POST /disciplinar/:id/cancelar`, `GET /disciplinar/:id/documento`, `/arquivo`. Migration 037. **12h.1 (ideia do Marcony):** a medida é preenchida no escritório e apresentada depois → ciência **"⏳ Colher depois"** (padrão no formulário): salva como *aguardando ciência* (card próprio, tag na lista e na Ficha) e **não conta na progressão** até ser colhida; na medida, **"✍ Colher ciência"** (assina na tela · recusa + 2 testemunhas · **"📄 Assinou no papel"** com o documento anexo · verbal só para orientação) — a data da ciência vira a data de aplicação. **🖨 "Imprimir para assinar"** sai com as linhas em branco (colaborador + 2 testemunhas). Também dá para registrar já como "assinou no papel" no cadastro. Texto do documento sem ".." quando a descrição termina com ponto. Rota `POST /api/pessoas/disciplinar/:id/ciencia`. Migration 038. **12h.2:** testemunhas com **nome + CPF** (validado; diferente do colaborador e entre si) — compliance; CPF sai no documento, nas linhas em branco do "para assinar" e no dossiê; vai no hash de cada testemunha (jsonb, sem migration).
- **🏛 Autuações da empresa (etapa 12i, 21/10):** na tela **⚠️ Não Conformidades**, abas "⚠️ Não conformidades | 🏛 Autuações (requisito legal)" (a tela de NC não foi alterada por dentro — a aba nova é um componente à parte, `TelaAutuacoes.jsx`, com tabela própria `autuacoes`). Cadastro: órgão (lista com INEA, IBAMA, CETESB, FEPAM, ANTT, DER, vigilância sanitária, MTE, Receita, SEFAZ, bombeiros, prefeitura, ANP, INMETRO — ou digitar), esfera, nº do auto, infração/fato, base legal, local/unidade, valor, data da autuação e recebimento, **prazo de defesa** (o crítico), vencimento, **licença/documento da empresa ligado** (📄 Documentos de alvo "empresa"), veículo (opcional), quem monitora (→ **tarefa no ✅ Plano**, mesmo motor das multas), auto anexo. Situação: Recebida → 📝 Defesa apresentada (prazo de recurso/resposta + defesa anexa) → ⚖ Em recurso → **final**: 💳 Paga | ✖ Cancelada/anulada (motivo). **"⚠️ Abrir NC de causa raiz"** cria uma NC (origem inspeção, descrição montada com órgão, auto, base legal e documento) ligada à autuação — 5 porquês, plano de ação e eficácia ficam na NC; "Ver NC" abre o detalhe ali mesmo. Próximo prazo: defesa (recebida) · recurso · vencimento. **Calendário**: camada 🏛 Autuações (roxo #8b5cf6). **E-mail diário do gestor**: 🏛 defesa/recurso e 🏛 vencendo (5 dias e vencido). Ver: admin, gestor, operação, qualidade; alterar: admin, gestor, qualidade. Rotas `/api/autuacoes` (`GET`, `POST`, `PUT /:id`, `POST /:id/status`, `GET /:id/arquivo?qual=auto|defesa`, `DELETE /:id`). Migration 039.
- **🔍 Inspeções de equipamento (etapa 14a, 21/10):** menu novo **🔍 Inspeções** (admin, gestor, comprador, operação, qualidade; modelos e liberação: admin, gestor, qualidade). Abas: **🚚 Equipamentos** (⛔ bloqueados primeiro, última inspeção, modelo padrão, Inspecionar, 🔓 Liberar com motivo obrigatório → `equipamento_liberacoes`), **📋 Inspeções** (histórico, detalhe com o desenho e pinos coloridos, fotos, **🛠 Abrir OS** do item não OK → abre a OS já preenchida com o equipamento e um serviço "Corrigir: …"; ao salvar a OS ela fica ligada à inspeção) e **🧩 Modelos** (importar da biblioteca, ✨ versão nova, editar, criar do zero). **Editor:** vistas com os **esquemas genéricos do QuotaFlow** (13 desenhos próprios, sem marca — desenho de fabricante não entra na biblioteca) ou **imagem própria** do cliente; clique no desenho cria o ponto, 📍 Mover reposiciona; ponto crítico = não OK bloqueia. 14a.1: checkbox **Foto obrigatória** por ponto (desmarcado = foto opcional, ex.: tacógrafo). 📍 "localização registrada" = só a coordenada GPS do celular no momento da inspeção (vai no relatório); não preenche o campo Local. **Execução (celular):** registro (km/horímetro validados contra a última leitura, local, cliente) → uma tela por vista (desenho + lista, OK / Não OK / N.A., "✓ Tudo OK nesta vista", foto pela câmera comprimida a ~1280 px, descrição obrigatória no não OK, "impede o uso") → resumo + assinatura. **Offline:** rascunho gravado no aparelho (IndexedDB) a cada toque; concluída sem internet fica em "💾 Guardadas neste aparelho" e é enviada sozinha quando a conexão volta (evento online / ao abrir a tela); o envio é idempotente (`cliente_uid`). O modelo precisa ter sido aberto uma vez com internet no aparelho. **Reprovado** (item crítico ou "impede o uso") → equipamento ⛔ bloqueado até o gestor liberar. **📄 Relatório** printável para seguradora/cliente (desenhos com pinos, itens, fotos, OS, liberação, assinatura, SHA-256). Console: aba **🔍 Biblioteca de inspeções**. Rotas `/api/inspecoes` e `/api/plataforma/biblioteca/inspecoes`. Migration 040. **Fica para a 14b:** link de **inspeção de terceiros** (nome/CPF/empresa), "Minhas inspeções" no acesso do colaborador, "resolvi na rua", calendário de inspeções por equipamento com % de cumprimento (camada 🔍), relatório por período. **14c / v2.0:** PWA instalável (abrir sem internet), QR code no equipamento.
- **🔍 Inspeções 14b.1 (21/10):** **número INSP-2026-0001** (por empresa e ano; aparece na lista, no detalhe e no relatório). **Tipo do modelo:** Equipamento (pré-uso/rotina) · Carregamento · Em trânsito · Descarregamento — os 3 últimos serão os gatilhos da AT (etapa 17a); a biblioteca ganhou "Carga — inspeção de carregamento" (acomodação, amarração com nº de pontos, calços, dimensões/AET, sinalização, lacre, documentos a bordo, peso), "Carga — verificação em trânsito" e "Carga — inspeção de descarregamento" (avarias, lacre, canhoto, quem recebeu). **🔧 Resolvi na hora:** no item não OK, o motorista marca que consertou ali mesmo e conta o que fez (obrigatório) — **não bloqueia** o equipamento (mesmo crítico) e fica como ressalva "resolvido na hora: …" no detalhe e no relatório, sem botão de OS. **🔗 Links de terceiros** (admin, gestor, qualidade — botão na aba Equipamentos): modelo + equipamento da frota **ou** "veículo do próprio terceiro" (ele informa placa e veículo), validade 1–90 dias, para quem; copiar link ou mensagem pronta (WhatsApp/Telegram), desativar, contador de usos. Tela pública `#inspecao?t=…`: nome, CPF (validado), empresa, telefone → a mesma inspeção do app, **também offline** (fila no celular). Inspeção de terceiro: executor "terceiro" com CPF/empresa no detalhe e no relatório; veículo do terceiro não bloqueia nada (não é da frota). Limite: 30 envios por link + IP por hora. **Colaborador** (perfil só colaborador): a tela dele ganhou abas **🎓 Treinamentos | 🔍 Inspeções** — inspecionar e ver **só as próprias** inspeções (sem modelos, liberação nem OS); o `tenantMiddleware` libera `/api/inspecoes` e a rota restringe. Rotas novas: `GET/POST /api/inspecoes/links`, `DELETE /api/inspecoes/links/:id`, `GET /api/inspecao-link/:token`, `POST /api/inspecao-link/:token/enviar`. Migration 041. **Fica para a 14b.2:** calendário de inspeções por equipamento e % de cumprimento (frequência do modelo), camada 🔍 no calendário, relatório por período.
- **🔍 Inspeções 14b.1.1 (22/10):** **correção** — "🔓 Liberar" gravava a evidência mas o equipamento podia continuar ⛔ bloqueado (a falha do desbloqueio passava em silêncio). Agora desbloqueia **primeiro**, confere no banco e só depois grava a evidência; se o banco recusar, aparece o erro. Editar o equipamento (⚙ Equipamentos) não mexe mais em `bloqueado/bloqueio_*` — só as Inspeções bloqueiam e liberam. **Liberar** mostra os itens que impedem o uso e pergunta **como foi resolvido**: 🛠 reparo em OS (nº da OS — já vem preenchido com as OS abertas na inspeção) · ✅ **resolvido sem OS** (checkbox "Confirmo que {itens} foi(ram) corrigido(s) e não requer(em) ordem de serviço" + o que foi feito) · ⏳ liberação provisória (por quê e até quando). O texto montado fica na evidência. **No detalhe**, ao lado de "🛠 Abrir OS": **✅ Resolver sem OS** (admin, gestor, qualidade) — conta o que foi feito; fica "Resolvido sem OS: … (quem, quando)" no detalhe e no relatório; se era o último item que impedia o uso (os outros com OS ou resolvidos), **libera o equipamento sozinho** com a evidência. Rota `POST /api/inspecoes/:id/resolver`. Sem migration.
- **🔍 Inspeções 14b.1.2 (22/10):** o card do equipamento bloqueado mantém o motivo e o botão vira **🔓 Resolver bloqueio**, que abre a inspeção que bloqueou. No detalhe, aviso "⛔ bloqueado por esta inspeção": em cada item que impede o uso o gestor escolhe **🛠 Abrir OS** ou **✅ Resolver sem OS**; "⏳ Liberar agora (provisória / já resolvido)" abre a liberação manual. **OS concluída → item corrigido:** ao concluir a OS (`POST /cotacoes/chamados/:id/concluir`) as inspeções ligadas a ela marcam `os_abertas[].concluida_em` e o item mostra "✓ Corrigido na OS-… (concluída em …)" (também no relatório). **Liberação automática** quando nenhum item que impedia o uso ficou pendente (resolvido sem OS ou OS concluída — OS só aberta **não** libera), com evidência "Liberação automática — itens … corrigido na OS-…". A inspeção continua **Reprovado** (é o registro do que foi encontrado); o card mostra **🔓 Liberado** quando a última inspeção reprovou e o equipamento já foi liberado. Erro nessa etapa nunca impede a conclusão da OS (só log). Sem migration.
- **🔍 Inspeções 14b.1.3 (22/10):** foto da inspeção abre **ampliada dentro do sistema** (clique fora ou ✕ fecha — antes abria outra aba). "⏳ Liberar agora" abre o modal **por cima da inspeção** (cancelar volta para ela). Liberar com **"Resolvido sem OS"** a partir do bloqueio registra o "resolvido sem OS" em **cada item** que impedia o uso (atalho para quando o supervisor corrigiu vários) e o último libera o equipamento — fica tudo no detalhe e no relatório. Sem migration.
- **🔍 Inspeções 14b.1.4 (22/10) — decidido com o Marcony:** o item continua **NÃO OK** e a inspeção continua **Reprovado / Ressalvas** (é o registro do que foi encontrado, como no papel). Quando todos os itens não OK estão resolvidos (na hora, sem OS ou OS **concluída**) aparece a **situação "✓ Corrigido"** ao lado do resultado — na lista (campo `corrigida` em `GET /api/inspecoes`), no detalhe (e "✓ CORRIGIDO" em cada item) e no relatório. O card do equipamento mostra 🔓 Liberado. Sem migration. **Fecha a etapa 14b.1 (inspeções).**
- **🔍 Inspeções 14b.1.5 (22/10):** relatório PDF mostra em cada item não OK a OS ("corrigido na OS-… (concluída em …)" ou "OS-… em andamento") e "✓ CORRIGIDO". No detalhe, o **nº da OS é clicável** e abre a OS em 🛠 Ordem de Serviço (trilha do evento). Sem migration.
- **🔍 Inspeções 14b.1.6 (22/10):** no relatório PDF a correção ("✓ Corrigido na OS-…", "Resolvido sem OS", "Resolvido na hora") e o "impede o uso" ficam na **coluna da descrição**, como na tela; a coluna de status só tem o selo "✓ CORRIGIDO" + "NÃO OK". Seção "Ordens de serviço". Sem migration.
- **🔍 Inspeções 14b.2 (22/10) — rotinas e locação:** na aba 🚚 Equipamentos, filtros **Todos · 🏠 Na base · 📍 Locados · ⚠ Inspeção atrasada**; o card mostra a situação (📍 cliente · contrato · obra · até…) e as rotinas ("⏰ Semanal · checklist — próxima 29/10" verde / "atrasada 3 d" vermelho). **⏰ Rotinas** (admin, gestor, qualidade): modelo + frequência (diária, semanal, quinzenal, mensal) + quem faz (empresa | locatário — só com o equipamento locado) + primeira data. Próxima = última inspeção daquele modelo + período (sem nenhuma: a primeira data); pré-uso não entra. **📍 Locar:** cliente, contrato, local/obra, contato (nome, e-mail, telefone), início, fim previsto e, opcional, a **rotina do locatário** (primeira = início + período). **🏠 Encerrar locação:** data da devolução → volta para a base e as rotinas do locatário param; lembra da inspeção de devolução. Inspeção feita com o equipamento locado fica ligada à locação; os tipos novos **Entrega** e **Devolução** gravam na locação, e o detalhe/relatório da **devolução compara item a item com a entrega** ("entrega: OK → NÃO OK", em laranja o que mudou; horímetro/km da entrega). **📊 Cumprimento** (aba nova): período de/até, % geral (cumpridas / previstas), inspeções no período, reprovadas, terceiros, e uma linha por rotina (feitas/previstas, %, situação) + 🖨 relatório. Janela = período da frequência a partir do início; cumprida com ≥1 inspeção do modelo; janela em andamento só conta se já cumprida. **Calendário:** camada **🔍 Inspeções** (ciano) — próximas previstas e atrasadas no dia em que venceram. **E-mail diário do gestor:** "🔍 Inspeção de rotina atrasada" (uma vez por vencimento). Rotas: `POST /api/inspecoes/rotinas`, `DELETE /rotinas/:id`, `POST /equipamentos/:id/locar`, `POST /equipamentos/:id/encerrar-locacao`, `GET /equipamentos/:id/locacoes`, `GET /cumprimento?de&ate`; o painel traz `situacao, locacao, rotinas` por equipamento; `GET /api/manutencao/calendario` traz `inspecoes`. Migration 042. **Próxima: 14b.3** — Portal do locatário (link permanente por locação).
- **📑 Contratos e perfil Locatário (etapa 14b.3, 23/10):** menu **📑 Contratos** (ver: admin, gestor, operação, comprador, qualidade; alterar: admin, gestor). Contrato **CL-2026-0001** (cliente, CNPJ/CPF, obra, contato, início, fim previsto, obs) com: **🚜 equipamentos** (＋ Equipamento = loca um da base dentro do contrato, com a rotina do locatário; 🏠 Devolver; mostra rotinas em dia/atrasada e ✓ entrega / ✓ devolução) e **👤 acessos do locatário** (＋ Acesso: nome, e-mail, senha temporária → usuário com perfil **Locatário**; se o e-mail já é de um locatário da empresa, só liga mais um contrato a ele; e-mail de usuário da empresa ou de outra empresa é recusado; ⏸ Pausar / ▶ Reativar; 🗑 tirar o acesso do contrato). **Encerrar contrato** devolve os equipamentos que ainda estão locados e oferece **pausar** os acessos que ficaram sem contrato ativo. O 📍 Locar da tela de Inspeções agora escolhe o contrato (ou "locação avulsa", como na 14b.2). **Locatário** (perfil só "locatario"): entra no QuotaFlow e vê só **📑 Meus contratos** — contratos ATIVOS ligados a ele, equipamentos com a inspeção de rotina (em dia / atrasada) e **🔍 Inspecionar** (mesmo app, offline), lista das inspeções feitas nesses equipamentos durante a locação (detalhe, fotos e relatório), "👤 Meu perfil" para trocar a senha. Não conta na cobrança (Console). **Segurança:** o `tenantMiddleware` só deixa esse perfil chamar `/api/locatario`, `/api/usuarios/me` e `/api/auth`; em `/api/locatario` todo escopo vem de `escopoLocatario(req.userId)` — inspeciona só equipamento de locação ativa de contrato dele e só com modelo das rotinas desse equipamento; detalhe só de inspeção feita numa locação dele (testes cobrem locatário A tentando o equipamento/inspeção de B, equipamento na base, outra empresa e contrato encerrado). A inspeção do locatário grava `executor = usuário` com `terceiro = { locatario: true, empresa, contrato }` (aparece "locatário — cliente · CL-…" no detalhe). Troca de senha no primeiro acesso: **não obrigatória** (mesma decisão do colaborador). Botões do card de equipamento numa linha só (⏰ Rotinas · 📍 Locar / 🏠 Devolver · 🕘 histórico). Rotas: `/api/contratos` (GET, POST, PUT /:id, POST /:id/equipamentos, POST /:id/equipamentos/:equip/devolver, POST /:id/encerrar, POST /:id/acessos, DELETE /:id/acessos/:usuario, POST /usuarios/:usuario/pausar) · `/api/locatario` (GET /painel, GET /preparar/:equip, POST /enviar, GET /inspecoes/:id). Migration 043.
- **👥 Clientes (etapa 14b.3.1, 23/10) — decidido com o Marcony:** cadastro de cliente **um por CNPJ/CPF** na empresa (tabela `clientes`), sem tela nova no menu: aba **👥 Clientes** dentro de 📑 Contratos (lista com nº de contratos ativos/total, ＋ Cliente, editar). **Novo contrato começa pelo CNPJ/CPF** (máscara) → **🔍 Buscar**: 1º procura no cadastro da empresa — se já é cliente, o contrato usa o mesmo cadastro (✓ "Já é seu cliente") e só pede obra, contato deste contrato e datas; 2º, se não é, busca na Receita (BrasilAPI → CNPJ.ws, mesmo serviço do cadastro de fornecedor) e preenche nome, razão social, endereço, cidade/UF, CEP, e-mail e telefone para conferir (CPF ou Receita fora do ar: preenche na mão; "cliente sem CNPJ/CPF" também). Telefone com o **seletor de país 🇧🇷 + máscara** (CampoTelefone) no contrato, no cliente e no acesso do locatário. O mesmo CNPJ nunca gera um segundo cadastro (o servidor reaproveita) e o acesso do locatário é por **e-mail** — o mesmo e-mail em outro contrato só liga mais um contrato ao mesmo usuário. Editar contrato não troca o cliente (dados do cliente na aba 👥 Clientes; o contrato guarda o nome de quando foi criado). A proposta comercial (15a) vai usar este cadastro. Card de equipamento voltou ao layout da 14b.2 (texto "Histórico (n)"). Rotas: `GET /api/contratos/clientes`, `GET /clientes/consulta/:doc`, `POST /clientes`, `PUT /clientes/:id`; `POST /api/contratos` aceita `cliente_id` ou os dados do cliente. Migration 044.
- **14b.3.2 (23/10):** o "＋ Cliente" (aba 👥 Clientes) mostra a mesma nota do novo contrato depois do 🔍 Buscar ("Dados da Receita · situação ATIVA — confira", em vermelho com aviso se não estiver ATIVA). Só frontend.
- **🖼 Logomarca da empresa — 14c, etapa 1 (23/10):** ⚙️ Configurações → 🏢 Empresa → **Logomarca** (admin, gestor): enviar / trocar / remover (modal do app), PNG, JPG ou WEBP até 1 MB, com prévia do cabeçalho. O App carrega a logo uma vez depois do login (`utils/logoEmpresa.js` → `GET /api/usuarios/me/logo`, que funciona também para colaborador e locatário) e os geradores leem na hora com `logoHtml()` — a logo vai em **data URL** (não depende de link que expira na janela de impressão). Sem logo, os documentos seguem como antes. **Já com logo:** relatório de inspeção, relatório de cumprimento, certificado, comprovante da avaliação, lista de presença. **Etapa 2:** dossiê, ficha de EPI, termo de desconto, medida disciplinar, PDF da NC. **Etapa 3:** contrato e proposta. Páginas públicas por link (prova e inspeção de terceiros) ficam sem logo por enquanto (não têm login). Rotas: `GET/POST/DELETE /api/configuracoes/logo`, `GET /api/usuarios/me/logo`. Migration 045.
- **🗜 Compressão de imagem no navegador — 14c.1 (24/10, pedido do Marcony):** ninguém precisa comprimir imagem antes de enviar. `utils/comprimirImagem.js` reduz no próprio navegador: **logo** → lado maior 600 px (PNG com transparência continua PNG; aceita imagem de até 25 MB); **imagem da vista do modelo de inspeção** → 1600 px, JPEG 0,8; **anexos "PDF ou foto"** (documento do colaborador, evidência de competência e de treinamento, multa, medida disciplinar — termo assinado e anexo —, auto de infração e defesa/recurso) → foto vira JPEG 1600 px, qualidade 0,75 (foto de celular de 4–12 MB vira ~150–550 KB); PDF passa direto. As **fotos da inspeção** já eram reduzidas no celular (1280 px, 0,72 — 14a) e as de NC/Spot também (1200 px, 0,75). Se o navegador não abrir o formato (ex.: HEIC em alguns aparelhos), envia o original.
- **🖼 Logo — 14c.2, etapa 2 (24/10):** logo também no **dossiê do colaborador** (capa), **medida disciplinar** (advertência/suspensão), **ficha de EPI**, **termo de desconto de multa** e **PDF da NC**. Falta só contrato e proposta (14d / 15a). Botões de treinamento na aba Treinamentos → Por colaborador agora mostram que são clicáveis (mãozinha, realce e "›"; classe global `.qf-clicavel`). Só frontend. **Histórico de treinamento:** o selo mostra a situação **atual** (a última realização vale); todas as realizações ficam em Turmas e registros e no dossiê (histórico completo do período).
- **📄 Modelos de contrato — 14d (25/10):** 📑 Contratos ganhou a aba **📄 Modelos de contrato**: 📚 importar da biblioteca do QuotaFlow (modelo-base "Locação de equipamentos", 8 cláusulas — ponto de partida, revisar com o jurídico), ＋ criar do zero, editar, ✨ versão nova, desativar. Editor com a lista de **campos automáticos** (clique para inserir no cursor): contrato (nº, obra, início, fim, prazo), empresa (razão social, nome, CNPJ), cliente (razão social, nome, CNPJ/CPF, endereço completo, cidade, UF), contato, **{{tabela_equipamentos}}**, valor mensal total, quantidade, condições (caução, franquia, hora excedente, reajuste, multa rescisória, vencimento, forma de pagamento, foro, condições específicas) e data por extenso. Campo desconhecido no texto é recusado ao salvar. **No contrato** (detalhe → 📄 Contrato): escolher o modelo, **valor mensal de cada equipamento**, condições comerciais → **👁 Prévia** (marca "PRÉVIA — NÃO EMITIDO", "________" no que falta e aviso do que falta) → **📄 Emitir**: congela texto + tabela com **hash SHA-256** e versão (v1, v2…); com campo faltando pede "Emitir mesmo assim"; emitir de novo gera nova versão e **zera o aceite**. **Aceite do locatário:** na tela dele aparece "📄 Contrato — aguardando o seu aceite" → **Ler e aceitar** (texto completo + assinatura na tela) → nome, data, assinatura e hash do aceite ficam no contrato; depois, "🖨 Ver / imprimir". Contrato printável com a **logo**, título e cláusulas em negrito (linhas em MAIÚSCULAS / "CLÁUSULA…"), tabela dos equipamentos, assinaturas (locadora, locatária com a assinatura do aceite, 2 testemunhas) e os hashes. Console: aba **📄 Biblioteca de contratos**. Rotas: `/api/contratos/modelos…`, `PUT /api/contratos/:id/condicoes`, `GET /:id/previa`, `POST /:id/emitir`, `POST /api/locatario/contratos/:id/aceite`, `/api/plataforma/biblioteca/contratos`. Migration 046.
- **14d.1 (25/10):** **👁 Ver** o modelo antes de importar (biblioteca) e na lista de modelos — o texto aparece como o contrato impresso, com os campos à mostra («Razão social do cliente») e uma tabela de exemplo. Valores em reais com **máscara R$** (caução, hora excedente, valor mensal de cada equipamento — `components/shared/CampoMoeda.jsx`). A mensagem de erro/sucesso do 📄 Contrato aparece **dentro do painel** (antes ficava atrás do modal e a 👁 Prévia parecia não funcionar — ex.: franquia acima do limite). Franquia aceita até 100.000 h; números com vírgula ("4.500,50") entendidos no servidor.
- **14d.2 (25/10) — decidido com o Marcony:** **fase do contrato calculada** (não é marcada à mão): 📝 Em elaboração (não emitido) → ⏳ Aguardando aceite (emitido) → ✅ Em andamento (aceito pelo locatário ou assinatura no papel registrada) → 🏁 Encerrado. Filtros: Abertos · cada fase · Todos; a fase aparece no card e no detalhe. **✍ Registrar assinatura no papel** (cliente sem acesso ao sistema): data + observação → vale como aceite da versão emitida (hash, "Assinado no papel — … (registrado por …)"). **N/A** em cada condição (caução, franquia, hora excedente, reajuste, multa, vencimento, forma de pagamento, foro): checkbox ao lado do rótulo — o campo fica cinza, não conta como "falta" e sai **"não se aplica"** no contrato (`condicoes.na`). Rota `POST /api/contratos/:id/aceite-papel`.
- **14d.3 (25/10):** **Quem assina pelo cliente** no 📄 Contrato (nome, CPF, cargo — `condicoes.representante`; sem preencher, usa o contato) + campos `{{representante.nome/cpf/cargo}}`. Link **✏ Editar o cadastro do cliente** no contrato (abre 👥 Clientes no cliente). Equipamento do contrato: **📅 Data** (muda a data de saída) e **✖ Tirar** do contrato sem devolução (só enquanto não houve inspeção na locação — apaga a locação, para as rotinas e volta para 🏠 Na base; depois da inspeção, só 🏠 Devolver). A lista mostra o **valor mensal** de cada equipamento; equipamento que entra com o contrato aberto já aparece no 📄 Contrato para receber o valor. Rotas `DELETE` e `PUT /api/contratos/:id/equipamentos/:equip`. Migration 047.
- **14d.4 (25/10):** ⚙️ Configurações → 🏢 Empresa → **Dados cadastrais** (razão social, fantasia, CNPJ, endereço, telefone, e-mail; editar: admin/gestor; `GET/PUT /api/configuracoes/empresa/dados`) — vão no contrato: `{{empresa.endereco_completo}}`, `{{empresa.telefone}}`, `{{empresa.email}}`. Título das Configurações segue a aba. Contrato: **quem assina** entra também em modelo importado antes da 047 (troca "representada por {{contato.nome}}" pela pessoa, cargo e CPF) e a sede da LOCADORA entra em modelo antigo. Detalhe do contrato: **Contato** em bloco separado ("dados conforme cadastro"), telefone com bandeira (`telefoneExibir` em CampoTelefone). Login e `/auth/me` devolvem o **telefone** do usuário (o Meu perfil reabria vazio). Migration 048.
- **14d.5 (26/10):** **Perfil da empresa completo.** Criar conta já grava razão social, fantasia, endereço, CEP e e-mail da Receita em `tenants`. Tela inicial (admin/gestor): cartão **🏢 Complete o perfil da sua empresa** (dados cadastrais, estado do Canal Spot, logomarca, jornada — barra de progresso, cada item abre a aba certa; minimizável; some quando completo; `GET /api/configuracoes/empresa/status`). 🏢 Empresa → Dados cadastrais: **CEP primeiro** (busca na BrasilAPI e pula para o Número; tudo editável; `GET /api/configuracoes/cep/:cep`), **🔍 Buscar na Receita** (completa só os campos vazios; `GET /api/configuracoes/empresa/receita`), **CNPJ travado 🔒** depois de informado (a empresa não troca — 403) e **🕓 Histórico de alterações** (`GET /api/configuracoes/empresa/alteracoes`). Console da plataforma → Transportadoras → **🔒 CNPJ…**: troca com motivo obrigatório + histórico (`POST /api/plataforma/transportadoras/:id/cnpj`, `GET …/:id/alteracoes`; também em `admin_acoes`). Serviço `services/perfilEmpresa.js`. Migration 049.
- **14d.6 (26/10):** **Término previsto por equipamento** no contrato. Tabela do contrato (prévia, emitido, PDF) com as colunas **Saída** e **Término previsto** ("indeterminado" se vazio; contrato emitido antes continua com a tabela antiga). ＋ Equipamento pede o término (padrão = fim previsto do contrato); **📅 Datas** edita saída e término (`PUT /api/contratos/:id/equipamentos/:equip { inicio, fim_previsto }`); a lista mostra "sai em … → até …". Mudar o fim previsto do contrato leva junto os equipamentos que seguiam a data antiga.
- **14d.7 (26/10):** terminologia única **Início / Término** em contrato, equipamentos, ＋ Equipamento, 📅 Datas, locar e na tabela do PDF (antes: saída, sai em, fim previsto, término previsto). Tabela do contrato: Tag, datas e valor no tamanho do conteúdo — a descrição do equipamento fica com o espaço.
- **14e (26/10):** **🛡 Monitor de CNPJs** (compliance) — `services/monitorCnpj.js`, migration 050.
  - **Verificação:** ciclos quinzenais (começam dia **01 e 15**; o disparo das 7h — `POST /api/recomendacoes/resumo-diario` ou `CRON_INTERNO` — verifica até `MONITOR_CNPJ_LOTE`=300 CNPJs pendentes por dia, 1,2 s entre consultas, até 100%; aí manda os e-mails do ciclo uma vez) **e na hora** de enviar cotação, emitir OC ou lançar nota (resultado vale 24 h). Receita fora do ar → vale a última situação conhecida (não trava por falta de consulta). Mudou para irregular fora do ciclo → e-mail na hora para o gestor dos tenants com processo em andamento com aquele fornecedor.
  - **Quem vê o quê:** tenant → a base dele (fornecedores locais + clientes) e, dos **globais, só os irregulares em processo dele** (cotação aberta ou OC pendente/aprovada) — nunca a lista geral. Plataforma (Console → 🛡 CNPJs) → todos os globais/candidatos irregulares + quantas transportadoras têm processo com cada um; ações **✓ Revisado** (nota), **⛔ Suspender** (`fornecedores.ativo=false` — some para todos) e **Reativar**, no log do console.
  - **Travas:** **cotação** — CNPJ irregular não recebe (`enviarCotacao`, adicionar fornecedores, reenviar e-mail; `bloqueados_cnpj` na resposta; todos bloqueados → 409 `cnpj_irregular`). **OC** (`POST /cotacoes/:id/emitir-ocs`) e **lançamento da nota / pagamento** (`PUT /estoque/movimentacoes/item/:id/fiscal`) → 409 `cnpj_irregular` até registrar **justificativa** (mín. 15 caracteres) por fornecedor — `ModalJustificativaCnpj` — gravada em `cnpj_liberacoes` (quem, quando, situação naquele momento); vale uma vez por cotação (OC) / por OC (nota).
  - **Telas:** menu **🛡 Monitor de CNPJs** (admin, gestor, comprador; `GET /api/monitor-cnpj`, `POST /api/monitor-cnpj/verificar/:doc`): ciclo atual, sua base (só irregulares / todos, ↻ verificar agora), fornecedores da plataforma em processos seus, justificativas. Console: `GET /api/plataforma/cnpjs`, `POST …/cnpjs/:fornecedorId/revisar {acao, nota}`, `POST …/cnpjs/verificar/:doc`, `POST …/cnpjs/rodar {lote}`.
  - **E-mails do ciclo:** gestor de cada tenant ("✓ 100% da base verificada" ou "⚠ N com situação irregular", com os globais em processo) e `ADMIN_EMAIL` (globais irregulares + tenants com processo).
  - **Cadastro do fornecedor (portal):** razão social travada depois de preenchida (segue o CNPJ; CNPJ nunca muda por lá) + histórico das alterações em `fornecedor_alteracoes`.
- **14e.1 (26/10):** Console → 🛡 CNPJs mostra **quais transportadoras** são impactadas (nome, e-mail, telefone com WhatsApp, cotações/OCs em andamento) — também no e-mail do ciclo para `ADMIN_EMAIL` e num **e-mail na hora** para a administração quando um fornecedor da plataforma fica irregular fora do ciclo. **Console com menu lateral** agrupado (Geral · Cadastros · Compliance · Bibliotecas), como nos painéis da transportadora e do fornecedor.
- **14e.2 (26/10):** 🛡 Monitor de CNPJs: cotações e OCs dos fornecedores da plataforma (e as referências nas Justificativas) viram **links** — abrem direto o monitoramento da cotação (Compras) ou o detalhe da OC (`cotacaoInicialId` em TelaCotacoesNovaComAbas, `ocInicialId` em TelaOrdensVenda). *Próximo: menu lateral agrupado também no painel da transportadora.*
- **📈 Comercial — mini-CRM + BID (etapa 15a, 27/10):** menu novo **📈 Comercial** (admin, gestor e o perfil novo **comercial** — em 👥 Usuários). Inspirado em RD Station CRM / Pipedrive / HubSpot. Abas:
  - **📊 Funil** — indicadores do período (em aberto no funil · ganho · conversão ganhos × perdidos · ticket médio · tempo médio da criação ao aceite; parados há +7 dias e com validade vencida), **kanban arrastável** (Elaboração → Enviado → Em negociação → Proposta final → Aceito | Perdido; aceitos/perdidos do período), cartão com cliente, valor, dias na fase (vermelho > 7), responsável e próxima tarefa; **⏰ Tarefas** (só as minhas / todas, atrasadas em vermelho) e **✕ motivos de perda** (gráfico).
  - **📝 BIDs** — lista com busca e filtro. **＋ Novo BID**: CNPJ/CPF primeiro (mesmo cadastro de clientes dos contratos; novo cliente com a Receita) + modelo + referência do cliente (ex.: PC 551) + responsável + previsão de fechamento.
  - **Ficha do BID** — documento à esquerda: **💲 Itens e valores** por grupo/trecho ("De ES x CONFRESA/MT"), colunas do modelo (veículo, modelo, peso, altura, largura, comprimento, tipo de conjunto, escolta e licença Sim/Não/N/A, data prevista), quantidade e valor por item; subtotal do grupo digitado **ou** soma dos itens; **valor total digitado ou soma** (como no BID da cliente, dá para informar só o total); ⧉ duplicar grupo (o retorno) e item · **📋 Condições** (com N/A; tributo, pedágio, licenças, seguros, escolta, prazo AET, prazo de entrega, franquia, diária; forma de pagamento e validade) · **📝 Textos** (seções do modelo, ajustáveis só neste BID) · **✍ Dados e assinatura** (contato, responsável, assinatura com cargo e registro profissional — o próximo BID do responsável já vem com ela) · **🕘 Versões**. À direita, a **linha do tempo do CRM**: 📞 ligação · ✉ e-mail · 🤝 reunião · 📝 nota · ⏰ tarefa com data + eventos automáticos (criado, versão, mudança de fase, responsável).
  - **Versões** — 📌 Fechar versão congela v1, v2… com **o que mudou** (item incluído/retirado, valor de → para, condição, validade, textos) e SHA-256; **→ Enviado** fecha a versão sozinho se houve mudança e conta a validade a partir do envio (⌛ quando vence). **📄 PDF** do rascunho (marca RASCUNHO) ou de qualquer versão — layout do BID real da cliente: título + referência, 1. Identificação (dados cadastrais + IE + opção fiscal), seções, Precificação (tabela por trecho, subtotais, valor total, condições), Critérios de medição e pagamento, informações complementares e assinatura, com a logo.
  - **Perdido exige motivo** (preço, prazo, tipo de veículo, concorrente, cliente desistiu, outro + texto). Aceito/perdido travam a edição; ↺ Reabrir volta para Em negociação. Até a 15b o Enviado/Aceito é manual; na 15b passam a vir do link do cliente.
  - **👥 Clientes** — o mesmo cadastro de 📑 Contratos (por `/api/comercial/clientes`); clicar abre a **ficha 360°**: em aberto, ganho, perdidos, contratos de locação, BIDs e atividades do cliente, ＋ Novo BID, ✏ editar cadastro.
  - **🧩 Modelos de BID** — 📚 importar da biblioteca ("Transporte de equipamentos", textos genéricos para a empresa adaptar), ✨ versão nova, criar do zero (seções, colunas do item, condições com valor padrão), desativar. Campos automáticos nos textos: `{{empresa.razao_social}}`, `{{cliente.nome}}`, `{{bid.numero}}`, `{{bid.referencia}}`, `{{bid.validade}}`…
  - **⚙️ Configurações → 🏢 Empresa:** **Inscrição estadual** (números ou ISENTO) e **Opção fiscal** (Simples Nacional, Lucro Presumido, Lucro Real, MEI) — vão na Identificação do BID.
  - **Cotação (14e.3):** a lista de seleção de fornecedores (cotação manual e ＋ adicionar fornecedor no item) esconde os que têm CNPJ irregular (`situacao_cnpj` dos locais, espelhada pelo Monitor) com o aviso "🛡 N oculto(s) por CNPJ irregular — veja em 🛡 Monitor de CNPJs". Só o filtro da tela: `fornecedoresVisiveis.js` e o envio não mudaram (a trava do servidor continua como segunda proteção).
  - **15a.1 (27/10):** subtotal do trecho não some ao ⧉ duplicar/＋ adicionar item (soma os itens que já têm valor); botão do PDF do rascunho passa a ser **👁 rascunho** (com versão fechada e sem mudança: 📄 PDF vN).
- **📨 BID com o cliente (etapa 15b, 27/10):** quem faz o BID andar é o **cliente** — o comercial não move a fase à mão (só ✕ Perdido, com motivo). Desenho em `claude/desenho-bid-15b.md`.
  - **Kanban:** Elaboração · Aguardando o cliente · Revisão solicitada (vez do comercial) · Aguardando aceite · Aceito · Perdido. O cartão só é arrastado para Perdido; mostra ✓ enviado / ✓✓ visto N× e o alerta.
  - **📨 Revisar e enviar** (`EnviarBid`, no estilo do Workday): o documento exatamente como o cliente vai ver + checklist (bloqueia sem e-mail do contato, sem valor ou sem itens; avisa IE/opção fiscal, grupo sem nome, assinatura) + o que mudou desde a versão enviada + mensagem → confirmação ("depois do envio, só com nova versão e o cliente é avisado") → fecha a versão, **e-mail com o link** (`#bid?t=<token>`, sem login, como a cotação) + cópia ao responsável; a validade conta do envio.
  - **Travado depois do envio.** ✏ **Criar revisão** (o cliente segue vendo a versão enviada) → editar → Revisar e enviar a v2 (**nota obrigatória**) → e-mail "proposta atualizada — o que mudou" e o link passa a mostrar a v2. ✕ Descartar volta ao que foi enviado. Também: 🔗 Copiar link, ↻ Reenviar e-mail, 📄 PDF da versão enviada.
  - **✓✓ Visualizado:** cada abertura do link (1ª, última, quantas vezes — conta de novo após 10 min); a 1ª abertura de cada versão entra na linha do tempo e manda e-mail ao responsável ("👁 Cliente abriu a proposta"). Faixa no topo da ficha diz sempre onde o BID está.
  - **Alertas** (calculados na hora): enviado há 2+ dias sem abrir · aberto 3× (ou há 2+ dias) sem resposta · aprovado há 2+ dias sem assinar · validade vence em 2 dias / vencida — cada um com **＋ tarefa** (para amanhã). Com `CRON_INTERNO=1`, e-mail ao responsável 2 dias antes de vencer.
  - **Página do cliente** (`TelaBidPublica`, celular): documento + 📄 imprimir, aviso de versão atualizada (o que mudou), resposta **item por item** — ✅ aprovar · ✏ pedir revisão (valor, tipo de veículo, data, escopo, outro + comentário) · ❌ recusar (motivo) · "Aprovar todos"; na v2 os itens que não mudaram já vêm com a decisão anterior. Tudo aprovado → Aguardando aceite; tudo recusado → Perdido ("recusado pelo cliente"); o resto → Revisão solicitada (a resposta aparece em cada item da ficha, e o responsável recebe e-mail).
  - **Aceite:** código de 6 dígitos por e-mail (15 min, 5 tentativas, novo pedido após 1 min) + nome + assinatura na tela → SHA-256 (versão + nome + e-mail + data + assinatura) → Aceito; e-mail de confirmação ao cliente e ao responsável. Exceção: **⋯ aceite fora do sistema** (por e-mail/telefone/papel, com data e justificativa).
  - **Funil:** taxa de abertura, envio → visualização, visualização → resposta (tempo médio), com o cliente sem resposta (✓✓) / não abertos (✓).
  - **15b.1 (27/10):** e-mail **padronizado e pré-carregado** no 👁 Revisar e enviar — assunto `BID-AAAA-NNNN — <título da proposta>` (sem título: a referência; v2+: "(atualizada — versão N)") e texto padrão editável (saudação + parágrafo); o link, a validade e a assinatura entram sempre. "Título interno" virou **Título da proposta** (aviso no checklist quando falta). Correção: no funil, ganho/perdido depois das 21h contava no dia seguinte (UTC) — agora usa o dia de Brasília.
  - **15b.2 (28/10):** status do cliente **no próprio cartão do kanban**, como na Não Conformidade: 📤 Enviado · ainda não aberto · há N · 👁 Visualizado pelo cliente · N× · há N · 💬 Cliente pediu revisão · ✅ Aprovado · falta assinar · ✏ Preparando a vN. Saiu o indicador "Com o cliente, sem resposta". Correção: o 1º envio não diz mais "atualizada — versão 2" quando já havia versão fechada sem envio (BIDs da 15a).
  - **15b.3 (28/10):** no 👁 Revisar e enviar, **🔗 Enviar só pelo link (WhatsApp), sem e-mail** — gera o link e copia (o visualizado e a resposta funcionam igual; a linha do tempo registra "enviada só pelo link"). Saiu o botão falso "Ver a proposta" da prévia do e-mail. Depois do envio, 🔗 Copiar link continua no topo da ficha.
  - **15b.4 (28/10):** "Previsão de fechamento" virou **Decisão esperada em** (uso interno) e passou a ser usada: 📅 no cartão (vermelho quando passou), alerta "decisão esperada já passou" com ＋ tarefa, e no Funil a **previsão de receita** — previsto para fechar neste mês / no próximo, decisão já passou, sem data. Muda a qualquer momento, mesmo com o BID travado (salva na hora, como o responsável). Próximo desenho: **Calendário comercial + eventos de mercado** (`claude/desenho-calendario-comercial.md`).
- **🧾 Pedido de Venda + aditivo pelo link (etapa 15c, 28/10):**
  - **PV-AAAA-NNNN nasce sozinho no aceite** do BID (pelo link ou ⋯ aceite fora do sistema): itens, valores, condições e textos da versão aceita, origem (BID/versão, quem aceitou, hash). E-mail **"🎉 Parabéns! … foi aceito. O pedido PV-… foi gerado"** ao responsável + gestores (15c.1: admin não recebe — pode ser alguém de TI); linha do tempo; aviso no 📊 Funil (pedidos dos últimos 3 dias). BID aceito antes da 15c: **🧾 Gerar o pedido de venda** na ficha.
  - **📈 Comercial → 🧾 Pedidos**: lista (status, itens por status, próxima execução, aditivos) → **ficha do pedido**: itens por trecho com **status por item** (a programar → programado → em execução → concluído | cancelado — manual até a AT, 16a), próximas execuções (data prevista dos itens), histórico de aditivos, 📄 PDF do pedido, ✕ cancelar (com motivo; bloqueado com item em execução/concluído). Status do PV calculado pelos itens.
  - **➕ Aditivo pelo link** (decisão do Marcony: protege as duas partes): cria o BID do aditivo `PV-AAAA-NNNN-A1` com os itens atuais do pedido → mesmo fluxo da 15b (👁 Revisar e enviar, visualizado, resposta por item, código + assinatura). O cliente vê "📎 Aditivo 1 ao pedido … — o que muda". Aceito → **aplica no pedido** sozinho (antes × depois, valor antes → depois, hash), mantém o status dos itens que continuam e os novos entram "a programar". Item **programado/em execução/concluído não pode sair nem mudar de valor**; aditivo que não muda nada não é enviado. Um aditivo aberto por vez; aditivos ficam fora do kanban e dos indicadores do funil.
  - Cliente 360° mostra os pedidos. Correção: a página do cliente só mostra "proposta atualizada" se uma versão anterior foi realmente enviada.
  - **15c.1 (29/10):** ⏰ **tarefa com "Para quem?"** (digita o nome, a lista sugere comercial, gestor e admin; vazio = eu) — quem recebe é avisado por e-mail e a vê em ⏰ Tarefas ("só as minhas" = atribuídas a mim). E-mail ao cliente: **rodapé com os contatos** — 📞 telefone e ✉ e-mail de quem emitiu (assinatura ou cadastro do usuário) + telefone e e-mail da empresa; o endereço abaixo do botão também é link (o `#` não corta). Página do cliente: contatos clicáveis (telefone/e-mail) e o "O que revisar?" fica em vermelho quando falta. Os links usam `FRONTEND_URL` — funcionam igual no localhost e na URL de produção.
  - **15c.2 (29/10):** e-mail de **aceite ao cliente** mais completo: assunto `✅ Aceite confirmado — BID-… — <título> · pedido PV-…`, agradecimento, quem aceitou/quando/versão/nº do pedido/valor, tabela por trecho, próximos passos, contatos e o código de integridade (o responsável não recebe mais um e-mail "aceitou" duplicado — o "🎉 Parabéns" já avisa). **Sem banner** de pedido novo no Funil (empurrava o kanban): selo "N novo(s)" na aba 🧾 Pedidos, 🆕 na lista e "🧾 Pedido gerado" no cartão aceito. **➕ Criar aditivo pergunta antes**; aditivo nunca enviado pode ser **🗑 descartado** (some sem mexer no pedido); no aditivo, "✕ Perdido" virou **✕ Encerrar aditivo** (só o aditivo — o pedido continua). Rota `POST /bids/:id/descartar-aditivo`.
  - **15c.3 (29/10):** `node scripts/previaEmailsBid.js BID-2026-0001 [--enviar voce@empresa.com]` — remonta os e-mails que o cliente recebeu (envio de cada versão e a confirmação do aceite) com os dados reais e salva em `backend/previa-emails/<BID>/*.html` (fora do git) para tutorial/print; com `--enviar`, manda cada um para o endereço com "[PRÉVIA]" no assunto. Não altera nada no banco.
  - Rotas `/api/comercial/pvs` (GET), `/pvs/:id` (GET), `/pvs/:id/documento`, `POST /pvs/:id/itens/:item/status`, `POST /pvs/:id/cancelar`, `POST /pvs/:id/aditivo`, `POST /bids/:id/gerar-pv`. Ver: admin, gestor, comercial (a operação verá o serviço **sem valores** na AT). Migration 053. **Próxima: 16a** — AT por trecho a partir do PV.
- **🚛 Programação — AT por trecho (etapa 16a, 29/10, Marcony):** menu novo **🚛 Programação** (operação, gestor, admin) — **sem valores**.
  - **📋 A programar**: pedidos abertos e seus trechos → **🚛 Programar** abre o formulário: coleta e entrega (local + data/hora), **motorista** com o selo de conformidade (🟢🟡🔴⚪), **cavalo + até 2 implementos** (equipamento 🔒 bloqueado por inspeção nem aparece como opção; se bloquear depois, a AT não inicia).
  - **Motorista 🔴** (item vencido) bloqueia: só **gestor/admin** libera, com justificativa (≥ 15 caracteres) que fica na AT e sai no PDF. 🟡 só avisa.
  - **Conflito de agenda** (mesmo motorista ou equipamento em duas ATs ao mesmo tempo): mostra os conflitos e oferece "Programar mesmo assim"; a AT fica com ⚠ na lista e em vermelho na agenda.
  - **🚛 ATs**: lista com filtro e busca (AT, cliente, motorista, tag, cidade), ⏰ coleta passou, ⚠ conflito. **Ficha da AT**: rota, carga, motorista, conjunto, anexos **NF-e / CT-e / MDF-e** (PDF/XML/JPG/PNG até 10 MB), ▶ Iniciar · ✓ Concluir · ✕ Cancelar (motivo) · ↺ Reabrir · ✏ Editar (só programada) · 📄 **PDF da AT** para o motorista (sem valores, com assinaturas).
  - **🗓 Agenda da frota**: equipamentos e motoristas × 14 dias, navegação por semana.
  - **Status do pedido automático**: programar → itens "programado"; iniciar → "em execução"; concluir → "concluído"; cancelar → voltam a "a programar". No 📈 Comercial a ficha do pedido mostra a AT de cada trecho (só leitura) e o status desses itens fica travado ("controlado pela AT").
  - **SaaS genérico:** `tipo_execucao` no modelo de BID/PV (transporte → AT; locação → contrato de locação existente; serviço → AS; venda → entrega). Nesta etapa só transporte gera execução.
  - Rotas `/api/programacao` (`GET /base`, `/execucoes`, `/agenda`, `/pedidos`, `/pvs/:id`; `POST /pvs/:id/at`; `GET|PUT /execucoes/:id`; `POST /execucoes/:id/status`; anexos `POST|GET|DELETE /execucoes/:id/anexos[/:anexo]`; `GET /execucoes/:id/documento`) e `GET /api/comercial/pvs/:id/execucoes` (leitura). Travas respondem 409. Migration 055.
  - Rotas: `/api/comercial/bids/:id/revisao` (GET), `/enviar`, `/reenviar`, `/revisao/iniciar`, `/revisao/descartar`, `/aceite-externo`; `POST /bids/:id/fase` só aceita `perdido` e `reabrir`. Público: `/api/bid-link/:token` (GET, `/responder`, `/codigo`, `/aceitar`) — 40 chamadas por link + IP por hora. Migration 052. **Próxima: 15c** — Pedido de Venda (PV) a partir do BID aceito. **Futuro:** perfil **cliente** com login (mesmo padrão do locatário) — ver `claude/desenho-bid-15b.md`.
  - Rotas `/api/comercial` (`GET /funil`, `GET/POST /bids`, `GET/PUT /bids/:id`, `POST /bids/:id/versao`, `POST /bids/:id/fase`, `GET /bids/:id/documento?versao`, `POST /atividades`, `POST /atividades/:id/concluir`, `GET /tarefas?minhas=1`, `/modelos…`, `/clientes…`, `GET /clientes/:id/360`, `GET /responsaveis`). Migration 051. **Fica para a 15a.1:** biblioteca de modelos de BID no Console da Plataforma (hoje a biblioteca vem só da migration). **Próxima: 15b** — link do cliente, resposta por item (aprovar / pedir revisão / recusar), proposta final e aceite com assinatura → PV (15c).
- **🪪 CPF obrigatório (etapa 12e.0, 20/10, Marcony):** colaborador novo só salva com CPF válido (frontend bloqueia o Salvar; backend devolve 400). Quem já existia sem CPF aparece na lista com **"⚠ sem CPF"** e precisa preencher na próxima edição. Motivo: o CPF identifica a pessoa nos treinamentos (no link externo da prova, o CPF preenche o nome — evita nome digitado errado ou pela metade) e no dossiê. Continua único por empresa (`colaboradores_cpf_unico`) e mascarado para quem não edita (LGPD).
- **👔 Histórico de funções (etapa 12d.3 — pergunta do Marcony, 20/10):** trocar a função no cadastro abre o quadro **"Mudança de função"**: *a partir de* (padrão hoje) e *motivo* (promoção, transferência, readaptação, correção de cadastro, outro). O período atual fecha no dia anterior e abre o novo; data antes do início da função atual é recusada (nada é gravado). **Correção de cadastro** (e ligar ao modelo de mesmo nome, a sugestão da 12d.0) corrige o período atual sem abrir outro. Tirar a função só fecha o período. Colaborador novo ganha o 1º período na admissão. A Ficha mostra o histórico; a ficha NR-6 ganhou a coluna **"Função na época"** em cada entrega (vem de `epi_entregas.funcao_nome`) e o histórico de funções no cabeçalho. **EPIs acompanham a função atual**: o painel e a entrega usam o kit da função nova; o que foi recebido antes e não faz parte do kit novo aparece como **"↩ … · fora do kit atual"** (clique abre o Histórico para devolver — não é obrigatório, decisão b); o que é comum aos dois kits continua valendo. Rota: `GET /api/pessoas/colaboradores/:id/funcoes`. Base para o dossiê (12f): "Motorista (2022–2024) → Motorista MOPP (2024–2026) → Encarregado".
- **🦺 Avisos de EPI no calendário e no e-mail (etapa 12d.3):** **calendário** ganhou a camada **🦺 EPI** (laranja #f97316): troca de EPI em uso (dia da próxima troca) e validade de CA dos EPIs do estoque, com cartão "Ver em Pessoas → 🦺 EPI" (abre direto a aba — `App.jsx` guarda `abaPessoas`), legenda e rodapé "🦺 N troca(s)/CA de EPI · X vencido(s)". Rota `/api/manutencao/calendario` devolve `epi` (fora do filtro de equipamento). **E-mail diário** (o mesmo dos documentos, 7h): para **admin e gestor**, seções 🦺 Troca de EPI (15 dias e vencida), 🦺 CA de EPI (30 dias e vencido) e 📋 Documento exigido não cadastrado (uma vez por colaborador + tipo + função); um e-mail por pessoa por dia; cada marco uma vez (`avisos_enviados`); só o mais urgente se o servidor ficou dias fora. A resposta do disparo traz `pessoas` na contagem. **Atalho "＋ Cadastrar"** na ficha de entrega quando o tipo do kit não tem EPI no estoque: abre o Novo EPI com o tipo; ao salvar, a linha já pega o item novo.
- **Planos de manutenção recorrentes + valor da hora (etapa 12b):** botão "🔁 Planos" no Calendário. Plano = equipamento + modelo de manutenção + "a cada N dias/semanas/meses" + data, hora e duração. "⚙ Gerar OS (12 meses)" mostra a prévia (datas, custo por OS e total, o que já existe) e cria só o que falta. OS do plano nasce **aberta, sem RC e sem RM** (materiais na fila do comprador). Selo "🔁 do plano" na lista de OS e "🔁 Plano" no calendário. Valor da hora (R$/h) na mesma tela; entra no planejado e no % do calendário.
- **Calendário anual de manutenção (etapa 12a + 12a.1):** menu "📅 Calendário" (admin, gestor, comprador, operação). Visões Ano (folhinha), Mês e Semana; cor por situação (atrasada · em execução · programada · concluída — dia com várias OS pinta a mais urgente); filtros de equipamento, tipo e situação; clique no dia → OS do dia com "Abrir OS →" e "＋ Nova OS programada" (abre a criação com programação geral, preventiva, 08h–17h do dia). Rodapé: planejado · gasto · comprometido · falta · **% do custo conhecido**. Sem migration — ver regras em "Calendário de Manutenção" no Roadmap.

### ✅ Em produção (16/10/2026)
- **Canal Spot completo:** situações por cor (comprador), abas e expiração do histórico (fornecedor), busca única dos dois lados, encerrar com escolha do vencedor / reabrir, resultado para o fornecedor sem expor o vencedor, foto com compressão adicionada/trocada a qualquer momento
- **"Criar conta" (etapa 11a, 17/10/2026):** link na tela de login; transportadora (CNPJ na Receita, gestor+admin, teste de 15 dias, Spot só após aprovação) e fornecedor (CNPJ na Receita, nasce `candidato`); tabela `planos`; faixa de teste/análise no topo do sistema; alertas automáticos (CNAE, abertura, e-mail gratuito); e-mail à plataforma (`ADMIN_EMAIL`) com o SQL de aprovação; consulta à Receita centralizada em `services/receitaCnpj.js`
- **Convite com CNPJ + Spot só para verificado (etapa 10c, 17/10/2026):** CNPJ obrigatório e travado no convite (conferido na Receita no envio); Canal Spot, Pro e e-mails de recomendação exclusivos de fornecedor global; `/api/spot/publicas` deixou de ser pública
- **Convite a fornecedor novo (etapa 10b, 17/10/2026):** tenant convida só pelo e-mail; o fornecedor cadastra a empresa (CNPJ conferido na Receita), atuação e login e entra como local do tenant, já no portal; lista de convites pendentes com reenviar/cancelar
- **Painel do Fornecedor + convite ao fornecedor local (etapa 10):** portal abre no Painel (o que espera ação + desempenho 90 dias no Spot e em cotações); tenant convida o local por e-mail (link 7 dias), fornecedor cria o próprio login e passa a manter os dados (tenant só ativa/desativa)
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
- Tela consolidada de "grande marketplace" pro comprador
- E-mail/WhatsApp automático ao enviar cotação
- Dashboard, relatórios
- Reativação da aba "Manual" de `TelaCotacoesNovaComAbas.jsx`

---

## ⚠️ Armadilhas Conhecidas do Backend

### ⚠️ Não pedir coluna pelo nome sem conferir no banco (12a.1, 18/10/2026)
`select('id, preco_unitario')` em `catalogo_itens` derrubou o calendário: a coluna não existe nesse tenant/banco (o `preco_unitario` do código é de `fornecedor_itens`). Pedir coluna inexistente no supabase-js **quebra a consulta inteira**. Em leitura de tabela cujo schema não foi conferido no `information_schema`, usar `select('*')` e ler o campo de forma tolerante.

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

### Ritual de cada entrega (usado da etapa 1 à 11b — manter)
1. **Desenvolver e testar fora do projeto** (sandbox do Claude): mock de DB para rotas/serviços, esbuild + jsdom para telas, **Postgres local** para migrations (idempotência, CHECK, FK, CASCADE, rodar 2×).
2. **Entregar um zip com arquivos inteiros** (nunca DE→PARA para copiar à mão) + `README.md` passo a passo + `verificar-entrega.js` atualizado.
3. **Migration primeiro**, no Supabase, dentro de `BEGIN; ... COMMIT;`.
4. **`node verificar-entrega.js --antes`** (pasta `backend`): confere se os arquivos que vão ser substituídos ainda são a versão usada de base. Se algum divergir, **parar e mandar o arquivo** — o Marcony pode ter mexido nele e a entrega apagaria a mudança.
5. **Copiar os arquivos** do zip.
6. **`node verificar-entrega.js`**: todos os arquivos (acumulado de todas as etapas — 49 após a 11b) idênticos ao testado, sintaxe ok, `require` resolvendo; avisa arquivo novo fora do git e problemas no `.env` (sem mostrar valores).
7. Reiniciar, testar o roteiro do README da entrega, `git add` dos novos, commit, push.

**O verificador mora só no computador do Marcony (fora do git)** e uma cópia fica no projeto (`claude/verificar-entrega.js`). **Em conversa nova, o Claude parte dessa cópia** — acrescenta os md5 da etapa nova em `ESPERADO`, os da base em `ANTES` — e devolve o arquivo atualizado no zip.

Lições da etapa 1 (10/2026), que originaram o ritual:

- **`node --check` não basta.** Na aplicação manual por DE→PARA apareceram 3 erros que compilam normalmente mas quebram em execução: `res.statusa(404)`, `const f = await` apagado (variável indefinida na linha seguinte) e uma troca esquecida.
- **Verificador por md5:** `backend/verificar-entrega.js` (fora do git) confere, em um comando, se cada arquivo entregue está idêntico ao testado (md5 normalizado — ignora quebra de linha final e CRLF), se a sintaxe é válida e se os `require` novos resolvem. Pegou todos os erros acima. Atualizar a lista de md5 a cada entrega.
- **Preferência de aplicação:** arquivo inteiro + verificador; ou, idealmente, PR direto no GitHub (revisão pelo diff, sem copiar/colar).
- **Dependência instalada só no Mac (18/10/2026):** `express-fileupload` e `uuid` eram usados no código mas não estavam no `backend/package.json`; o Render funcionava com instalação antiga em cache e quebrou num build limpo (`Cannot find module`). Corrigido registrando os dois (`uuid@11`, última com CommonJS). **Todo pacote novo entra com `npm install --save`**; o verificador deve passar a conferir `require` × `package.json` (o `${r[1]}` que aparece na checagem manual é falso positivo do próprio verificador).
- **Confirmações e erros sempre no modal do app** (18/10/2026, pedido do Marcony): não usar `window.confirm` / `window.alert` em tela nova — destoam do visual escuro.
- **Deploy é manual** no Render (Manual Deploy → Deploy latest commit), de propósito.
- **O passo a passo de cada entrega nunca se chama `README.md` (18/10/2026):** na 12a o README da entrega foi copiado por cima do README do projeto e apagou tudo (recuperado pela cópia do início da conversa). A partir de agora: `LEIA-ME-ENTREGA-<etapa>.md`, e o README do projeto, quando mudar, vem **inteiro** e só com acréscimos.
- **`html5-qrcode` fora do `frontend/package.json` (18/10/2026):** usado em `LeitorCodigoBarras.jsx`, mas registrado só no `package.json` da raiz. O Netlify funciona porque instala a raiz; num build só do `frontend` (ex.: Render Static Site) quebra. Ao migrar: `cd frontend && npm install --save html5-qrcode`.
- **Arquivo novo não aparece no `git diff`** — lembrar do `git add` (ex.: `services/fornecedoresVisiveis.js`).
- **zsh (Mac):** em `node -e`, usar aspas simples por fora (`!` em aspas duplas dispara o histórico); em `grep --include`, usar `--include='*.js'`; `git diff` longo abre o paginador (`q` sai; `git --no-pager diff` evita).
- **Migrations:** testar em Postgres local antes (idempotência, CHECK, FK, CASCADE) e rodar dentro de `BEGIN; ... COMMIT;`.

---

## 🗺️ Roadmap / Decisões em Aberto

> **Sem datas.** A ordem abaixo é de prioridade, não de calendário. Cada item é atacado conforme tempo e necessidade de cliente.

### ⭐ PRÓXIMAS ETAPAS (decidido 18/10/2026) — ver `claude/plano-etapas-12-a-17.md`
Ordem: **12** Calendário anual de manutenção (folhinha) + planos recorrentes + vencimentos de documentos → **13** Gantt de projeto + MRP → **14** Inspeções operacionais (pré-uso, carregamento, processo, descarregamento) → **15** Inspeção de locação (saída × retorno, relatório de danos para cobrança) → **16** Custo por equipamento → **11c** verificação do fornecedor. O arquivo do plano diz, para cada etapa, tabelas, rotas, telas, arquivos a pedir e decisões em aberto.

### Calendário de Manutenção — etapa 12a (feita 18/10/2026)
- **Rota:** `GET /api/manutencao/calendario?de=AAAA-MM-DD&ate=AAAA-MM-DD&equipamento_id=` (`routes/manutencao.js`, com `tenantMiddleware`; máx. 400 dias). Cálculo em `services/calendarioManutencao.js` (função pura `montarCalendario`, testável sem banco; leitura com supabase-js `.in/.lte`, sem `DB.raw`).
- **Quais OS:** `tipo_documento = 'os'` (ou nulo), com `data_inicio_prevista`, sem `cancelada_em`, ocupando o intervalo (início ≤ fim do período e fim ≥ início do período). OS de vários dias aparece em todos os dias.
- **Situação:** `concluida_em` → concluída · `status = 'em_andamento'` → em execução · fim previsto (ou início) já passou → atrasada · senão programada.
- **Custo por OS** (conta a OS com **data no período**, não a data da compra): ligação item da OS → item da RM (`chamado_itens.origem_os_item_id`) → item da OV (`ordem_venda_itens.chamado_item_id`; também aceita OV direto no item da OS); OV com status `cancel*` ignorada.
  - **Planejado:** com OV = valor da OV; material sem OV = último preço pago do item (OV) → preço do catálogo (se existir coluna de preço) → "sem preço" (não conta como zero).
  - **Comprometido:** OV emitida não recebida · **Gasto:** `quantidade_recebida × valor_unitario`.
  - **% do custo conhecido:** itens ativos com algum valor ÷ itens ativos.
  - **Mão de obra própria (12b):** horas × pessoas × `tenants.valor_hora`; sem valor da hora, só em horas (não conta no %). Serviço sem horário próprio (OS com programação geral) usa a janela da OS: até 24 h = horas reais; mais = 8 h por dia de calendário. Consumo de estoque sem OV ainda não entra no gasto.
- **Front:** `TelaCalendarioManutencao.jsx` feito à mão com CSS grid (sem biblioteca). `App.jsx`: item `calendario` em `navItems` e `PERMISSOES`; estado `novaOSData` → `TelaOrdemServico` (props `novaOSData` / `onNovaOSAberta`). Comprador vê o calendário sem os botões de abrir/criar OS. `index.html` ganhou `<meta name="color-scheme" content="dark">` (ícones de data/hora claros em todo o app).

### Planos de manutenção recorrentes — etapa 12b (feita 18/10/2026)
- **Decisões (18/10):** itens vêm de um modelo de manutenção existente; periodicidade só por **tempo** (km/horas com medidor manual ficam para depois — os clientes ainda não têm fonte de km); gera **12 meses corridos** a partir de hoje; OS geradas são OS normais com selo; **um** valor da hora por empresa.
- **Término (12b.1, ideia do Marcony):** "Sem término" (repete até desativar) ou "Termina em <data>" — nenhuma OS é gerada depois dela; plano com término já passado aparece como **Encerrado** (sem botão de gerar). Encurtar o término de um plano que já gerou OS **não cancela nada**: a lista avisa "N OS já geradas depois do término" para o gestor cancelar na tela de OS. Lembrete: o plano nunca gera OS sozinho — só no clique em "Gerar OS (12 meses)".
- **12b.2 (18/10, decisões do Marcony):**
  - Botão **"Gerar OS"** (o limite de 12 meses é só de cada clique). Prévia com **caixinha por data** (todas marcadas; "marcar/desmarcar todas"); desmarcadas ficam para o próximo "Gerar OS". `POST /planos/:id/gerar { datas: [nominais], sem_itens }`.
  - **Planejar antes:** sem modelo (ou modelo vazio) o gerar é **recusado** (400 `codigo: 'sem_modelo'`), com a orientação "monte uma OS com os itens e use 📋 Salvar como modelo"; exceção marcada na prévia: "gerar mesmo assim, sem itens" (`sem_itens: true`). Aviso fixo no topo da tela de planos.
  - **Dia útil:** data que cai em folga ou feriado vai para o **próximo dia útil** (padrão), anterior, ou fica. Dia útil = dia da semana "Trabalho normal" na jornada da empresa (`tenant_jornadas`, Configurações; sem jornada = segunda a sexta) e que não está em `tenant_feriados`. Prévia mostra "~~31/10/2026~~ → seg., 02/11/2026 (sábado)". Procura até 60 dias; se não achar, mantém.
  - **Responsável:** escolhido no plano entre os usuários ativos do tenant; as OS geradas herdam. Aparece no cartão do calendário ("👤 Fulano"), no detalhe da OS e na lista de planos. Calendário ganhou o filtro **Responsável** com **"👤 Só as minhas"** (o calendário devolve `eu` = `req.userId`) e "Sem responsável".
  - **Transferir responsabilidade** (férias, desligamento): `GET /responsaveis/previa?de=&para=` e `POST /responsaveis/transferir { de, para }` — só **admin e gestor**. Move os planos do usuário e as OS dele **não concluídas e não canceladas** (concluída fica com quem fez = histórico); evento `transferencia_responsavel` em `chamado_eventos` de cada OS ("de X para Y por Z"). Destino precisa ser usuário ativo do mesmo tenant.
  - `GET /api/manutencao/usuarios` — usuários ativos do tenant (id, nome, perfil) + `eu`.
  - **12b.3 — transferir UMA OS** (ideia do Marcony): botão "⇄ Transferir" / "👤 Definir responsável" no cartão do dia (Calendário) e no detalhe da OS → `ModalTransferirOS.jsx` → `PUT /api/manutencao/os/:id/responsavel { para, motivo }`. **Só admin e gestor** (decisão 18/10). Vale para OS do plano **e OS avulsa** (resolve a pendência de responsável na OS avulsa sem mexer no formulário de OS). Não muda o plano (as próximas OS geradas seguem o responsável do plano). OS concluída/cancelada → 400; mesma pessoa → 400; motivo opcional vai para o histórico ("Responsabilidade transferida de X para Y por Z — férias do Pedro"). `GET /usuarios` devolve `pode_transferir`. O global continua, como **"⇄ Transferir plano de responsável"** (texto escolhido pelo Marcony; férias/desligamento).
  - **Dia útil (confirmado 18/10):** padrão = próximo dia útil; a OS continua editável à mão. Se o Natal (sexta) cair no sábado, é porque o sábado está "Trabalho normal" na jornada — ajuste em Configurações, não no código.
  - **12b.4 — previstas no calendário (ideia do Marcony):** ocorrências dos planos **ativos** que ainda não viraram OS aparecem como **"Prevista (sem OS)"** — roxo do selo 🔁: fundo roxo translúcido + borda tracejada roxa (12b.5, para não confundir com o "hoje", que é só contorno branco sólido), já no dia útil. Calculadas na hora em `planosManutencao.previstasNoIntervalo` (sem tabela; somem quando a OS é gerada; só de hoje em diante; respeitam término, filtro de equipamento e regra de dia útil). `GET /calendario` devolve `previstas` + `totais_previstas`. Cartão do dia: custo estimado pelo modelo + **"⚙ Gerar esta OS"** (`POST /planos/:id/gerar { datas: [nominal] }`; sem modelo → pergunta, num modal do app — 12b.6, nunca `window.confirm`/`alert` —, e gera sem itens). Rodapé: **"Previsto pelos planos R$ X (N sem OS)"**, separado do planejado das OS. Filtros de situação/responsável valem para as previstas. Botão só para quem edita planos (`GET /usuarios` → `pode_editar`).
  - **Ainda não:** tela "resumo do dia" do funcionário logado (M4.7b) — vai ler `chamados.responsavel_id`.
- **Datas:** série ancorada em `proxima_data` (a data não anda); ocorrências passadas são ignoradas; mensal mantém o dia da âncora e encosta no fim do mês (31/01 → 28/02 → 31/03); máximo de 400 ocorrências por geração.
- **OS gerada:** número `OS-AAAA-NNNN` (mesma regra do `gerarNumeroOS` de `cotacoes.js`, copiada em `planosManutencao.js` para não mexer no arquivo central), `status 'aberta'`, `modo_programacao 'geral'`, início = data + `hora_inicio` (Brasília), fim = início + `duracao_horas`, itens do modelo (um insert por item; se um falhar, a OS é apagada), evento `criacao` em `chamado_eventos`. **Não chama `dividirESalvarMateriais`**: a OS criada na tela gera RC/RM na hora, mas um plano mensal geraria 12 RCs de uma vez — os materiais ficam para o comprador pedir via `gerar-requisicao-material` (e, na 13b, o MRP sugere quando).
- **Rotas** (`routes/manutencao.js`): `GET/PUT /config` (valor da hora) · `GET/POST /planos` · `PUT/DELETE /planos/:id` (DELETE desativa) · `GET /planos/:id/previa` (nada é gravado) · `POST /planos/:id/gerar`. Gravação só para **admin, gestor, operação** (403 para os demais); equipamento e modelo conferidos no tenant; plano de outro tenant → 404. Antes da migration 019 as rotas de planos respondem 409 "rode a migration".
- **Próximo:** **12c** — vencimentos de documentos no calendário (CRLV, ANTT, seguro, tacógrafo, CNH, MOPP…), e-mail de aviso pelo agendamento diário, motorista com cadastro mínimo próprio. Depois: medidor manual (km/horas) e periodicidade por uso.

### "Parte ISO" — 12c, 12d, 12e (decidido 18/10/2026 com o Marcony) — ver `claude/plano-etapas-12-a-17.md`
- **Colaboradores separados de Usuários** (ligação opcional); módulo **"👷 Pessoas"** com abas Colaboradores · Documentos e vencimentos · EPI · Treinamentos; **Equipamentos** ganham aba Documentos (CRLV, ANTT, seguro, aferição de tacógrafo, certificado de calibração); documentos da empresa (alvará, licença ambiental, AVCB); calendário com camadas (Manutenção · Documentos · Treinamentos · EPI); e-mail 30/15/5 dias.
- **12c — entregue** (colaboradores, documentos com vencimento e arquivo, camadas no calendário). Decisões: lista inicial de 12 tipos (o cliente cria outros); aviso por e-mail para admin, gestor e o responsável do documento; menu "👷 Pessoas" abaixo de Equipamentos. **12c.1 — entregue** (e-mail de aviso 30/15/5 dias e vencido pelo agendamento das 7h, migration 023). Documentos de equipamento ficam, por enquanto, em Pessoas → Documentos (filtro "Equipamento"); a aba dentro da tela de Equipamentos fica para depois.
- **12d.0 — entregue** (funções/cargos com descritivo + documentos exigidos, biblioteca do QuotaFlow no Console com importar = cópia e aviso de versão nova, ficha do colaborador; migration 024). Decidido 19/10 com o Marcony: modelos de função como os modelos de OS, banco de descritivos acessível a todos os tenants (mesmo padrão que vai servir ao **banco de inspeções**); trocar de função só mostra as novas pendências. **12d.1 — entregue** (EPI ligado ao Estoque, CA, endereço EPI, kit na função sugerido pelos riscos; migration 026). **12d.1b — entregue** (catálogo de EPI no banco + autocompletar, Novo EPI cria o item, sub-aba Estoque de EPI, Guardar no EPI, tamanhos; migration 027). **12d.2 — entregue** (3 sub-abas, entrega com assinatura e baixa, devolução, ficha NR-6, selo de conformidade; migration 028). **12d.3 — entregue** (histórico de funções, camada 🦺 no calendário, avisos de EPI/CA/documento faltando no e-mail diário, atalho Cadastrar; migration 029). **12e.0 — entregue** (CPF obrigatório). **12e.1 — entregue** (catálogo, turmas com presença assinada, registro manual com evidência, exigidos na função, pilar 🎓, calendário e e-mail; migration 030). **12e.2a — entregue** (conteúdo, prova, biblioteca de treinamentos no Console, importar/versão nova, horas creditadas, data de nascimento; migration 031). **12e.2b — entregue** (prova online logado/link, perfil Colaborador fora da cobrança, tentativas e liberar, PDF protegido, formatação leve, aniversariantes; migration 032). **Pendências anotadas:** certificado em PDF para o colaborador, aniversariantes no e-mail diário (opcional), `PUT /api/usuarios/:id` sem checagem de admin (pré-existente — revisar). **12e.2c — entregue** (certificado e comprovante da avaliação). **12e.2d — entregue** (encerrar turma, encerramento automático da online por prazo/todos concluídos). **12e.3 — entregue** (competências, pilar 🧩; migration 033). **12e.3.1 — entregue** (nota 1–4, nível esperado, treinamentos como evidência, acordeão das funções; migration 034). **12f — entregue** (dossiê; migration 035). **12g — entregue** (multas; migration 036). **12h — entregue** (disciplinar; migrations 037–038). **12i — entregue** (autuações da empresa; migration 039). **14a.1 — entregue** (foto obrigatória/opcional por ponto). **14a — entregue** (inspeções: modelos/biblioteca, execução no celular com offline, bloqueio e liberação, OS do item não OK, relatório; migration 040). **14b.1 — entregue** (número INSP, tipos e modelos de carga, resolvi na hora, links de terceiros, inspeções do colaborador; migration 041). **14b.1.1 — entregue** (liberar com "como foi resolvido", resolver sem OS, correção do desbloqueio). **14b.1.2 — entregue** (resolver bloqueio pela inspeção, OS concluída libera). **14b.1.3 — entregue** (foto ampliada no sistema, liberar sobre a inspeção, sem OS em lote). **14b.1.4 — entregue** (situação "✓ Corrigido" sem mudar o NÃO OK registrado). **14b.2 — entregue** (situação na base/locado, locação, rotinas, cumprimento, calendário 🔍, e-mail, entrega × devolução; migration 042). **14b.3 — entregue** (contratos de locação CL, perfil Locatário, área do locatário; migration 043). **14b.3.1 — entregue** (cadastro de clientes por CNPJ/CPF, busca na Receita, máscaras; migration 044). **Próxima: 15a** (proposta comercial) — ou ajustes do fluxo de locação. **Próximo:** agente de IA do gestor lendo a base de Pessoas (ex.: muitas multas de velocidade → sugerir direção defensiva); toggle "aprovação de retirada" no menu Configurações; tela de saída de veículo/viagem. **Próxima: 12e.3** (competências). Ideia registrada: mover o toggle "aprovação de retirada" para o menu Configurações. Escopo da 12e (escopo decidido 20/10 com o Marcony): (1) **biblioteca de treinamentos do QuotaFlow** no Console (conteúdo, perguntas, nota mínima; o tenant importa) — início com integração EHS, direção defensiva, NR-6 (uso de EPI) e produtos perigosos; (2) **treinamentos próprios** da empresa com turma (data, instrutor), **lista de presença com assinatura na tela** e certificado com validade; (3) **"Treinamento manual"** — registrar treinamento já feito no modelo da empresa (instrutor interno, material interno) só com o **anexo da evidência**; (4) **treinamentos exigidos na função** → pilar 🎓 no selo (por item), vencimento no calendário e no e-mail; (5) **prova online híbrida**: o padrão é o **colaborador logado** (perfil de colaborador, que só vê "Meus treinamentos" — o sistema registra quem fez e quando, como assinatura do exame); **em último caso, link externo** em que o CPF identifica a pessoa e preenche o nome; (6) **competências** — escolaridade e categoria da CNH comparadas com a função + lista atende/não atende do gestor. **12e** — treinamentos: **biblioteca de treinamentos do QuotaFlow com conteúdo, perguntas e avaliação** (ideia do Marcony, 19/10 — o tenant aplica aos funcionários e complementa com treinamentos próprios e lista de presença), e competências na Ficha (colaborador ganha escolaridade e categoria da CNH, comparadas sozinhas com a função; demais competências = lista "atende / não atende" marcada pelo gestor, com data e evidência opcional). Na 12e: a entrega avisa se o colaborador ainda não foi aprovado no treinamento básico de EHS. **12f — Dossiê do colaborador** ("Gerar dossiê": PDF com capa, dados, histórico de funções e descritivos, documentos com anexos, fichas de EPI assinadas, treinamentos com presença e provas, multas — período: ano, intervalo ou todo o histórico; registro de quem gerou, LGPD; para auditoria ISO e processos trabalhistas). **12g — Multas** (veículo, motorista na hora, data/local, nº do auto, órgão, infração com gravidade/pontos, valor, vencimento; situação recebida → indicação do condutor → recurso → paga/descontada; prazos no calendário e no e-mail, principalmente o de indicação do condutor; vai para a Ficha e o dossiê). **Depois — agente de IA** do gestor lendo essa base (ex.: "fulano: muitas multas de velocidade → considere direção defensiva").
- **Ordem:** 12c (colaboradores + vencimentos + camadas + e-mail) → 12d.0 (funções + biblioteca + ficha) → **12d EPI** (CA, ficha NR-6, nº de rastreabilidade por movimento `EPI-AAAA-NNNN`, assinatura desenhada na tela do aparelho de quem entrega com "Limpar e refazer", PDF) → **12e Treinamentos** (matriz por função, turmas/plano de ação no calendário, certificado renova a validade).

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
- **Avaliação periódica de fornecedores (ISO 9001, requisito 8.4)** — "como a empresa avalia, seleciona, monitora e reavalia seus fornecedores qualificados?" e o SaaS responder isso pelo cliente. Matéria-prima já existe: NCs por fornecedor, prazo de entrega (OV × recebimento), taxa de resposta e vitória (Painel), preço praticado. Primeiro passo fácil e automático: **revalidação mensal do CNPJ** na Receita (rotina que reconsulta e avisa se algum fornecedor ficou baixado/inapto). Depois: nota periódica por fornecedor (qualidade, prazo, preço, atendimento), relatório de reavaliação exportável para auditoria. Ainda sem desenho — conversar quando chegar a hora.
- **Export Excel em massa.** OS, RC, OV, NC, itens de estoque. Pequena transportadora vive em Excel — tira 30% dos tickets de suporte.
- **M4.8a — IA Embarcada (nível gestor).** Ver seção IA abaixo.

### Camadas de confiança (decidido 17/10/2026)
"SaaS forte, íntegro e confiável precisa de camadas, mesmo que mínimas."
| Origem do fornecedor | Quem responde | Entrada | Vê o Canal Spot |
|---|---|---|---|
| Convidado pelo tenant (local) | O tenant | Na hora (CNPJ ATIVO obrigatório); vai para a fila do admin só como auditoria ("convidado por X") | Não |
| Autocadastro pela tela de login | Ninguém | **"Aguardando aprovação"** do admin — não aparece para tenant nenhum; só completa o perfil | Não, até aprovar |
| Verificado (global) | A plataforma | Sempre com aprovação do admin (documentos) | Sim |

- **Filtros automáticos antes do admin:** bloqueio por CNPJ inválido/inexistente/não ATIVO; **alertas** (sem bloquear) para CNAE fora de peças/manutenção/comércio de veículos, empresa aberta há menos de 6 meses, e-mail gratuito. Fila do admin mostra os dados da Receita lado a lado com o que a pessoa digitou → aprovar/recusar em 1 clique.
- **Tenant novo também:** CNPJ ATIVO obrigatório no "Criar conta" e **só publica no Canal Spot depois da aprovação do admin** (senão um tenant falso publica demandas para colher contatos e preços de fornecedores verificados).
- **Promoção local → global amarrada pelo CNPJ:** ao promover, os cadastros locais com o mesmo CNPJ em outros tenants passam a apontar para o global — o tenant vê o mesmo fornecedor ganhar o selo 🏅 ("o João do Eixo Cardã virou global"), sem duplicar e sem perder o histórico (cotações, OVs, NCs). É a junção da "etapa 2", feita no momento da promoção. Para o tenant é garantia a mais: a plataforma analisou o cadastro.
- **O Spot vira o incentivo à verificação:** tenant convida → fornecedor usa o portal para cotações → vê "Spot 🔒" → pede verificação → admin aprova → vira global.

### "Criar conta" (etapa 11a — feita)
- **Rotas:** `POST /api/auth/signup` (transportadora) e `POST /api/auth/signup-fornecedor`; regras em `services/cadastroPublico.js`; CNPJ/Receita/alertas em `services/receitaCnpj.js` (fonte única — o convite da 10c também usa).
- **Transportadora:** CNPJ obrigatório (inexistente, não ATIVO ou Receita fora do ar = não cadastra; CNPJ já cliente → 409). Responsável entra com perfil principal **gestor** + `usuario_perfis` gestor **e admin** (Usuários exige admin — sem isso o dono não cadastraria a equipe). `plano = 'teste'`, `teste_ate = +15 dias` (de `planos.dias_teste`). `aprovacao_status = 'pendente'`: tudo liberado menos **publicar no Canal Spot** (`POST /spot/demandas` → 403 `spot_tenant_em_analise`; `GET /spot/config` devolve `pode_publicar`).
- **Fornecedor:** CNPJ obrigatório; nasce `tipo = 'candidato'`, `plano = 'gratuito'`; entra direto no portal com faixa "Cadastro em análise" (`GET /fornecedor/me` → `aguardando_aprovacao`). CNPJ que já é global/candidato → 409; CNPJ local de algum tenant não é revelado (junção na aprovação — 11b).
- **Alertas (não bloqueiam):** CNAE fora do esperado (prefixos ajustáveis em `receitaCnpj.js`: cliente = transporte/logística/locação; fornecedor = veículos, peças, máquinas, manutenção…), abertura < 6 meses, e-mail gratuito. Gravados em `alertas_cadastro`.
- **`ADMIN_EMAIL`** (Render, opcional): e-mail a cada cadastro com dados da Receita, alertas e o SQL de aprovação. Até a 11b, aprovar é por SQL (comandos no README da entrega 11a).
- **`/auth/me`** devolve `em_teste`, `dias_restantes_teste`, `teste_encerrado`, `aprovacao_status`, `pode_publicar_spot`, `plano_nome` → `AvisoPlanoTenant.jsx` (faixa no topo do App; some para clientes antigos; fechável na sessão).
- **Fim do teste:** só aviso, sem bloqueio (decisão 17/10/2026) — bloqueio entra quando os planos estiverem definidos.
- **E-mail gratuito no cadastro da transportadora:** aceito, só sinalizado (decisão 17/10/2026).

### Ajustes da 11a (11a.1 a 11a.3 — 17/10/2026)
- **11a.1:** `#signup` não redireciona mais quem tem sessão guardada (antes o "Criar conta" parecia não abrir).
- **11a.2:** consulta à Receita com **User-Agent próprio** (a BrasilAPI devolve 403 para pedido sem identificação — causa real do 503 no cadastro), 2 tentativas, timeout 10 s e **2ª fonte CNPJ.ws** (3/min); no "Criar conta", Receita fora do ar **não trava** (alerta `receita_nao_conferida` para o admin); no convite do tenant continua bloqueando.
- **11a.3 (migration 017):** **confirmação de e-mail** no "Criar conta" (`email_confirmacoes`, link 7 dias, `#confirmar-email`, faixa com "reenviar" limitada a 1/2 min; logins antigos e convidados já confirmados; **não bloqueia nada** — o admin aprova de preferência quem confirmou); **telefone com país** (`CampoTelefone.jsx`, E.164 — também conserta os links `wa.me`, que não levavam código do país); **"Sair" limpa o localStorage**.
- Pendência conhecida: trocar o e-mail de login em Meus Dados não pede nova confirmação (o link antigo deixa de valer).

### Console da Plataforma (etapa 11b — em produção, aplicada 18/10/2026)
- **Aplicada:** migration 018 rodada, verificador 49/49, admin `marcony@betaeyes.com` criado pelo script, console testado em `localhost:5173/#admin`, `PLATAFORMA_ADMINS` + `PLATAFORMA_JWT_SECRET` no `.env`, push `27650e3`. Deploy no Render ok (após registrar `express-fileupload` e `uuid` no `package.json`). Falta conferir o login em `https://kotuno.netlify.app/#admin`.
- **Onde:** `<FRONTEND_URL>/#admin` (`plataforma/ConsolePlataforma.jsx`, rota no `main.jsx`). Login **próprio** — `plataforma_admins` (migration 018), separado de transportadora e fornecedor (isolamento: admin da plataforma nunca é usuário de tenant).
- **Segurança:** precisa estar na tabela (ativo) **e** em `PLATAFORMA_ADMINS` (env, vírgulas) — tirar da env derruba o acesso na hora; token assinado com `PLATAFORMA_JWT_SECRET` (ou derivado do `JWT_SECRET`) → nunca aceito pelo `tenantMiddleware`/`fornecedorMiddleware` (que, sem `tenant_id`, devolveriam dados de todos) e vice-versa; 5 senhas erradas = 15 min de bloqueio; admin criado só por `node scripts/criarAdmin.js` (senha escondida, bcrypt 12, mín. 10 caracteres; rodar de novo troca a senha).
- **Rotas** `/api/plataforma/*` (`routes/plataforma.js`, `middleware/plataformaMiddleware.js`, `services/plataformaConsole.js`): `login`, `me`, `visao-geral`, `pendentes`, `transportadoras`, `fornecedores`, `…/:id/aprovar`, `…/:id/recusar {motivo}`, `DELETE …/:id`.
- **Aprovar/Recusar** mandam e-mail (aprovado ✅ / verificado 🏅 / recusado com motivo). Fornecedor: aprovar = `candidato → global` (`aprovado_em`); recusar = `recusado_em` + `aprovacao_obs` (continua invisível; faixa vermelha no portal via `/fornecedor/me.cadastro_recusado`). Bloqueia aprovar CNPJ que já é global (duplicado).
- **Excluir:** fornecedor só `candidato`; transportadora só do "Criar conta", não aprovada e **sem dados de operação** (chamados, cotações, OV, demandas, NC, equipamentos, itens, catálogo, tarefas, movimentações) — limpa logins, perfis, confirmações, resets, locais/convites dela.
- **Auditoria:** `admin_acoes (admin_email, acao, alvo_tipo, alvo_id, detalhes, criado_em)` — login, aprovar, recusar, excluir.
- **Chaves estrangeiras no Spot (migration 018):** `interesses_spot` e `demandas_spot_visualizacoes` → `fornecedores` ON DELETE CASCADE; `demandas_spot.fornecedor_vencedor_id` ON DELETE SET NULL (órfãos apagados antes). Causa real encontrada em 17/10: interesse de 14/10 com `fornecedor_id = 9` (era do bug `fornecedores_spot`) "herdado" pelo fornecedor novo de id 9.
- **Verificador** confere também o `.env` local (sem mostrar valores): `FRONTEND_URL` com espaço/`#`/acento (o `ß` que quebrou o link de confirmação) e falta de `PLATAFORMA_ADMINS`.

### Próxima etapa (11c) — verificação do fornecedor local e promoção a global
**Começar em conversa nova**, lendo este README primeiro. Escopo combinado:
1. **Pedido de verificação** pelo fornecedor local (e pelo candidato): no portal, a tela "Spot 🔒" ganha "Pedir verificação" → upload de documentos (cartão CNPJ / comprovante de endereço) em **bucket privado** (LGPD), tabela `fornecedor_verificacoes (fornecedor_id, tipo, status pendente|aprovado|recusado, arquivo, analisado_por, analisado_em, obs)`.
2. **Fila no Console da Plataforma** (aba Aprovações): pedidos de verificação ao lado dos cadastros, com os documentos via signed URL e a Receita lado a lado.
3. **Promoção local → global amarrada pelo CNPJ:** ao aprovar, os locais com o mesmo CNPJ em outros tenants passam a apontar para o global, **sem perder histórico** (cotações, OVs, NCs, estoque, interesses). Atenção aos 3 formatos de id de fornecedor (bigint / integer / texto em `itens_consumo.fornecedor_preferencial_id`) e à lista `cotacao_itens.fornecedores_ids` — ver etapa 2 no Roadmap. O vínculo privado de cada tenant (ativo/preferido/obs) vai para `tenant_fornecedores`. Testar a migration/rotina em Postgres local antes.
4. **Selo 🏅 em 3 camadas** (CNPJ ativo automático · endereço por documento · telefone confirmado), com progresso "2 de 3" para o fornecedor.
5. **No console:** mudar plano / estender teste da transportadora.
- **Feito na 11b.1 (18/10):** caixa "Credenciais de teste" só com `import.meta.env.DEV` (some do build); troca do e-mail de login do fornecedor em Meus Dados zera `email_confirmado_em` e envia link ao e-mail novo (e recusa e-mail que já é login de transportadora); verificador confere `require` × `package.json`.
- **Hospedagem do frontend (pendente, 18/10):** créditos do Netlify acabaram (build a cada push). Opções: esperar renovar (desligar builds automáticos antes), **Render Static Site** (recomendado — mesmo painel, deploy manual, não dorme) ou Cloudflare Pages. Trocar de endereço exige `allowedOrigins` no `server.js` + `FRONTEND_URL` no Render.
- Ainda não confirmado: teste ponta a ponta do "Criar conta" de transportadora.
- **Segurança:** rotacionar os segredos do `.env` que foram expostos em conversa (Supabase service role, senha do banco, `JWT_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`) — local e Render.

### Planejamento original da etapa 11 (decidido 17/10/2026)
Dividida em **11a** ("Criar conta" transportadora e fornecedor, planos, teste de 15 dias, CNPJ ATIVO obrigatório; `useAuth().signup` já existe) e **11b** (fila do admin, pedido de verificação com documentos, promoção local → global amarrada pelo CNPJ, liberação do Spot, aprovação do tenant para publicar no Spot).
- **"Criar conta" na tela de login**, dois caminhos:
  - **Transportadora:** CNPJ (busca no cadastro nacional), dados da empresa, e-mail corporativo → dono entra como **gestor** (hoje o signup cria `admin` e não grava `usuario_perfis` — corrigir) → **15 dias de teste**.
  - **Fornecedor:** CNPJ, dados, login, atuação → plano **gratuito** → entra como **"aguardando aprovação"**: só completa o perfil; **não vê o Canal Spot e não aparece para nenhum cliente** até o admin aprovar (revisto em 17/10/2026 — antes previa Spot no mesmo dia).
- **Tabela `planos`** para os dois públicos: cliente `teste` (15 dias) · `bronze` · `prata` · `ouro`; fornecedor `gratuito` · `pro`. Nome, preço e lista de recursos no banco (mudar o que cada plano libera = ajuste no banco). Tenant ganha `plano` + `teste_ate`; aviso "Teste grátis — faltam X dias". **Sem bloqueio por enquanto** — entra quando o conteúdo de cada plano estiver decidido.
- **Selo 🏅 "verificado" em 3 camadas** (ideia do Marcony, a detalhar): (1) **CNPJ ativo** — automático pela consulta que já existe; (2) **endereço** — upload de comprovante/cartão CNPJ, validado pela plataforma; (3) **telefone** — confirmado (ligação ou código por WhatsApp/SMS). Selo só com as 3; fornecedor vê o progresso ("2 de 3"). Documentos em bucket privado (LGPD), tabela `fornecedor_verificacoes (tipo, status pendente|aprovado|recusado, arquivo, analisado_por, analisado_em, obs)` + tela simples de aprovação para a plataforma.

### Visão: listas de atuação em árvore, multi-segmento (decidido 17/10/2026 — não construir agora)
O sistema nasce para transportadoras, mas pode atender outros setores (agro, construção, mineração…) no modelo "árvore que vai abrindo" (estilo Mercado Livre). A base atual já comporta: `atuacao_opcoes` usa **códigos estáveis** e o Match Score compara códigos. Quando entrar o 2º setor: colunas `vertical` e `pai` em `atuacao_opcoes` e o seletor vira árvore — nada do que existe precisa ser refeito. Até lá: aprovar marca sugerida por SQL; a tela de curadoria (aprovar marcas/opções) nasce junto com a árvore. Limpeza de `fornecedores_spot` e `fornecedores.categorias` pode ser feita a qualquer momento.

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

## 🚛 Plano — Comercial → Operação → Viagem → Pós-venda (desenhado em 21/10/2026)

Objetivo: fechar o ciclo do negócio da transportadora dentro do QuotaFlow. Hoje o sistema cobre o **lado de dentro** (compras, manutenção, pessoas, inspeção). A fase seguinte cobre o **lado do cliente**: proposta, aceite, execução da viagem e satisfação.

### Nomes (sem confundir com o que já existe)
| Documento | Código | Observação |
|---|---|---|
| Proposta comercial | **PC-2026-0001** | versões (rev. 1, 2…). **Não** usar "venda"/OV: **OV** já é a ordem de compra ao fornecedor |
| Item da proposta | PC-…/03 | trecho de transporte **ou** item de locação. O cliente aceita item a item |
| Autorização de Transporte | **AT-2026-0001** | uma por viagem/conjunto (sugestão do Marcony). **Não** é OS: **OS** fica para a manutenção |
| Contrato de Locação | **CL-2026-0001** | locação mensal. Mobilização/desmobilização geram ATs |
| Inspeção | **INSP-2026-0001** | numeração visível nas inspeções que já existem (14a). Tipos: pré-uso, carregamento, em trânsito, descarregamento |
| Comunicado de Sinistro | **SIN-2026-0001** | dossiê para a seguradora |

### Fluxo
```
Cliente ─► PC (itens: trechos / locação) ─► envio por link ─► cliente aceita x de y itens (assinatura/aceite registrado)
   └► itens aceitos viram "a programar" ─► Operação programa: data/hora/local (editável), motorista, cavalo + carreta
        └► AT-2026-0001 emitida ─► motorista recebe no celular
             ├► INSP pré-uso (cavalo e carreta) ─ reprovado bloqueia (já existe)
             ├► INSP carregamento (acomodação, amarração, bloqueio, sinalização) ─► dispara o percurso (+1 h de folga)
             ├► INSP em trânsito (paradas: amarração, pneus, lonas) · ocorrência ─► SIN (dossiê seguradora)
             └► INSP descarregamento ─► encerra a AT ─► relatório completo da viagem ─► pesquisa NPS ao cliente
```

### O que a AT leva para o motorista (Marcony, 22/10)
A Operação monta a AT a partir da proposta aceita e o motorista (app logado ou link do terceiro) já vê **qual serviço vai executar**, com a inspeção pré-preenchida:
1. **contrato, cliente e endereço de coleta** (→ "Cliente / contrato" e "Local" da inspeção já vêm preenchidos);
2. **motorista** — vincula sozinho a **CNH** do cadastro (📄 Documentos de Pessoas);
3. **conjunto** (cavalo + carreta, caminhão, empilhadeira, carregadeira…) — vincula sozinho os **documentos do equipamento** (CRLV etc.) e abre as inspeções dos modelos padrão de cada um;
4. **documentos do transporte** (NF-e, DAMDFE, AET) anexados pela Operação;
5. **dados da coleta**: equipamento/carga, nº de série, quantidade, peso/dimensões.
A inspeção feita a partir da AT fica ligada a ela (AT-2026-0001 ↔ INSP-2026-0001…).

### Regras principais
- **Proposta multi-trecho** (ex.: ES → CE com 2 carretas, depois CE → RN com 1 que já está lá): cada item tem origem, destino, carga (peso, dimensões, carga especial/AET), quantidade de conjuntos, janela de datas, preço e condições. Trechos encadeados avisam que o equipamento já estará no destino (reposicionamento sem volta vazia).
- **Feiras/eventos** (ex.: 30 carretas): itens agrupados por "frente" (fábrica → feira, feira → fábrica, feira → cliente final). Uma ação gera vários itens iguais.
- **Locação**: equipamento ou categoria, quantidade, mensalidade, período mínimo, franquia de horas/km, mobilização. O cliente pede 10 e aceita 5: o CL nasce com 5.
- **Aceite parcial**: o link do cliente mostra os itens com checkbox. O aceite grava quem aceitou, quando, IP e hash (mesmo padrão das assinaturas). O que não foi aceito fica como "recusado" com motivo opcional, para medir a taxa de conversão.
- **Programação (Operação)**: só motorista com CNH/treinamentos/documentos em dia (selo de conformidade de Pessoas) e equipamento **não bloqueado** pela inspeção. Avisa choque de agenda (o mesmo conjunto em duas ATs).
- **Tempo de viagem**: distância e tempo pela API de rotas (Google Routes, perfil caminhão quando houver). Em cima disso, a regra de **jornada do motorista (Lei 13.103)**: no máximo 5h30 dirigindo sem parar 30 min, refeição de 1 h, 11 h de descanso entre jornadas, jornada diária. O resultado é a previsão de chegada (ETA) por trecho. A API tem custo por chamada: cache por origem/destino e chave do próprio cliente (Configurações).
- **Percurso**: começa quando a INSP de carregamento é concluída, com 1 h de folga configurável. A posição vem da INSP em trânsito (GPS do celular). Rastreador de terceiros fica para depois.
- **Multas**: a multa de trânsito (12g) cruza data/hora e veículo com a AT e sugere o motorista (indicação do condutor automática).
- **Sinistro**: botão na AT. Já puxa motorista, conjunto, carga, inspeções (com fotos), posição, horários e dados do cliente. Fotos e boletim de ocorrência entram como anexos, e sai o PDF/dossiê para a seguradora.
- **Relatório da viagem**: AT + motorista + conjunto + as 4 inspeções + tempos previsto × real + ocorrências. Serve para o cliente e para a seguradora.
- **NPS**: link enviado ao encerrar a AT (ou ao encerrar todas as ATs da PC). Nota 0–10 + comentário. Indicador NPS por cliente, período e motorista.

### 🏗 Locação de longo prazo — inspeção pelo "cliente do cliente" (ideia do Marcony, 22/10)
Dois modelos de contrato das transportadoras: (1) **serviço sob demanda / curto prazo** (transporte, serviços — o que já temos) e (2) **locação de longo prazo** (obra: semanas, meses, anos — empilhadeira, retroescavadeira, contêiner customizado). Hoje, no (2), só há inspeção de **entrega** e de **devolução** — e as surpresas aparecem na volta.
- **Situação do equipamento:** `🏠 Na base` | `📍 Locado` (cliente, contrato/CL, local/obra, início e fim previsto). A lista de equipamentos filtra "na base" × "no cliente" e mostra, por equipamento, as inspeções em dia / atrasadas.
- **Inspeções de entrega e devolução** como tipos de modelo (o comparativo entrega × devolução vai no relatório — base para cobrar avarias).
- **Rotina para o locatário:** ao locar, a empresa define a frequência (semanal, mensal ou sob demanda) e o modelo; o sistema gera a **demanda** (próxima inspeção, vencida, % de cumprimento) — o mesmo motor de calendário da 14b.2.
- **Acesso do "cliente do cliente" — DECIDIDO 22/10 (Marcony): perfil "Locatário"** (em vez do link): a empresa cadastra o usuário do locatário em 👥 Usuários (e-mail + senha temporária, como um funcionário), com o perfil **locatario** — fora da cobrança por usuário, como o colaborador. Ele entra no QuotaFlow e vê **só a seção 📑 Contratos**, com os **contratos/locações ligados a ele** (equipamentos, inspeção pendente, fazer a inspeção, histórico, documentos do contrato). Mesmo padrão do perfil colaborador: `tenantMiddleware` libera só `/api/locatario`, e **todas** as consultas filtram pelo usuário logado (locação ligada ao `usuario_id` dele) — nunca por parâmetro vindo da tela. O gestor vê **todos** os contratos na mesma seção. Ao encerrar o último contrato ativo do locatário, o sistema oferece **pausar o usuário**. O link de terceiros continua para motoristas avulsos.
- **Avisos:** e-mail do gestor com "inspeção do locatário atrasada" e, opcional, lembrete ao contato do locatário.
- **Por que vale:** a empresa acompanha o ativo durante o contrato, divide a responsabilidade do cuidado com o locatário e tem evidência datada (liability) — em caso de avaria, sabe-se quando apareceu.

### Ideias do Marcony (23/10) — no plano
- **Logomarca da empresa (transportadora) em todos os documentos.** Upload em ⚙️ Configurações (PNG/JPG/SVG até 1 MB, bucket privado) e um **cabeçalho único** para todos os HTML "printáveis" (`utils/cabecalhoDocumento.js`: logo + razão social + CNPJ). Por etapas: (1) relatório de inspeção, cumprimento, certificado, comprovante da avaliação, lista de presença; (2) dossiê, ficha de EPI, termo de desconto, medida disciplinar, PDF da NC; (3) contrato (modelos de contrato) e proposta (15a). Sem logo, segue como hoje (nome em texto).
- **🛡 Monitor de CNPJs (compliance).** Dia **01 e 15** (na rotina das 7h), verifica 100% dos CNPJs da base — clientes, fornecedores do tenant — na Receita (BrasilAPI → CNPJ.ws, devagar para não estourar limite) e guarda a situação de cada um (`cnpj_monitor`: documento, de onde vem, situação, verificado_em, mudou_em). Tela **🛡 Monitor de CNPJs** (gestão): última verificação, % verificado, lista com a situação e o que mudou. **E-mail ao gestor:** "100% da base verificada — nenhum CNPJ inativo no período" ou "Alerta: estes CNPJs ficaram inativos", destacando quem tem **relacionamento em andamento** (contrato de locação ativo, cotação/pedido de compra em aberto). O aviso vai para a transportadora (o gestor), não para o cliente/fornecedor.
- **📄 Modelos de contrato.** Texto padrão da empresa com campos automáticos (`{{cliente.nome}}`, `{{cliente.documento}}`, `{{contrato.numero}}`, `{{obra}}`, `{{inicio}}`, `{{fim_previsto}}`, `{{tabela_equipamentos}}`, `{{empresa.razao_social}}`…) + **condições comerciais** preenchidas no contrato (valor mensal por equipamento, caução, franquia de horas, reajuste, multa, foro). Gera o contrato printável com a logo; depois, aceite do locatário pelo acesso dele (assinatura na tela + hash, como nos outros termos). **Biblioteca no Console** com um modelo-base ("Contrato de locação de equipamento — modelo para revisar com o jurídico"), que a empresa importa e adapta (mesmo padrão de funções, treinamentos e inspeções).
- **Ordem sugerida:** 14c **logo** (base de todos os documentos) → 14d **modelos de contrato** (usa a logo e prepara as condições comerciais da proposta 15a) → 14e **monitor de CNPJs** (independente; pode vir a qualquer momento) → 15a proposta.

### Etapas
| Etapa | Entrega |
|---|---|
| **14a.1** | ✅ checkbox "Foto obrigatória" por ponto |
| **14b.1** ✅ / **14b.2** | inspeção de terceiros (link), "Minhas inspeções" do colaborador, "resolvi na rua", calendário e % de cumprimento, relatório por período, **numeração INSP-AAAA-NNNN** e **tipo de inspeção** (pré-uso / carregamento / em trânsito / descarregamento) + modelos de carregamento na biblioteca |
| **14b.2** ✅ | situação do equipamento (🏠 na base / 📍 locado), frequência por equipamento, calendário de inspeções (camada 🔍), em dia / atrasada / % de cumprimento, relatório por período, tipos entrega/devolução |
| **14b.3** ✅ | **Perfil Locatário** + seção **📑 Contratos** (gestor vê todos; locatário só os dele), locação ligada ao usuário, inspeções do locatário, pausar usuário ao encerrar |
| **14c** ✅ | logomarca da empresa — etapa 1 (inspeção, cumprimento, certificado, avaliação, presença) · etapa 2 (dossiê, EPI, termo de desconto, disciplinar, NC) |
| **14d** ✅ | modelos de contrato (texto com campos automáticos + condições comerciais, biblioteca no Console, emissão com hash, aceite do locatário) |
| **14e** ✅ | 🛡 monitor de CNPJs (ciclos 01/15 + checagem na hora, tela do tenant só com o que impacta, Console da plataforma, trava na cotação, justificativa na OC/nota) + trava da razão social e histórico do fornecedor |
| **15-bid** | ✅ entregue como **15a** — modelo da cliente (PC 551) virou o modelo "Transporte de equipamentos" |
| **15a** | ✅ 📈 Comercial (mini-CRM): funil kanban, BID com modelos da biblioteca, itens por trecho, versões com o que mudou, PDF, atividades e tarefas, cliente 360°, perfil comercial, IE e opção fiscal |
| **15b** | ✅ BID com o cliente: link, ✓✓ visualizado, resposta por item, código + assinatura, previsão de receita (15b.1–15b.4) |
| **15c** | ✅ Pedido de Venda (PV) automático no aceite, status por item, **aditivo pelo link** |
| **Calendário comercial** | 📅 BIDs/PVs + eventos de mercado com lembrete de prospecção (`claude/desenho-calendario-comercial.md`) |
| **16a** | ✅ **Programação / AT** (entregue 29/10): itens aceitos → AT com data/hora/local, motorista e conjunto (checagem de conformidade e bloqueio), agenda da frota, camada 🚛 no calendário |
| **16b** | **Contrato de locação (CL)**: mensalidade, período, mobilização → AT, faturamento mensal previsto |
| **17a** | **App do motorista na AT**: AT no celular → INSP pré-uso → carregamento → em trânsito → descarregamento (gatilhos em cadeia, offline como na 14a), encerramento |
| **17b** | Rotas e **ETA com jornada** (API de rotas + Lei 13.103), previsto × real, cruzamento com **multas** |
| **18** | **Comunicado de sinistro** (dossiê para a seguradora) e relatório completo da viagem |
| **19** | **Pesquisa NPS** e indicadores comerciais (conversão, NPS, receita por cliente/trecho) |
| v2.0 | rastreador/telemetria, CT-e/MDF-e (fiscal — integração com emissor), PWA instalável, QR code no equipamento, agente de IA do gestor |

**Decidido em 21/10 (Marcony):**
1. **Preço:** em ⚙️ Configurações, o **custo por km rodado** (por tipo de conjunto, quando fizer sentido). A proposta mostra o **valor mínimo** do item (km do trecho × custo/km) e avisa se o preço digitado ficar abaixo dele. O preço continua livre.
2. **AET, CT-e, MDF-e (DAMDFE), NF-e:** continuam no sistema que o cliente já usa. Ganhou a proposta, o cliente emite esses documentos e **anexa na AT**.
3. **Pasta da viagem para o motorista:** a AT junta todos os documentos (do veículo, AET, DAMDFE, NF-e, CNH, apólice…). O funcionário acessa pelo app; o terceiro recebe um **link** (sem login, com validade, como o link da prova). O envio do link com os dados do transporte é automático pelo **Telegram** (bot gratuito, para funcionários que iniciarem o bot) ou por **copiar e colar** (WhatsApp/Instagram) para o terceiro.

## 📞 Contatos do Projeto

**Desenvolvedor:** Marcony
**Plataforma:** QuotaFlow
**Última atualização deste documento:** 29/10/2026 (etapa 16a)

--------------------------------------------------------------------------------

#### 🌿 17. Módulo ESG (Maturidade & Relatórios de Sustentabilidade)

O QuotaFlow converte dados operacionais brutos em indicadores de conformidade ESG (Environmental, Social, Governance) para atender a grandes contratantes e exigências internacionais (CSRD / EU Taxonomy):

* **🌱 Environmental (Meio Ambiente):**
  * Redução de emissões e prevenção de contaminação através do cumprimento rigoroso dos **Planos de Manutenção Preventiva**.
  * Rastreabilidade de licenças ambientais (IBAMA, ANTT, licenças estaduais/municipais) e controle de transporte de carga perigosa (MOPP).
  * Gestão consciente de resíduos e insumos com controle de vida útil de pneus e componentes.
* **👥 Social (Saúde, Segurança & Pessoas):**
  * Gestão de **EPIs (NR-6)** com controle de Certificado de Aprovação (CA) e assinatura digital na tela.
  * Monitoramento diário de exames ocupacionais (ASO, toxicológico) e validade de CNH.
  * Biblioteca de treinamentos regulatórios com listas de presença assinadas e emissão automática de certificados.
* **🛡️ Governance (Governança & Ética):**
  * Auditoria contínua de compliance em compras e fornecedores.
  * Trilha inviolável de dados com **hashes de segurança (SHA-256)** em inspeções, entregas e termos disciplinares.
  * Validação periódica de cadastros de fornecedores e clientes na Receita Federal (CNPJ).
* **📊 Dashboard de Maturidade ESG & Relatório 1-Clique:**
  * Indicador sintético do nível de prontidão ESG da empresa.
  * Emissão automática de relatório formal em PDF para apresentação a bancos, seguradoras e auditores.

--------------------------------------------------------------------------------

#### 📜 18. Módulo ISO 9001 (Gestão da Qualidade & Análise Crítica)

Estrutura nativa desenvolvida para simplificar e automatizar os requisitos da norma ISO 9001 sem burocracia ou pastas de papel:

* **Mapeamento Direto de Requisitos:**
  * **Cláusula 7 (Apoio & Competência):** Mapeado via Matriz de Competências, Treinamentos e Ficha de EPI.
  * **Cláusula 8 (Operação & Compras):** Mapeado pelo fluxo completo de compras (*OS → RM → RC → OV*) e inspeções operacionais.
  * **Cláusula 9 (Avaliação de Desempenho):** Mapeado por benchmarking de mercado, relatórios de manutenção e histórico de compras.
  * **Cláusula 10 (Melhoria & Não Conformidade):** Mapeado pelo módulo de **NCs com Análise de Causa Raiz (5 Porquês)** e Planos de Ação (3W).
* **📄 Análise Crítica pela Direção (Cláusula 9.3) em 1-Clique:**
  * Compilação automática de indicadores de qualidade, satisfação, desempenho de fornecedores e riscos operacionais.
  * Geração instantânea de apresentação em PDF/PPT e ata da reunião pronta para auditoria externa.

--------------------------------------------------------------------------------

#### 🤖 19. Agente de IA de Compliance & Anti-Fraude

Auditoria contínua rodando em segundo plano para identificar anomalias operacionais, fraudes em compras e descumprimento de procedimentos:

* **🚚 Operação & Campo:**
  * **Checklist Carimbado (Vistoria Ultrarrápida):** Alerta para inspeções finalizadas em tempo incompatível com a vistoria física (ex: < 60s).
  * **Divergência de GPS:** Vistorias realizadas fora do perímetro da base ou do local esperado do veículo.
  * **Inconsistência de Reincidência:** Veículos antigos com 100% de apontamentos "OK" consecutivos sem nenhum item preventivo registrado.
* **💰 Compras & Suprimentos (Procurement):**
  * **Cotação Expressa sem Competição:** Janela de cotação encerrada em minutos com contratação imediata sem tempo de resposta para a rede.
  * **Renegociação Seletiva:** Abertura de contraproposta para apenas um fornecedor específico, mantendo concorrentes sem opção de ajuste.
  * **Fracionamento de Pedidos:** Múltiplas RMs/RCs de pequenos valores no mesmo dia para burlar alçadas de aprovação da diretoria.
  * **Desvio de Preço Histórico (Overpricing):** Compras de insumos com valores acima da média histórica do tenant ou benchmark da rede.
* **📦 Estoque & Almoxarifado:**
  * **Saída de Material sem OS:** Retiradas avulsas frequentes de itens de alto valor sem vínculo com Ordem de Serviço.
  * **Divergência Fiscal (NF-e × OV):** Incompatibilidade de quantidade, valores ou NCM no XML da Nota Fiscal em relação ao pedido original.
* **🦺 Pessoas, SST & Disciplinar:**
  * **Operação com Restrição Trabalhista (Selo Vermelho):** Escalamento de funcionários com CNH, ASO ou toxicológico vencido, ou sem treinamento obrigatório.
  * **Ficha de EPI sem Conformidade de Risco:** Ausência de entrega de EPIs para funções mapeadas no PGR.
  * **Padrão Gráfico Suspeito:** Assinaturas digitais em sequência com padrão idêntico para colaboradores distintos.

--------------------------------------------------------------------------------

#### 📷 20. Câmera de Inspeção Inteligente (Marca d'Água & Anti-Anacronismo)

Módulo de captura de evidências visuais integrado ao App de Inspeções/Checklists:

* **🏷️ Marca d'Água Inviolável cravada nos Pixels:**
  * Aplicação direta na imagem dos metadados de execução: Data, Hora exata, Coordenadas GPS, Nome do Inspetor, Placa do Veículo e ID da Inspeção.
* **🚫 Bloqueio Estrito de Galeria:**
  * Desativação do acesso ao armazenamento interno do aparelho — fotos obrigatoriamente capturadas em tempo real pela câmera do app (`capture="environment"`).
* **⏱️ Análise de Delta de Tempo (Anti-Anacronismo):**
  * Registro do intervalo entre capturas de fotos e comparação com o horário do evento/viagem.
  * Prevenção de "vistorias retroativas" (ex: vistoria realizada às 10h referente a uma saída que ocorreu às 08h).
* **🛡️ Prova Técnica Inviolável:**
  * Evidência documental pronta para instrução de defesas jurídicas, trabalhistas e sinistros de frotas.

--------------------------------------------------------------------------------

#### 📄 21. Dossiê do Colaborador & Relatório do "Analista Sênior" (IA)

* **📋 Dossiê Trabalhista em 1-Clique:**
  * Relatório unificado contendo histórico de funções, documentos, entregas de EPI (NR-6), treinamentos, advertências e multas.
  * Registro de auditoria com IP, data, hora e responsável pela emissão (conformidade LGPD).
* **🧠 Relatório Mensal do Analista Sênior (IA):**
  * Consolidação mensal automatizada sobre a saúde financeira, operacional e de compliance da empresa.
  * Insights práticos com alertas de custos atípicos, gargalos de manutenção e plano de ação estratégico para o empresário.