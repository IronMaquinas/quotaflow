# Entrega 15c.2 — aceite mais caloroso, sem banner, aditivo seguro

Base: GitHub na **15c.1** (commit `4abaef3`, 186 ✓).

## O que muda
- **E-mail de aceite ao cliente:**
  - Assunto `✅ Aceite confirmado — BID-… — <título> · pedido PV-…`.
  - Corpo: agradecimento, quem aceitou, data e hora, versão, nº do pedido, valor, tabela por trecho, próximos passos, botão para ver/imprimir, contatos (seus e da empresa) e o código de integridade.
  - No aditivo, o e-mail diz que o pedido já foi atualizado.
  - O responsável não recebe mais o "… aceitou" duplicado; o "🎉 Parabéns! … pedido gerado" já avisa.
- **Sem banner no Funil.**
  - O pedido novo (até 3 dias) aparece como selo "1 novo" na aba 🧾 Pedidos e "🆕 novo" na lista.
  - O cartão aceito no kanban ganha "🧾 Pedido gerado".
- **Aditivo:**
  - **➕ Criar aditivo** pergunta antes e explica o que acontece.
  - Enquanto o aditivo não foi enviado, aparece **🗑 Descartar aditivo**. Ele é apagado e o pedido não muda.
  - Depois de enviado, o botão vira **✕ Encerrar aditivo**. Ele encerra só o aditivo; o pedido continua como está.
  - No aditivo dá para **incluir, retirar e ajustar** itens. Só não dá para retirar ou mudar o valor de item já programado, em execução ou concluído.
- **✕ Cancelar pedido** sempre abriu uma confirmação com motivo obrigatório. Nada mudou aí.

## Como aplicar
1. Na pasta `backend`, rode `node verificar-entrega.js --antes`. Tem que dar ✓ nos 6 arquivos.
2. Copie os arquivos do zip e rode `node verificar-entrega.js`. Tem que dar ✓ nos 186.
3. Não há migration. Faça o commit e o push.

## Para limpar o aditivo de teste
Abra o pedido → **📎 Abrir o aditivo em andamento** → **🗑 Descartar aditivo**. Isso funciona porque ele ainda não foi enviado.
