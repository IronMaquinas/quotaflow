# Entrega 18h.4c — ⚠️ Ocorrências: acesso ≠ notificação

**Sem migration.** Base: 18h.4b (commit aab05b8).

- **👁 Perfis com acesso** — veem e acompanham as ocorrências da origem (gestor e admin sempre). Não recebem e-mail.
- **📧 Quem é avisado por e-mail** — só as pessoas escolhidas; a 1ª é a responsável pela tarefa.
- Saiu "Funções".

## Arquivos
- `backend/services/ocorrencias.js` — e-mail só para as pessoas; acesso por origem na lista, detalhe, conversa e alteração
- `backend/routes/ocorrencias.js` — passa os perfis; quem altera vem da configuração
- `frontend/src/components/configuracoes/ConfigOcorrencias.jsx` — tela simplificada
- `backend/verificar-entrega.js`, `readme.md`

## Depois de subir
Em ⚙️ Configurações → 🏢 Empresa → ⚠️ Ocorrências, **escolha as pessoas** de cada origem — enquanto não escolher, ninguém recebe o e-mail (a ocorrência aparece na tela).
