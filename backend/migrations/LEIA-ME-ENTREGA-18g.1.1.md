# Entrega 18g.1.1 — XML primeiro, lido ao escolher + "anexar PDF" depois

**Sem migration.**

## Arquivos
- `frontend/src/components/plano/ChecklistFiscal.jsx` — XML antes do PDF; prévia do que foi lido; "＋ anexar PDF" na linha
- `frontend/src/utils/lerXmlFiscal.js` (novo) — leitura do XML no navegador
- `backend/services/tarefasFiscais.js`, `backend/routes/tarefas.js` — `{ entrada, pdf }` completa a entrada salva só com o XML
- `backend/verificar-entrega.js`, `readme.md`

## Como testar (com os XMLs de exemplo — fictícios, sem valor fiscal)
1. Na tarefa 🧾, NF-e › ＋ Registrar › **🧩 XML** → escolha `nfe-exemplo-1234.xml`: nº 1234 e a chave aparecem sozinhos + "✓ XML lido: …".
2. Anexe qualquer PDF em **📄 PDF** e salve → 1/4.
3. CT-e com `cte-exemplo-567.xml` (cita a NF-e 1234 — sem alerta). Teste salvar **só o XML**: aparece "⚠️ falta o PDF · ＋ anexar PDF".
4. Averbação: nº `0000123456`. MDF-e com `mdfe-exemplo-89.xml` (placas ABC333 + ABC123, averbação 0000123456) + um PDF → 4/4, concluída.
5. `cd backend && node verificar-entrega.js`
