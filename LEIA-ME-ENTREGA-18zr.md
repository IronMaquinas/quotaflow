# Entrega 18zr — 📁 abas no Documentos + 📘 Gestão

> Esta entrega **inclui a 18zq**, que ainda não estava no GitHub: menu 📁 Documentos agrupado por dono e documentos na ficha do colaborador.

## 1. Rode no Supabase
`backend/migrations/092_documentos_gestao.sql` (pode rodar mais de uma vez).

## 2. Abas do 📁 Documentos
**👤 Pessoas · 🚜 Equipamentos · 🏢 Licenças e certificados · 📘 Gestão**
- Cada aba de vencimento mostra **quantos documentos estão vencidos ou vencendo**. Os cards e o **＋ Novo documento** seguem a aba aberta.
- Em **Licenças e certificados** ficam os documentos da empresa: alvará, AVCB, licença ambiental, RNTRC, certificado ISO…

## 3. 📘 Gestão (documentos controlados — ISO 9001, 7.5)
- **Código** único (PQ-01…), título e **tipo**: manual, política, procedimento, instrução, formulário ou registro.
- Área ou processo, **revisão** (Rev. 00…) e **situação**: rascunho, vigente ou obsoleto.
- Elaborado e aprovado por, com a data.
- **Próxima análise crítica**: quando a data vence, aparece o selo "Análise crítica vencida".
- **Texto editável no sistema** e/ou arquivo anexo.
- **👁 Ver** abre a página A4 com o cabeçalho de controle (código, revisão, situação, elaborado/aprovado), com **🖨 Imprimir**.
- **Vigente não se exclui**: marque como Obsoleto. A ISO pede o histórico.

## Próximas etapas
- **18zs:** fluxo de revisão e aprovação, histórico de versões, confirmação de leitura pela equipe.
- **18zt:** biblioteca de modelos ISO 9001 (manual + procedimentos), para você revisar.

## Arquivos
- backend/migrations/092_documentos_gestao.sql (novo) · backend/services/documentosGestao.js (novo) · backend/routes/pessoas.js
- frontend/src/components/pessoas/DocumentosGestao.jsx (novo) · TelaPessoas.jsx
- da 18zq: frontend/src/App.jsx · TelaCalendarioManutencao.jsx · EditorAT.jsx · FichaAT.jsx · MesaProgramacao.jsx · backend/services/avisosVencimento.js
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
