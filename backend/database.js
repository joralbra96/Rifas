// backend/database.js
const { Pool } = require('pg'); // Importamos el driver de PostgreSQL
const bcrypt = require('bcryptjs');

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
    // Ajuste importante para PostgreSQL: pg usa res.rowCount en lugar de this.changes
    // Modificamos ligeramente la forma en que los controladores acceden a esto si es necesario.
    prepare: (query) => { // Simulación para métodos de prepared statement
        return {
            run: (params, callback) => db.run(query, params, callback),
            finalize: () => {}
        };
    }
  };
  console.log("Conectado a PostgreSQL remoto.");

  // --- INICIALIZACIÓN AUTOMÁTICA PARA POSTGRESQL ---
  const initPostgres = async () => {
    try {
      console.log("Comprobando e inicializando tablas en PostgreSQL si es necesario...");

      // 1. Crear tabla users
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE,
          password VARCHAR(255)
        )
      `);

      // 2. Crear tabla tickets
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tickets (
      number INTEGER PRIMARY KEY,
          name VARCHAR(255),
          phone VARCHAR(255),
          address TEXT,
          status VARCHAR(50) DEFAULT 'available'
        )
      `);

      // 3. Inicializar Admin si no existe
      const adminCheck = await pool.query("SELECT COUNT(*) FROM users");
      if (parseInt(adminCheck.rows[0].count) === 0) {
        console.log("Creando usuario admin inicial en PostgreSQL...");
    const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync('admin123', salt); // ¡CAMBIAR EN PRODUCCIÓN!
        await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", ['admin', hash]);
        console.log("Usuario admin creado.");
      }

      // 4. Inicializar Tickets si no existen
      const ticketsCheck = await pool.query("SELECT COUNT(*) FROM tickets");
      if (parseInt(ticketsCheck.rows[0].count) === 0) {
        console.log("Inicializando 200 números de rifa en PostgreSQL (esto puede tardar unos segundos)...");

        // Construimos una query grande de inserción múltiple para ser más eficientes
        let values = [];
        for (let i = 1; i <= 200; i++) {
          values.push(`(${i})`);
        }
        const insertQuery = `INSERT INTO tickets (number) VALUES ${values.join(',')}`;
        await pool.query(insertQuery);

        console.log("Números de rifa inicializados correctamente.");
      } else {
        console.log("Las tablas ya contienen datos. Saltando inicialización.");
      }
  } catch (err) {
      console.error("Error crítico durante la inicialización de PostgreSQL:", err.message);
  }
  };

  initPostgres(); // Ejecutar la inicialización
  // --- FIN INICIALIZACIÓN POSTGRESQL ---

} else {
  // --- MODIFICACIÓN DE SEGURIDAD ---
  // Si estamos en un entorno que parece ser Render (por la variable RENDER) y no hay DATABASE_URL,
  // lanzamos un error para evitar usar SQLite silenciosamente en producción.
  if (process.env.RENDER || process.env.NODE_ENV === 'production') {
     console.error("CRÍTICO: No se encontró la variable DATABASE_URL en el entorno de producción/Render.");
     console.error("Por favor, configura DATABASE_URL en el panel de Environment de Render.");
     process.exit(1); // Detiene el servidor
  }
  // Si NO existe DATABASE_URL y NO estamos en producción, usamos SQLite (para desarrollo local)
  console.log("No se encontró DATABASE_URL. Intentando usar SQLite para desarrollo local...");
  try {
  const sqlite3 = require('sqlite3').verbose(); // Importamos sqlite3 SOLO aquí
  db = new sqlite3.Database('./rifa.db', (err) => {
    if (err) {
      console.error("Error al conectar a SQLite:", err.message);
    } else {
        console.log('Conectado a la base de datos SQLite local.');
    }
  });

    // ... (el resto del código de sqlite) ...
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

      try {
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
      } catch (e) {
          console.error("Error inicializando el usuario en SQLite (¿falta bcryptjs?):", e.message);
}
    });
  } catch (err) {
      console.error("CRÍTICO: No se pudo cargar sqlite3 localmente. Asegúrate de instalarlo con 'npm install sqlite3' si quieres desarrollo local sin PostgreSQL.");
      process.exit(1);
  }
}

module.exports = db;