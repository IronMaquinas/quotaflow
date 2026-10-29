# Entrega 15c.1 — tarefa para um usuário + contatos no e-mail

Base: GitHub na **15c** (commit `a906e6e`, verificador 185 ✓).

## O que muda
- **⏰ Tarefa com "Para quem?"**
  - Digite o nome e a lista sugere os usuários comercial, gestor e admin. Se deixar vazio, a tarefa fica para você.
  - Quem recebe a tarefa é avisado por e-mail e a vê em 📊 Funil → ⏰ Tarefas. O filtro "só as minhas" mostra as tarefas atribuídas a você.
- **E-mail do pedido aceito:** vai para o responsável e para os gestores. O admin não recebe mais.
- **E-mail ao cliente:**
  - O rodapé traz 📞 telefone e ✉ e-mail de quem emitiu o BID. O telefone vem da assinatura ou do cadastro do usuário.
  - Também traz o telefone e o e-mail da empresa (⚙️ Configurações → Empresa).
  - O endereço abaixo do botão agora também é um link, então o `#` não corta mais.
- **Página do cliente:**
  - Contatos clicáveis (ligar, mandar e-mail).
  - Quando o cliente escolhe "Pedir revisão" e esquece de preencher **"O que revisar?"**, o campo fica vermelho e a mensagem diz o que falta.

## Links (localhost × produção)
Todos os links (e-mail, link do cliente, botões) são montados com o `FRONTEND_URL` do `.env`:
- no Mac: `FRONTEND_URL=http://localhost:5173`;
- no Render: o endereço público (ex.: `https://app.quotaflow.com.br`).

Não é preciso mudar nada no código.

O endereço do localhost aparecia "cortado" porque o Gmail só transforma em link automático o que tem domínio com ponto. Em produção isso já não aconteceria, e agora o endereço vai como link de qualquer forma.

## Como aplicar
1. **Migration** no SQL Editor do Supabase: `backend/migrations/054_tarefa_atribuida.sql`. Pode rodar 2×.
2. Na pasta `backend`, rode `node verificar-entrega.js --antes`. Tem que dar ✓ nos 6 arquivos.
3. Copie os arquivos do zip e rode `node verificar-entrega.js`. Tem que dar ✓ nos 186 arquivos.
4. `git add backend/migrations/054_tarefa_atribuida.sql`, depois commit e push.

## Como testar
1. Na ficha de um BID: **⏰ Tarefa** → texto + data + "Para quem?". Comece a digitar o nome de um gestor e escolha na lista → Registrar.
   - O gestor recebe "⏰ Nova tarefa para você".
   - A tarefa aparece como "→ Nome" na ficha e no Funil.
2. Confira o seu telefone em ✍ Dados e assinatura ou no seu cadastro de usuário, e o telefone e o e-mail da empresa.
   - Envie um BID para o seu e-mail.
   - O rodapé deve trazer os dois contatos, e o endereço abaixo do botão deve ser clicável.
3. No link do cliente: Pedir revisão sem escolher "O que revisar?". O campo fica vermelho e a mensagem explica.
4. Aceite um BID: o e-mail "🎉 Parabéns!" chega ao responsável e aos gestores, e **não** ao admin.

## Arquivos
```
backend/migrations/054_tarefa_atribuida.sql   (novo)
backend/services/bids.js                     (tarefa atribuída + aviso por e-mail)
backend/services/bidsCliente.js              (contatos no e-mail e na página do cliente; endereço como link)
backend/services/pedidosVenda.js             (aviso do pedido: responsável + gestores)
backend/verificar-entrega.js                 (15c.1 — 186 arquivos)
frontend/src/components/comercial/FichaBid.jsx
frontend/src/components/comercial/TelaComercial.jsx
frontend/src/TelaBidPublica.jsx
readme.md
```
