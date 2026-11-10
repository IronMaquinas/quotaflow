# Entrega 18t — 🧩 abas de Pessoas por módulo

**Base:** origin/main 557d440 (18s). Sem migration.

Copie os arquivos e rode `cd backend && node verificar-entrega.js`. Tem que dar "✓ Todos".

## Testar
1. No Console da Plataforma, desligue EPI, Treinamentos ou Multas de uma empresa de demonstração.
2. Em 👷 Pessoas, a aba do módulo desligado some.
3. Na API, `/api/pessoas/epi` (ou `/multas`, `/treinamentos`) responde 409.
4. Documentos, Colaboradores, Funções e Disciplinar continuam iguais.
5. Com todos os módulos ligados, nada muda.
