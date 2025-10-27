const express = require('express');
const router = express.Router();

// Importamos el controlador que acabamos de crear
const direccionController = require('../controllers/direccionController');

/**
 * Módulo de rutas para la API de Direcciones (Dipomex).
 * Montado bajo /api/direccion
 * * Usamos el (pool) => {} para mantener la consistencia con
 * tus otros archivos de rutas, aunque este controlador no usa el pool.
 */
module.exports = (pool) => {

    // =================================================================
    // GET: Obtener la info de un CP
    // Endpoint: GET /api/direccion/:cp
    // =================================================================
    router.get('/:cp', direccionController.buscarPorCP);

    return router;
};