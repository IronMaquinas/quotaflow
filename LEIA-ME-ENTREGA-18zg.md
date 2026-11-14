# Entrega 18zg — ⏱📋 checklist "Leitura para medição contratual (horímetro)"

## 1. Rode no Supabase (SQL Editor)
Cole o arquivo `backend/migrations/088_checklist_medicao_contratual.sql`. Ele pode rodar mais de uma vez sem duplicar o modelo.

## 2. O modelo novo (Biblioteca de checklists)
- **Nome:** Leitura para medição contratual (horímetro) · frequência semanal
- **Campo obrigatório:** horímetro, que não aceita valor menor que a última leitura
- **Pontos:** 📷 foto do painel com o horímetro legível (foto sempre) · equipamento operando normalmente (foto se NOK)

## 3. Como usar
1. 🔍 Inspeções → Biblioteca → importar "Leitura para medição contratual (horímetro)".
2. No equipamento do contrato, crie a rotina **semanal**, com o responsável **Locatário** (o cliente faz pelo acesso dele) ou a sua equipe.
3. A medição calcula as horas do ciclo entre a primeira e a última leitura. São precisas pelo menos 2 leituras.

O aviso de horímetro, no contrato e na medição, passa a sugerir esse modelo.

## Arquivos
- backend/migrations/088_checklist_medicao_contratual.sql (novo)
- frontend/src/components/contratos/AvisoHorimetro.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
