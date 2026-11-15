# Entrega 18zs — 🔁 revisão, histórico e leitura dos documentos de gestão

## 1. Rode no Supabase
`backend/migrations/093_gestao_revisoes_leituras.sql` (pode rodar mais de uma vez).

## 2. Como funciona (ISO 9001, 7.5.2 / 7.5.3)
- **↻ Nova revisão** fica em 👁 Ver.
  - A próxima revisão fica em **rascunho**, e a **vigente continua valendo** até a aprovação.
  - "O que mudou" é **obrigatório** para aprovar.
- **✓ Aprovar revisão** (admin, gestor ou qualidade):
  - a revisão anterior vai para o **🗂 Histórico** como obsoleta, com a data;
  - a nova vira **Rev. +1**, com "aprovado por/em" de quem aprovou;
  - o cabeçalho A4 passa a mostrar "**Alterações desta revisão**".
- Uma revisão antiga abre com a **tarja OBSOLETO** ("cópia não controlada").
- **🔒 Documento vigente:** texto, título, revisão e arquivo **só mudam por nova revisão**. No Editar ficam travados; dá para mudar área, datas, norma e a situação.
- **👥 ✓ Li e entendi:** cada pessoa confirma a leitura da revisão vigente, e a tela lista quem leu. Uma **nova revisão recomeça as leituras**.

## Próximo
**18zt:** biblioteca de modelos ISO 9001 para importar (você revisa).

## Arquivos
- backend/migrations/093_gestao_revisoes_leituras.sql (novo)
- backend/services/documentosGestao.js · backend/routes/pessoas.js
- frontend/src/components/pessoas/DocumentosGestao.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
