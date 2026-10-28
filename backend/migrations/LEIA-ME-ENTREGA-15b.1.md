# Entrega 15b.1 — e-mail do BID padronizado

Base: **15b** aplicada (verificador 182 ✓). Pode aplicar direto por cima da 15b, mesmo que ela ainda não esteja no GitHub.

## O que muda
- **👁 Revisar e enviar** mostra o e-mail que o cliente vai receber.
  - **Assunto:** `BID-2026-0002 — <título da proposta>`. Sem título, usa a referência do cliente. Da v2 em diante, ganha "(atualizada — versão N)".
  - **Texto:** vem preenchido com a saudação e um parágrafo padrão, e você pode ajustar. Se não mexer, vai o padrão. O e-mail **nunca** vai em branco.
  - Depois do texto, entram sempre: o que mudou (v2+), o botão do link, a validade e a assinatura (✍ Dados e assinatura + nome da empresa).
- "Título interno" virou **Título da proposta**. Ele aparece no assunto, e o checklist avisa quando está faltando.
- **Correção no Funil:** um BID ganho ou perdido depois das 21h entrava no dia seguinte, porque o sistema usava o horário UTC. Agora usa o horário de Brasília.

## Como aplicar
1. Na pasta `backend`, rode `node verificar-entrega.js --antes` com o verificador deste zip. Tem que dar ✓ nos 6 arquivos.
2. Copie os arquivos do zip por cima do projeto e rode `node verificar-entrega.js`. Tem que dar ✓ nos 182 arquivos.
3. Não há migration. Reinicie o backend.

## Arquivos
```
backend/services/bidsCliente.js
backend/services/bids.js
backend/verificar-entrega.js
frontend/src/components/comercial/EnviarBid.jsx
frontend/src/components/comercial/FichaBid.jsx
frontend/src/components/comercial/TelaComercial.jsx
frontend/src/TelaBidPublica.jsx
readme.md
```
