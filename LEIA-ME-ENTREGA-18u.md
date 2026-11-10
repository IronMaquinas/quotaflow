# Entrega 18u — 🏷 segmentos do negócio + plano atualizado sem sair e entrar

**Base:** origin/main 9dc56f0 (18t.1).

## 1. Supabase
Rode `backend/migrations/076_tenant_segmentos.sql`. É idempotente.

## 2. Conferir
Rode `cd backend && node verificar-entrega.js`. Antes do commit aparece o aviso da 076 fora do git, que é normal.

## 3. Testar
1. **Console → 🧩 Módulos da empresa:** em "Segmentos do negócio", marque 🚛 Transporte + 🏗 Locação e salve.
   - No sistema da empresa, o menu mostra "🚛 Frota e equipamentos".
   - Só com Locação: "⚙ Equipamentos/ativos", "🧰 Minhas atividades" e "📅 Programação".
2. **"＋ ligar módulos sugeridos"** (com "Tudo ligado" desligado): liga os módulos típicos dos segmentos marcados. Confira e salve.
3. **Plano atualizado sem sair e entrar:** com o cliente logado, ligue ou desligue um módulo no Console.
   - Em até 5 min, ou ao voltar para a aba do navegador, aparece "⭐ Seu plano foi atualizado" e o menu muda.
4. **Sem mudança:** empresas sem segmento marcado continuam como Transporte.
