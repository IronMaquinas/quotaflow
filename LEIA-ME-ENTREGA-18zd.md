# Entrega 18zd — leitor de XML da NF-e preserva o zero à esquerda

**Base:** origin/main d2f4524 (18zc.6). Sem migration. Só backend: suba todos os arquivos, inclusive o `backend/verificar-entrega.js`, e reinicie o backend.

## O que estava errado
O leitor do XML convertia em número tudo que parecia número e perdia o zero à esquerda:
- CNPJ: 04884082000640 virava 4884082000640;
- código do produto: "007" virava 7;
- EAN e NCM que começam com zero.

No recebimento pelo XML do fornecedor, uma empresa ou um fornecedor com CNPJ começando em zero (ou cadastrado com ponto e barra) aparecia sempre como "❌ CNPJ divergente".

## Testar
1. **Recebimento:** num recebimento com XML de um fornecedor (o ideal é um CNPJ que comece com 0), a validação mostra ✅ CNPJ Emitente / Destinatário válido.
2. **📦 Pátio → 📄 Pré-entrada pelo XML:** o cliente continua sendo sugerido pelo CNPJ.
