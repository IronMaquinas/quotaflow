# Entrega 18zx — 🏢 CNPJ do agregado com máscara e consulta à Receita

- No colaborador **agregado/terceiro**, o campo **CNPJ / CPF** agora:
  - formata enquanto você digita: `00.000.000/0000-00`, ou `000.000.000-00` para CPF;
  - confere o dígito verificador. Se o número for inválido, o campo fica em vermelho;
  - com o CNPJ completo, **consulta a Receita** e mostra a razão social, a cidade/UF e a **situação cadastral**: ✓ ATIVA em verde, ou ⚠ "não está regular" em vermelho;
  - preenche a **Empresa do agregado** com a razão social, se o campo estiver vazio.
- O CNPJ vem antes da empresa no formulário.
- O componente é novo e compartilhado (`CampoCnpj`), pronto para ser usado em outros cadastros.

Sem migração.

## Arquivos
- frontend/src/components/shared/CampoCnpj.jsx (novo) · frontend/src/components/pessoas/TelaPessoas.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
