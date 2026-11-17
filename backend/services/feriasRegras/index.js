// services/feriasRegras/index.js — etapa B1.6: regras de férias por PAÍS (tenants.pais, escolhido no Console da Plataforma)
//   ➕ Novo país: copie BR.js para <SIGLA>.js, ajuste os números/funções e registre abaixo. Nada mais muda.
const PAISES = { BR: require('./BR') };
const regrasDe = (pais) => PAISES[String(pais || 'BR').toUpperCase()] || PAISES.BR;
const lista = () => Object.values(PAISES).map((p) => ({ pais: p.pais, nome: p.nome }));
module.exports = { regrasDe, lista, PAISES };
