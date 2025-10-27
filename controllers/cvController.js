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
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
            bufferPages: true
        });
        const buffers = [];

        // 🎨 PALETA DE COLORES PROFESIONAL
        const COLORS = {
            primary: '#2C3E50',      // Azul oscuro elegante
            secondary: '#34495E',    // Gris azulado
            accent: '#3498DB',       // Azul brillante
            text: '#2C3E50',         // Texto principal
            textLight: '#7F8C8D',    // Texto secundario
            border: '#BDC3C7',       // Bordes sutiles
            background: '#ECF0F1'    // Fondo claro
        };

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // 📐 CONSTANTES DE LAYOUT
        const pageWidth = doc.page.width - 100; // Ancho útil
        const leftMargin = 50;
        const rightMargin = doc.page.width - 50;

        // ============================================
        // 🎯 HEADER - ENCABEZADO PROFESIONAL
        // ============================================

        // Rectángulo de fondo para el header
        doc.rect(0, 0, doc.page.width, 140)
            .fill(COLORS.primary);

        // Nombre del candidato
        doc.fillColor('#FFFFFF')
            .fontSize(32)
            .font('Helvetica-Bold')
            .text((cvData.nombre || 'CURRÍCULUM VITAE').toUpperCase(), leftMargin, 45, {
                width: pageWidth,
                align: 'left'
            });

        // Email con icono simulado
        doc.fontSize(11)
            .font('Helvetica')
            .fillColor('#ECF0F1')
            .text('✉ ' + (cvData.email || 'email@ejemplo.com'), leftMargin, 90, {
                width: pageWidth,
                align: 'left'
            });

        // Línea decorativa inferior
        doc.rect(leftMargin, 120, pageWidth, 3)
            .fill(COLORS.accent);

        // Resetear posición Y después del header
        doc.y = 160;

        // ============================================
        // 📋 FUNCIÓN PARA RENDERIZAR SECCIONES
        // ============================================

        const renderSection = (title, dataArray, mapFunction) => {
            // Verificar si hay espacio suficiente, si no, crear nueva página
            if (doc.y > doc.page.height - 200) {
                doc.addPage();
            }

            doc.moveDown(0.5);

            // TÍTULO DE SECCIÓN con barra lateral
            const titleY = doc.y;

            // Barra lateral de color
            doc.rect(leftMargin - 10, titleY - 2, 4, 20)
                .fill(COLORS.accent);

            // Título
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .fillColor(COLORS.primary)
                .text(title.toUpperCase(), leftMargin, titleY, {
                    width: pageWidth
                });

            // Línea debajo del título
            doc.strokeColor(COLORS.border)
                .lineWidth(0.5)
                .moveTo(leftMargin, doc.y + 5)
                .lineTo(rightMargin, doc.y + 5)
                .stroke();

            doc.moveDown(1);

            // CONTENIDO DE LA SECCIÓN
            if (dataArray && dataArray.length > 0) {
                dataArray.forEach((item, index) => {
                    // Verificar espacio para el item
                    if (doc.y > doc.page.height - 150) {
                        doc.addPage();
                        doc.y = 50;
                    }

                    const lines = mapFunction(item);
                    const itemStartY = doc.y;

                    // Marcador circular decorativo
                    doc.circle(leftMargin + 5, itemStartY + 6, 3)
                        .fill(COLORS.accent);

                    // Línea 1: Título principal (bold)
                    doc.fontSize(12)
                        .font('Helvetica-Bold')
                        .fillColor(COLORS.text)
                        .text(lines[0] || 'Sin Título', leftMargin + 15, itemStartY, {
                            width: pageWidth - 15
                        });

                    // Línea 2: Subtítulo (italic, color secundario)
                    if (lines[1]) {
                        doc.fontSize(10)
                            .font('Helvetica-Oblique')
                            .fillColor(COLORS.textLight)
                            .text(lines[1], leftMargin + 15, doc.y + 2, {
                                width: pageWidth - 15
                            });
                    }

                    // Resto de líneas: Descripción
                    lines.slice(2).forEach(line => {
                        if (line && String(line).trim() !== '') {
                            doc.fontSize(10)
                                .font('Helvetica')
                                .fillColor(COLORS.text)
                                .text('• ' + String(line), leftMargin + 20, doc.y + 4, {
                                    width: pageWidth - 20,
                                    align: 'left',
                                    lineGap: 2
                                });
                        }
                    });

                    // Separador entre items (excepto el último)
                    if (index < dataArray.length - 1) {
                        doc.moveDown(0.8);
                    } else {
                        doc.moveDown(0.5);
                    }
                });

                doc.moveDown(0.5);
            } else {
                // Sin datos
                doc.fontSize(10)
                    .font('Helvetica-Oblique')
                    .fillColor(COLORS.textLight)
                    .text('Sin información registrada', leftMargin + 15, doc.y, {
                        width: pageWidth - 15
                    });
                doc.moveDown(1.5);
            }
        };

        // ============================================
        // 📝 RENDERIZAR TODAS LAS SECCIONES
        // ============================================

        // EXPERIENCIA LABORAL
        renderSection('Experiencia Laboral', cvData.experienciaLaboral, (exp) => [
            exp.cargo || 'Cargo no especificado',
            exp.empresa || 'Empresa no especificada',
            exp.descripcion || ''
        ]);

        // EDUCACIÓN
        renderSection('Educación', cvData.educacion, (edu) => {
            const periodo = (edu.fecha_inicio && edu.fecha_fin)
                ? `${edu.fecha_inicio} - ${edu.fecha_fin}`
                : 'Período no especificado';
            return [
                edu.carrera || 'Carrera no especificada',
                edu.universidad || 'Universidad no especificada',
                periodo
            ];
        });

        // CURSOS Y CERTIFICACIONES
        renderSection('Cursos y Certificaciones', cvData.cursos, (curso) => {
            const lines = [
                curso.nombre_curso || 'Curso no especificado',
                curso.descripcion || ''
            ];
            if (curso.curso && String(curso.curso).trim() !== '') {
                lines.push(`🔗 ${curso.curso}`);
            }
            return lines;
        });

        // ============================================
        // 🔧 HABILIDADES TÉCNICAS (Diseño en columnas)
        // ============================================

        if (cvData.habilidades && cvData.habilidades.length > 0) {
            if (doc.y > doc.page.height - 200) {
                doc.addPage();
            }

            doc.moveDown(0.5);
            const titleY = doc.y;

            // Barra lateral
            doc.rect(leftMargin - 10, titleY - 2, 4, 20).fill(COLORS.accent);

            // Título
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .fillColor(COLORS.primary)
                .text('HABILIDADES TÉCNICAS', leftMargin, titleY);

            // Línea
            doc.strokeColor(COLORS.border)
                .lineWidth(0.5)
                .moveTo(leftMargin, doc.y + 5)
                .lineTo(rightMargin, doc.y + 5)
                .stroke();

            doc.moveDown(1);

            // Habilidades en formato de tags/pills
            const habilidadesList = cvData.habilidades.map(h => h.nombre || 'N/A');
            const startY = doc.y;
            let currentX = leftMargin + 15;
            let currentY = startY;
            const tagPadding = 8;
            const tagMargin = 10;

            habilidadesList.forEach(habilidad => {
                const textWidth = doc.widthOfString(habilidad, { fontSize: 10 });
                const tagWidth = textWidth + (tagPadding * 2);

                // Si no cabe en la línea, bajar
                if (currentX + tagWidth > rightMargin) {
                    currentX = leftMargin + 15;
                    currentY += 25;
                }

                // Dibujar el "pill"
                doc.roundedRect(currentX, currentY, tagWidth, 18, 9)
                    .fill(COLORS.background);

                // Texto dentro del pill
                doc.fontSize(10)
                    .font('Helvetica')
                    .fillColor(COLORS.text)
                    .text(habilidad, currentX + tagPadding, currentY + 4, {
                        width: textWidth
                    });

                currentX += tagWidth + tagMargin;
            });

            doc.y = currentY + 30;
            doc.moveDown(0.5);
        }

        // ============================================
        // 🌍 IDIOMAS
        // ============================================

        if (cvData.idiomas && cvData.idiomas.length > 0) {
            if (doc.y > doc.page.height - 150) {
                doc.addPage();
            }

            doc.moveDown(0.5);
            const titleY = doc.y;

            // Barra lateral
            doc.rect(leftMargin - 10, titleY - 2, 4, 20).fill(COLORS.accent);

            // Título
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .fillColor(COLORS.primary)
                .text('IDIOMAS', leftMargin, titleY);

            // Línea
            doc.strokeColor(COLORS.border)
                .lineWidth(0.5)
                .moveTo(leftMargin, doc.y + 5)
                .lineTo(rightMargin, doc.y + 5)
                .stroke();

            doc.moveDown(1);

            // Lista de idiomas con viñetas
            cvData.idiomas.forEach(idioma => {
                doc.fontSize(10)
                    .font('Helvetica')
                    .fillColor(COLORS.text)
                    .text('• ' + (idioma.idioma || 'N/A'), leftMargin + 15, doc.y, {
                        width: pageWidth - 15
                    });
                doc.moveDown(0.3);
            });

            doc.moveDown(0.5);
        }

        // ============================================
        // 📄 FOOTER - Pie de página en todas las páginas
        // ============================================

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);

            // Línea superior del footer
            doc.strokeColor(COLORS.border)
                .lineWidth(0.5)
                .moveTo(leftMargin, doc.page.height - 40)
                .lineTo(rightMargin, doc.page.height - 40)
                .stroke();

            // Texto del footer
            doc.fontSize(8)
                .font('Helvetica')
                .fillColor(COLORS.textLight)
                .text(
                    `Página ${i + 1} de ${range.count} | Generado el ${new Date().toLocaleDateString('es-ES')}`,
                    leftMargin,
                    doc.page.height - 30,
                    {
                        width: pageWidth,
                        align: 'center'
                    }
                );
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