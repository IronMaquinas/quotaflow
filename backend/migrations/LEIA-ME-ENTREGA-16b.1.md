# Entrega 16b.1 — sem "juntar itens" + documentos na grade

Inclui tudo desde a 16a (comparado com o GitHub). Sem migration nova. Os SQL avulsos (`corrigir-titulo-trecho.sql`, `rota-trechos-bid-teste.sql`) continuam na raiz do zip, caso ainda não tenha rodado.

## O que mudou
- **Mesa de programação**: saiu o "⛓ no mesmo conjunto de cima". Cada item = um conjunto = uma AT.
- **Documentos**: depois de programar, a linha da AT mostra **＋ NF-e · ＋ CT-e · ＋ MDF-e**. Clique → escolha o arquivo (PDF, XML, JPG ou PNG até 10 MB) → o chip fica verde (✓). Clique no verde abre o arquivo. Também dá para anexar pela ficha da AT. Continua sendo só pendência.
- **Correção**: a coleta/entrega "(do BID)" aparecia vazia quando havia rascunho antigo no navegador — agora o rascunho só sobrescreve o que você digitou.

## Conferir
`cd backend && node verificar-entrega.js` → **194 ✓**.
