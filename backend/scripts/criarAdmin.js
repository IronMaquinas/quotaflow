#!/usr/bin/env node
// backend/scripts/criarAdmin.js
//
// Cria um admin do Console da Plataforma (#admin) — ou troca a senha de um
// que já existe. A senha é digitada escondida e só o hash (bcrypt) vai para o
// banco. Nada de senha em SQL nem no código.
//
// Uso (dentro da pasta backend, com o .env apontando para o Supabase):
//   node scripts/criarAdmin.js
//
// Lembre: o e-mail também precisa estar na variável PLATAFORMA_ADMINS
// (no .env local e no Render), senão o login no console é recusado.

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { DB } = require('../db');

// Sem terminal interativo (entrada redirecionada), lê todas as linhas de uma vez
let filaLinhas = null;
async function perguntar(texto) {
  if (!process.stdin.isTTY) {
    if (!filaLinhas) {
      filaLinhas = await new Promise((resolve) => {
        let dados = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (c) => { dados += c; });
        process.stdin.on('end', () => resolve(dados.split(/\r?\n/)));
      });
    }
    process.stdout.write(texto + '\n');
    return String(filaLinhas.shift() || '').trim();
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(texto, (r) => { rl.close(); resolve(r.trim()); }));
}

// Lê a senha sem mostrar na tela (mostra * no lugar)
function perguntarSenha(texto) {
  // sem terminal interativo (ex.: entrada redirecionada): lê a linha normalmente
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') return perguntar(texto);
  return new Promise((resolve) => {
    const entrada = process.stdin;
    process.stdout.write(texto);
    let senha = '';
    const aoDigitar = (buf) => {
      const c = buf.toString('utf8');
      if (c === '\r' || c === '\n' || c === '\u0004') {
        entrada.setRawMode(false);
        entrada.pause();
        entrada.removeListener('data', aoDigitar);
        process.stdout.write('\n');
        resolve(senha);
      } else if (c === '\u0003') {          // Ctrl+C
        process.stdout.write('\n');
        process.exit(1);
      } else if (c === '\u007f' || c === '\b') { // backspace
        if (senha.length) { senha = senha.slice(0, -1); process.stdout.write('\b \b'); }
      } else {
        senha += c;
        process.stdout.write('*'.repeat(c.length));
      }
    };
    entrada.setRawMode(true);
    entrada.resume();
    entrada.on('data', aoDigitar);
  });
}

(async () => {
  try {
    console.log('\nConsole da Plataforma — criar admin (ou trocar senha)\n');
    const email = (await perguntar('E-mail do admin: ')).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('E-mail inválido');

    const existente = await DB.selectOne('plataforma_admins', { email });
    const nome = existente ? existente.nome : await perguntar('Seu nome: ');

    const senha = await perguntarSenha(existente ? 'Nova senha (mín. 10 caracteres): ' : 'Senha (mín. 10 caracteres): ');
    if (senha.length < 10) throw new Error('A senha precisa ter ao menos 10 caracteres');
    const confirma = await perguntarSenha('Confirme a senha: ');
    if (senha !== confirma) throw new Error('As senhas não conferem');

    const senha_hash = bcrypt.hashSync(senha, 12);
    if (existente) {
      await DB.update('plataforma_admins', existente.id, { senha_hash, ativo: true });
      console.log(`\n✓ Senha atualizada para ${email}.`);
    } else {
      await DB.insert('plataforma_admins', { email, nome: nome || null, senha_hash, ativo: true });
      console.log(`\n✓ Admin criado: ${email}.`);
    }

    const lista = String(process.env.PLATAFORMA_ADMINS || '').split(',').map((e) => e.trim().toLowerCase());
    if (!lista.includes(email)) {
      console.log(`⚠️  ${email} ainda NÃO está em PLATAFORMA_ADMINS. Acrescente no .env (local) e no Render:`);
      console.log(`   PLATAFORMA_ADMINS=${email}`);
    } else {
      console.log('✓ E-mail já está em PLATAFORMA_ADMINS.');
    }
    console.log('Acesse o console em <seu endereço>/#admin\n');
    process.exit(0);
  } catch (err) {
    console.error(`\n✗ ${err.message}\n`);
    process.exit(1);
  }
})();
