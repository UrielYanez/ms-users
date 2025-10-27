// controllers/postulacionController.js

const postulacionController = (pool) => ({

    obtenerPostulacionesPorUsuario: async (req, res) => {
        const idAuthParam = req.params.id; // Recibe el ID de Auth (ej. 3)
        const idAuth = parseInt(idAuthParam);

        if (isNaN(idAuth) || idAuth <= 0) {
            console.log(`[DEBUG] ID de Auth recibido inválido: ${idAuthParam}`); // Log de depuración
            return res.status(400).json({ error: 'ID de usuario para autenticación inválido.' });
        }

        console.log(`[DEBUG] Buscando postulaciones para ID de Auth: ${idAuth}`); // Log de depuración

        const query = `SELECT usuarios.get_postulaciones_perfil($1) AS postulaciones_data;`;

        try {
            const result = await pool.query(query, [idAuth]);

            // ==========================================================
            // 🚨 CONSOLE.LOG PARA DEPURACIÓN 🚨
            // Imprime el resultado completo devuelto por la función SQL
            // ==========================================================
            console.log('[DEBUG] Resultado de get_postulaciones_perfil:', result.rows);
            // ==========================================================

            // Si la función devuelve el JSON, lo enviamos
            if (result.rows.length > 0 && result.rows[0].postulaciones_data) {
                console.log('[DEBUG] Enviando datos de postulaciones al frontend.'); // Log de depuración
                return res.json(result.rows[0].postulaciones_data);
            }
            
            // Si la función devuelve null o vacío
            console.log('[DEBUG] No se encontraron datos de postulaciones, enviando objeto vacío.'); // Log de depuración
            return res.json({ postulaciones: [] }); 

        } catch (err) {
            console.error('[ERROR] Error al obtener postulaciones con función SQL:', err.message);
            // Loguea el error completo si la consulta falla
            console.error(err.stack); 
            res.status(500).json({ error: 'Error interno al obtener las postulaciones.', details: err.message });
        }
    }
});

module.exports = postulacionController;