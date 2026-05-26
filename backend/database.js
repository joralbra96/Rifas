// backend/database.js
const { Pool } = require('pg'); // Importamos el driver de PostgreSQL

let db; // Esta variable contendrá la conexión a la base de datos

if (process.env.DATABASE_URL) {
  // Si existe DATABASE_URL, usamos PostgreSQL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Puede ser necesario para Render
  });

  db = {
    all: (query, params, callback) => pool.query(query, params).then(res => callback(null, res.rows)).catch(err => callback(err)),
    get: (query, params, callback) => pool.query(query, params).then(res => callback(null, res.rows[0])).catch(err => callback(err)),
    run: (query, params, callback) => pool.query(query, params).then(res => callback(null, res)).catch(err => callback(err)),
    prepare: (query) => { // Simulación para métodos de prepared statement
        return {
            run: (params, callback) => db.run(query, params, callback),
            finalize: () => {}
        };
    }
  };
  console.log("Conectado a PostgreSQL remoto.");

} else {
  // Si NO existe DATABASE_URL, usamos SQLite (para desarrollo local)
  const sqlite3 = require('sqlite3').verbose(); // Importamos sqlite3 SOLO aquí
  db = new sqlite3.Database('./rifa.db', (err) => {
    if (err) {
      console.error("Error al conectar a SQLite:", err.message);
    } else {
      console.log('Conectado a la base de datos SQLite.');
    }
  });

  // Aseguramos que el método prepare exista también para sqlite3
  db.prepare = (query) => db.prepare(query);

  // La lógica de creación de tablas y datos iniciales SOLO para SQLite
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
      number INTEGER PRIMARY KEY,
      name TEXT,
      phone TEXT,
      address TEXT,
      status TEXT DEFAULT 'available'
    )`);

    db.get("SELECT COUNT(*) as count FROM tickets", [], (err, row) => {
      if (err) { console.error("Error al contar tickets:", err.message); return; }
      if (row && row.count === 0) {
        console.log("Inicializando números de rifa en SQLite...");
        const stmt = db.prepare("INSERT INTO tickets (number) VALUES (?)");
        for (let i = 1; i <= 200; i++) { stmt.run(i); }
        stmt.finalize();
        console.log("Números de rifa inicializados en SQLite.");
      }
    });

    const bcrypt = require('bcryptjs'); // Necesitamos bcryptjs también localmente
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt); // ¡CAMBIA ESTA CONTRASEÑA!

    db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
       if (err) { console.error("Error al contar usuarios:", err.message); return; }
      if (row && row.count === 0) {
        db.run("INSERT INTO users (username, password) VALUES (?, ?)", ['admin', hash], (err) => {
          if (err) console.error("Error al crear usuario admin:", err.message);
          else console.log("Usuario admin creado en SQLite.");
        });
      }
    });
  });
}

module.exports = db;