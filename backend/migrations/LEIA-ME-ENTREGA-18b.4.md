# Entrega 18b.4 — Histórico da campanha e retorno combinado

Sem migration. Copie o zip por cima do projeto e rode `cd backend && node verificar-entrega.js` → "Todos os 214 arquivos".

## O que mudou (📣 painel de prospecção)
- Cada cliente mostra o **texto do último contato** (quem registrou e quando).
- "ver os N registros da campanha ▾" abre o histórico daquele evento: contatos, retornos, delegações, cancelamentos e reaberturas.
- O **nome do cliente abre o Cliente 360°**.
- Ao registrar um contato, **📅 Retornar em** (opcional) cria uma ⏰ tarefa sua para a data. Ela aparece no painel ("📅 retorno dd/mm") e no rodapé do Funil, com o botão 📣, que abre a prospecção.

## Arquivos
- backend: services/calendarioComercial.js, services/bids.js, verificar-entrega.js
- frontend: components/comercial/PainelProspeccao.jsx, TelaComercial.jsx
- readme.md
