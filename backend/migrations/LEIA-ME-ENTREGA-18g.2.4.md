# Entrega 18g.2.4 — 🔁 Substituir documento com versão + ＋ Evento / correção

**Sem migration.**

## Arquivos
- `backend/services/tarefasFiscais.js` — substituir (versões, motivo, regras pela AT) e evento/correção; espelho na AT
- `backend/services/execucoes.js` — link do motorista mostra "versão atualizada"
- `backend/routes/tarefas.js` — `POST /:id/fiscal/:item/:entrada/substituir` · `/evento`
- `frontend/src/components/plano/ChecklistFiscal.jsx` — botões, formulários, versões anteriores, eventos
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. Na tarefa fiscal (com AT no trecho), NF-e › **🔁 Substituir** › motivo "Arquivo errado anexado" › PDF novo › Substituir → aparece **v2** e "🕘 1 versão anterior"; na AT o PDF já é o novo.
2. "Documento cancelado e reemitido" pede chave nova (XML novo) e refaz a conferência das chaves.
3. Coloque a AT **em execução**: como fiscal, substituir é recusado; como gestor, passa e o 📲 link do motorista mostra "🔁 versão atualizada".
4. Com a AT **concluída**: substituir é recusado; **＋ Evento / correção** (CC-e) funciona e vai para a AT.
5. `cd backend && node verificar-entrega.js`
