# Entrega 18g.4 — 🧮 CFOP e ICMS sugeridos por trecho + apólice pelo CNPJ

**Base:** origin/main 3a72be1 (18g.3). Sem migration.

Copie os arquivos e rode `cd backend && node verificar-entrega.js`. Tem que dar "✓ Todos".

## Testar
1. **⚙️ Configurações → 📋 Dados do CT-e:**
   - preencha a UF de inscrição (ex.: ES), a alíquota interna e o tipo de tomador mais comum;
   - marque Simples Nacional, se for o caso;
   - salve: o botão não fica mais colado no formulário.
2. **＋ Apólice:**
   - digite o CNPJ e clique em 🔍 Buscar: o nome da seguradora vem da Receita;
   - escolha o início da vigência: o fim vem com +1 ano.
3. **Ficha do CT-e de trechos diferentes** (exemplo com a base na Serra/ES):

   | Trecho | CFOP | ICMS |
   |---|---|---|
   | Serra → MG | 6353 | 12% |
   | MG → CE | 6932 | 7% |
   | ES → ES | 5353 | alíquota interna |

   - Os campos com ✎ são editáveis.
   - Corrigir a alíquota recalcula o ICMS.
   - O PDF e o CSV saem com a correção.
4. **👋 Bem-vindo:** aparece o passo "Dados do CT-e e apólice de seguro". Ele fica ✓ quando IE, UF, RNTRC e uma apólice ativa estão preenchidos.
