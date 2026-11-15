# Entrega 18zm — 🧠 parecer de analista SÊNIOR + correções contam

## 1. Correções contam como liberação
- Uma reprovação **corrigida** conta como **liberada na data da correção**. Vale para o item resolvido na hora, para a resolução posterior e para o item cuja OS foi concluída. No seu caso, a luz de ré do ABC-333 trocada pela OS-2026-0004 sai de "sem liberação".
- "Itens que mais falham" mostra **✓ N corrigida(s)**. A falha continua contando como histórico, porque é ela que revela recorrência.
- Novo dado: **dias indisponível por reprovação**, por equipamento.

## 2. Parecer reescrito (tático e estratégico)
- Escrito para o dono ou gestor. Fica **proibido** o óbvio operacional ("peça quebrada é risco", "troque a peça") e **não indica responsável**.
- **Foco:**
  - **recorrência** (intervalo entre falhas, troca frequente demais) e **hipóteses de causa raiz a investigar**, por exemplo lente trincada, umidade ou mau contato;
  - **disponibilidade** × contratos de locação e receita;
  - **disciplina da rotina** (equipe × locatário);
  - onde concentrar preventiva, substituição ou renegociação de cláusula.
- **Títulos:** Leitura do mês · Padrões e riscos para o negócio · Recomendações táticas.
- Com poucos dados, o parecer diz isso em uma frase e aponta o que acumular, sem encher o texto.
- A IA agora recebe também as datas das falhas, o que já foi corrigido, as OS abertas, os dias indisponíveis e os equipamentos locados (com o cliente).

## 3. Outros
- O selo "IA ligada · null" foi corrigido.
- O módulo **🧠 Agente de IA** (Console) agora descreve o que liga: parecer mensal + leitura da CNH. É ele que você coloca no plano superior ou vende como adicional.

## Arquivos
- backend/services/analistaRotina.js · backend/services/analistaMensal.js · backend/routes/inspecoes.js · backend/services/modulos.js
- frontend/src/components/inspecoes/AnalistaRotina.jsx
- backend/verificar-entrega.js · readme.md

Sem migração. ⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
