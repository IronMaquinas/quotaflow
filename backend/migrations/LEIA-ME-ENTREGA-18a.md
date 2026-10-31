# Entrega 18a — 📅 Calendário comercial + 🎪 eventos de mercado

## Como aplicar
1. Copie os arquivos por cima.
2. No Supabase, rode **`backend/migrations/059_calendario_comercial.sql`** (pode rodar 2×).
3. Reinicie o backend. `cd backend && node verificar-entrega.js` → **208 ✓**.

## O que testar
1. **📈 Comercial → 📅 Calendário**: visões **Semana / Mês / Ano**. As camadas (clique para ligar e desligar): 🎯 decisão esperada do BID, ⌛ validade da proposta, 🚚 transporte negociando (BID), 🚛 transporte vendido (pedido), ⏰ tarefas, 🎪 eventos e 📣 prospecção. Clique num item para abrir o BID, o pedido ou o evento.
2. **🎪 ＋ Evento de mercado**: por exemplo, "Feira de Máquinas — BH", 10/12 a 13/12, 🔁 repete todo ano, prospectar **60** dias antes, clientes ligados e responsável. A tela mostra "📣 Prospecção a partir de …".
3. Como a prospecção já começou (no exemplo, 10/12 − 60 dias):
   - nas **⏰ tarefas** do responsável entra "🎪 Faltam N dias para Feira de Máquinas — BH (Belo Horizonte/MG) — hora de procurar os clientes: …" (uma vez por ano);
   - o **📊 Funil** mostra a faixa "📣 Faltam N dias para …".
4. No **Ano**, o evento aparece no mês dele; clique no mês para abrir o calendário.
5. Edite a data do evento: o lembrete do ano é refeito.
