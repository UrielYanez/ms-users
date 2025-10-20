// routes/usuarios.js
const express = require('express');
const router = express.Router();

// Importar la fábrica de controladores
const usuarioControllerFactory = require('../controllers/usuarioController');

/**
 * Módulo de rutas que conecta las URLs con las funciones del controlador.
 * @param {Pool} pool - El pool de conexiones de PostgreSQL.
 */
module.exports = (pool) => {
    // 1. Instanciar el controlador, pasándole el pool de DB
    const controller = usuarioControllerFactory(pool);

    // Mapeo de Rutas a Controladores
    
    // POST /api/usuarios (CREATE)
    router.post('/', controller.crearUsuario);

    // GET /api/usuarios (READ All)
    router.get('/', controller.obtenerUsuarios);

    // GET /api/usuarios/:id (READ Single)
    router.get('/:id', controller.obtenerUsuarioPorId);

    // PUT /api/usuarios/:id (UPDATE)
    router.put('/:id', controller.actualizarUsuario);

    // DELETE /api/usuarios/:id (DELETE)
    router.delete('/:id', controller.eliminarUsuario);

    return router;
};