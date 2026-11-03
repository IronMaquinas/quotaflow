# Entrega 18d.5 — Aba 📏 Medições

Sem migration. Copie o zip por cima do projeto (inclusive o `backend/verificar-entrega.js`). Depois rode `cd backend && node verificar-entrega.js` → "Todos os 226 arquivos".

## O que mudou
- **Nova aba 📏 Medições** em 📑 Contratos, com contador (bolinha vermelha) das medições para revisar e enviar.
- **Resumo:**
  - valor mensal em locação;
  - contratos ativos (e quantos vencem em 60 dias);
  - para revisar e enviar;
  - aguardando o cliente;
  - medido no mês anterior × previsto.
- **Para agir:** a lista das medições pendentes.
- **Histórico:** filtros por período, contrato, cliente e equipamento.
- **No detalhe do contrato:** a seção de medições saiu. Ficou o link "📏 Ver medições deste contrato ›", que abre a aba já filtrada.
- **Na lista de contratos:** a faixa de pendências virou um aviso de uma linha.
- **Boletim final de medição no encerramento:** anotado no roadmap do readme.

## Como testar
1. Abra 📑 Contratos. A aba 📏 Medições mostra o contador.
2. Na aba, abra uma medição pendente e feche-a.
3. No histórico, filtre por equipamento.
4. Abra um contrato e clique em "📏 Ver medições deste contrato ›".

Arquivos: backend/services/medicoes.js, backend/routes/contratos.js, frontend/src/components/contratos/AbaMedicoes.jsx (novo), TelaContratos.jsx, backend/verificar-entrega.js, readme.md
