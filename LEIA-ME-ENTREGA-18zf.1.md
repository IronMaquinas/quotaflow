# Entrega 18zf.1 — medição reaberta mantém os valores

**Base:** origin/main 489e525 (18zf). Sem migration. Suba todos os arquivos, inclusive o `backend/verificar-entrega.js`, e reinicie o backend.

## Recuperar a medição out/2026 do CL-2026-0002
Os valores foram recalculados antes desta correção. Escolha um caminho:
- **(a) Franquia:** no contrato, marque **N/A** em Franquia (h/mês) e Hora excedente (ou corrija os números). Na medição, clique em **↻ Recalcular**. Pelo mensal proporcional, os valores voltam a ser R$ 2.709,68 (ABC-333) e R$ 2.935,48 (ABC123).
- **(b) Horas:** digite as horas do período em cada linha.

## Testar
1. **Reabertura:** feche uma medição sem clicar em Salvar e reabra com um motivo. Os valores continuam lá para ajustar.
2. **Aviso da franquia:** no documento do contrato, Franquia (h/mês) acima de 744 mostra o aviso.
