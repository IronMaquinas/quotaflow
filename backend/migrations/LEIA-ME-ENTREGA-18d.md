# Entrega 18d — 📏 Medição mensal do contrato de locação

## Como aplicar
1. Rode no Supabase a `backend/migrations/062_medicao_locacao.sql` (idempotente).
2. Copie o zip por cima do projeto, inclusive o `backend/verificar-entrega.js`.
3. Rode `cd backend && node verificar-entrega.js` → "Todos os 224 arquivos".

## O que mudou
- **Contrato → ✏ Editar → "📏 Medição e inspeções":**
  - ciclo de medição (☑ Mês do calendário, ou o dia de início);
  - **Checklist pelo locatário**;
  - **Medição pelo locatário**.
- **Atenção ao toggle de checklist:**
  - contratos que já tinham rotina feita pelo locatário vêm com o checklist marcado;
  - nos demais, a rotina criada ao locar um equipamento passa a ser da **empresa** até você marcar o toggle.
- **Escopo por equipamento** (no detalhe do contrato, em "📏 … ✏ definir"): por hora, por dia ou valor fixo mensal, com a quantidade programada por ciclo e o valor unitário (opcional).
- **Seção 📏 Medições** no contrato e faixa **📏 Medições pendentes** na aba Contratos.
- **Na medição:**
  - programado × realizado por equipamento;
  - **↻ Repetir programado**;
  - observações;
  - informativo de inspeções e horímetro;
  - **🖨 Boletim de Medição** (PDF).
- **Fluxo sem o toggle de medição:** a empresa lança e aprova.
- **Fluxo com o toggle de medição:**
  1. O locatário preenche na aba **📏 Medições** e envia.
  2. A empresa aprova ou devolve com motivo.
  3. Uma medição aprovada pode ser reaberta, com motivo.
- **Lembretes ao locatário**, no e-mail das 7h:
  - medição do ciclo encerrado;
  - inspeção do locatário atrasada.

## Como testar
1. Edite um contrato. Deixe "Mês do calendário" marcado e salve.
2. No detalhe do contrato, defina o escopo de um equipamento, por exemplo "Por hora · 200".
3. Em 📏 Medições, clique no ciclo atual ("＋ abrir"). Use **↻ Repetir programado**, mude um valor e **✓ Aprove**. Abra o **🖨 Boletim de Medição**.
4. Marque **Medição pelo locatário** no contrato.
5. Entre com o login do locatário: a aba **📏 Medições** aparece. Abra um ciclo, preencha e **📤 Envie**.
6. De volta como gestor:
   1. A faixa "📏 Medições pendentes" mostra a medição enviada.
   2. Devolva com um motivo.
   3. Como locatário, corrija e reenvie.
   4. Como gestor, aprove.

## Arquivos
- backend:
  - migrations/062_medicao_locacao.sql (novo)
  - services/medicoes.js (novo)
  - services/contratosLocacao.js
  - services/rotinasInspecao.js
  - routes/contratos.js
  - routes/locatario.js
  - routes/recomendacoes.js
  - server.js
  - verificar-entrega.js
- frontend:
  - components/contratos/MedicaoModal.jsx (novo)
  - utils/gerarMedicao.js (novo)
  - components/contratos/TelaContratos.jsx
  - components/contratos/TelaLocatario.jsx
- readme.md
