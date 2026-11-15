# Entrega 18zk — 🧠✉ relatório mensal do analista + adaptador de IA

## 1. Configure no servidor (Render → Environment)
| Variável | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | sua chave da API da Anthropic (console.anthropic.com) |
| `IA_PROVEDOR` | *(opcional)* `anthropic` · `openai` · `desligado` |
| `IA_MODELO` | *(opcional)* padrão `claude-sonnet-5-5` |

Sem chave nenhuma, a IA fica **desligada** e tudo funciona, só sem o parecer.

**Trocar de IA no futuro** é só mudar as variáveis, sem mexer no código. Exemplo, `IA_PROVEDOR=openai`, `IA_API_KEY=…`, `IA_BASE_URL=https://api.groq.com/openai/v1`, `IA_MODELO=…`. Esse formato serve para OpenAI e compatíveis (Groq, DeepSeek, Mistral, Ollama local…).

**Por empresa:** o módulo **🧠 Agente de IA** no Console liga ou desliga a IA daquela empresa.

## 2. O e-mail mensal
- Sai **todo dia 1, às 7h**, para os **gestores** (o admin não recebe), uma vez por mês por empresa.
- **Conteúdo:**
  - cumprimento do mês × mês anterior, inspeções, reprovados sem liberação e 12 meses;
  - **🔎 O que o analista viu** (regras);
  - **🧠 Parecer do Analista Sênior** (IA): Leitura do mês · Riscos · Ações sugeridas, marcado como texto de IA;
  - itens que mais falham.
- Se a IA estiver desligada, sem chave ou fora do ar, o e-mail **sai igual, sem o parecer**.

## 3. Na tela
🔍 Inspeções → 🧠 Analista → **✉ Relatório mensal**:
- prévia do e-mail do mês escolhido;
- selo **IA ligada/desligada**;
- **🧠 Gerar parecer na prévia** (usa a IA, então tem custo);
- **✉ Enviar agora aos gestores**.

## Arquivos
- backend/services/ia/index.js (novo) · backend/services/analistaMensal.js (novo)
- backend/routes/inspecoes.js · backend/server.js
- frontend/src/components/inspecoes/AnalistaRotina.jsx · TelaInspecoes.jsx
- backend/verificar-entrega.js · readme.md

Sem migração. ⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
