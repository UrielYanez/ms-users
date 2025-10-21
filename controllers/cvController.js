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
     * GET: Obtiene el CV completo de un usuario utilizando la función SQL.
     * Endpoint: /api/usuarios/:id/cv
     */
    obtenerCVCompleto: async (req, res) => {
        const { id } = req.params;
        const userId = parseInt(id);

        if (!userId || isNaN(userId)) {
            return res.status(400).json({ error: 'ID de usuario inválido.' });
        }

        // 🚨 Llamada directa a la función SQL: usuarios.get_cv_perfil(ID)
        const query = `SELECT usuarios.get_cv_perfil($1) as cv_data;`;

        try {
            const result = await pool.query(query, [userId]);

            // La base de datos devuelve un único registro con un campo JSON (cv_data)
            if (result.rows.length === 0 || !result.rows[0].cv_data) {
                return res.status(404).json({ error: 'Perfil de CV no encontrado para este usuario.' });
            }

            // Enviamos directamente el objeto JSON devuelto por la función
            res.json(result.rows[0].cv_data);

        } catch (err) {
            console.error('Error al obtener CV con función SQL:', err.message);
            res.status(500).json({ error: 'Error interno al obtener el perfil del CV.', details: err.message });
        }
    },

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