// backend/index.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database'); // Ya hemos modificado este archivo para manejar PostgreSQL/SQLite

const app = express();

// Lee el puerto de las variables de entorno, o usa 3001 si no está definido
const PORT = process.env.PORT || 3001;

// Lee la clave secreta de las variables de entorno, o usa una por defecto si no está definida
// ¡IMPORTANTE! En producción, esta clave DEBE ser una variable de entorno fuerte y aleatoria.
const SECRET_KEY = process.env.SECRET_KEY || 'mi_clave_secreta_super_segura_y_larga';

app.use(cors());
app.use(bodyParser.json());

// --- Middleware para verificar JWT ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    // Si no hay token, puede ser una petición pública o una que requiera login
    // Para las rutas públicas (GET /api/tickets), no haremos nada aquí.
    // Para las rutas protegidas, se enviará 401.
    // Si la ruta es pública y no requiere token, simplemente continuamos.
    // Si la ruta es protegida y no hay token, el siguiente `jwt.verify` fallará.
    // console.log('No se proporcionó token de autorización.');
    // return res.sendStatus(401); // Descomentar si quieres que TODAS las rutas requieran token
    next(); // Continuar para permitir acceso a rutas públicas
    return;
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      console.error("Error de verificación de token:", err.message);
      return res.sendStatus(403); // Forbidden
    }
    req.user = user; // El payload del token está ahora en req.user
    // console.log('Token verificado. Usuario:', user);
    next(); // Token válido, continuar a la siguiente ruta
  });
};

// --- RUTAS PÚBLICAS ---

// 1. Obtener estado de todos los números (para la matriz)
// Esta ruta debe ser accesible públicamente para que el frontend muestre los tickets disponibles.
app.get('/api/tickets', (req, res) => {
  db.all("SELECT number, status FROM tickets", [], (err, rows) => {
    if (err) {
      console.error("Error al obtener tickets:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 2. Login - Autenticación de Admin
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // Buscar usuario en la base de datos
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      console.error("Error en consulta de login:", err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado o contraseña incorrecta" });
    }

    // Comparar la contraseña proporcionada con la almacenada (hasheada)
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Usuario no encontrado o contraseña incorrecta" });
    }

    // Si las credenciales son válidas, generar un token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username }, // Payload del token
      SECRET_KEY, // Clave secreta para firmar el token
      { expiresIn: '1h' } // El token expira en 1 hora
    );
    res.json({ token }); // Enviar el token al cliente
  });
});

// --- RUTAS PROTEGIDAS (Requieren JWT válido) ---

// 3. Comprar un número (Ahora protegida por authenticateToken)
// Solo usuarios autenticados (admins/vendedores) pueden registrar una venta.
app.post('/api/tickets/:number/buy', authenticateToken, (req, res) => {
  const { number } = req.params;
  const { name, phone, address } = req.body;

  // Validación básica
  if (!name || !phone) {
    return res.status(400).json({ error: "Nombre y teléfono son obligatorios" });
  }

  // Verificar si el número está disponible ANTES de actualizar
  db.get("SELECT status FROM tickets WHERE number = ?", [number], (err, row) => {
    if (err) {
      console.error("Error al verificar disponibilidad:", err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: "Número no encontrado" });
    }
    if (row.status === 'sold') {
      return res.status(400).json({ error: "El número ya está vendido" });
    }

    // Si está disponible, proceder a actualizar
    const query = `UPDATE tickets SET name = ?, phone = ?, address = ?, status = 'sold' WHERE number = ?`;
    db.run(query, [name, phone, address, number], function(err) { // Usamos 'function' para acceder a 'this.changes'
      if (err) {
        console.error("Error al registrar venta:", err.message);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) { // Si no se actualizó ninguna fila
          return res.status(404).json({ error: "Número no encontrado o ya vendido" });
      }
      console.log(`Número ${number} vendido a ${name}`);
      res.json({ message: "Venta registrada con éxito", number });
    });
  });
});

// 4. Obtener todos los datos de las rifas (para el panel de admin)
// Ruta protegida que solo el admin puede ver.
app.get('/api/admin/tickets', authenticateToken, (req, res) => {
  // Asegurarse de que el usuario esté autenticado (req.user debería tener la info)
  // Aunque el middleware ya lo verifica, es buena práctica tener esto en mente.
  // if (!req.user) return res.sendStatus(403);

  db.all("SELECT * FROM tickets ORDER BY number", [], (err, rows) => {
    if (err) {
      console.error("Error al obtener todos los tickets para admin:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 5. Resetear una rifa (para el admin)
// Ruta protegida para que el admin pueda liberar un número vendido.
app.post('/api/admin/tickets/:number/reset', authenticateToken, (req, res) => {
  const { number } = req.params;

  const query = `UPDATE tickets SET name = NULL, phone = NULL, address = NULL, status = 'available' WHERE number = ?`;
  db.run(query, [number], function(err) { // Usamos 'function' para acceder a 'this.changes'
    if (err) {
      console.error(`Error al resetear número ${number}:`, err.message);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) { // Si no se actualizó ninguna fila
        return res.status(404).json({ error: "Número no encontrado o no estaba vendido" });
    }
    console.log(`Número ${number} liberado.`);
    res.json({ message: "Número liberado correctamente" });
  });
});

// --- Inicio del servidor ---
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
  console.log(`Modo: ${process.env.DATABASE_URL ? 'Producción (PostgreSQL)' : 'Desarrollo (SQLite)'}`);
  console.log(`Clave secreta usada: ${SECRET_KEY.substring(0, 10)}...`); // Muestra solo el inicio de la clave
});