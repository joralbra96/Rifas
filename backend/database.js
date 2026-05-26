// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg'); // Importamos el driver de PostgreSQL

let db; // Esta variable contendrá la conexión a la base de datos

// Verificamos si existe la variable de entorno DATABASE_URL (la que Render nos dará)
if (process.env.DATABASE_URL) {
  // Si existe, usamos PostgreSQL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // ssl: { rejectUnauthorized: false } // Descomenta esto si Render te da problemas con SSL
  });

  // Creamos un objeto 'db' que simula los métodos de sqlite3 (all, get, run, prepare)
  // para que el resto de tu código no necesite cambios.
  db = {
    all: (query, params, callback) => pool.query(query, params).then(res => callback(null, res.rows)).catch(err => callback(err)),
    get: (query, params, callback) => pool.query(query, params).then(res => callback(null, res.rows[0])).catch(err => callback(err)),
    run: (query, params, callback) => pool.query(query, params).then(res => callback(null, res)).catch(err => callback(err)),
    // Para prepare, necesitamos una implementación más compleja o adaptar el código que la usa.
    // Por ahora, una simulación simple. Si tienes problemas, revisaremos esto.
    prepare: (query) => {
        return {
            run: (params, callback) => db.run(query, params, callback),
            finalize: () => {} // No hace nada en este wrapper
        };
    }
  };
  console.log("Conectado a PostgreSQL remoto.");
} else {
  // Si no existe DATABASE_URL, usamos SQLite (para desarrollo local)
  db = new sqlite3.Database('./rifa.db', (err) => {
    if (err) {
      console.error("Error al conectar a SQLite:", err.message);
    } else {
      console.log('Conectado a la base de datos SQLite.');
    }
  });

  // Aseguramos que el método prepare exista también para sqlite3 si no lo tenías
  db.prepare = (query) => db.prepare(query);
}

// La lógica de creación de tablas debe ser compatible con ambos tipos de base de datos.
// Las sentencias SQL usadas aquí son compatibles con SQLite y PostgreSQL.
db.serialize(() => {
  // Tabla de usuarios (Administradores)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  // Tabla de Rifas
  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    number INTEGER PRIMARY KEY,
    name TEXT,
    phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'available' -- 'available', 'sold'
  )`);

  // Inicializar 200 números si la tabla de tickets está vacía (solo para SQLite localmente)
  // En PostgreSQL, la base de datos se creará vacía y la llenaremos manualmente o con un script aparte si es necesario.
  // Para simplificar, dejamos esta inicialización solo para SQLite.
  if (!process.env.DATABASE_URL) {
    db.get("SELECT COUNT(*) as count FROM tickets", [], (err, row) => {
      if (err) {
         console.error("Error al contar tickets:", err.message);
         return;
      }
      if (row && row.count === 0) {
        console.log("Inicializando números de rifa en SQLite...");
        const stmt = db.prepare("INSERT INTO tickets (number) VALUES (?)");
        for (let i = 1; i <= 200; i++) {
          stmt.run(i);
        }
        stmt.finalize();
        console.log("Números de rifa inicializados en SQLite.");
      }
    });
  }

  // Crear un admin por defecto si no hay ninguno (solo para SQLite localmente)
  // En PostgreSQL, podrías necesitar un script de 'seed' inicial o gestionarlo manualmente.
  if (!process.env.DATABASE_URL) {
    const bcrypt = require('bcryptjs');
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt); // ¡CAMBIA ESTA CONTRASEÑA!

    db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
       if (err) {
         console.error("Error al contar usuarios:", err.message);
         return;
       }
      if (row && row.count === 0) {
        db.run("INSERT INTO users (username, password) VALUES (?, ?)", ['admin', hash], (err) => {
          if (err) console.error("Error al crear usuario admin:", err.message);
          else console.log("Usuario admin creado en SQLite.");
        });
      }
    });
  }
});

module.exports = db;