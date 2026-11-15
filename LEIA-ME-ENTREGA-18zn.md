# Entrega 18zn — 🪪📷 dados da CNH na ficha + foto ajustável + IA sem nome

## 1. Rode no Supabase
`backend/migrations/090_colaborador_cnh.sql` (pode rodar mais de uma vez).

## 2. A IA não se identifica mais
- O selo mostra só **"IA ligada"**.
- O e-mail diz **"Parecer gerado por inteligência artificial"**.
- A leitura da CNH não devolve modelo nem tokens para a tela.
- Erros da IA aparecem genéricos ("sem crédito ou sobrecarregada", "não respondeu agora"). O detalhe fica só no log do servidor e na tabela `ia_uso`.

## 3. Dados da CNH no cadastro
Campos novos: **RG / órgão / UF · nº de registro · 1ª habilitação · emissão · validade** (borda vermelha se vencida) **· observações** (EAR…) **· local de emissão**.

A leitura preenche todos eles e diz o que mudou; também dá para digitar à mão. O documento CNH (com o arquivo) continua sendo o que avisa o vencimento.

## 4. Foto
- **📷 Trocar** (câmera ou galeria) ou **✕ tirar** (com confirmação), mesmo sem ler a CNH.
- **✂ Ajustar** abre uma moldura 3×4 sobre a imagem inteira:
  - arraste para posicionar;
  - puxe o canto (ou use − / +) para o tamanho;
  - a régua **Endireitar** (−15° a +15°) corrige a foto fora de esquadro;
  - a prévia aparece ao vivo.
- O ajuste serve tanto para a foto da CNH quanto para a foto enviada.

## Arquivos
- backend/migrations/090_colaborador_cnh.sql (novo)
- backend/services/documentos.js · backend/services/ia/index.js · backend/services/leituraCnh.js · backend/services/analistaMensal.js · backend/routes/inspecoes.js
- frontend/src/components/pessoas/AjustarFoto.jsx (novo) · LerCnh.jsx · TelaPessoas.jsx · frontend/src/components/inspecoes/AnalistaRotina.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
