# Entrega 18z.1 — 📦 Pátio: pré-entrada pelo XML, leitor da chave, fotos na abertura, celular

**Base:** origin/main 6e11769. Esta entrega **inclui a 18z**, que ainda não está no GitHub. Use este zip no lugar do da 18z.

## 1. Supabase
Rode, nesta ordem:
1. `081_patio_cliente.sql` (se ainda não rodou);
2. `082_patio_pre_entrada.sql`.

As duas são idempotentes.

## 2. Conferir
Rode `cd backend && node verificar-entrega.js`.

## 3. Testar
1. **📄 Pré-entrada pelo XML:**
   - carregue o XML de uma NF com máquinas e confira o cliente sugerido, uma linha por unidade e as séries encontradas;
   - lance;
   - carregue o mesmo XML de novo: aparece o aviso de NF já lançada.
2. **Aguardando chegada:** abra uma pré-entrada e use ✅ Confirmar chegada:
   - confira a série (troque para ver o aviso de série diferente da NF);
   - informe o local;
   - tire as fotos ali mesmo e confirme.
3. **＋ Entrada no pátio:**
   - use 📷 Ler e leia o código de barras de uma DANFE. A chave e o nº da NF são preenchidos;
   - se a NF tiver pré-entrada, aparece o atalho para ela;
   - tire as fotos antes de salvar e registre.
4. **Celular:** abra no celular ou no tablet. As telas ocupam a tela toda e os botões ficam embaixo.
