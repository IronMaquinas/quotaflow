# Entrega 18g.3 — 📋 Ficha do CT-e + 🛡 apólices em ⚙️

**Base:** origin/main 38abfe8 (18y.1).

## 1. Supabase
Rode `backend/migrations/080_ficha_cte_apolices.sql`. É idempotente.

## 2. Conferir
Rode `cd backend && node verificar-entrega.js`. Antes do commit aparecem os avisos dos 4 arquivos novos fora do git, que é normal.

## 3. Testar
1. **⚙️ Configurações → 🧾 Documentos fiscais → 📋 Dados do CT-e:**
   - preencha IE, UF, RNTRC, CFOP (ex.: 5353 dentro do estado e 6353 fora), CST e alíquota do ICMS;
   - clique em "Salvar".
2. **🛡 Apólices → ＋ Apólice:** cadastre a seguradora, o nº, o ramo (RCTR-C) e a vigência. A lista mostra "✓ vigente".
3. **✅ Plano → abra uma tarefa TSK-TR (tarefa fiscal do trecho) → "📋 Ficha do CT-e":**
   - os campos aparecem preenchidos, com 📋 para copiar cada um;
   - com o XML da NF-e anexado na tarefa, remetente, destinatário, peso, valor e chave vêm da NF-e;
   - o que falta aparece como "⚠ falta" e diz onde completar.
4. **🖨 PDF:** abre a ficha em A4, com a logo, para imprimir ou salvar. **⬇ CSV:** baixa a planilha.
