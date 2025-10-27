// controllers/cvController.js

// 1. Imports necesarios
const PDFDocument = require('pdfkit'); 
const fs = require('fs');
const path = require('path');

// Función auxiliar para reajustar la secuencia de IDs de una tabla (CORREGIDA)
const resetSequence = async (client, schema, table, column = 'id') => {
    // 🚨 CORRECCIÓN CLAVE: 
    // 1. Usamos COALESCE(MAX(id), 0) para asegurar que, si la tabla está vacía, el valor sea 0.
    // 2. Usamos 'true' para que el próximo ID generado sea el valor + 1.
    const query = `
        SELECT setval(pg_get_serial_sequence('${schema}.${table}', '${column}'), 
                      COALESCE(MAX(${column}), 0), true) 
        FROM ${schema}.${table};
    `;
    try {
        await client.query(query);
        console.log(`Secuencia reseteada para ${schema}.${table}`);
    } catch (err) {
        console.error(`Error reseteando secuencia para ${schema}.${table}:`, err.message);
        throw err;
    }
};

// Función auxiliar para generar el PDF como Buffer (NO CAMBIA)
const generarCVBuffer = (cvData) => {
    // ... (Tu código de generarCVBuffer se queda igual) ...
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        const PRIMARY_COLOR = '#004080';
        const ACCENT_COLOR = '#6c757d';
        const BLACK = '#333333';

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            resolve(Buffer.concat(buffers));
        });
        doc.on('error', reject); 
        
        const renderSection = (title, dataArray, mapFunction) => {
            // ... (Lógica de renderSection) ...
            if (dataArray && dataArray.length > 0) {
                doc.moveDown(0.8);
                doc.fontSize(15).font('Helvetica-Bold').fillColor(PRIMARY_COLOR).text(title, { underline: true });
                doc.moveDown(0.6);
                
                dataArray.forEach(item => {
                    const lines = mapFunction(item);
                    
                    doc.fontSize(11).font('Helvetica-Bold').fillColor(BLACK).text(lines[0] || 'Sin Título');
                    doc.fontSize(10).font('Helvetica-Oblique').fillColor(ACCENT_COLOR).text(lines[1] || 'Sin Subtítulo');
                    
                    lines.slice(2).forEach(line => {
                        doc.fontSize(10).font('Helvetica').fillColor(BLACK).text(String(line), { indent: 10 }); 
                    });
                    doc.moveDown(0.5);
                });
                doc.moveDown(0.5);
            } else {
                doc.moveDown(0.8);
                doc.fontSize(15).font('Helvetica-Bold').fillColor(PRIMARY_COLOR).text(title, { underline: true });
                doc.fontSize(10).font('Helvetica-Oblique').fillColor(ACCENT_COLOR).text('Sin datos registrados.');
                doc.moveDown(1.5);
            }
            doc.fillColor(BLACK); 
        };

        doc.fillColor(BLACK).fontSize(28).font('Helvetica-Bold').text(cvData.nombre || 'CV de Usuario');
        doc.fontSize(12).font('Helvetica').text(cvData.email || 'Email no disponible');
        doc.strokeColor(PRIMARY_COLOR).lineWidth(1).moveTo(50, doc.y).lineTo(560, doc.y).stroke(); 
        doc.moveDown(1);

        renderSection('Experiencia Laboral', cvData.experienciaLaboral, (exp) => [
            exp.cargo || 'N/A', exp.empresa || 'N/A', exp.descripcion || 'N/A',
        ]);
        renderSection('Educación', cvData.educacion, (edu) => [
            edu.carrera || 'N/A', edu.universidad || 'N/A', `Período: ${edu.fecha_inicio || 'N/A'} - ${edu.fecha_fin || 'N/A'}`,
        ]);
        renderSection('Cursos y Certificaciones', cvData.cursos, (curso) => {
            const lines = [`${curso.nombre_curso || 'N/A'}`, `${curso.descripcion || 'N/A'}`];
            if (curso.curso && String(curso.curso).trim() !== '') { lines.push(`Link: ${curso.curso}`); }
            return lines;
        });

        if (cvData.habilidades && cvData.habilidades.length > 0) {
            doc.fontSize(15).font('Helvetica-Bold').fillColor(PRIMARY_COLOR).text('Habilidades Técnicas', { underline: true });
            doc.moveDown(0.6);
            doc.fillColor(BLACK).list(cvData.habilidades.map((s) => s.nombre || 'N/A'), {
                bulletRadius: 2, textIndent: 10, columns: 3, columnGap: 20
            });
            doc.moveDown(1.5);
        }
        
        if (cvData.idiomas && cvData.idiomas.length > 0) {
            doc.fontSize(15).font('Helvetica-Bold').fillColor(PRIMARY_COLOR).text('Idiomas', { underline: true });
            doc.moveDown(0.6);
            doc.fillColor(BLACK).list(cvData.idiomas.map((l) => l.idioma || 'N/A'), {
                bulletRadius: 2, textIndent: 10, columns: 2, columnGap: 20
            });
            doc.moveDown(1);
        }

        doc.end();
    });
};


const cvController = (pool) => ({

    obtenerCVCompleto: async (req, res) => {
        // ... (Tu código de obtenerCVCompleto)
        const idAuthParam = req.params.id;
        const idAuth = parseInt(idAuthParam);

        if (!idAuth || isNaN(idAuth)) {
            return res.status(400).json({ error: 'ID de usuario (auth) inválido.' });
        }

        const query = `SELECT usuarios.get_cv_perfil($1) as cv_data;`;

        try {
            const result = await pool.query(query, [idAuth]);

            if (result.rows.length === 0 || !result.rows[0].cv_data || Object.keys(result.rows[0].cv_data).length === 0) {
                return res.status(404).json({ error: 'Perfil de CV no encontrado para este usuario.' });
            }

            res.json(result.rows[0].cv_data);

        } catch (err) {
            console.error('Error al obtener CV con función SQL:', err.message);
            res.status(500).json({ error: 'Error interno al obtener el perfil del CV.', details: err.message });
        }
    }, 

    actualizarCVCompleto: async (req, res) => {
        const idAuthParam = req.params.id;
        const idAuth = parseInt(idAuthParam);

        if (!idAuth || isNaN(idAuth)) {
            return res.status(400).json({ error: 'ID de usuario (auth) inválido.' });
        }

        const payload = req.body;
        const client = await pool.connect();

        try {
            // BUSCAR EL ID DEL PERFIL CORRESPONDIENTE (ej. 4)
            const userProfileQuery = 'SELECT id FROM usuarios.usuarios WHERE id_userAuth = $1';
            const userProfileResult = await client.query(userProfileQuery, [idAuth]);

            if (userProfileResult.rows.length === 0) {
                client.release();
                return res.status(404).json({ error: 'Perfil de usuario no encontrado para este ID de autenticación.' });
            }
            const idPerfilUsuario = userProfileResult.rows[0].id;

            await client.query('BEGIN'); 

            // --- 1. EXPERIENCIA LABORAL ---
            await client.query(`DELETE FROM usuarios.experiencia_laboral WHERE id_usuario = $1`, [idPerfilUsuario]);
            await resetSequence(client, 'usuarios', 'experiencia_laboral'); // Reset antes de insertar
            const experienciaRecibida = payload.experienciaLaboral || [];
            if (experienciaRecibida.length > 0) {
                const insertQueries = experienciaRecibida.map((exp) => {
                    return client.query(
                        `INSERT INTO usuarios.experiencia_laboral (id_usuario, empresa, cargo, descripcion) VALUES ($1, $2, $3, $4)`,
                        [idPerfilUsuario, exp.empresa, exp.cargo, exp.descripcion]
                    );
                });
                await Promise.all(insertQueries);
            }

            // --- 2. EDUCACIÓN ---
            await client.query(`DELETE FROM usuarios.educacion WHERE id_usuario = $1`, [idPerfilUsuario]);
            await resetSequence(client, 'usuarios', 'educacion');
            const educacionRecibida = payload.educacion || [];
            if (educacionRecibida.length > 0) {
                const insertQueries = educacionRecibida.map((edu) => {
                    return client.query(
                       `INSERT INTO usuarios.educacion (id_usuario, universidad, carrera, fecha_inicio, fecha_fin) VALUES ($1, $2, $3, $4, $5)`,
                       [idPerfilUsuario, edu.universidad, edu.carrera, edu.fecha_inicio, edu.fecha_fin]
                    );
                });
                await Promise.all(insertQueries);
            }

             // --- 3. CURSOS ---
             await client.query(`DELETE FROM usuarios.cursos WHERE id_usuario = $1`, [idPerfilUsuario]);
             await resetSequence(client, 'usuarios', 'cursos');
             const cursosRecibidos = payload.cursos || [];
             if (cursosRecibidos.length > 0) {
                 const insertQueries = cursosRecibidos.map((curso) => {
                     return client.query(
                         `INSERT INTO usuarios.cursos (id_usuario, nombre_curso, descripcion, curso) VALUES ($1, $2, $3, $4)`,
                         [idPerfilUsuario, curso.nombre_curso, curso.descripcion, curso.curso]
                     );
                 });
                 await Promise.all(insertQueries);
             }

             // --- 4. HABILIDADES ---
             await client.query(`DELETE FROM usuarios.usuarios_habilidades WHERE id_usuario = $1`, [idPerfilUsuario]);
             await resetSequence(client, 'usuarios', 'usuarios_habilidades');
             const habilidadesRecibidas = payload.habilidades || [];
             if (habilidadesRecibidas.length > 0) {
                 const insertQueries = habilidadesRecibidas.map((habilidad) => {
                     return client.query(
                         `INSERT INTO usuarios.usuarios_habilidades (id_usuario, id_habilidad) VALUES ($1, $2)`,
                         [idPerfilUsuario, habilidad.id_habilidad]
                     );
                 });
                 await Promise.all(insertQueries);
             }

             // --- 5. IDIOMAS ---
             await client.query(`DELETE FROM usuarios.usuarios_idiomas WHERE id_usuario = $1`, [idPerfilUsuario]);
             await resetSequence(client, 'usuarios', 'usuarios_idiomas');
             const idiomasRecibidos = payload.idiomas || [];
             if (idiomasRecibidos.length > 0) {
                 const insertQueries = idiomasRecibidos.map((idioma) => {
                     return client.query(
                         `INSERT INTO usuarios.usuarios_idiomas (id_usuario, id_idioma) VALUES ($1, $2)`,
                         [idPerfilUsuario, idioma.id_idioma]
                     );
                 });
                 await Promise.all(insertQueries);
             }

            await client.query('COMMIT'); 
            client.release();
            res.json({ message: 'CV actualizado exitosamente.', id_usuario: idPerfilUsuario });

        } catch (err) {
            await client.query('ROLLBACK');
            client.release();
            console.error('Error Completo en Transacción de CV:', err);
            res.status(400).json({
                error: 'Fallo la actualización completa del CV (transacción revertida).',
                details: err.message
            });
        }
    }, 

    descargarCVPDF: async (req, res) => {
        const idAuth = parseInt(req.params.id);

        if (!idAuth || isNaN(idAuth)) {
            return res.status(400).send('ID de usuario (auth) inválido.');
        }

        try {
            const query = `SELECT usuarios.get_cv_perfil($1) as cv_data;`;
            const result = await pool.query(query, [idAuth]);

            if (result.rows.length === 0 || !result.rows[0].cv_data) {
                return res.status(404).send('CV no encontrado para este usuario.');
            }
            const cvData = result.rows[0].cv_data;

            // 1. Generar el Buffer del PDF
            const pdfBuffer = await generarCVBuffer(cvData);
            
            // 2. Enviar el Buffer con cabeceras de visualización
            res.setHeader('Content-Type', 'application/pdf'); 
            res.setHeader('Content-Disposition', 'inline'); 

            res.status(200).send(pdfBuffer); 
        } catch (err) {
            console.error('Error al generar PDF con PDFKit:', err.message);
            res.status(500).send('Error interno al generar el PDF.');
        }
    }

});

module.exports = cvController;