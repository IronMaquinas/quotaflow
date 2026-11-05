# Entrega 18h.4b — ⚠️ "Ocorrências — quem recebe" mais clara

**Sem migration.** Base: 18h.4a (commit a382765).

## Arquivos
- `frontend/src/components/configuracoes/ConfigOcorrencias.jsx` — "Vão receber o e-mail" ao vivo, com o motivo de cada um; sem o campo "Tarefa criada"; texto: perfis + pessoas + funções somam
- `backend/services/ocorrencias.js` — tipo da tarefa fixo pela origem (INC-LC → TSK-CM, INC-TR → TSK-MT); dados para a prévia ao vivo
- `backend/verificar-entrega.js`, `readme.md`
