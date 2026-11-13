# Entrega 18z.5 — 📦 Pátio: comprovante, ficha de movimentação e área (m²)

**Base:** origin/main fe477b8 (18z.4). Suba **todos** os arquivos do zip, inclusive o `backend/verificar-entrega.js`. Nas duas últimas entregas ele ficou de fora do commit, e o verificador acusava o TelaPatio sem motivo.

## 1. Supabase
Rode `backend/migrations/083_patio_area.sql`. É idempotente.

## 2. Testar
1. **Ficha do equipamento:**
   - confira o bloco 🧾 Nota fiscal de entrada, que aparece sempre, com a NF ou com o aviso "sem NF";
   - use ✎ alterar para informar local e área;
   - use 🖨 Comprovante de entrada (e o de saída, para um equipamento que já saiu).
2. **📊 Movimentação:**
   - escolha cliente e período e confira saldo inicial, entradas, saídas, saldo final, equipamento·dia e m²·dia;
   - clique num movimento ou num equipamento para abrir a ficha;
   - gere a 🖨 Ficha (PDF) e o ⬇ CSV.
3. **＋ Entrada no pátio:**
   - preencha o novo campo Área ocupada (m²);
   - depois de registrar, a ficha não abre mais sozinha.
