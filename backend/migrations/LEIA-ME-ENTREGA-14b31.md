# Entrega 14b.3.1 — 👥 Clientes (um por CNPJ/CPF) · busca na Receita · máscaras · card de equipamento como antes

Aplique **por cima da 14b.3**.

## O que muda
- **Novo contrato começa pelo CNPJ/CPF** (com máscara) → **🔍 Buscar**:
  - se já é seu cliente → "✓ Já é seu cliente" e o contrato usa o **mesmo cadastro** (só pede obra, contato deste contrato e datas);
  - se não é → busca na Receita (BrasilAPI → CNPJ.ws) e preenche nome, razão social, endereço, cidade/UF, CEP, e-mail e telefone para conferir;
  - CPF, Receita fora do ar ou "cliente sem CNPJ/CPF" → preenche na mão.
- Aba **👥 Clientes** dentro de 📑 Contratos (lista, ＋ Cliente, editar).
- Telefone com bandeira 🇧🇷 + máscara no contrato, no cliente e no acesso do locatário.
- O card do equipamento (🔍 Inspeções) voltou ao layout anterior, com "Histórico (n)".
- Os contratos já criados ganham o cliente na migration.

## Como aplicar
1. **Supabase → SQL Editor:** rode `backend/migrations/044_clientes.sql` (pode rodar de novo).
2. Copie os arquivos por cima.
3. Novos no git:
   ```
   git add backend/services/clientes.js backend/migrations/044_clientes.sql frontend/src/components/contratos/Clientes.jsx
   ```
4. `cd backend && node verificar-entrega.js` → **139 arquivos OK**.
5. Reinicie o backend.

## Teste
1. 📑 Contratos → ＋ Novo contrato → digite um CNPJ real → 🔍 Buscar → dados da Receita → salve.
2. ＋ Novo contrato de novo com o **mesmo CNPJ** → "✓ Já é seu cliente" → salve → em 👥 Clientes aparece **um** cliente com 2 contratos.
3. O contrato de teste que você criou antes (CNPJ com dígitos a mais) aparece em 👥 Clientes; corrija o CNPJ por lá se quiser.

## Árvore
```
backend/
  verificar-entrega.js
  routes/contratos.js
  services/ clientes.js (novo) · contratosLocacao.js
  migrations/ 044_clientes.sql (novo)
frontend/src/components/
  contratos/ Clientes.jsx (novo) · TelaContratos.jsx
  inspecoes/TelaInspecoes.jsx
readme.md
```
