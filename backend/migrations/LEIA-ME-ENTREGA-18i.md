# Entrega 18i — 👋 Bem-vindo ao QuotaFlow (roteiro das configurações mínimas)

**Migration 070** — rodar `backend/migrations/070_roteiro_inicial.sql` no SQL Editor (idempotente) antes de subir o backend. Base: 18h.4 (commit cff88cb).

## Onde
- Tela inicial (admin/gestor): cartão **👋 Bem-vindo ao QuotaFlow** (substitui o "Complete o perfil da empresa").
- Sempre em **⚙️ Configurações → 👋 Roteiro inicial** (também para mudar o tipo do negócio).

## Arquivos
**Novos** — `backend/migrations/070_roteiro_inicial.sql`, `backend/services/roteiroInicial.js`, `frontend/src/components/configuracoes/BemVindo.jsx`
**Alterados** — `backend/routes/configuracoes.js` (`GET/PUT /api/configuracoes/roteiro`), `frontend/src/App.jsx` (cartão na tela inicial + navegação do roteiro), `frontend/src/components/configuracoes/TelaConfiguracoes.jsx` (aba 👋 Roteiro inicial), `backend/verificar-entrega.js` (259 arquivos), `readme.md`

## Como testar
1. Entre como gestor/admin → tela inicial: escolha o que a empresa faz (pode ser mais de um) → **Montar meu roteiro**.
2. Os passos já feitos aparecem com ✓; clique **ir ›** num pendente, faça o cadastro e volte — ele marca sozinho.
3. Num recomendado que não serve, **não se aplica** (sai da conta; "contar de novo" desfaz).
