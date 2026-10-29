# Entrega 15c — Pedido de Venda + aditivo pelo link

Base: GitHub na **15b.4** (commit `7475f12`, verificador 182 ✓).

## O que vem
- **O PV nasce sozinho** quando o cliente aceita o BID, seja pelo link ou pelo "⋯ aceite fora do sistema".
  - O pedido usa os itens, valores e condições da versão aceita.
  - O responsável, os gestores e os admins recebem o e-mail "🎉 Parabéns! … O pedido PV-… foi gerado".
  - O 📊 Funil mostra o aviso "🎉 … aceito!", com o botão **Abrir o pedido**.
- **📈 Comercial → 🧾 Pedidos:**
  - A lista mostra, para cada pedido, o status, os itens por status, a próxima execução e os aditivos.
  - Na ficha, cada item tem um **status**: a programar → programado → em execução → concluído | cancelado. Por enquanto a mudança é manual; a AT da 16a vai atualizar sozinha.
  - A ficha também tem 📄 PDF do pedido e ✕ cancelar (com motivo).
- **➕ Aditivo pelo link:**
  - Cria o `PV-…-A1` com os itens atuais do pedido. Você inclui, retira ou ajusta e faz 📨 Revisar e enviar.
  - O cliente vê "📎 Aditivo 1 ao pedido … — o que muda" e responde e assina como no BID.
  - Quando ele aceita, **o pedido é atualizado sozinho**, e o histórico mostra valor antes → depois e o que mudou.
- Item programado, em execução ou concluído **não pode sair** num aditivo nem mudar de valor.
- O BID aceito mostra o botão **🧾 Abrir o pedido**. Os BIDs aceitos antes desta entrega mostram **🧾 Gerar o pedido de venda**.
- O Cliente 360° mostra os pedidos.

## Como aplicar
1. **Migration** no SQL Editor do Supabase: `backend/migrations/053_pedidos_venda.sql`. Pode rodar 2×.
2. Na pasta `backend`, rode `node verificar-entrega.js --antes` com o verificador deste zip. Tem que dar **✓ 7 arquivos**.
3. Copie os arquivos do zip por cima do projeto e rode `node verificar-entrega.js`. Tem que dar **✓ 185 arquivos**.
4. `git add` dos novos:
   - `backend/migrations/053_pedidos_venda.sql`
   - `backend/services/pedidosVenda.js`
   - `frontend/src/components/comercial/FichaPedido.jsx`

   Depois faça o commit, o push e o deploy.

## Como testar
1. Num BID com o cliente, aceite pelo link: Aprovar todos → código → assinatura.
   - Chega o e-mail "🎉 Parabéns!" para você e para os gestores.
   - O Funil mostra o aviso do pedido novo.
2. **Abrir o pedido:**
   - Confira os itens, o valor e a origem (BID, versão e quem aceitou).
   - Mude um item para **Programado**. O pedido passa para "Em execução".
3. **➕ Criar aditivo:**
   - Abre a ficha `PV-…-A1`, com a faixa roxa "Aditivo 1 … em elaboração".
   - Tente tirar o item programado → **Revisar e enviar**: o checklist bloqueia.
   - Agora, em vez disso, mude o valor de outro item e inclua um item novo → envie.
4. No link do cliente aparece "📎 Aditivo 1 ao pedido … — o que muda". Aceite com código e assinatura.
   - O pedido é atualizado: o valor muda, o item novo entra como "a programar" e o programado continua programado.
   - O histórico mostra "Aditivo 1: R$ X → R$ Y".
   - Chega o e-mail "📎 Aditivo 1 ao pedido … aceito".
5. **📄 PDF do pedido.** Também teste o ✕ cancelar com um item em execução: o sistema bloqueia.
6. Um BID aceito na 15b, antes desta entrega: abra a ficha → **🧾 Gerar o pedido de venda**.

## Observações
- O status dos itens é manual até a **16a**. A AT de cada trecho vai atualizar programado → em execução → concluído.
- Os aditivos não aparecem no kanban nem nos indicadores do funil, para não contar a mesma venda duas vezes. Eles ficam na ficha do pedido.
- Quem vê os pedidos: admin, gestor e comercial. A operação vai ver o serviço **sem valores** na AT.

## Arquivos
```
backend/
  migrations/053_pedidos_venda.sql   (novo)
  services/pedidosVenda.js           (novo)
  services/bids.js                   (aditivo fora do funil; PV no detalhe e no cliente 360°)
  services/bidsCliente.js            (aceite → PV; aditivo: texto, validação, "o que muda")
  routes/comercial.js                (rotas /pvs)
  verificar-entrega.js               (15c — 185 arquivos)
frontend/src/
  components/comercial/FichaPedido.jsx (novo)
  components/comercial/TelaComercial.jsx (aba 🧾 Pedidos, aviso no Funil, pedidos no cliente 360°)
  components/comercial/FichaBid.jsx  (abrir/gerar o pedido; aditivo)
  TelaBidPublica.jsx                 (aviso do aditivo)
  utils/gerarBid.js                  (PDF do pedido)
readme.md                            (15c + tabela do roadmap atualizada)
```
