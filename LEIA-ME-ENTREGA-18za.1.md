# Entrega 18za.1 — 📦 guarda visível no contrato + preço com máscara de moeda

**Base:** origin/main 7bdfed0 (18za). Sem migration. Suba **todos** os arquivos, inclusive o `backend/verificar-entrega.js` e o novo `GuardaContrato.jsx`.

## Testar (📑 Contratos)
1. **Ficha do contrato com a guarda ligada:**
   - o bloco **📦 Guarda no pátio — COBRANDO** aparece abaixo dos equipamentos;
   - ele mostra preço, mínimo, o que está no pátio agora e o acumulado do ciclo até hoje, linha por linha.
2. **Lista e cabeçalho:** o selo **📦 GUARDA** aparece no cartão da lista e no cabeçalho da ficha.
3. **Contrato de um cliente que tem equipamento no pátio, sem a guarda ligada:**
   - aparece o aviso tracejado com **✎ Ligar a cobrança**.
4. **✎ Editar → Cobrar guarda no pátio:** o preço agora tem máscara de moeda (R$ 31,00).
