# Entrega 18j — 🧩 áreas → módulos → planos · ⭐ Meu plano

**Migration 071** — rodar `backend/migrations/071_modulos_planos.sql` no SQL Editor (idempotente) antes de subir o backend. Base: 18i (commit 3d8d90d).
Empresas que já existem ficam com **tudo ligado** (nada muda para elas até você mexer no Console).

**Opcional:** variável `PLATAFORMA_CONTATO_EMAIL` no backend (ex.: contato@quotaflow.com.br) — vira o "Fale conosco" do ⭐ Meu plano.

## Arquivos
**Novos** — `backend/migrations/071_modulos_planos.sql`, `backend/services/modulos.js` (catálogo + dependências), `frontend/src/components/configuracoes/MeuPlano.jsx`, `frontend/src/plataforma/ModulosPlataforma.jsx`
**Alterados** — `backend/routes/plataforma.js` (`/modulos`, `/planos`, `/transportadoras/:id/modulos`), `backend/services/plataformaConsole.js` (módulos na lista), `backend/routes/configuracoes.js` (`GET /api/configuracoes/modulos`), `backend/services/roteiroInicial.js` (passos pelos módulos), `frontend/src/App.jsx` (menu/tela inicial pelos módulos, ⭐ Meu plano, padding da tela inicial), `frontend/src/components/configuracoes/BemVindo.jsx` (sem a pergunta do tipo; nota "dá para ajustar depois"), `frontend/src/plataforma/ConsolePlataforma.jsx` (aba 🧩 Planos e módulos, botão 🧩 Módulos…), `backend/verificar-entrega.js` (263 arquivos), `readme.md`

## Como testar
1. Console → **🧩 Planos e módulos** → ＋ Novo plano "Suprimentos" (marque Cotações e Canal Spot — as dependências entram sozinhas).
2. Console → 🚚 Transportadoras → **🧩 Módulos…** numa empresa de teste → aplique "Suprimentos" → Salvar.
3. Entre nessa empresa (saia e entre de novo): o menu e a tela inicial só têm Suprimentos; o 👋 roteiro mostra só os passos de Suprimentos; **⭐ Meu plano** mostra o resto como 🔒.
4. Volte no Console → 🧩 Módulos… → **Tudo ligado** para desfazer.
