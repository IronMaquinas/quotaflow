# Entrega 14e — 🛡 Monitor de CNPJs (compliance)

Por cima do GitHub (14d.7). **Só os 22 arquivos que mudaram.**

## Como aplicar
1. **Supabase → SQL Editor:** rode `backend/migrations/050_monitor_cnpj.sql`.
2. Copie os arquivos por cima (na **raiz** do projeto).
3. Novos no git:
   `git add backend/migrations/050_monitor_cnpj.sql backend/services/monitorCnpj.js backend/routes/monitorCnpj.js frontend/src/components/compliance frontend/src/plataforma/CnpjsPlataforma.jsx`
4. `cd backend && node verificar-entrega.js` → **168 arquivos OK**.
5. Reinicie o backend.
6. (Opcional, Render) `MONITOR_CNPJ_LOTE` (padrão 300 CNPJs por dia) e `MONITOR_CNPJ_PAUSA_MS` (padrão 1200).

## Para testar
1. **Console → 🛡 CNPJs → ↻ Rodar lote agora** (verifica 50 de uma vez; repita até "restam 0" — no fim, saem os e-mails do ciclo).
2. Menu **🛡 Monitor de CNPJs**: sua base, ↻ Verificar agora, aba da plataforma, justificativas.
3. Para simular um CNPJ irregular sem esperar a Receita, no SQL Editor:
   `UPDATE cnpj_monitor SET situacao = 'BAIXADA', verificado_em = now() WHERE documento = '<14 dígitos de um fornecedor>';`
   (vale 24 h; depois o sistema consulta de novo a Receita)
   - Enviar cotação para ele → não envia (aviso 🛡).
   - Emitir OC → pede a justificativa → OC emitida e a justificativa aparece em 🛡 → Justificativas.
   - Recebimento → conferência fiscal da OC dele → pede a justificativa.
4. Portal do fornecedor → Meus dados → razão social 🔒.

## Árvore
```
backend/
  verificar-entrega.js · server.js
  migrations/050_monitor_cnpj.sql (novo)
  services/ monitorCnpj.js (novo) · CotacaoService.js · avisosVencimento.js
  routes/ monitorCnpj.js (novo) · cotacoes.js · estoque/movimentacoes.js · fornecedor.js · plataforma.js · recomendacoes.js
frontend/src/
  App.jsx
  services/cotacoesService.js
  components/compliance/ TelaMonitorCnpj.jsx (novo) · ModalJustificativaCnpj.jsx (novo)
  components/cotacoes/ TelaMonitorarRespostas.jsx · TelaCotacoesNovaComAbas.jsx
  components/estoque/TelaRecebimento.jsx
  components/fornecedores/TelaMeusDadosFornecedor.jsx
  plataforma/ ConsolePlataforma.jsx · CnpjsPlataforma.jsx (novo)
readme.md
```
