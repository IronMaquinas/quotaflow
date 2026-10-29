# Entrega 16b — rota no BID + 🧩 Mesa de programação

Este zip já inclui tudo da 16a e da 16a.1 (comparado com o GitHub). **Sem migration nova** (a 055 continua valendo).

## Como aplicar
1. Copie os arquivos do zip por cima do projeto. Se ainda não rodou a `055_execucoes_at.sql`, rode antes.
2. Reinicie o backend. `cd backend && node verificar-entrega.js` → **194 ✓**.
3. No Supabase, rode na ordem (os dois arquivos estão na raiz do zip e não vão para o repositório):
   - `corrigir-titulo-trecho.sql` (se ainda não rodou): corrige "Minas Gerai" → "Minas Gerais";
   - `rota-trechos-bid-teste.sql`: grava Capuaba ➜ Expominas na ida e o inverso na volta, no pedido e no BID de teste.

## O que testar
1. **BID** (📈 Comercial): cada trecho tem 📍 Coleta e 🏁 Entrega. "⧉ Duplicar" cria o retorno com os endereços invertidos. 👁 Rascunho / PDF e o link do cliente mostram a rota debaixo do nome do trecho.
2. **Pedido**: a ficha mostra a rota de cada trecho.
3. **🚛 Programação → 🧩 Mesa de programação**: no trecho de ida aparecem os 3 itens, cada um numa linha, com coleta/entrega e data já preenchidas.
   - Escolha motorista e conjunto em cada linha. A coluna **Situação** mostra na hora: ✓ pronto, 🔴 (justificativa na própria linha, só gestor/admin), ⚠ conflito (inclusive o mesmo cavalo em duas linhas) com "programar mesmo assim".
   - "⛓ no mesmo conjunto de cima" junta dois itens numa AT só.
   - **🚛 Programar N ATs prontas** grava todas de uma vez. As ATs passam a aparecer na grade; clique abre a ficha (PDF, iniciar, anexos).
   - Deixe uma linha pela metade, saia e volte: ela continua preenchida (rascunho neste navegador).
4. Documentos NF-e/CT-e/MDF-e aparecem cinza (pendência) até serem anexados na ficha; não impedem nada.
