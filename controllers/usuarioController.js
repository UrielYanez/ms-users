const usuarioController = (pool) => ({

    // C - CREATE (Con los campos de la API)
    crearUsuario: async (req, res) => {
        const { 
            id_userAuth, salario, id_area, 
            codigo_postal, estado, municipio, colonia
        } = req.body;
        
        if (!id_userAuth || !salario || !id_area || !codigo_postal || !estado || !municipio || !colonia) {
            return res.status(400).json({ error: 'Faltan campos requeridos.' });
        }

        const query = `
            INSERT INTO usuarios.usuarios (
                id_userAuth, salario, id_area, 
                codigo_postal, estado, municipio, colonia
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING *;
        `;
        const values = [
            id_userAuth, salario, id_area,
            codigo_postal, estado, municipio, colonia
        ];

        try {
            const result = await pool.query(query, values);
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error('Error al crear usuario:', err.message);
            res.status(400).json({ error: 'Error al crear usuario', details: err.message });
        }
    },

    // R - READ (All) (Del original)
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

    // R - READ (Single by ID) (Del original)
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

    // R - READ (Single by Auth ID) (El nuevo que añadimos)
    obtenerUsuarioPorAuthId: async (req, res) => {
        const { id_userAuth } = req.params;
        const query = 'SELECT * FROM usuarios.usuarios WHERE id_userAuth = $1;';
        
        try {
            const result = await pool.query(query, [id_userAuth]);
            if (result.rows.length === 0) {
                // ¡Esto no es un error! Es un usuario nuevo que no tiene perfil.
                return res.status(404).json({ error: 'Perfil no encontrado. El usuario debe crear uno.' });
            }
            res.json(result.rows[0]);
        } catch (err) {
            console.error(`Error al obtener usuario por Auth ID ${id_userAuth}:`, err.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    },

    // U - UPDATE (Con los campos de la API)
    actualizarUsuario: async (req, res) => {
        const { id } = req.params;
        const { 
            id_userAuth, salario, id_area, 
            codigo_postal, estado, municipio, colonia
        } = req.body;
        
        const query = `
            UPDATE usuarios.usuarios 
            SET 
                id_userAuth = $1, salario = $2, id_area = $3,
                codigo_postal = $4, estado = $5, municipio = $6, colonia = $7
            WHERE id = $8
            RETURNING *;
        `;
        const values = [
            id_userAuth, salario, id_area,
            codigo_postal, estado, municipio, colonia,
            id
        ];
        
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

    // D - DELETE (Del original)
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