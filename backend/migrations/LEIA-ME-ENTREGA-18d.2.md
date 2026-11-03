# Entrega 18d.2 — 📏 Medição simplificada (substitui a 18d.1)

## Como aplicar
1. Rode no Supabase, nesta ordem (as duas são idempotentes):
   - a `backend/migrations/062_medicao_locacao.sql`, se ainda não rodou;
   - a `backend/migrations/063_medicao_vencimento.sql`.
2. Copie o zip por cima do projeto, inclusive o `backend/verificar-entrega.js`.
3. Rode `cd backend && node verificar-entrega.js` → "Todos os 225 arquivos".

## O que mudou
- **O sistema monta a medição** de cada ciclo dos contratos ativos, por equipamento:
  - valor mensal do contrato;
  - dias no ciclo;
  - valor recomendado proporcional (ex.: entrou dia 15 → 17/31 do mensal).
- **Faixa "📏 Medições para revisar e enviar"** na aba Contratos. As medições aparecem ali já prontas.
- **O comercial revisa o valor a cobrar** e as observações, e então:
  - **📤 Envia ao cliente**, se o contrato tiver marcada a "Aprovação da medição pelo locatário";
  - ou só **✓ Fecha**, se não tiver.
- **O cliente recebe o e-mail** e vê a pendência em **📏 Medições**. Ele **✓ Aprova** ou **✕ Contesta**, comentando na linha do item. A medição contestada volta para o comercial, que ajusta e reenvia.
- **Contrato → Editar:** novo campo "Vencimento da cobrança: dia".
- **Saíram da tela:** o escopo por hora/dia e o "programado × realizado". Continuam no banco para o futuro.

## Como testar
1. Num contrato com valores mensais por equipamento, abra 📑 Contratos. A faixa mostra a medição do mês com o total.
2. Abra a medição, mude um "valor a cobrar" e **✓ Feche**.
3. Edite o contrato e marque "Aprovação da medição pelo locatário". Abra outra medição e **📤 Envie ao cliente**.
4. Entre como o locatário → **📏 Medições**:
   1. Abra a medição.
   2. Comente numa linha e clique em **✕ Contestar**.
5. Volte como gestor. A medição contestada vem primeiro: ajuste e **📤 Reenvie**.
6. Entre de novo como o locatário e **✓ Aprove**.

## Arquivos
- backend:
  - migrations/063_medicao_vencimento.sql (novo)
  - services/medicoes.js
  - services/contratosLocacao.js
  - routes/contratos.js
  - routes/locatario.js
  - verificar-entrega.js
- frontend:
  - components/contratos/MedicaoModal.jsx
  - components/contratos/TelaContratos.jsx
  - components/contratos/TelaLocatario.jsx
  - utils/gerarMedicao.js
- readme.md
