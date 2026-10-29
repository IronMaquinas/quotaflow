# Entrega 16a — 🚛 Programação / AT por trecho

## Como aplicar
1. Copie os arquivos do zip por cima do projeto (mesmas pastas).
2. No SQL Editor do Supabase, rode **`backend/migrations/055_execucoes_at.sql`** (pode rodar 2×).
3. Reinicie o backend. No frontend, nada a instalar.
4. Confira: `cd backend && node verificar-entrega.js` → **193 ✓**.

## O que testar
1. Entre como **operação** (ou gestor/admin) → menu **🚛 Programação** → aba **📋 A programar**: aparecem os pedidos abertos e os trechos. Não aparece nenhum valor em R$.
2. **🚛 Programar** um trecho: preencha coleta/entrega, escolha motorista e conjunto.
   - Equipamento bloqueado por inspeção aparece com 🔒 e não pode ser escolhido.
   - Motorista 🔴: como **operação**, a tela pede um gestor; como **gestor/admin**, aparece a caixa de justificativa (≥ 15 caracteres) → "🔓 Liberar e programar".
3. Programe outro trecho com o **mesmo cavalo ou motorista** em datas que se cruzam → aparece "⚠ Conflito de agenda" → "Programar mesmo assim".
4. **🗓 Agenda da frota**: o conflito fica em vermelho; ◀ ▶ trocam a semana.
5. Na ficha da AT: anexe NF-e/CT-e/MDF-e, **📄 PDF da AT**, **▶ Iniciar**, **✓ Concluir**, **✕ Cancelar** (motivo), **↺ Reabrir**.
6. No **📈 Comercial → Pedidos**, abra o pedido: cada trecho mostra a AT; o status dos itens fica travado ("controlado pela AT") e muda sozinho ao iniciar/concluir.

## Arquivos
Novos: `backend/migrations/055_execucoes_at.sql`, `backend/services/execucoes.js`, `backend/routes/programacao.js`, `frontend/src/components/programacao/TelaProgramacao.jsx`, `frontend/src/components/programacao/FichaAT.jsx`, `frontend/src/utils/gerarAT.js`.
Alterados: `backend/server.js`, `backend/routes/comercial.js`, `backend/services/bids.js`, `backend/services/pedidosVenda.js`, `frontend/src/App.jsx`, `frontend/src/components/comercial/FichaPedido.jsx`, `backend/verificar-entrega.js`, `readme.md`.

## Observações
- `tipo_execucao` já existe no modelo de BID/PV (transporte, locação, serviço, venda); só **transporte** gera execução nesta etapa. O select no editor de modelos fica para quando locação/serviço entrarem.
- O motorista logado vendo as próprias ATs fica para a 17a.
