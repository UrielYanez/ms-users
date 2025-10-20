const express = require('express');
const router = express.Router();

// Importamos el "factory" del controlador, que creamos en el paso anterior
const cvControllerFactory = require('../controllers/cvController');

/**
 * Módulo de rutas para la gestión del CV de un usuario (rutas agregadas).
 * Montado bajo /api/usuarios
 */
module.exports = (pool) => {
    // 1. Instanciar el controlador, pasándole el pool de DB
    const controller = cvControllerFactory(pool);

    // =================================================================
    // GET: Obtener el CV completo del usuario
    // Endpoint: GET /api/usuarios/:id/cv
    // =================================================================
    router.get('/:id/cv', controller.obtenerCVCompleto);

    // =================================================================
    // PUT: Actualizar/Sincronizar el CV completo del usuario
    // Endpoint: PUT /api/usuarios/:id/cv
    // =================================================================
    router.put('/:id/cv', controller.actualizarCVCompleto);

    return router;
};