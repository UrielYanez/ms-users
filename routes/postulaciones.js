// routes/postulaciones.js
const express = require('express');
// La clave mergeParams: true es esencial para heredar req.params
const router = express.Router({ mergeParams: true }); 
const postulacionControllerFactory = require('../controllers/postulacionController');

module.exports = (pool) => {
    const controller = postulacionControllerFactory(pool);

    // 🚨 CORRECCIÓN: La ruta debe capturar el ID de perfil y luego /postulaciones
    // El path resultante es /api/usuarios + /:id/postulaciones
    router.get('/:id/postulaciones', controller.obtenerPostulacionesPorUsuario);

    return router;
};