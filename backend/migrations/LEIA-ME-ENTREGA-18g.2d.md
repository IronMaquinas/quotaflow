# Entrega 18g.2d — ⚠️ saída da base sem CT-e/MDF-e + ⏰ prazo fiscal vencido (+ 18g.2.9: histórico abaixo dos botões)

**Sem migration.**

## Arquivos
- `backend/services/tarefasFiscais.js` — alerta de saída, e-mail do prazo vencido (gestor/admin + fiscal)
- `backend/services/fluxoViagem.js` — checa CT-e/MDF-e ao marcar a saída da base
- `backend/services/execucoes.js` — alerta no relatório da viagem
- `backend/server.js`, `backend/routes/recomendacoes.js` — prazo vencido no disparo diário das 7h
- `frontend/src/components/programacao/FichaAT.jsx` — alerta na etapa; 📜 histórico abaixo dos botões de anexar
- `frontend/src/utils/gerarRelatorioViagem.js`
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. Numa AT **sem MDF-e**, abra o 📲 link do motorista e marque **🏭 Saída da base** → a viagem segue; o gestor e o fiscal recebem "⚠️ AT-… saiu da base sem MDF-e"; a ficha mostra o alerta na etapa.
2. Tarefa fiscal com prazo vencido: no disparo das 7h (ou `POST /api/recomendacoes/resumo-diario`) chega "⏰ N tarefa(s) fiscal(is) com prazo vencido"; no dia seguinte não repete.
3. Ficha da AT: "📜 Histórico dos documentos" agora fica abaixo de ＋ NF-e / ＋ CT-e / ＋ Outro.
4. `cd backend && node verificar-entrega.js`
