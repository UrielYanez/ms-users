require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

// Importar los módulos de rutas
const usuariosRoutes = require('./routes/usuarios'); 
const cvRoutes = require('./routes/cv');

app.use(express.json());


const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  ssl: {
    // Comentar si la DB requiere SSL
    rejectUnauthorized: false 
  }
});

// Montar el módulo de rutas de usuarios bajo el prefijo /api/usuarios
app.use('/api/usuarios', usuariosRoutes(pool)); // Se sigue pasando el pool aquí.
app.use('/api/usuarios', cvRoutes(pool));

// Prueba de Conexión
app.get('/api/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    res.json({ 
      message: 'Conexión a la base de datos exitosa!',
      currentTime: result.rows[0].current_time 
    });
  } catch (err) {
    console.error('Error al conectar a la base de datos:', err.message);
    res.status(500).json({ 
      message: 'Error de conexión a la base de datos', 
      error: err.message 
    });
  }
});

// 4. Iniciar el Servidor
app.listen(port, () => {
  console.log(`Servidor en http://localhost:${port}`);
  console.log(`Conexión a la DB en http://localhost:${port}/api/health`);
});