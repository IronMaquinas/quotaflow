# Entrega 18zf.3 — 📏 horas da medição + conta da franquia explícita

## O que mudou
- **Defeito corrigido:** digitar horas em duas linhas seguidas fazia um salvamento atropelar o outro (a 2ª linha não salvava e o valor da 1ª virava "ajustado"). Agora todas as horas, valores e observações vão num envio só; os campos ficam travados enquanto salva. Salvar/Fechar também aplicam horas digitadas.
- **"ajustado"** agora diz: `ajustado à mão · recomendado R$ X`.
- **Base do cálculo** mostra a conta inteira, ex.: `R$ 12.000,00/mês × 7/31 dias · franquia 200 h/mês × 7/31 dias = 45,2 h · usou 50 h → 4,8 h excedente × R$ 500,00 = R$ 2.400,00`.

## Como a franquia funciona
Por equipamento, proporcional aos dias locados no ciclo (7 de 31 dias → 200 × 7/31 = 45,2 h).

## De onde vem o horímetro
Inspeções do equipamento cujo **modelo de inspeção** tem o campo **horímetro** ligado (🔍 Inspeções → modelo → campos). Precisa de pelo menos 2 leituras cobrindo o período; sem isso, informe as horas na medição.

## Arquivos
- frontend/src/components/contratos/MedicaoModal.jsx
- backend/services/cobrancaLocacao.js
- backend/verificar-entrega.js · readme.md

Sem migração. ⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
