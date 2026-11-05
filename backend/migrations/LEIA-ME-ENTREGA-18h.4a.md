# Entrega 18h.4a — ⚠️ quem recebe a ocorrência · admin fora dos e-mails de rotina · numeração INC-LC / INC-TR

**Migration 069** — rodar `backend/migrations/069_ocorrencias_inc_config.sql` no SQL Editor (idempotente) **antes** de subir o backend.
Ela renumera as ocorrências de teste: SIN-2026-0001 → INC-LC-2026-0001 … (títulos e vínculos das tarefas acompanham). Base: 18h.3.2 (commit e1b6fdd).

## Arquivos
**Novos**
- `backend/migrations/069_ocorrencias_inc_config.sql`
- `frontend/src/components/configuracoes/ConfigOcorrencias.jsx` — ⚙️ Configurações → 🏢 Empresa → ⚠️ Ocorrências — quem recebe

**Alterados**
- `backend/services/ocorrencias.js` — destinatários por origem (perfis, pessoas, funções; admin nunca), responsável e tipo da tarefa
- `backend/routes/configuracoes.js` — `GET/PUT /api/configuracoes/ocorrencias` (alterar: admin, gestor)
- `backend/services/tarefasFiscais.js` — aviso fiscal: gestor + fiscal (sem admin)
- `backend/services/avisosVencimento.js`, `backend/services/avisosPessoas.js` — aviso de vencimento: gestor (sem admin)
- `frontend/src/components/configuracoes/TelaConfiguracoes.jsx`, `frontend/src/components/pessoas/TelaPessoas.jsx` (texto "avisa o gestor")
- `frontend/src/components/ocorrencias/RegistrarOcorrencia.jsx`, `frontend/src/utils/gerarDossieOcorrencia.js` — textos INC
- `backend/verificar-entrega.js` (254 arquivos), `readme.md`

## Como testar
1. ⚙️ Configurações → 🏢 Empresa → **⚠️ Ocorrências — quem recebe**: em 🏗 Locação deixe Comercial e adicione uma pessoa (vira 👤 responsável); em 🚛 Transporte, Operação (ou uma função, ex.: Mecânico) → Salvar. "Hoje recebem" mostra os e-mails.
2. Registre uma ocorrência de locação → número **INC-LC-2026-000N**; o e-mail vai só para quem está configurado (admin não); a tarefa **TSK-CM** aparece em "👤 Minhas tarefas" da pessoa escolhida.
3. Pela ficha de uma AT → **INC-TR-2026-0001**, tarefa TSK-MT, e-mail para a Operação.
4. `cd backend && node verificar-entrega.js`
