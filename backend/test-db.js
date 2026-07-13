const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:IronM%40quin%405%21@db.oiytxyurqwxjqqzpawgn.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Erro de conexão:', err.message);
  } else {
    console.log('✅ Conectado ao Supabase!', res.rows[0]);
  }
  pool.end();
});
