# Entrega 18c.1 — Rastreabilidade na tarja das fotos de NC

Sem migration. Copie o zip por cima do projeto (inclusive o `backend/verificar-entrega.js`). Depois rode `cd backend && node verificar-entrega.js` → "Todos os 219 arquivos".

## O que mudou
A tarja das fotos de não conformidade agora traz a referência:
- **NC aberta (detalhe):** `NC-AAAA-NNNN · item · SKU · lote · série · NF`.
- **NC nova:** `nova NC · item · SKU · lote · série · NF`. O número da NC só existe depois de salvar, por isso preencha o item, o lote e a NF **antes** de tirar a foto.
- **Recebimento (recusa/quarentena):** `Recebimento · OV · item`.

Quando a referência é longa, ela ganha uma linha própria na tarja e não é cortada.

## Como testar
1. Abra uma NC existente e anexe uma foto. A tarja deve mostrar o número da NC e os dados do item.
2. Em "Nova NC", preencha o item e o lote e depois anexe a foto. A tarja deve mostrar "nova NC · item · lote".
3. No Recebimento, recuse um item com NC e anexe uma foto. A tarja deve mostrar "Recebimento · OV · item".

Arquivos: frontend/src/utils/marcaFoto.js, components/naoConformidades/ModalNovaNC.jsx, ModalDetalheNC.jsx, components/estoque/ModalNaoConformidade.jsx, TelaRecebimento.jsx, backend/verificar-entrega.js, readme.md
