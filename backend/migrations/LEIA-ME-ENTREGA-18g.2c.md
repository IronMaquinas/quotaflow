# Entrega 18g.2c — 👤 Um jeito só de escolher pessoa (+ sai o "Voltar" do Plano)

**Sem migration.**

## Arquivos (todos em `frontend/src/components/`)
- `shared/CampoPessoa.jsx` — novo `SeletorPessoa` (autocomplete que guarda o ID)
- `plano/TelaPlanoAcaoNova.jsx` — sem o botão "← Voltar"
- `pessoas/TelaPessoas.jsx` · `pessoas/TelaMultas.jsx` · `naoConformidades/TelaAutuacoes.jsx` · `naoConformidades/ModalDetalheNC.jsx`
- `manutencao/TelaPlanosManutencao.jsx` · `programacao/EditorAT.jsx`
- `comercial/TelaComercial.jsx` · `comercial/FichaBid.jsx` · `comercial/CalendarioComercial.jsx` · `comercial/PainelProspeccao.jsx`
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
Em cada campo: clicar não abre nada → digite parte do nome → escolha (Enter ou clique) → o ✕ limpa (onde aceita "ninguém").
1. 🚚 Programar AT › Motorista (mostra o selo, a função e a CNH).
2. 📈 Comercial › Novo BID › Responsável; ficha do BID › Responsável; 📅 evento › Responsável; 📣 prospecção › 👤 Delegar › Para quem.
3. 🚦 Multa / 🏛 Autuação › Quem monitora · 👷 Documento › Responsável por renovar · 🔧 Plano de manutenção › Responsável · ⚠️ NC › Direcionar › Responsável.
4. ✅ Plano: não tem mais o "← Voltar".
5. `cd backend && node verificar-entrega.js`
