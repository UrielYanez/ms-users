require('dotenv').config();
const cors = require('cors');

const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

const router = express.Router({ mergeParams: true });
// Importar los módulos de rutas
const usuariosRoutes = require('./routes/usuarios'); 
const cvRoutes = require('./routes/cv');
const direccionRoutes = require('./routes/direccion');
const postulacionesRoutes = require('./routes/postulaciones');

app.use(express.json());
app.use(cors());


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
// Montaje de Rutas
app.use('/api/direccion', direccionRoutes(pool)); 

// Montar Rutas de Usuarios Base
app.use('/api/usuarios', usuariosRoutes(pool)); 

// Montar Rutas de CV
app.use('/api/usuarios', cvRoutes(pool));      

// 🚨 Montar Rutas de Postulaciones (usa el mismo prefijo que las otras)
app.use('/api/usuarios', postulacionesRoutes(pool));
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