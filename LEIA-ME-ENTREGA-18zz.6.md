# Entrega 18zz.6 — 👤 Elaborado/Aprovado por = funcionário do cadastro

**Rode no Supabase:** `backend/migrations/098_gestao_pessoas_rastreaveis.sql` (idempotente).

- Em 📘 Gestão (cadastro e ↻ Nova revisão), "Elaborado por" e "Aprovado por" agora sugerem os funcionários ativos enquanto digita.
- ✓ = ligado ao cadastro (rastreável) · ⚠️ = nome digitado à mão (fica com aviso).
- Aprovar / Publicar / fluxo assinado ligam sozinhos ao funcionário do login de quem aprovou.

Conferir: `cd backend && node verificar-entrega.js` — suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
