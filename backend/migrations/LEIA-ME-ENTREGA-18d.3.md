# Entrega 18d.3 — A medição em preparação acompanha o contrato

Sem migration. Copie o zip por cima do projeto (inclusive o `backend/verificar-entrega.js`). Depois rode `cd backend && node verificar-entrega.js` → "Todos os 225 arquivos".

## O que mudou
A medição ainda em preparação passa a acompanhar o contrato. Ela é atualizada quando você abre a medição, a seção de medições do contrato ou a faixa de pendências.
- **O que é atualizado:** equipamento que entrou, saiu ou teve o valor mensal ou as datas alterados depois de a medição ser gerada.
- **Medição ainda não revisada:** é refeita inteira.
- **Medição já revisada:** os valores digitados ficam. O equipamento novo entra com o valor recomendado e o aviso "entrou no contrato depois da revisão — confira o valor".
- **Medição enviada ou aprovada:** não muda. Para alterá-la, use Reabrir.

## Como testar
Abra o CL-2026-0002 e depois as medições de out/2026 e nov/2026. As duas devem trazer o ABC-333 e o ABC123.

Arquivos: backend/services/medicoes.js, frontend/src/components/contratos/MedicaoModal.jsx, TelaContratos.jsx, backend/verificar-entrega.js, readme.md
