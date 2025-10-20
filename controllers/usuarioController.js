const usuarioController = (pool) => ({

    // C - CREATE: Crear un nuevo usuario
    crearUsuario: async (req, res) => {
        const { id_userAuth, salario, ubicacion, id_area } = req.body;
        
        if (!id_userAuth || !salario || !ubicacion || !id_area) {
            return res.status(400).json({ error: 'Faltan campos requeridos.' });
        }

        const query = `
            INSERT INTO usuarios.usuarios (id_userAuth, salario, ubicacion, id_area) 
            VALUES ($1, $2, $3, $4) 
            RETURNING *;
        `;
        const values = [id_userAuth, salario, ubicacion, id_area];

        try {
            const result = await pool.query(query, values);
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error('Error al crear usuario:', err.message);
            // Capturar el error de FK si es posible (código 23503 en Postgres)
            res.status(400).json({ error: 'Error al crear usuario', details: err.message });
        }
    },

    // R - READ (All): Obtener todos los usuarios
    obtenerUsuarios: async (req, res) => {
        const query = 'SELECT * FROM usuarios.usuarios ORDER BY id;';
        
        try {
            const result = await pool.query(query);
            res.json(result.rows);
        } catch (err) {
            console.error('Error al obtener usuarios:', err.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    },

    // R - READ (Single): Obtener un usuario por ID
    obtenerUsuarioPorId: async (req, res) => {
        const { id } = req.params;
        const query = 'SELECT * FROM usuarios.usuarios WHERE id = $1;';
        
        try {
            const result = await pool.query(query, [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado.' });
            }
            res.json(result.rows[0]);
        } catch (err) {
            console.error(`Error al obtener usuario ID ${id}:`, err.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    },

    // U - UPDATE: Actualizar un usuario por ID
    actualizarUsuario: async (req, res) => {
        const { id } = req.params;
        const { id_userAuth, salario, ubicacion, id_area } = req.body;
        
        const query = `
            UPDATE usuarios.usuarios 
            SET id_userAuth = $1, salario = $2, ubicacion = $3, id_area = $4
            WHERE id = $5
            RETURNING *;
        `;
        const values = [id_userAuth, salario, ubicacion, id_area, id];
        
        try {
            const result = await pool.query(query, values);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado para actualizar.' });
            }
            res.json(result.rows[0]);
        } catch (err) {
            console.error(`Error al actualizar usuario ID ${id}:`, err.message);
            res.status(400).json({ error: 'Error al actualizar usuario', details: err.message });
        }
    },

    // D - DELETE: Eliminar un usuario por ID
    eliminarUsuario: async (req, res) => {
        const { id } = req.params;
        const query = 'DELETE FROM usuarios.usuarios WHERE id = $1 RETURNING id;';

        try {
            const result = await pool.query(query, [id]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado para eliminar.' });
            }
            res.status(204).send();
        } catch (err) {
            console.error(`Error al eliminar usuario ID ${id}:`, err.message);
            res.status(500).json({ error: 'Error al eliminar usuario', details: err.message });
        }
    },
});

module.exports = usuarioController;