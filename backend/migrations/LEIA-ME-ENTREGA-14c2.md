# Entrega 14c.2 — Logo em todos os documentos (14c + 14c.1 + 14c.2 juntas)

Este zip **inclui a 14c e a 14c.1** (você ainda não subiu a 14c para o GitHub). Se já copiou a 14c, pode copiar este por cima.

## O que vem
- ⚙️ Configurações → 🏢 Empresa → **Logomarca** (qualquer tamanho — o sistema reduz sozinho).
- Logo nos documentos: relatório de inspeção, cumprimento, certificado, comprovante da avaliação, lista de presença **+ (14c.2) dossiê do colaborador, medida disciplinar, ficha de EPI, termo de desconto de multa e PDF da NC**.
- Fotos de anexos comprimidas antes de enviar (14c.1).
- Treinamentos → Por colaborador: os selos agora mostram que são clicáveis (mãozinha, realce e "›").
- O readme mantém as suas seções 17 a 21 (ESG, ISO 9001, IA de compliance, câmera, dossiê/IA).

## Como aplicar
1. **Supabase → SQL Editor:** rode `backend/migrations/045_logo_empresa.sql` (se ainda não rodou).
2. Copie os arquivos por cima.
3. Novos no git:
   ```
   git add backend/services/logoEmpresa.js backend/migrations/045_logo_empresa.sql \
     frontend/src/components/configuracoes/LogoEmpresa.jsx frontend/src/utils/logoEmpresa.js frontend/src/utils/comprimirImagem.js
   ```
4. Se existirem aí, apague: `backend/services/marca.js` e `frontend/src/utils/cabecalhoDocumento.js` (sobras, ninguém usa).
5. `cd backend && node verificar-entrega.js` → **146 arquivos OK**.
6. Reinicie o backend.

## Teste
Dossiê, advertência, ficha de EPI, termo de desconto e PDF de uma NC → logo no topo. Treinamentos → passe o mouse no selo → mãozinha.
