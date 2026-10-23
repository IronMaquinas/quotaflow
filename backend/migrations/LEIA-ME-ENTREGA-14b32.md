# Entrega 14b.3.2 — Nota da Receita no "＋ Cliente"

Por cima da 14b.3.1. Sem migration, só frontend (+ verificador e readme com o plano de logo, modelos de contrato e monitor de CNPJs).

- 👥 Clientes → ＋ Cliente → 🔍 Buscar: mostra "Dados da Receita · situação ATIVA — confira." (vermelho com aviso se o CNPJ não estiver ATIVO), igual ao novo contrato.

## Como aplicar
1. Copie os arquivos por cima.
2. `cd backend && node verificar-entrega.js` → **139 arquivos OK**.

## Árvore
```
backend/verificar-entrega.js
frontend/src/components/contratos/Clientes.jsx
readme.md
```
