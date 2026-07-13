const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:IronM%40quin%405%21@db.oiytxyurqwxjqqzpawgn.supabase.co:5432/postgres';

console.log('🔌 Conectando com:', connectionString);

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000, // 5 segundos para timeout
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Erro detalhado:', err);
  } else {
    console.log('✅ Conectado!', res.rows[0]);
  }
  pool.end();
});