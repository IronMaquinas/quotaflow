# Entrega 18w — 💳 modalidade (como a Adobe) + ⭐ Meu plano com escolha e troca de plano

**Base:** origin/main 503fe5f (18v).

## 1. Supabase
Rode `backend/migrations/078_assinatura_modalidade_pedidos.sql`. É idempotente.

Ela converte a assinatura que você criou na 18v: mensal desde 09/11/2026 → próxima cobrança em 09/12/2026, sem fim.

## 2. Conferir
Rode `cd backend && node verificar-entrega.js`. Antes do commit aparece o aviso da 078 fora do git, que é normal.

Para o e-mail de pedido chegar, o `.env` precisa ter `PLATAFORMA_ADMINS` (já existe desde a 11b).

## 3. Testar
1. **Console → 🧩 Planos → Editar "Transportadora Bronze":** preencha os 3 preços.
   - Exemplo: mensal 499 · anual pago por mês 449 · pré-pago 4.990.
   - Deixe marcado "aparece para o cliente".
2. **No sistema da empresa (admin ou gestor) → ⭐ Meu plano:**
   - aparecem 💳 Minha assinatura e 📦 Planos disponíveis;
   - troque a modalidade no seletor e veja os preços mudarem;
   - clique em "Mudar para este" e depois em "Enviar pedido".
3. **No Console:** o botão da empresa mostra "💳 Assinatura… · 📝 pedido". Abra e clique em ✓ Confirmar.
   - A assinatura fica ativa, com as datas da modalidade, e os módulos do plano são ligados.
   - Quem pediu recebe um e-mail.
4. **Recusar:** "🤝 Plano personalizado → Fale conosco" cria um pedido. Recuse no Console: quem pediu recebe um e-mail.
5. **Teste vencido (só leitura):** dá para pedir o plano mesmo assim.
