# Entrega 18zu — 🏢 logo e rodapé nos documentos de gestão

- **Cabeçalho de controle**, igual nos outros documentos do QuotaFlow:
  - a **logo da empresa** (⚙️ Configurações → Logomarca; sem logo, entra o nome);
  - o título;
  - código · revisão · situação;
  - a linha de elaborado/aprovado, com a razão social e o CNPJ.
- **Rodapé:** "PQ-02 · Rev. 00 — Documento controlado eletronicamente no QuotaFlow — cópia impressa não controlada — impresso em dd/mm/aaaa".
- O layout é o mesmo em três lugares:
  - no **👁 Ver**;
  - na **revisão obsoleta**, com a tarja OBSOLETO;
  - no **Visualizar do modelo** da biblioteca, com a tarja RASCUNHO e já com o nome e o CNPJ da empresa.
- **🖨 Imprimir / PDF** abre a página A4 própria, com o rodapé repetido em **cada página** impressa. Para PDF, escolha "Salvar como PDF" na impressão.

Sem migração.

## Arquivos
- frontend/src/utils/gerarDocumentoGestao.js (novo) · frontend/src/components/pessoas/DocumentosGestao.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
