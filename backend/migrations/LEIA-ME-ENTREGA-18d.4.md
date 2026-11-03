# Entrega 18d.4 — Medição do mês corrente só a partir de D-10

Sem migration. Copie o zip por cima do projeto (inclusive o `backend/verificar-entrega.js` — o do GitHub está defasado). Depois rode `cd backend && node verificar-entrega.js` → "Todos os 225 arquivos".

## O que mudou
- **D-10:** a medição do mês corrente só aparece, e só é gerada, nos últimos 10 dias do ciclo (em novembro, a partir de 20/11). Antes disso, a tela mostra só os ciclos já encerrados.
- **Início no futuro:** o equipamento com início no futuro ganha a etiqueta "⏳ começa em dd/mm/aaaa" no contrato.

**O ABC123 do CL-2026-0002:** o início dele está em 25/10/**2027** (confira no contrato). Por isso ele não entra nas medições de 2026. Corrija a data em 📅 Datas; a medição em preparação se atualiza sozinha.

Arquivos: backend/services/medicoes.js, frontend/src/components/contratos/TelaContratos.jsx, backend/verificar-entrega.js, readme.md
