# Entrega 18zb — 📦📑 Contrato de armazenagem separado (CA-)

**Base:** origin/main f721893 (18za.1). Suba **todos** os arquivos, inclusive o `backend/verificar-entrega.js`.

## 1. Supabase
Rode `backend/migrations/086_contrato_armazenagem_tipo.sql`. É idempotente. Ela:
- cria o tipo de contrato;
- cria o campo de área máxima;
- desliga a "guarda" de dentro dos contratos CL;
- coloca o modelo-base de armazenagem na biblioteca.

## 2. Biblioteca de modelos
1. Em 📑 Contratos → Modelos, importe **"Armazenagem de área — modelo-base"**.
2. Revise o texto com o jurídico.

## 3. Testar
1. **Criar o contrato:**
   - use **＋ 📦 Contrato de armazenagem** e crie um contrato para a Iron Maquinas. O número sai **CA-2026-0001**;
   - na ficha aparecem as **📐 Condições da armazenagem**, sem equipamentos e sem mobilização;
   - em ✎ Editar condições, informe preço (R$/m²·mês), área mínima e área máxima, por exemplo 10 m².
2. **Documento:** escolha o modelo importado, confira a 👁 Prévia (preço e áreas no texto) e use 📄 Emitir. O fluxo de aceite é o mesmo do CL.
3. **📦 Pátio:**
   - abra ＋ Entrada no pátio para a Iron Maquinas e informe os m²;
   - antes de salvar aparece "CA-…: usa X de 10 m²";
   - passe do máximo: aparece o aviso vermelho, mas registra mesmo assim;
   - o gestor recebe 🔔. O admin e quem fez a entrada não recebem;
   - confira o saldo por cliente (m² usados/máximo) e o Cabe? escolhendo o cliente.
4. **Medição do CA:** abra a medição do ciclo e confira os itens por equipamento e o complemento da área mínima.
5. **Contrato CL antigo:** a guarda que você ligou na 18za não aparece mais. A cobrança passa a ser pelo CA.
