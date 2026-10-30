# Entrega 16e — 🧭 Fluxo da viagem (etapas em ordem, com inspeções)

## Como aplicar
1. Copie os arquivos por cima.
2. No Supabase, rode **`backend/migrations/057_fluxo_viagem.sql`** (pode rodar 2×).
3. Reinicie o backend. `cd backend && node verificar-entrega.js` → **202 ✓**.
4. Para o fluxo sugerido vir completo, tenha em 🔍 Inspeções → Modelos pelo menos um modelo de cada tipo: **equipamento** (liberação), **carregamento**, **trânsito** e **descarregamento**. O tipo que não tiver modelo fica de fora, e a tela avisa.

## O que testar
1. **Programar**: Mesa → card → preencha → **🚛 Programar ›** → aparece o **Fluxo da viagem** com a sequência sugerida. Troque o modelo ou o equipamento de uma inspeção, tire uma etapa (✕), acrescente outra (＋) e reordene (↑ ↓) → **✓ Confirmar e programar**. 💾 Salvar rascunho guarda o fluxo também.
2. **Card e ficha**: o card mostra "🧭 0/8 · próxima: …". A ficha mostra a linha do tempo e não tem mais ▶ Iniciar / ✓ Concluir (a viagem começa e termina sozinha).
3. **📲 Link do motorista** (abra pelo celular):
   - a próxima etapa vem em destaque e as outras ficam 🔒. Toque numa bloqueada: "Etapa ainda não liberada — conclua primeiro: …";
   - **🔍 Fazer a inspeção** abre a tela de inspeção. Ao enviar, a AT vira "em execução" (o pedido acompanha);
   - **✓ Confirmar: Saída da base**, um toque;
   - **sem internet** (modo avião): marque uma etapa → "💾 guardada no celular", e a seguinte já abre. Volte a internet: tudo é enviado na ordem;
   - **"não sou eu"**: outro motorista informa nome e CPF.
4. **Reprovação**: faça uma inspeção com um item que impede o uso → o link mostra "⛔ Reprovada — NÃO siga". Na ficha, como **gestor/admin**: "⛔ Reprovada — liberar para seguir" → motivo → o motorista segue (o equipamento também é liberado).
5. A última etapa conclui a AT e o pedido.
6. Uma AT programada antes desta entrega continua manual (▶ Iniciar).
