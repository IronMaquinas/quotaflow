# Entrega 14c (etapa 1) + 14c.1 — 🖼 Logomarca da empresa nos documentos · 🗜 compressão de imagem automática

## O que vem
- ⚙️ **Configurações → 🏢 Empresa → Logomarca** (admin, gestor): enviar / trocar / remover, com prévia do cabeçalho. **Qualquer tamanho** (até 25 MB) — o sistema reduz sozinho para 600 px (PNG transparente continua transparente).
- A logo já sai em: **relatório de inspeção**, **relatório de cumprimento**, **certificado**, **comprovante da avaliação** e **lista de presença** (inclusive quando o colaborador ou o locatário imprime). Sem logo, os documentos continuam como hoje.
- **Compressão automática (14c.1):** foto enviada como anexo (documento do colaborador, evidência de competência/treinamento, multa, medida disciplinar, auto de infração, defesa/recurso) vira JPEG de ~150–550 KB antes de subir. PDF passa direto. Imagem da vista do modelo de inspeção também (1600 px). As fotos da inspeção já eram reduzidas no celular.
- Próxima etapa da logo: dossiê, ficha de EPI, termo de desconto, medida disciplinar e PDF da NC.

## Como aplicar
1. **Supabase → SQL Editor:** rode `backend/migrations/045_logo_empresa.sql`.
2. Copie os arquivos por cima.
3. Novos no git:
   ```
   git add backend/services/logoEmpresa.js backend/migrations/045_logo_empresa.sql \
     frontend/src/components/configuracoes/LogoEmpresa.jsx frontend/src/utils/logoEmpresa.js frontend/src/utils/comprimirImagem.js
   ```
4. `cd backend && node verificar-entrega.js` → **145 arquivos OK**.
5. Reinicie o backend.

## Teste
1. ⚙️ Configurações → 🏢 Empresa → Enviar logo (pode ser uma imagem grande) → aparece na prévia.
2. 🔍 Inspeções → abra uma inspeção → 📄 Relatório → logo no topo. Idem 📊 Cumprimento → 🖨 Relatório.
3. 👷 Pessoas → Treinamentos → certificado / lista de presença → logo no topo.
4. 👷 Pessoas → documento do colaborador → anexe uma foto do celular (vários MB) → sobe sem erro de limite.
5. Remover a logo → os documentos voltam só com o nome.

## Árvore
```
backend/
  verificar-entrega.js
  routes/ configuracoes.js · usuarios.js
  services/ logoEmpresa.js (novo)
  migrations/ 045_logo_empresa.sql (novo)
frontend/src/
  App.jsx
  components/configuracoes/ TelaConfiguracoes.jsx · LogoEmpresa.jsx (novo)
  components/inspecoes/EditorModeloInspecao.jsx
  components/pessoas/ TelaPessoas.jsx · FichaCompetencias.jsx · TelaDisciplinar.jsx · TelaMultas.jsx · TelaTreinamentos.jsx
  components/naoConformidades/TelaAutuacoes.jsx
  utils/ logoEmpresa.js (novo) · comprimirImagem.js (novo) · gerarRelatorioInspecao.js · gerarRelatorioCumprimento.js · gerarCertificado.js · gerarListaPresenca.js
readme.md
```
