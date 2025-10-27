const axios = require('axios');

const direccionController = {

    buscarPorCP: async (req, res) => {

        // 1. Obtenemos el CP de los parámetros (Ej. 37600)
        const cp = req.params.cp;

        // 2. Obtenemos el token (tu APIKEY) de las variables de entorno
        // (Usamos el nombre que ya habíamos definido en tu .env)
        const token = process.env.DIPOMEX_TOKEN;

        if (!token) {
            console.error('Error: DIPOMEX_TOKEN no está configurado en .env');
            return res.status(500).json({ error: 'Error de configuración del servidor.' });
        }

        // 3. Definimos la URL
        const urlDipomex = 'https://api.tau.com.mx/dipomex/v1/codigo_postal';

        try {
            // 4. Hacemos la llamada a Dipomex (V1)
            const respuestaDipomex = await axios.get(urlDipomex, {
                headers: {
                    'APIKEY': token // El header se llama 'APIKEY'
                },
                params: {
                    'cp': cp // El CP se pasa como parámetro ?cp=37600
                }
            });

            // 5. Procesamos la respuesta (según tu documentación)
            const datosApi = respuestaDipomex.data;

            // Si la API devuelve un error (ej. CP no encontrado)
            if (datosApi.error === true || !datosApi.codigo_postal) {
                console.warn('API Dipomex (tau) devolvió un error:', datosApi.message);
                return res.status(404).json({ error: datosApi.message || 'Código Postal no encontrado.' });
            }

            // 6. Extraemos los datos que el Frontend necesita
            const infoCp = datosApi.codigo_postal;
            const respuestaParaFrontend = {
                estado: infoCp.estado,
                municipio: infoCp.municipio,
                colonias: infoCp.colonias
            };

            // 7. Enviamos la respuesta
            res.json(respuestaParaFrontend);

        } catch (error) {

            // Manejamos errores de Axios
            if (error.response) {
                // Si la API de 'tau' nos da un error (ej. 401, 403 por token malo)
                console.error('Error de API tau.com.mx:', error.response.data);
                res.status(error.response.status).json({
                    error: 'Error al consultar la API de direcciones',
                    details: error.response.data
                });
            } else if (error.request) {
                // Si no se pudo conectar (ej. el 'ENOTFOUND' de antes)
                console.error('Error de conexión con tau.com.mx:', error.message);
                res.status(500).json({ error: 'No se pudo conectar al servicio de direcciones.' });
            } else {
                console.error('Error inesperado:', error.message);
                res.status(500).json({ error: 'Error interno del servidor.' });
            }
        }
    }
};

module.exports = direccionController;