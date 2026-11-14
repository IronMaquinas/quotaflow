# Entrega 18za — 📦📏 Guarda no pátio cobrada pelo contrato

**Base:** origin/main 3e125de (18z.7). Suba **todos** os arquivos, inclusive o `backend/verificar-entrega.js`. Ele ficou fora dos últimos commits, e é por isso que o verificador acusa o TelaPatio.

## 1. Supabase
Rode `backend/migrations/085_contrato_armazenagem.sql`. É idempotente.

## 2. Testar
1. **📦 Propriedade do cliente:**
   - aparece o alerta "Guarda sem cobrança" com os clientes que têm equipamento no pátio sem contrato de guarda;
   - em ⚙ Áreas → ✎ Editar, informe o preço de referência (R$/m²·mês);
   - o painel passa a mostrar o valor aproximado do espaço livre.
2. **📑 Contratos:**
   - abra o contrato do cliente (ou crie um) e use ✎ Editar → 📏 Medição e inspeções;
   - ligue 📦 Cobrar guarda no pátio, informe preço, unidade e mínimo (opcional) e salve;
   - o alerta do pátio some para esse cliente.
3. **Medições:**
   - abra a medição do ciclo e confira as linhas 📦 Guarda no pátio, com a base do cálculo;
   - um equipamento sem m² fica em laranja e impede o envio;
   - com mínimo, aparece a linha de complemento;
   - confira também o 🖨 Boletim.
4. **Modelo de contrato:** os campos {{armazenagem.preco}} e {{armazenagem.minimo}} aparecem na lista de campos automáticos.
