# Entrega 18b — Prospecção por evento

## Como aplicar
1. Rode no Supabase: `backend/migrations/060_prospeccao_evento.sql` (idempotente).
2. Copie os arquivos do zip por cima do projeto (inclui `readme.md` e `backend/verificar-entrega.js`).
3. `cd backend && node verificar-entrega.js` → deve dar "Todos os 210 arquivos".

## O que mudou
- **📣 Painel de prospecção** do evento (faixa do Funil, item do calendário ou botão "📣 Prospectar clientes"): clientes ligados + sugeridos (contrataram ±30 dias da mesma data no ano anterior).
- Contatos com **💬 WhatsApp** (mensagem pronta e editável), 📞 ligar e ✉ e-mail; último BID/pedido/contato.
- Situação: a contatar → contatado → BID criado. **✓ Registrar contato** e **＋ BID** ficam ligados ao evento.
- Equipamentos livres no período do evento.

## Arquivos
- backend: migrations/060_prospeccao_evento.sql (novo), services/bids.js, services/calendarioComercial.js, routes/comercial.js, verificar-entrega.js
- frontend: components/comercial/PainelProspeccao.jsx (novo), TelaComercial.jsx, CalendarioComercial.jsx
- readme.md
