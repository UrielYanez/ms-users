// Función auxiliar para reajustar la secuencia de IDs de una tabla
const resetSequence = async (client, schema, table, column = 'id') => {
    // Encuentra el MAX(id) y establece el contador de la secuencia a ese valor.
    // Esto asegura que la próxima inserción use un ID nuevo y único.
    const query = `
        SELECT setval(pg_get_serial_sequence('${schema}.${table}', '${column}'), 
                      COALESCE(MAX(${column}), 1), false) 
        FROM ${schema}.${table};
    `;
    await client.query(query);
};

const cvController = (pool) => ({

    /**
     * GET: Obtiene el CV completo de un usuario (todas las secciones) con una sola petición.
     * Endpoint: /api/usuarios/:id/cv
     */
    obtenerCVCompleto: async (req, res) => {
        const { id } = req.params;

        // 🚨 Validación simple del ID
        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({ error: 'ID de usuario inválido.' });
        }

        const userId = parseInt(id);
        const client = await pool.connect(); // Usar un cliente para ejecutar múltiples queries en paralelo

        try {
            // Definición de las 5 consultas para las tablas del CV
            const experienciaQuery = 'SELECT * FROM usuarios.experiencia_laboral WHERE id_usuario = $1 ORDER BY id DESC;';
            const educacionQuery = 'SELECT * FROM usuarios.educacion WHERE id_usuario = $1 ORDER BY fecha_fin DESC;';
            const cursosQuery = 'SELECT * FROM usuarios.cursos WHERE id_usuario = $1 ORDER BY id DESC;';
            // Nota: Para las tablas de relación (muchos a muchos), se traen las FK.
            const habilidadesQuery = 'SELECT * FROM usuarios.usuarios_habilidades WHERE id_usuario = $1 ORDER BY id_habilidad;';
            const idiomasQuery = 'SELECT * FROM usuarios.usuarios_idiomas WHERE id_usuario = $1 ORDER BY id_idioma;';

            // Ejecutar todas las consultas en paralelo para mejorar el rendimiento
            const [
                experiencia,
                educacion,
                cursos,
                habilidades,
                idiomas
            ] = await Promise.all([
                client.query(experienciaQuery, [userId]),
                client.query(educacionQuery, [userId]),
                client.query(cursosQuery, [userId]),
                client.query(habilidadesQuery, [userId]),
                client.query(idiomasQuery, [userId])
            ]);

            client.release(); // Liberar el cliente

            // Responder con el objeto CV agregado
            res.json({
                id_usuario: userId,
                experienciaLaboral: experiencia.rows,
                educacion: educacion.rows,
                cursos: cursos.rows,
                habilidades: habilidades.rows,
                idiomas: idiomas.rows
            });

        } catch (err) {
            client.release();
            console.error('Error al obtener CV completo:', err.message);
            res.status(500).json({ error: 'Error interno al obtener datos del CV.', details: err.message });
        }
    },

    /**
     * PUT: Actualiza el CV completo (sincroniza las 5 tablas).
     * 🚨 Implementa una Transacción: Si falla una sección, se revierte todo.
     * Endpoint: /api/usuarios/:id/cv
     */
    /**
     * PUT: Actualiza el CV completo (sincroniza las 5 tablas).
     * 🚨 Implementa una Transacción: Si falla una sección, se revierte todo.
     * Endpoint: /api/usuarios/:id/cv
     */
    actualizarCVCompleto: async (req, res) => {
        const { id } = req.params;
        const userId = parseInt(id);
        const payload = req.body;

        // 🚨 Validación simple del ID
        if (!userId || isNaN(userId)) {
            return res.status(400).json({ error: 'ID de usuario inválido.' });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN'); // 🚨 INICIO DE LA TRANSACCIÓN

            // =================================================================
            // Estrategia: DELETE ALL (para este usuario) & INSERT ALL
            // Esto simplifica la lógica de sincronización (Insertar/Actualizar/Eliminar)
            // y es seguro gracias a la transacción.
            // =================================================================

            // ----------------------------------------------------------------------------------
            // 1. EXPERIENCIA LABORAL (usuarios.experiencia_laboral)
            // ----------------------------------------------------------------------------------
            const experienciaRecibida = payload.experienciaLaboral || [];
            await client.query(`DELETE FROM usuarios.experiencia_laboral WHERE id_usuario = $1`, [userId]);

            if (experienciaRecibida.length > 0) {
                const insertQueries = experienciaRecibida.map((exp) => {
                    return client.query(
                        `INSERT INTO usuarios.experiencia_laboral (id_usuario, empresa, cargo, descripcion) 
                         VALUES ($1, $2, $3, $4)`,
                        [userId, exp.Empresa, exp.Cargo, exp.Descripcion]
                    );
                });
                await Promise.all(insertQueries);
            }

            // ----------------------------------------------------------------------------------
            // 2. EDUCACIÓN (usuarios.educacion)
            // ----------------------------------------------------------------------------------
            const educacionRecibida = payload.educacion || [];
            await client.query(`DELETE FROM usuarios.educacion WHERE id_usuario = $1`, [userId]);

            if (educacionRecibida.length > 0) {
                const insertQueries = educacionRecibida.map((edu) => {
                    // Nota: Asegúrate que Fecha_inicio y Fecha_fin vengan en formato de fecha válido (YYYY-MM-DD)
                    return client.query(
                        `INSERT INTO usuarios.educacion (id_usuario, universidad, carrera, fecha_inicio, fecha_fin) 
                         VALUES ($1, $2, $3, $4, $5)`,
                        [userId, edu.Universidad, edu.Carrera, edu.Fecha_inicio, edu.Fecha_fin]
                    );
                });
                await Promise.all(insertQueries);
            }

            // ----------------------------------------------------------------------------------
            // 3. CURSOS (usuarios.cursos)
            // ----------------------------------------------------------------------------------
            const cursosRecibidos = payload.cursos || [];
            await client.query(`DELETE FROM usuarios.cursos WHERE id_usuario = $1`, [userId]);

            if (cursosRecibidos.length > 0) {
                const insertQueries = cursosRecibidos.map((curso) => {
                    return client.query(
                        `INSERT INTO usuarios.cursos (id_usuario, nombre_curso, descripcion, curso) 
                         VALUES ($1, $2, $3, $4)`,
                        [userId, curso.Nombre_curso, curso.Descripcion, curso.Curso]
                    );
                });
                await Promise.all(insertQueries);
            }

            // ----------------------------------------------------------------------------------
            // 4. HABILIDADES (usuarios.usuarios_habilidades) - Tablas de relación
            // ----------------------------------------------------------------------------------
            const habilidadesRecibidas = payload.habilidades || [];
            await client.query(`DELETE FROM usuarios.usuarios_habilidades WHERE id_usuario = $1`, [userId]);

            if (habilidadesRecibidas.length > 0) {
                const insertQueries = habilidadesRecibidas.map((habilidad) => {
                    // Solo se necesita id_usuario y id_habilidad
                    return client.query(
                        `INSERT INTO usuarios.usuarios_habilidades (id_usuario, id_habilidad) 
                         VALUES ($1, $2)`,
                        [userId, habilidad.id_habilidad]
                    );
                });
                await Promise.all(insertQueries);
            }

            // ----------------------------------------------------------------------------------
            // 5. IDIOMAS (usuarios.usuarios_idiomas) - Tablas de relación
            // ----------------------------------------------------------------------------------
            const idiomasRecibidos = payload.idiomas || [];
            await client.query(`DELETE FROM usuarios.usuarios_idiomas WHERE id_usuario = $1`, [userId]);

            if (idiomasRecibidos.length > 0) {
                const insertQueries = idiomasRecibidos.map((idioma) => {
                    // Solo se necesita id_usuario y id_idioma
                    return client.query(
                        `INSERT INTO usuarios.usuarios_idiomas (id_usuario, id_idioma) 
                         VALUES ($1, $2)`,
                        [userId, idioma.id_idioma]
                    );
                });
                await Promise.all(insertQueries);
            }

            // =================================================================

            // Importante: Llama a esta función para cada una de las tablas.
            await resetSequence(client, 'usuarios', 'experiencia_laboral');
            await resetSequence(client, 'usuarios', 'educacion');
            await resetSequence(client, 'usuarios', 'cursos');
            await resetSequence(client, 'usuarios', 'usuarios_habilidades');
            await resetSequence(client, 'usuarios', 'usuarios_idiomas');

            // =================================================================

            await client.query('COMMIT'); // ✅ CONFIRMAR LA TRANSACCIÓN
            client.release();
            res.json({ message: 'CV actualizado exitosamente.', id_usuario: userId });

        } catch (err) {
            await client.query('ROLLBACK'); // ❌ REVERTIR todo si algo falla
            client.release();
            console.error('Error en Transacción de CV:', err.message);
            // El error podría ser una clave foránea (FK) inválida (e.g., id_habilidad no existe)
            res.status(400).json({
                error: 'Fallo la actualización completa del CV (transacción revertida).',
                details: err.message
            });
        }
    }
});

module.exports = cvController;