# Entrega 18y — 🚛 contrato de locação → mobilização → AT · 📈 faturamento previsto

**Base:** origin/main 5817663 (18x).

## 1. Supabase
Rode `backend/migrations/079_contrato_mobilizacao.sql`. É idempotente.

## 2. Conferir
Rode `cd backend && node verificar-entrega.js`. Antes do commit aparecem os avisos dos 3 arquivos novos fora do git, que é normal.

## 3. Testar
1. **📑 Contratos → abra um contrato ativo com equipamentos.** Na seção "🚛 Mobilização e desmobilização", clique em **＋ Mobilização**:
   - pátio/base (fica guardado no contrato);
   - local da obra (em branco = o local do contrato);
   - data, valor (opcional) e os equipamentos;
   - depois clique em "Criar e ir programar".
2. **Na ficha:** aparece o movimento com "⏳ AT a programar · abrir 🚛 Programação".
3. **Em 🚛 Programação:** o pedido "Movimentação do contrato CL-…" aparece com o trecho "🚛➡️ Mobilização — CL-…" (pátio → obra) e as máquinas.
   - Programe a AT normalmente: motorista, conjunto, documentos.
   - De volta ao contrato, a AT aparece no movimento.
4. **＋ Desmobilização:** entra no mesmo pedido, com a rota invertida (obra → pátio).
5. **📈 Faturamento previsto**, botão na aba Contratos:
   - mostra 3, 6 ou 12 meses, por contrato e total;
   - o primeiro mês é proporcional ao dia de início;
   - avisa os equipamentos sem valor mensal;
   - clicar no cliente abre o contrato.
