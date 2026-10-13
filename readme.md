# 📦 QuotaFlow — Estrutura Completa do Projeto

**Versão:** 4.0 (Multi-perfil + NC end-to-end + Reset de senha + Meu perfil)
**Última atualização:** 13/10/2026
**Status:** núcleo de compras (OS → RM → RC → OV) em produção; marketplace de fornecedores com busca unificada em produção; módulo de Não Conformidades com fluxo ISO 9001 completo; multi-perfil e reset de senha entregues.

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Estrutura de Pastas](#estrutura-de-pastas)
4. [Banco de Dados](#banco-de-dados)
5. [Fluxo de Negócio: OS → RM → RC → OV](#fluxo-de-negócio-os--rm--rc--ov)
6. [Marketplace de Fornecedores e Busca Unificada de Item](#marketplace-de-fornecedores-e-busca-unificada-de-item)
7. [Módulo de Não Conformidades (M4.4 – M4.5)](#módulo-de-não-conformidades-m44--m45)
8. [Multi-perfil, Reset de Senha e Meu Perfil (M4.6 – M4.7)](#multi-perfil-reset-de-senha-e-meu-perfil-m46--m47)
9. [Como Rodar](#como-rodar)
10. [Status das Features](#status-das-features)
11. [Armadilhas Conhecidas do Backend](#armadilhas-conhecidas-do-backend)
12. [Roadmap / Decisões em Aberto](#roadmap--decisões-em-aberto)

---

## 🎯 Visão Geral

**QuotaFlow** é um SaaS de automação de compras para **transportadoras** (frotistas de carretas e caminhões). O produto nasceu com uma referência de rigor de cadastro típica de óleo & gás, mas a validação com clientes reais mostrou que a maioria das transportadoras pequenas/médias não tem (nem quer ter) esse nível de burocracia — isso moldou duas decisões estruturais grandes descritas neste documento: a separação OS/RM/RC e o modelo de marketplace decoupled de fornecedores.

### Principais Atores:
- 🚚 **Motorista / Mecânico / Encarregado** — abre a Ordem de Serviço (OS), monta a lista de materiais e serviços
- 💰 **Comprador** — revisa os itens de material marcados para compra, gera Requisição de Material (RM), depois Requisição de Compra (RC/cotação), escolhe fornecedor e emite Ordem de Venda (OV)
- 🏢 **Fornecedor** — cadastra catálogo de produtos (via CSV ou manualmente), responde cotações pelo portal próprio, trata NCs

### Segmentação de clientes (decisão de produto confirmada)
Cerca de 20% dos clientes potenciais (geralmente com herança de controladoria tipo óleo & gás) querem catálogo próprio rigoroso, rastreável, com fornecedores "internos" qualificados. Os outros ~80% querem o mínimo de burocracia possível e vão comprar direto do marketplace agregado de fornecedores, sem nunca preencher o catálogo do próprio tenant. **O sistema foi desenhado para atender aos dois perfis ao mesmo tempo, sem forçar nenhum a se comportar como o outro** — ver seção 6.

---

## 🏗️ Arquitetura
┌─────────────────┐
│ Frontend │ (React + Vite)
│ (port 5173) │
└────────┬────────┘
│ HTTP/REST (JWT Bearer)
▼
┌─────────────────┐
│ Backend │ (Node.js + Express)
│ (port 3001) │
└────────┬────────┘
│ Supabase JS client (supabase-js) + wrapper DB (backend/db.js)
▼
┌─────────────────┐
│ Supabase │ (PostgreSQL + Auth + Storage + pg_trgm/unaccent)
│ (Cloud) │
└─────────────────┘

text

### Stack Tecnológico:
- **Frontend:** React 18 + Vite; `react-phone-number-input` (telefone internacional E.164)
- **Backend:** Node.js + Express
- **Banco:** PostgreSQL (Supabase), com extensões `pg_trgm` e `unaccent` para busca fuzzy
- **Storage:** Supabase Storage (bucket privado `nc-evidencias` para anexos de NC; bucket `nfe-xmls` para XML de NF-e)
- **Auth:** JWT (`Authorization: Bearer <token>`), payload `{ user_id, tenant_id, email, perfil, perfis[] }`, validado em `middleware/tenantMiddleware.js`
- **Multi-tenant:** toda tabela relevante tem `tenant_id`; middleware injeta `req.tenantId` (exceto tabelas N:N como `usuario_perfis`, cujo isolamento é por transitividade via FK do usuário)

### `apiService.js` — convenção real (importante para quem for escrever chamadas novas)
`apiService.get(endpoint, params)` e os demais métodos **recebem os query params/body diretamente como objeto**, sem wrapper `{ params: {...} }` (essa é convenção do axios, não deste projeto). A assinatura real:
```js
get(endpoint, params = {})     // params vai direto pra URLSearchParams
post(endpoint, body, params = {})
put(endpoint, body, params = {})
patch(endpoint, body, params = {})
delete(endpoint, params = {})
Um { params: { x } }} passado como segundo argumento de get produz ?params=[object Object] na URL — bug real encontrado e corrigido em TelaChamadosNova.jsx (dois pontos: consultarSaldo e a busca unificada de item) em 10/09/2026.

Middleware global PATCH → PUT (M4.6, 13/10/2026)
O front (apiService.js) usa PATCH em várias rotas (/chamados/:id, /cotacoes/:id, /fornecedores/:id, /equipamentos/:id, /tarefas/:id), mas o backend registra tudo como PUT. Em vez de duplicar handlers em cada arquivo, um middleware no server.js normaliza req.method = 'PUT' antes do router. Se um dia precisar de PATCH com semântica diferente de PUT (update parcial real), remover o middleware e registrar rotas .patch() específicas.

📁 Estrutura de Pastas
text
quotaflow/
│
├── backend/
│   ├── services/
│   │   ├── CotacaoService.js       (Lógica de cotações — buscarPorChamadoComFornecedores, etc)
│   │   ├── CatalogoService.js
│   │   ├── emailService.js         (envio genérico + templates)
│   │   ├── NCService.js            (M4.1 — notificação de NC ao fornecedor + emissão de token)
│   │   ├── NCEmailTemplates.js     (M4.4 — templates de email da NC: corpoParaFornecedor / corpoParaComprador)
│   │   ├── StorageNC.js            (M4.5 — upload/signed URL/delete no bucket `nc-evidencias`)
│   │   └── PasswordResetService.js (M4.6 — geração/validação de token de reset de senha)
│   │
│   ├── routes/
│   │   ├── auth.js                 (login, signup, login-fornecedor, forgot-password, reset-password)
│   │   ├── cotacoes.js             (chamados/OS/RM, apontamentos, gerar-requisicao-material, cotações/RC, OV — arquivo grande e central)
│   │   ├── catalogo.js             (catálogo do tenant — CRUD "clássico")
│   │   ├── catalogoBusca.js        (NOVO 09/2026 — busca unificada catálogo+marketplace pra tela de OS)
│   │   ├── fornecedores.js         (fornecedor "cliente" — cadastro simples do lado comprador)
│   │   ├── fornecedor.js           (fornecedor "anunciante" — perfil de fornecedor com catálogo próprio)
│   │   ├── fornecedorProdutos.js   (NOVO 09/2026 — CRUD do catálogo do fornecedor: upload CSV, criar/editar/deletar item)
│   │   ├── buscaFornecedores.js    (NOVO 09/2026 — busca no marketplace COM dado comercial, uso do comprador)
│   │   ├── portalFornecedor.js     (rota realmente usada pelo fornecedor pra responder cotação via token — sem middleware, autenticação por token na URL)
│   │   ├── fornecedorNC.js         (M4.2 – M4.4 — endpoints do portal do fornecedor para NC: listar, responder, anexar, reenviar)
│   │   ├── naoConformidades.js     (M4.2 – M4.5 — endpoints do comprador para NC: CRUD, devolver, marcar-interna, vincular-item, editar-item-avulso, buscar-item)
│   │   ├── equipamentos.js
│   │   ├── usuarios.js             (CRUD + /me + /me/trocar-senha + requerAdmin)
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
│   │   ├── tenantMiddleware.js     (valida JWT, injeta req.tenantId/req.userId/req.userEmail/req.userPerfil/req.perfis)
│   │   └── fornecedorMiddleware.js
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
│   │   │   │   ├── TelaFornecedoresNova.jsx         (fornecedor "cliente", lado comprador)
│   │   │   │   ├── TelaCatalogoFornecedor.jsx       (perfil do fornecedor anunciante: CRUD + import CSV)
│   │   │   │   ├── TelaNaoConformidadesFornecedor.jsx (lista de NCs do fornecedor)
│   │   │   │   └── ModalDetalheNCFornecedor.jsx     (detalhe de NC no portal do fornecedor: contestar/resolver, anexos, PDF)
│   │   │   │
│   │   │   ├── usuarios/
│   │   │   │   ├── TelaUsuariosNova.jsx             (CRUD de usuários, multi-perfil com toggles)
│   │   │   │   ├── ModalMeuPerfil.jsx               (M4.7 — modal do próprio usuário: nome, telefone, trocar senha)
│   │   │   │   └── phone-input.css                  (override dark do react-phone-number-input)
│   │   │   │
│   │   │   ├── portal/
│   │   │   │   └── TelaPortalFornecedor.jsx
│   │   │   │
│   │   │   ├── equipamentos/, catalogo/, historico/, relatorio/, financeiro/,
│   │   │   │   inteligencia/, plano/, benchmark/, layouts/, shared/
│   │   │
│   │   ├── hooks/
│   │   │   ├── useCotacoes.js, useChamados.js, useFornecedores.js, useAuth.js,
│   │   │   │   useCatalogo.js, useEquipamentos.js, useEmail.js, usePortal.js,
│   │   │   │   useTarefas.js, useUsuarios.js
│   │
│   │   ├── services/
│   │   │   ├── apiService.js       (cliente HTTP genérico)
│   │   │   └── ...Service.js por domínio
│   │
│   │   ├── utils/
│   │   │   ├── csvFornecedorUtils.js  (parser CSV quote-aware + sinônimos de coluna + normalização de preço BR/US)
│   │   │   └── gerarPdfNC.js          (M4.5 — gera o HTML printável da NC, CSS embutido)
│   │
│   │   ├── TelaLogin.jsx
│   │   ├── TelaEsqueciSenha.jsx       (M4.6)
│   │   ├── TelaResetSenha.jsx         (M4.6)
│   │   ├── TelaSignup.jsx
│   │   ├── App.jsx, main.jsx
│   │
│   ├── .env.local, package.json, vite.config.js
│
└── README.md (este arquivo)
🗄️ Banco de Dados
Núcleo multi-tenant
tenants — id | nome | cnpj | telefone | email_contato | email_admin | comunicacao_*_policy | criado_em

usuarios — id | tenant_id | nome | email | telefone | perfil | ativo | criado_em | atualizado_em. perfil continua sendo o "principal" (compatibilidade com checks legados); o multi-perfil de verdade vive em usuario_perfis (ver abaixo). telefone em E.164 (+5511999999999).

perfis ⭐ (M4.6) — catálogo dos 6 perfis canônicos: admin | gestor | comprador | operacao | qualidade | financeiro. Colunas: codigo (PK) | nome | descricao | ordem.

usuario_perfis ⭐ (M4.6) — N:N entre usuários e perfis (multi-perfil). usuario_id | perfil_codigo. Não tem tenant_id — isolamento por transitividade (ver db.js regra multi-tenant).

equipamentos — id | tenant_id | tag | nome | local | fabricante | modelo | serie | ativo | criado_em.

Núcleo de compra: OS → RM → RC → OV
Ver seção 5 para o fluxo completo.

chamados — OS e RM (tipo_documento: 'os' | 'requisicao_material'). Campos: id | tenant_id | equipamento_id | numero | status | urgencia | categoria | descricao_geral | servico_nome | modo_programacao | data_inicio_prevista | data_fim_prevista | tipo_documento | origem_os_id | origem_os_numero | origem_rc_id | origem_rc_numero | bloqueado_em | criado_em.

chamado_itens — lista única material+serviço. Campos descritos na versão anterior do README (mantidos).

chamado_apontamentos — apontamento por item de serviço.

cotacoes ⭐ — a RC.

cotacao_itens — itens da RC.

cotacao_fornecedores ⯑ — resposta por fornecedor na RC.

cotacao_fornecedor_itens — resposta item a item.

ordens_venda — OV emitida após escolha do fornecedor.

nao_conformidades — ver seção 7 para o schema completo.

Módulo de Não Conformidades (M4.4/M4.5)
nao_conformidades — numero_nc | tenant_id | ordem_venda_id | numero_pedido | fornecedor_id | fornecedor_nome | fornecedor_tratativa_status | fornecedor_ciente_em | fornecedor_ciente_por_nome | numero_nota_fiscal | data_recebimento | data_ocorrencia | inspetor_id | criado_por_nome | motivo_recusa | descricao_problema | quantidade | unidade_medida | lote | numero_serie | validade | **item_catalogo_id** (M4.5) | **item_consumo_id** (M4.5 — ponte pro estoque) | **item_nome_avulso** (M4.5 — texto livre quando item fora do catálogo) | **item_sku_avulso** (M4.5) | **item_fora_catalogo** (M4.5 — flag pra Qualidade revisar) | tipo_resolucao | rodada | **status** (aberta | em_analise | em_execucao | aguardando_validacao | resolvida | cancelada) | **fornecedor_tratativa_status** (nao_enviado | enviado | visualizado | contestada | resolvida_fornecedor | devolvida | null) | criado_em | atualizado_em. Constraint CHECK em fornecedor_tratativa_status (whitelist). Bloco causa_raiz / cinco_porques (jsonb) / acao_corretiva / encerrada_por_* / devolvida_validacao_*.

nao_conformidade_eventos — timeline: nc_id | tipo | descricao | dados (jsonb) | criado_por | criado_por_nome | criado_em | visivel_fornecedor | autor_tipo.

nao_conformidade_anexos — nc_id | url | nome_arquivo | mime_type | tamanho_bytes. O url agora contém path do bucket nc-evidencias (M4.5) — antes era data URI inline. Anexos antigos (data URI) continuam válidos e são detectados no gerarPdfNC.js.

nao_conformidade_plano_acao — plano 3W opcional.

Multi-perfil, reset de senha e afins
perfis / usuario_perfis — descritos acima.

password_resets ⭐ (M4.6) — id | tenant_id | usuario_id | fornecedor_usuario_id | email | token_hash | expira_em | usado_em | criado_em. Serve tenant e fornecedor (uma das duas FKs preenchida, a outra null). Token cru nunca é guardado — só o SHA-256.

Estoque e reservas (mantidos da versão anterior)
itens_consumo — almoxarifado com saldo físico. Colunas item_sku_avulso (M4.5 — part number livre quando o item não tem catálogo).

ordem_venda_itens, historico_contagens_cegas, estoque_reservas, movimentacoes_estoque, solicitacoes_retirada, config_estoque — inalterados.

Catálogo e marketplace (mantidos)
catalogo_itens — catálogo do tenant.

fornecedores, fornecedor_itens, fornecedor_produtos — inalterados.

normalizar_pn / normalizar_texto — inalteradas.

Storage
Bucket nc-evidencias (privado) — M4.5. Path: tenant-{id}/nc-{id}/evidencia-NN.ext. Acesso sempre via signed URL (1h TTL, download: false).

Bucket nfe-xmls (privado) — XML de NF-e (uso anterior).

Outras tabelas
tarefas, tarefa_comentarios, fornecedor_preco_historico, cnpj_alertas, notas_periodo, cliente_frota, fornecedor_upload_log, demandas_spot.

Órfãs, não usadas (mantidas): ordens_servico, ordem_servico_itens, backend/routes/useAuth.js (deletado em M4.6).

🔄 Fluxo de Negócio: OS → RM → RC → OV
(Mantido integralmente da versão anterior — o fluxo não mudou.)

🔎 Marketplace de Fornecedores e Busca Unificada de Item
(Mantido integralmente da versão anterior — a busca unificada e as duas rotas com contratos diferentes seguem como em 10/09/2026.)

Adição M4.5: a mesma busca unificada é usada pela NC na tela do comprador. O endpoint é GET /nao-conformidades/buscar-item — não reaproveita o /catalogo/buscar-item porque o contrato é diferente (a NC precisa saber se o item tem estoque — itens_consumo — além do catálogo). Retorna { item_consumo_id, catalogo_item_id, nome, sku, tem_estoque } e o front usa 2 ícones: 📦 (tem estoque) / 📖 (só catálogo). Dedup por catalogo_item_id.

---

## 📊 Benchmarking de Mercado

### Visão geral
Página dedicada do tenant que compara **os preços que ele praticou** contra a
**faixa de preços da rede QuotaFlow** — sem abrir valores de concorrentes
nominalmente. O que o cliente vê é:

> "Você pagou R$ 1.000 neste item. A rede QuotaFlow registrou valores entre
> R$ 800 e R$ 1.200, com mediana R$ 950. **Considere incluir o fornecedor
> XYZ na próxima cotação** — este fornecedor tem histórico de venda do mesmo
> item por R$ 900."

### Como o número aparece
- **Só o tenant vê os próprios valores.** Nunca os de outro tenant.
- **Faixa da rede** só aparece quando há **≥ 5 fornecedores** com histórico do
  item (anonimato estatístico — mesmo princípio dos benchmarks de folha de
  pagamento).
- **Convite ao fornecedor** só aparece quando um fornecedor específico tem
  histórico do mesmo item a preço menor que o praticado — e ele não foi
  convidado na última cotação. Ação de 1 clique: "Incluir na próxima cotação".

### De onde vêm os dados
- `fornecedor_produtos` (marketplace) — catálogo do fornecedor anunciante,
  global. Alimentado por CSV ou manual pelo próprio fornecedor.
- `cotacao_fornecedor_itens` — preço praticado nas cotações fechadas.
- `fornecedor_preco_historico` — série temporal (preço por item, por fornecedor).
- `catalogo_itens.codigo` (PN) — chave de agregação entre tenants.

### Limitação atual (honesta)
Hoje o banco **não tem volume suficiente** para a faixa da rede aparecer na
maioria dos itens (precisa de ≥ 5 fornecedores por item). A página existe e
funciona; ela **cresce junto com o marketplace**. Enquanto o volume não vem,
o que dá pra entregar:
- Comparação do tenant **contra ele mesmo** (mesmo item, mês anterior, média
  dos últimos 6 meses) — zero dependência de rede.
- "Você pagou R$ 1.000; na sua última compra deste item você pagou R$ 850."
- Recomendação "considere incluir fornecedor Y" quando o próprio tenant já
  comprou mais barato de outro fornecedor.

### Valor de produto
- **Retenção:** o cliente não sai porque perde o histórico de economia.
- **Monetização (fase 2):** fornecedor pode pagar **destaque** pra aparecer na
  recomendação "incluir na próxima cotação". Modelo análogo ao "patrocinado"
  do Google Shopping — cobrança por impressão ou por inclusão efetiva.
- **Efeito de rede:** quanto mais tenants usam, melhor o benchmark de todos.
  É um dos poucos features que **melhora com o tempo sem dev adicional**.

---

## 🧭 Módulo de Não Conformidades (M4.4 – M4.5)
Fluxo completo (ISO 9001 cláusula 10.2)
Abertura — via OS/recebimento (origem os_material, os_servico, recebimento) ou manual (ModalNovaNC, origem inspecao).

Notificação ao fornecedor — gestor clica "📤 Notificar fornecedor"; NCService.notificarFornecedorNC (idempotente) envia email + muda fornecedor_tratativa_status pra enviado.

Tratativa — fornecedor responde pelo portal (contestar ou resolver). Comprador analisa: pode validar (encerra NC), devolver (loop de rodadas), aceitar contestação (cancela NC) ou rejeitar contestação.

Encerramento — Qualidade registra causa raiz + 5 porquês (opcional), NC vira resolvida.

Fluxos auxiliares da NC
Marcar como interna — NC nasceu vinculada a fornecedor via OC, mas a triagem concluiu que não é problema dele. Zera fornecedor_id, mantém o histórico, fornecedor perde acesso ao portal.

Curadoria de item (M4.5) — quando o operador abre NC com item fora do catálogo (texto livre), a Qualidade pode depois vincular ao catálogo (POST /:id/vincular-item) ou editar como item avulso (POST /:id/editar-item-avulso). Ícone ⚠ no chip enquanto pendente.

Bloqueio de OS por NC ativa (M4.4-etapa-10d)
Backend: PUT /chamados/:id (detalhe) recusa conclusão enquanto houver NC ativa vinculada via chamado_id.

Frontend: botão "🔒 Concluir OS" fica com fundo preto e clique abre modal overlay (não substitui a tela) listando as NCs abertas com ação dupla (abrir NC / voltar). Item da OS com NC ativa ganha ⚠ clicável no header.

Regra: qualquer NC com status NOT IN ('resolvida','cancelada') bloqueia.

Emails transacionais (M4.4-etapa-10d)
Todos os 5 eventos usam o mesmo template (NCEmailTemplates.js):

Criação (criacao — contexto: 'criacao') → fornecedor

Devolução (E1 — contexto: 'devolucao') → fornecedor

Reenvio (E2) → comprador

Contestação (E3) → comprador

Resolução (E3) → comprador

O bloco de contexto (🏢 Cliente / 📋 NC / 📄 OC / 📦 Item / 🔖 PN / 🔢 Qtd / 🏷 Lote / 🔢 Série / 📆 Validade / 📝 Descrição) é sempre visível. Cabeçalho/rodapé são dinâmicos por contexto.

PDF de NC (M4.5)
Gerado no frontend via window.print() (não há dependência nova). O gerarPdfNC.js monta o HTML com CSS embutido.

Duas versões: interno (comprador, com causa raiz / trilha de auditoria opcionais) e fornecedor (sem dados internos; com tratativa e histórico de devoluções).

Sem links clicáveis pros anexos no PDF — fotos entram como miniatura (pixels), PDFs são listados só por nome. Decisão de segurança: PDF pode ser distribuído.

Limitações conhecidas: sem "Página X de Y" no conteúdo (limitação do window.print()); fotos vão pra página seguinte se não couberem no bloco.

Anexos no Storage (M4.5)
Fotos e PDFs vão pro bucket nc-evidencias, path tenant-{id}/nc-{id}/evidencia-NN.ext.

Signed URL gerada no GET /:id em batch (por criarSignedUrlsEmBatch).

download: false → PDFs abrem em nova aba em vez de baixar.

Anexos antigos (data URI inline) continuam válidos — o gerarSignedUrl detecta data: e devolve como está.

🔐 Multi-perfil, Reset de Senha e Meu Perfil (M4.6 – M4.7)
Multi-perfil
Modelo: usuarios.perfil continua sendo o "principal" (compatibilidade com checks antigos); usuario_perfis guarda o array de perfis do usuário.

JWT: auth.js inclui perfis: [...] no payload. Fallback [decoded.perfil] cobre tokens emitidos antes da migração.

tenantMiddleware: injeta req.perfis (array) e mantém req.userPerfil (single).

requerAdmin (em usuarios.js): aceita se qualquer perfil do usuário é admin.

Frontend: o ModalMeuPerfil e a TelaUsuariosNova usam 6 toggles (com codigo dos 6 perfis canônicos). navItems e PERMISSOES no App.jsx filtram por interseção de perfis.

Reset de senha
Fluxo: "Esqueci minha senha" → backend gera token → email com link → /reset-senha?token=....

Backend: PasswordResetService.js (gerar/validar/consumir token, SHA-256, TTL 1h, rate limit 3/15min por email).

Rotas: POST /api/auth/forgot-password, GET /api/auth/reset-password/validar, POST /api/auth/reset-password.

Resposta sempre 200 no /forgot (não vaza se o email existe).

Serve tenant e fornecedor — encontrarUsuarioPorEmail busca nas duas tabelas.

Frontend: TelaEsqueciSenha.jsx + TelaResetSenha.jsx, rotas via state (authRoute) no App.jsx, não por hash (o Router do app intercepta o hash). Comentarista: se o usuário sai, setAuthRoute(null) fecha.

Meu perfil (M4.7a)
PUT /api/usuarios/me — atualiza nome + telefone do próprio usuário (req.userId do JWT, nunca aceita id no body).

POST /api/usuarios/me/trocar-senha — valida senha atual, atualiza.

Frontend: ModalMeuPerfil.jsx (avatar com iniciais enquanto upload de foto não existe; 2 abas: dados + trocar senha). Botão no rodapé da sidebar abre o modal.

⚠ Ordem de rotas: /me e /me/trocar-senha precisam vir antes de router.put("/:id") e router.post("/:id/...") no usuarios.js — senão o Express casa /me com /:id e o handler tenta fazer SELECT WHERE id = 'me' → 500 UUID.

🚀 Como Rodar
Pré-requisitos:
Node.js 18+, npm, conta Supabase (Postgres + Storage), Git

Iniciar Projeto:
bash
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
Buckets do Supabase Storage:
nc-evidencias (privado) — obrigatório pro módulo de NC. Sem ele, POST /nao-conformidades/:id/anexos falha.

nfe-xmls (privado) — pra XML de NF-e.

✅ Status das Features
✅ Em produção (histórico consolidado)
Autenticação JWT, multi-tenant, cadastro de equipamentos

Repaginação da OS: lista única material+serviço, numeração estável, apontamento de execução persistido

Separação estrutural OS → RM → RC → OV completa

Reserva de estoque + ponte itens_consumo.catalogo_item_id ↔ catalogo_itens

Correção de vazamento de dados no portal do fornecedor

Recebimento com e sem OV, NC, correção de bug de concatenação de saldo

Catálogo do fornecedor (marketplace): CRUD + import CSV

Busca unificada de item na OS (catálogo + marketplace, dual-source, sem curto-circuito)

Recebimento reescrito com tracker visual de 3 etapas (Fiscal → Contagem → Entrada), com entrada_por/entrada_em gravados

itens_consumo criado on-the-fly na primeira entrada

Fuso horário corrigido no histórico de contagens (contado_em virou timestamptz)

Cotações — Fase 1B: edição item a item, CIF/FOB por item, card "Vencedores por Item", Panorama executivo em 3 atos com Saving do Sistema / do Comprador

Fluxos auxiliares da RC: remover/restaurar item, mover item pra nova RC (com herança de cotação), cancelar cotação, trava de edição

Fixes pontuais: excluirCotacao, emails com undefined, bloqueado_em em enviarCotacao, filtro 'cancelado' → 'cancelada'

✅ Em produção (M4.4 – M4.7 — 13/10/2026)
M4.4: emails transacionais de NC (5 eventos, template unificado), bloqueio de OS por NC ativa, modal overlay de bloqueio, chip "Devolvida ao fornecedor", banner "NC ativa" na OS com clique

M4.5: abertura manual de NC (ModalNovaNC), item fora do catálogo com curadoria da Qualidade, vincular-item e editar-item-avulso, anexos no Supabase Storage com signed URL, PDF de NC (interno + fornecedor), contato empresa+comprador no PDF e no portal do fornecedor

M4.6: reset de senha (forgot password com token por email, TTL 1h), multi-perfil (backend + frontend + JWT + migração + varredura single→array), middleware global PATCH → PUT, telefone internacional (react-phone-number-input)

M4.7a: modal "Meu perfil" com abas dados/senha, PUT /api/usuarios/me e POST /api/usuarios/me/trocar-senha

🟡 Em progresso / próximo passo real
#5 Custo de recebimento por NF — diferencial competitivo central

Tela única de consulta de estoque cobrindo consumíveis e peças/componentes juntos

Validar TelaGerarRequisicaoMaterial.jsx na prática com um comprador de verdade usando dados reais

❌ Não iniciado
M4.7b — Dashboard "Analista Sênior" (tela do zero, widgets por perfil, avatar clicável no canto superior direito, upload de foto). TODO marcado no App.jsx.

Tela consolidada de "grande marketplace" pro comprador

Email/WhatsApp automático ao enviar cotação

Dashboard, relatórios

Reativação da aba "Manual" de TelaCotacoesNovaComAbas.jsx

⚠️ Armadilhas Conhecidas do Backend
(Mantidas integralmente da versão anterior + as 4 novas abaixo.)

⚠️ DB.delete só aceita ID único — não compõe filtro
DB.delete(table, id, tenantId) faz .eq("id", id). Não funciona em tabelas N:N (usuario_perfis, cotacao_fornecedores) que não têm coluna id. Bug real: DELETE FROM usuario_perfis WHERE id = '<uuid>' retornava 0 linhas afetadas (nenhuma tinha id), e os perfis antigos ficavam. Corrigido com DB.deleteWhere(table, where, tenantId) (M4.6) — usa DELETE WHERE de verdade. Sempre usar deleteWhere em tabelas N:N.

⚠️ DB.raw cai no fallback genérico
DB.raw() só reconhece um punhado de padrões SQL hardcoded. Qualquer WHERE/ORDER BY fora do reconhecido cai no fallback SELECT * FROM <tabela> ignorando o resto da query. Bug real: GET /usuarios filtrava por ORDER BY criado_em DESC → caía no fallback → devolvia usuários sem a coluna telefone (adicionada depois). Corrigido trocando DB.raw por DB.select + .sort() em JS (M4.5). Regra: se precisa de WHERE além de tenant_id, use DB.select + filtro em JS.

⚠️ DB.select / DB.selectOne ignoram null no filtro
Qualquer null no where é descartado silenciosamente. Sintoma perigoso: DB.selectOne('itens_consumo', { catalogo_item_id: item.item_catalogo_id }) com item_catalogo_id null → vira SELECT * FROM itens_consumo WHERE tenant_id = X LIMIT 1 → devolve o primeiro item do tenant. Sempre validar antes de passar pra DB.selectOne.

⚠️ DB.select NÃO ordena
Ordem devolvida é arbitrária e pode mudar depois de qualquer UPDATE (heap físico do Postgres). Toda lista que o usuário vê precisa de .sort() em JS.

⚠️ Ordem de rotas /me antes de /:id (M4.7a)
Rotas literais (/me, /me/trocar-senha) precisam vir antes de router.put("/:id"). Senão o Express casa /me com /:id e o handler tenta SELECT WHERE id = 'me' → erro UUID.

⚠️ Regra multi-tenant pra tabelas N:N sem tenant_id
Tabelas N:N (usuario_perfis, cotacao_fornecedores) não têm tenant_id. Isolamento é por transitividade via FK do usuário/entidade principal. Nunca consultar essas tabelas sem antes validar que a entidade principal pertence ao req.tenantId. Documentado no topo do db.js.

⚠️ Regra dos Hooks do React
Hooks (useState, useEffect, useX) nunca podem ser chamados depois de um return condicional. O número e a ordem de chamadas têm que ser idênticos em todo render. Bug real em App.jsx: rotas de auth por hash estavam antes dos hooks → React quebrava ao navegar. Corrigido movendo as rotas pra depois de todos os hooks.

(Demais armadilhas mantidas da versão anterior: timestamp without time zone é bug latente; trigger AFTER INSERT que referencia coluna renomeada aborta o INSERT; SQL Editor do Supabase não respeita BEGIN/COMMIT pra DDL; DB.raw() cai em fallback; bigint/numeric voltam como string; apiService.get(endpoint, { params }) é padrão errado; pg_trgm indexabilidade; LANGUAGE sql inlining; DB.insert/DB.update não fazem cast; constraint CHECK em coluna enum-like precisa de migration pra aceitar valor novo.)

## 🗺️ Roadmap / Decisões em Aberto

> **Sem datas.** A ordem abaixo é de prioridade, não de calendário. Cada
> item é atacado conforme tempo e necessidade de cliente.

### Prioridade alta — próximo passo real

- **M4.7b — Dashboard "Analista Sênior"** (TODO no `App.jsx`). Cada perfil vê
  um resumo do próprio dia: comprador (cotações aguardando resposta, OCs
  pendentes, aprovações), qualidade (NCs abertas, respostas de fornecedor,
  curadoria de item), operação (OS abertas, recebimentos, apontamentos),
  gestor (aprovações + KPIs consolidados), financeiro (contas do dia).
  Avatar clicável no canto superior direito → abre `ModalMeuPerfil`.
- **Relatórios PDF gerenciais estilo ISO.** Reaproveita `gerarPdfNC.js`.
  Entrega: PDF de OS, PDF de RC aprovada, PDF de OV, e um **Relatório
  Mensal/Trimestral gerencial** com status de OS / cotações / recebimento /
  NC / manutenções em andamento. **Snapshot imutável** ao gerar (congela o
  JSON analisado + PDF — se o cliente editar OS depois, o relatório do mês
  anterior continua mostrando o que era verdade). Campo "Aprovado por
  [gestor] em [data]" com hash do conteúdo. Agendamento por cron (dia 1º,
  8h, email pro gestor). Auditoria ISO ama.
- **Calendário de Manutenção + MRP.** Visão mês/semana com cards por OS
  (dados já existem em `chamados` e `chamado_itens` — zero migration).
  Botão "Rodar MRP" projeta consumo + custo médio dos últimos 6 meses,
  gera previsão orçamentária. Diferencial de venda forte: "você tem
  R$ 47k de manutenção prevista pro Q1".
- **Export Excel em massa.** OS, RC, OV, NC, itens de estoque. Pequena
  transportadora vive em Excel — tira 30% dos tickets de suporte.
- **M4.8a — IA Embarcada (nível gestor).** Ver seção IA abaixo.

### Prioridade média — features de valor real

- **Validade das propostas.** Portal ganha campo "validade em dias"; monitor
  mostra badge 🟢🟡🔴; panorama avisa se venceu. Sem isso, valores vencidos
  invalidam o cálculo de custo de recebimento.
- **Aging de RC.** RC aberta há 30/60/90 dias gera aviso de cancelamento
  definitivo (o comprador decide se cancela). Sentido falta no SAP, segundo
  o usuário.
- **Webhooks / Zapier / Make.** Endpoints `nc.criada`, `ov.emitida`,
  `rc.aprovada`, `os.concluida`. Cliente conecta sozinho no Zapier/Make —
  custo zero pra você, valor percebido alto ("QuotaFlow integra com tudo").
- **#5 Custo de recebimento por NF.** Campo `custo_recebimento_nf` em
  `tenants`, tela de configuração, 4ª seção no Panorama executivo.
- **M4.8b — IA Embarcada (níveis operacionais).** Só quando houver
  clientes pedindo e métrica de uso dos perfis.
- **Upload de avatar do usuário.** Depende de coluna `usuarios.avatar_url` +
  Storage. Cosmético, mas melhora o onboarding.

### Prioridade baixa — sob demanda de cliente pagante

- **Inspeção de equipamento.** Checklist de pré-viagem (motorista) e check
  periódico (mecânico) + abertura de OS direto do item reprovado. Cuidado
  com UX: precisa funcionar em celular, com internet ruim, com 1 mão.
- **Inspeção de locação.** Reaproveita 90% da inspeção de equipamento — só
  muda o tipo (`pre_viagem | retorno_locacao | periodica`). Só faz sentido
  se ≥ 3 clientes pagantes pedirem.
- **Tela única de consulta de estoque** cobrindo consumíveis + peças juntos.
- **Marketplace monetizado.** Banner + destaque pago ao fornecedor na
  recomendação de cotação. Já tem infra; falta modelo de cobrança.
- **Requisitante abre nova RC referenciando RC bloqueada.** Reusa o fluxo
  do `/mover` que já existe.

### Visão de produto (sem prazo — constrói quando fizer sentido)

**Posicionamento final:** all-in-one-solution para o pequeno transportador
brasileiro — do orçamento comercial até NPS e assistência técnica.

**Onde NÃO entramos (por escolha deliberada):**
- **Fiscal** (NFe/SPed/NFS-e) — barreira regulatória alta, Omie/Conta Azul
  dominam. Integração via API em vez de construção.
- **Financeiro completo** (contas a pagar/receber, conciliação) — mesma
  lógica.
- **RH / Ponto** — fora do nosso problema.

**Onde vamos estender (reaproveitando o que já existe):**
- **Propostas comerciais** — orçamento → OS, reaproveita `chamados` +
  `chamado_itens` com um novo `tipo_documento`.
- **Assistência técnica de cliente final** — mesma OS, muda o destinatário
  (cliente final em vez de equipamento interno).
- **NPS / CSAT** — 1 formulário, 1 email automático, 1 dashboard. Gancho
  de venda forte ("seu cliente final aprovou o serviço com nota 9,2/10").
- **Benchmarking setorial anônimo** — quando houver 20+ tenants ativos,
  comparar contra a média do setor em vez de contra o próprio histórico.

**Decisão de verticalização vs. plataforma** fica pra quando houver 200-500
clientes pagantes. Não antecipar.

### M4.8 — IA Embarcada (arquitetura detalhada)

**Objetivo:** agente que analisa dados **agregados** do tenant e entrega ao
gestor (e, em versão resumida, aos demais perfis) uma leitura "analista
sênior": onde investir, o que está indo bem, o que pode melhorar, e alertas
de comportamento atípico (compliance operacional).

**Arquitetura de 2 camadas (custo controlado):**
1. **Camada SQL (grátis):** queries agregadas no Postgres geram um "resumo
   estruturado" — KPIs por período, tendências, desvios de média, top
   fornecedores, custo por categoria, NCs por origem, aging de RC/OV,
   reincidência de item, economia acumulada.
2. **Camada LLM (paga por análise):** só o resumo agregado (2-5k tokens)
   vai pro modelo. Prompt com persona "analista sênior de compras" +
   framework SWOT. **Nunca envia dado bruto.**

**Exemplo real de cruzamento que só essa arquitetura produz:**
> "50% das cotações do trimestre terminaram com fornecedor único, apesar de
> a média de participação ser 2,4 fornecedores por cotação. Dessas, 80%
> tiveram renegociação só com esse fornecedor. **Padrão atípico** —
> vale revisar o processo de convite ou checar dependência de fornecedor."

Esse cruzamento existe em SQL (2 queries + 1 merge). O LLM só interpreta o
resumo. **Custo por análise: < R$ 1.**

**Gatilhos de disparo (não é "a IA analisa o banco todo"):**
- Fim de mês / trimestre / ano → gera relatório SWOT + recomendações.
- Sob demanda (gestor clica "Analisar período").
- Alertas de compliance rodam **em background** (diário/semanal) e geram
  fila de revisão.

**Escopo por perfil (gated):**
- **Gestor / Admin:** SWOT completa (operacional + tática + estratégica),
  recomendações de investimento, análise de fornecedor, alertas de
  compliance comportamental.
- **Comprador / Qualidade / Operação:** 1 análise/semana em cache — resumo
  do próprio setor.
- **Limite por plano:** Essencial = 2 análises/mês; Operação = 8/mês;
  Completo = 30/mês; Enterprise = ilimitado com fair use.

**Compliance / anomaly detection (fase 2):**
- Padrões suspeitos: OS abertas fora do horário, RC emergencial recorrente
  do mesmo requisitante, fornecedor único em categoria competitiva,
  aprovação em cadeia por mesma pessoa, NC "resolvida" rápido demais,
  consumo de estoque sem OS vinculada.
- Saída sempre em linguagem neutra: **"padrão atípico detectado"** — nunca
  "funcionário X fez Y". Decisão final é sempre humana.
- Log de auditoria de quem consultou cada alerta.

**Monetização recomendada:**
- Add-on IA: +R$ 149/mês (5 análises incluídas)
- Pacote extra: R$ 39 por 10 análises adicionais
- Enterprise: ilimitado com fair use

**Pré-requisitos técnicos:**
- Tabela `ia_analises` (`tenant_id | tipo | periodo | resumo_sql (jsonb) |
  resposta_llm (text) | custo_tokens | criado_em | criado_por`) — cache de
  análise, evita reprocessar.
- Endpoint `POST /api/ia/analisar` com rate limit por tenant/plano.
- Chave do provedor (OpenAI/Anthropic/Groq) em env var, com fallback por
  tenant (Enterprise pode usar chave própria).
- Painel admin pra ver custo acumulado por tenant (se virar lucro negativo,
  corta antes).
- **A IA vende o PDF:** "Exportar análise como PDF" reaproveita
  `gerarPdfNC.js`. Custo zero, valor percebido alto.

**M4.8a (gestor) antes de M4.8b (demais perfis).** Motivo: cliente precisa
de 6+ meses de dado acumulado pra IA ter o que analisar. M4.8a faz sentido
depois que a base tiver histórico. M4.8b só quando houver pedido real.

### Outras decisões em aberto

- **Amarração de busca a Equipamento** (ranking, não filtro rígido). Só
  faz sentido quando `catalogo_itens.marca/modelo/ano_fabricacao_*` estiver
  povoado — hoje está majoritariamente vazio. Equipamento selecionado no
  topo da OS vira **boost de ranking**, nunca filtro que esconde opção.
- **Normalização de catálogo entre fornecedores** (`pn_raw` é por fornecedor;
  não há PN canônico cross-fornecedor). Decisão ainda em aberto — resolve
  via `normalizar_pn` + curadoria humana, ou via um dicionário próprio.
- **Backend sem auto-restart em dev.** Considerar `nodemon` (dev) e `pm2`
  (prod). Hoje, se o processo cai, o app para.
- **Higiene:** `POST /signup` não cria linha em `usuario_perfis` (fallback
  cobre, mas fica feio se um dia listar).

### Deferidos (intencional, não é pendência ativa)

- Estilo visual do seletor "Programação da OS"
- Toggle de "verificar estoque no ato da programação" por tenant
- Limpeza de `ordens_servico` / `ordem_servico_itens` (órfãs)
- Decidir se apontamento de execução vira histórico versionado
- Remoção de `/api/cotacao/:token` inline em `server.js` (provável código morto)
- Drag-and-drop pra reordenar itens da OS
- **Merge de email duplicado** entre `usuarios` e `fornecedor_usuarios` (caso
  apareça de novo — solução conhecida: renomear/desativar o lixo)
- **PATCH diferenciado de PUT** (hoje o middleware normaliza tudo — remover
  só se algum dia precisar de update parcial real)
- **Decidir modelo de monetização da IA:** add-on vs. incluso vs. híbrido
  (hoje recomendação: híbrido — 5 grátis/mês + pacote extra)

📞 Contatos do Projeto
Desenvolvedor: Marcony
Plataforma: QuotaFlow
Última atualização deste documento: 13/10/2026

text

---

## Resumo do que mudou

**Novo:**
- Seções 7 (NC) e 8 (Multi-perfil / Reset / Meu perfil) completas
- Stack atualizada (Storage, react-phone-number-input)
- 4 armadilhas novas documentadas (`DB.deleteWhere`, `DB.raw` fallback, `/me` antes de `/:id`, ordem dos Hooks)
- Roadmap reorganizado (M4.7b, nodemon/pm2, higiene)

**Mantido:**
- Visão geral, segmentação de clientes, arquitetura, `apiService` convenção
- Fluxo OS → RM → RC → OV inteiro
- Marketplace + busca unificada
- Todas as armadilhas antigas
- Todas as decisões em aberto (roadmap)

**Não inventei nada** — só consolidei o que a gente fez. Se algum trecho estiver diferente do que você lembra, me avisa que ajusto.

## Depois

1. **Substitui o README.md** pelo conteúdo acima
2. **Commit específico do README**:
   ```bash
   git add README.md
   git commit -m "docs: atualiza README (M4.4 – M4.7a)"
   git push origin main