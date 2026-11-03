# Entrega 18c.3 — Rastreabilidade antes de existir o número

Sem migration. Copie o zip por cima do projeto, **inclusive o `backend/verificar-entrega.js`** (o do GitHub está na 18c.1). Depois rode `cd backend && node verificar-entrega.js` → "Todos os 219 arquivos".

## O que mudou
- **Inspeção:** a tarja das fotos leva o **ID da inspeção** (ex.: `ID 7F3A-9C21`). Esse ID é gerado no aparelho quando a inspeção começa, antes de ela ter número. O mesmo ID aparece:
  - no detalhe da inspeção: "INSP-2026-0012 · ID 7F3A-9C21";
  - no relatório/PDF, no canto superior direito;
  - na **busca** do Histórico de inspeções, que aceita o ID ou o número.
- **NC nova:** a prévia já mostra a tarja provisória "nova NC · nº gerado ao registrar". Ao registrar, a tarja é refeita com o número da NC. A hora e o GPS continuam sendo os do momento da foto.

## Como testar
1. **ID na tarja:** faça uma inspeção com foto. Toque na miniatura e anote o ID que aparece na tarja.
2. **ID no detalhe:** envie a inspeção e abra o detalhe. O cabeçalho deve mostrar "INSP-… · ID …" com o mesmo ID.
3. **Busca pelo ID:** em 🔍 Inspeções → Histórico, digite o ID (por exemplo, 7F3A ou 7F3A-9C21). A inspeção deve aparecer.
4. **NC nova:** crie uma NC nova com foto. A miniatura já mostra a tarja provisória. Salve. Abra a NC e veja a foto anexada: a tarja deve mostrar o número NC-… recém-criado.

## Arquivos
- backend: services/inspecoes.js, verificar-entrega.js
- frontend: utils/marcaFoto.js, utils/gerarRelatorioInspecao.js, components/inspecoes/ExecutarInspecao.jsx, components/inspecoes/TelaInspecoes.jsx, components/naoConformidades/ModalNovaNC.jsx
- readme.md
