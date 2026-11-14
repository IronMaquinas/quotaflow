# Entrega 18ze — 📷 padrão de fotos em todas as telas (modal antes de excluir) + 🔍 zoom no ver foto

**Base:** origin/main 6984e1c (18zd). Sem migration. Só frontend: suba todos os arquivos, inclusive os novos `ConfirmarExclusao.jsx` e `ImagemZoom.jsx` e o `backend/verificar-entrega.js`.

## Testar o ✕ (ou "Excluir") em cada tela
Em todas, deve abrir **"Excluir esta foto?"** com a miniatura e os botões **Cancelar | Excluir**:
1. **🔍 Inspeção:** no ✕ da miniatura e no Excluir da foto ampliada.
2. **⚠ Nova não conformidade:** no ✕ de um anexo, que antes abria a caixa do navegador.
3. **Detalhe da NC:**
   - no ✕ de um anexo salvo;
   - no ✕ de uma ação do plano.
4. **Recebimento → registrar NC:** no ✕ da foto.
5. **Spot (publicar equipamento):**
   - toque na prévia: ela abre por cima da tela;
   - o × pergunta antes de excluir.

Em todos os casos, Cancelar mantém a foto.

## Testar o 🔍 zoom ao abrir qualquer foto
O zoom vale para: pátio, inspeção, ocorrência, NC e Spot.
- **No computador:**
  - a **rodinha do mouse** aproxima no ponto do cursor;
  - o **duplo clique** alterna entre 100% e 250%;
  - com zoom, dá para **arrastar** a foto;
  - os botões **− / 100% / +** ficam no canto.
- **No celular:**
  - a **pinça** com dois dedos aproxima;
  - o **duplo toque** volta para 100%;
  - com zoom, um dedo arrasta a foto.
- **Fechar:** sem zoom, clicar no fundo fecha como antes. Com zoom, arrastar não fecha sem querer.
