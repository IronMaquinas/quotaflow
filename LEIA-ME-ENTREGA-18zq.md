# Entrega 18zq — 📁 menu Documentos próprio

## O que muda
- **Menu novo: 📁 Documentos.** É o repositório de documentos de **pessoas, equipamentos e da empresa**, **agrupado por dono**:
  - cada pessoa (👤), cada equipamento (🚜) e a empresa (🏢) viram um grupo que abre e fecha, com contadores: "2 documento(s) · 1 vencido";
  - quem tem documento **vencido ou vencendo** vem primeiro e já aparece aberto; os grupos em dia ficam fechados;
  - a busca e o filtro por colaborador abrem tudo.
- **👷 Pessoas** fica só com gente: Colaboradores, Funções, EPI, Treinamentos, Multas e Disciplinar.
- **Ficha do colaborador:**
  - o "📄 N documento(s)" do card abre a **ficha**;
  - a **foto** aparece no cabeçalho;
  - no rodapé ficam **todos os documentos da pessoa** (inclusive os que a função não exige), com 📎 Abrir e **＋ Documento**. Para renovar ou editar, use 📁 Documentos.
- Os avisos de vencimento (🔔 e e-mail), o calendário de manutenção e a AT agora apontam para **📁 Documentos**.

Sem migração e sem mudança de API.

## Arquivos
- frontend/src/App.jsx · frontend/src/components/pessoas/TelaPessoas.jsx · frontend/src/components/manutencao/TelaCalendarioManutencao.jsx
- frontend/src/components/programacao/EditorAT.jsx · FichaAT.jsx · MesaProgramacao.jsx
- backend/services/avisosVencimento.js
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
