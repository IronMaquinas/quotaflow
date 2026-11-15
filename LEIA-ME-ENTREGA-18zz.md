# Entrega 18zz — ⏱ a ficha do colaborador abre na hora

## O que estava acontecendo
A ficha fazia cerca de **8 consultas ao banco, uma depois da outra**, e só abria a janela quando todas terminavam. Enquanto isso, nada aparecia na tela. Quando o servidor do Render estava "acordando" ou a conexão estava lenta, parecia que o clique não tinha pegado, e o 2º clique disparava outra busca.

## O que mudou
- **O modal abre no clique**, com a foto, o nome e um **"Carregando…"** girando.
- **Um 2º clique não dispara outra busca.**
- **As consultas rodam em paralelo** no servidor, e as duas chamadas da tela vão juntas. A espera fica bem menor.
- Se passar de **8 s**, aparece: "Está demorando mais que o normal (conexão ou servidor acordando). Aguarde — não precisa clicar de novo."
- Se der **erro**, ele aparece dentro do modal, com **Tentar de novo**.

Sem migração.

## Arquivos
- backend/routes/pessoas.js · frontend/src/components/pessoas/TelaPessoas.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
