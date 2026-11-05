# Entrega 18h + 18h.1 + 18h.2 — ⚠️ Ocorrência / sinistro unificado (SIN-AAAA-NNNN)

> **18h.1:** fotos corrigidas — ao escolher, aparece a miniatura já comprimida e com a tarja, clique amplia, ✕ pergunta "Remover a foto?". 
> **18h.2:** login do cliente (locatário) não entra mais em loop — `frontend/src/App.jsx`, `frontend/src/hooks/useCatalogo.js`, `frontend/src/utils/areaRestrita.js` (novo).
> Este zip substitui os anteriores da 18h (traz tudo).

**Migration 068** — rodar `backend/migrations/068_ocorrencias.sql` no SQL Editor do Supabase (idempotente, pode rodar 2×) **antes** de subir o backend.

## Arquivos
**Novos**
- `backend/migrations/068_ocorrencias.sql` — tabela `ocorrencias` + numeração SIN por empresa/ano (trigger, imutável)
- `backend/services/ocorrencias.js` — registrar (AT ou contrato), contexto do momento, TSK-MT, e-mail ao comercial, conversa, fotos/BO, situação/responsabilidade, dias parados
- `backend/routes/ocorrencias.js` — `/api/ocorrencias` (empresa)
- `frontend/src/components/ocorrencias/RegistrarOcorrencia.jsx` — formulário (fotos com tarja do SIN, BO, GPS)
- `frontend/src/components/ocorrencias/PainelOcorrencias.jsx` — lista + detalhe (conversa, situação, dossiê)
- `frontend/src/utils/gerarDossieOcorrencia.js` — 📄 dossiê para imprimir / PDF

**Alterados**
- `backend/routes/locatario.js` — `/api/locatario/ocorrencias…` (escopo pelo usuário logado)
- `backend/server.js` — monta `/api/ocorrencias`
- `backend/services/medicoes.js` — dias parados no detalhe da medição (só informa)
- `backend/services/tarefas.js` — vínculo "Ocorrência (SIN)" e origem `ocorrencia` → MT
- `frontend/src/components/contratos/TelaContratos.jsx` — aba ⚠️ Ocorrências + "⚠️ Ocorrências ›" no contrato
- `frontend/src/components/contratos/TelaLocatario.jsx` — aba ⚠️ Ocorrências + atalho na inspeção com item não OK
- `frontend/src/components/contratos/MedicaoModal.jsx` — "⚠️ Equipamento parado no ciclo"
- `frontend/src/components/programacao/FichaAT.jsx` — botão ⚠️ Ocorrência + "Ocorrências desta AT"
- `backend/verificar-entrega.js` (250 arquivos), `readme.md`

## Como testar
1. **Locatário** (login de cliente): aba **⚠️ Ocorrências** → **⚠️ Registrar ocorrência** → o contrato/equipamento já vem escolhido se houver um só → tipo **Pane**, marque **⛔ parado**, descreva, tire 2 fotos e anexe um BO → **Registrar**. Confira a tarja "QuotaFlow · Ocorrência · SIN-2026-0001" embaixo das fotos.
2. Chega o e-mail "⚠️ SIN-2026-0001 — Pane / falha mecânica · EQUIPAMENTO PARADO" para admin/gestor/comercial, e aparece a tarefa **TSK-MT** no ✅ Plano.
3. **Empresa:** 📑 Contratos → **⚠️ Ocorrências** → abra o SIN → responda na 💬 conversa, mude a responsabilidade e a situação para **Encerrada** (pede confirmação no modal) → **📄 Dossiê**.
4. Abra a **medição** do ciclo desse contrato → aparece "⚠️ Equipamento parado no ciclo" com os dias (nada é descontado).
5. **Atalho:** no locatário, abra uma inspeção com item não OK → **⚠️ Registrar ocorrência destes itens**.
6. **AT:** ficha de uma AT programada/em execução → **⚠️ Ocorrência** → motorista, placas, carga, documentos e última posição entram sozinhos.
7. `cd backend && node verificar-entrega.js`
