# Entrega 18c — 📸 Marca de rastreabilidade nas fotos (revisada: tarja abaixo da foto)

Substitui o zip anterior da 18c, que não chegou a subir.

Sem migration. Copie o zip por cima do projeto (inclusive o `backend/verificar-entrega.js`). Depois rode `cd backend && node verificar-entrega.js` → "Todos os 219 arquivos" (o aviso "marcaFoto.js ainda não está no git" some depois do commit).

## O que mudou
Toda foto tirada nas **inspeções** (no app, no 📲 link do motorista e no link de terceiros) e nas **não conformidades** sai com uma **tarja abaixo da foto**, no mesmo arquivo. A foto fica inteira, sem nada cobrindo a cena. A tarja tem duas linhas:
- `QuotaFlow · o quê · AT/placa`
- `data e hora · GPS · quem tirou`

Se o arquivo da foto for mais de 10 minutos mais antigo que o envio (foto da galeria ou de outro dia), a tarja ganha a linha amarela "⚠ foto antiga ou da galeria — arquivo de …", e a inspeção avisa na tela.

## Como testar
1. **Inspeção pelo app (celular, de preferência)**
   1. Em 🔍 Inspeções, comece uma inspeção.
   2. Marque um ponto como "Não OK" e toque em 📷.
   3. Tire a foto na hora. Se o navegador pedir a localização, permita.
   4. Na miniatura, veja a tarja abaixo da foto, com o modelo, a TAG/placa, a data e hora, o GPS e o seu nome.
2. **Foto antiga:** repita o teste escolhendo uma foto antiga da galeria (no computador, um arquivo qualquer). Deve aparecer o aviso amarelo na tela e a linha "⚠ foto antiga ou da galeria" na faixa.
3. **Sem GPS:** negue a localização no navegador. A tarja mostra "sem GPS".
4. **Link do motorista**
   1. Abra o 📲 link de uma AT (por exemplo, a AT-2026-TESTE1).
   2. Faça uma etapa de inspeção com foto.
   3. A tarja mostra o número da AT e o nome do motorista.
5. **Não conformidade:** crie uma NC e anexe uma foto. Abra a foto anexada: a tarja diz "Não conformidade" e mostra o seu nome.
6. **Depois de enviar:** abra a inspeção concluída e o PDF/relatório. A tarja continua na foto, porque está nos pixels e não é um campo à parte.

## Arquivos
frontend/src/utils/marcaFoto.js (novo), utils/filaInspecoes.js, components/inspecoes/ExecutarInspecao.jsx, TelaATPublica.jsx, components/naoConformidades/ModalNovaNC.jsx, components/naoConformidades/ModalDetalheNC.jsx, components/estoque/ModalNaoConformidade.jsx, backend/verificar-entrega.js, readme.md
