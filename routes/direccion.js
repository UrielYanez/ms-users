const express = require('express');
const router = express.Router();
const direccionController = require('../controllers/direccionController'); // Asumo que el controlador se llama así

module.exports = (pool) => {
    // GET /api/direccion/:cp
    router.get('/:cp', direccionController.buscarPorCP);

    return router;
};