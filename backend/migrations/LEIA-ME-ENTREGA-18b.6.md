# Entrega 18b.6 — Histórico de participação nos eventos

Sem migration. Copie o zip por cima do projeto, **inclusive o `backend/verificar-entrega.js`** (o do GitHub ainda é antigo). Depois rode `cd backend && node verificar-entrega.js` → "Todos os 214 arquivos".

## O que mudou
- **Cancelar com retorno aberto:** ao cancelar uma oportunidade (✕) ou o evento (🔕) com 📅 retorno aberto, aparece "☑ Encerrar também o retorno de dd/mm", já marcado. A tarefa é encerrada com o resultado preenchido pelo motivo.
- **🎪 EVENTOS no Cliente 360°:** mostra, por evento e ano, se o cliente não participou (com o motivo), se teve BID (fase e valor) ou se só houve contato.
- **Anos anteriores no painel do evento:** cada cliente mostra o que aconteceu nos anos anteriores.
- **Resumo por ano na lista de eventos (calendário):** clientes, BIDs (aceitos), quantos não participaram e quantos ficaram sem resposta.

## Arquivos
- backend: services/calendarioComercial.js, services/bids.js, routes/comercial.js, verificar-entrega.js
- frontend: components/comercial/PainelProspeccao.jsx, TelaComercial.jsx, CalendarioComercial.jsx
- readme.md
