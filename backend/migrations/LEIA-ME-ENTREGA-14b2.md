# Entrega 14b.2 — Rotinas de inspeção, equipamento na base / locado, cumprimento e calendário

## O que vem
- **🚚 Equipamentos:** filtros Todos · 🏠 Na base · 📍 Locados · ⚠ Inspeção atrasada. O card mostra a situação e as rotinas ("próxima 29/10" / "atrasada 3 d").
- **⏰ Rotinas** por equipamento: modelo + frequência (diária, semanal, quinzenal, mensal) + quem faz (empresa ou locatário).
- **📍 Locar / 🏠 Encerrar locação:** cliente, contrato, obra, contato, início, fim previsto e a rotina do locatário.
- **Entrega × devolução:** modelos novos na biblioteca ("Locação — inspeção de entrega" e "… de devolução"). A devolução mostra, item a item, como estava na entrega (o que mudou em laranja) — na tela e no relatório.
- **📊 Cumprimento** (aba nova): % por rotina no período + 🖨 relatório.
- **Calendário:** camada 🔍 Inspeções. **E-mail diário do gestor:** "🔍 Inspeção de rotina atrasada".

## Como aplicar
1. **Supabase → SQL Editor:** rode `backend/migrations/042_inspecoes_rotinas_locacao.sql` (pode rodar de novo).
2. Copie os arquivos por cima.
3. Novos no git:
   ```
   git add backend/services/rotinasInspecao.js backend/migrations/042_inspecoes_rotinas_locacao.sql \
     frontend/src/components/inspecoes/RotinasLocacao.jsx frontend/src/utils/gerarRelatorioCumprimento.js
   ```
4. `cd backend && node verificar-entrega.js` → **130 arquivos OK**.
5. Reinicie o backend.

## Roteiro de teste
1. 🧩 Modelos → 📚 importe "Locação — inspeção de entrega" e "… de devolução" (e um checklist de rotina, ex.: empilhadeira NR-11).
2. Num equipamento: **⏰ Rotinas** → semanal, empresa, primeira = 7 dias atrás → o card fica "atrasada"; filtro ⚠ mostra ele; calendário (camada 🔍) mostra no dia que venceu. Inspecione com esse modelo → vira "próxima" daqui a 7 dias.
3. **📍 Locar** outro equipamento (cliente "Obra Teste", rotina do locatário semanal) → card "📍 Locado — Obra Teste" + rotina "👤 locatário".
4. Faça a **inspeção de entrega** nele. Depois a **de devolução** com um item diferente (ex.: lataria Não OK) → o detalhe mostra "entrega: OK →" em laranja; 📄 relatório idem.
5. **🏠 Encerrar locação** → volta para 🏠 Na base; a rotina do locatário some.
6. **📊 Cumprimento** → período do mês → % e 🖨 Relatório.

## Árvore
```
backend/
  verificar-entrega.js
  routes/ inspecoes.js · manutencao.js
  services/ inspecoes.js · avisosPessoas.js · rotinasInspecao.js (novo)
  migrations/ 042_inspecoes_rotinas_locacao.sql (novo)
frontend/src/
  components/inspecoes/ TelaInspecoes.jsx · RotinasLocacao.jsx (novo)
  components/manutencao/TelaCalendarioManutencao.jsx
  utils/ gerarRelatorioInspecao.js · gerarRelatorioCumprimento.js (novo)
readme.md
```

## Próxima: 14b.3
Portal do locatário — link permanente por locação: equipamentos do contrato, inspeção pendente, fazer a inspeção e histórico.
