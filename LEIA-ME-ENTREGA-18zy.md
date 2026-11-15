# Entrega 18zy — 👥 CPF já cadastrado abre um modal

- Ao salvar um colaborador com um CPF que já existe, aparece o modal **"⚠ Este CPF já está cadastrado"**. Ele mostra a quem o CPF pertence, com a função, o vínculo e a situação. A mensagem no fundo da tela deixou de aparecer.
- **Opções do modal:**
  - **Voltar** — continua no formulário;
  - **📋 Ver ficha** — abre a ficha da pessoa;
  - **✎ Abrir cadastro** — abre o cadastro dela para editar.
- Se a pessoa estiver **desligada**, o modal sugere reativar o cadastro em vez de criar outro.
- Vale tanto para cadastro novo quanto para edição que mude o CPF.

Sem migração.

## Arquivos
- backend/routes/pessoas.js · frontend/src/components/pessoas/TelaPessoas.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
