# Entrega 14b.3 — 📑 Contratos de locação + perfil Locatário

## O que vem
- **Menu 📑 Contratos:** contrato CL-2026-0001 (cliente, obra, contato, início, fim previsto) com:
  - 🚜 **equipamentos** — ＋ Equipamento (loca um da base dentro do contrato + rotina do locatário), 🏠 Devolver;
  - 👤 **acessos do locatário** — ＋ Acesso (nome, e-mail, senha temporária → usuário com perfil **Locatário**), ⏸ Pausar / ▶ Reativar, 🗑 tirar o acesso;
  - **Encerrar contrato** — devolve o que ainda está locado e oferece pausar os acessos que ficaram sem contrato.
- **Locatário** entra no QuotaFlow e vê só **📑 Meus contratos**: os equipamentos dele, a inspeção de rotina (em dia / atrasada), 🔍 Inspecionar (funciona sem internet), as inspeções feitas (detalhe e relatório) e 👤 Meu perfil (trocar a senha). Não conta na cobrança.
- **Segurança:** o servidor só deixa o locatário chamar a área dele, e tudo é filtrado pelo usuário logado.
- 📍 Locar (Inspeções) agora escolhe o contrato. Botões do card do equipamento numa linha só.
- Troca de senha no primeiro acesso: **não obrigatória** (como o colaborador). Se quiser obrigar, me avise.

## Como aplicar
1. **Supabase → SQL Editor:** rode `backend/migrations/043_contratos_locatario.sql` (pode rodar de novo).
2. Copie os arquivos por cima.
3. Novos no git:
   ```
   git add backend/services/contratosLocacao.js backend/routes/contratos.js backend/routes/locatario.js \
     backend/migrations/043_contratos_locatario.sql frontend/src/components/contratos
   ```
4. `cd backend && node verificar-entrega.js` → **136 arquivos OK**.
5. Reinicie o backend.

## Roteiro de teste
1. 📑 Contratos → ＋ Novo contrato (cliente "Construtora Teste") → abre o CL-2026-0001.
2. ＋ Equipamento → escolha um da base + rotina semanal com um checklist → aparece em 🔍 Inspeções como 📍 Locado — Construtora Teste.
3. ＋ Acesso → nome, um e-mail que não seja de usuário do sistema, senha "123456".
4. Saia e entre com esse e-mail → só aparece "📑 Meus contratos" → 🔍 Inspecionar → conclua → aparece em "📋 Inspeções" (dele) e, na empresa, em 🔍 Inspeções como "locatário — Construtora Teste · CL-…".
5. Crie um **segundo** contrato com outro acesso e confira que um locatário não vê o contrato do outro.
6. Volte como gestor → Encerrar contrato → o equipamento volta para a base e aparece "⏸ Pausar os acessos?" → Pausar → o locatário não entra mais.

## Árvore
```
backend/
  server.js · verificar-entrega.js · middleware/tenantMiddleware.js
  routes/ contratos.js (novo) · locatario.js (novo)
  services/ contratosLocacao.js (novo) · rotinasInspecao.js · inspecoes.js · plataformaConsole.js
  migrations/ 043_contratos_locatario.sql (novo)
frontend/src/
  App.jsx
  components/contratos/ TelaContratos.jsx (novo) · TelaLocatario.jsx (novo)
  components/inspecoes/ TelaInspecoes.jsx · RotinasLocacao.jsx
readme.md
```
