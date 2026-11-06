# Entrega 18k — 🧩 bloqueio dos módulos no backend · 💳 caminho das assinaturas no readme

**Sem migration.** Base: 18j (commit b129318).

## O que muda
- Módulo desligado no Console agora é barrado **também na API**: 409 "O módulo … não está no plano da empresa. Veja ⭐ Meu plano." (nunca 403).
- Dentro das telas somem as abas/botões de módulo desligado: ⚠️ Ocorrências e 📏 Medições (📑 Contratos e tela do cliente), ⚠️ Ocorrência (ficha da AT), 📍 Locar/Encerrar locação (Inspeções).
- Empresa com **Tudo ligado** não muda nada.
- readme: nova seção **💳 Planos e assinaturas — o caminho para um SaaS profissional** (o que falta, em ordem).

## Arquivos
**Novos** — `backend/middleware/exigirModulo.js`, `frontend/src/utils/modulosSessao.js`
**Alterados** — `backend/server.js` (bloqueio nas rotas de cada módulo), `backend/services/modulos.js` (limpa o cache ao mudar no Console), `backend/routes/locatario.js` (`GET /api/locatario/modulos`), `frontend/src/App.jsx`, `frontend/src/components/contratos/TelaContratos.jsx`, `frontend/src/components/contratos/TelaLocatario.jsx`, `frontend/src/components/programacao/FichaAT.jsx`, `frontend/src/components/inspecoes/TelaInspecoes.jsx`, `backend/verificar-entrega.js` (265 arquivos), `readme.md`

## Como testar
1. Console → 🧩 Módulos… de uma empresa de teste → desligue **Ocorrências** → Salvar.
2. Entre na empresa (saia e entre): 📑 Contratos sem a aba ⚠️ Ocorrências; ficha da AT sem o botão; e a API `GET /api/ocorrencias` responde 409.
3. Ligue de novo no Console → vale na hora (no próximo acesso à tela).
