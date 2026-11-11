# Entrega 18v — 💳 Assinaturas: preço nos planos · assinatura por empresa · teste de 14 dias

**Base:** origin/main 1dd1319 (18u).

## 1. Supabase
Rode `backend/migrations/077_assinaturas.sql`. É idempotente.

Se a tabela `planos` tiver `dias_teste` na linha `teste`, é ela que vale. Para usar 14 dias:
`UPDATE planos SET dias_teste = 14 WHERE codigo = 'teste';`

## 2. Conferir
Rode `cd backend && node verificar-entrega.js`. Antes do commit aparecem os avisos dos 2 arquivos novos fora do git, que é normal.

## 3. Testar
1. **Console → 🧩 Planos → Editar:** preencha o bloco 💲 Preço.
   - Exemplo 1: "Cresce", R$ 590/mês, cobrança por veículo, R$ 29 por unidade, 10 incluídos.
   - Exemplo 2: "Pay-per-use", por uso.
   - O resumo do preço aparece no card do plano.
2. **Console → 🚚 Transportadoras → 💳 Assinatura…:**
   - escolha o plano-modelo, ciclo anual e 10% de desconto e marque ✅ Ativa;
   - a empresa sai do teste e a renovação fica em +1 ano;
   - o 📜 Histórico mostra a mudança.
3. **Estender o teste:** em uma empresa de demonstração, deixe "🧪 Em teste" e troque o "Fim do teste".
4. **Só leitura:** coloque o fim do teste em uma data passada.
   - A empresa consegue ver tudo, mas criar ou alterar dá "Seu teste grátis terminou — o sistema está só para consulta. Escolha um plano em ⭐ Meu plano.".
   - A faixa no topo tem o link ⭐ Meu plano.
   - O bloqueio vale em até 30 s.
5. **Aviso de 3 dias:** com o fim do teste em até 3 dias, o cron das 9h manda 🔔 para o gestor e um e-mail para o contato da empresa (só com `CRON_INTERNO=1`).
