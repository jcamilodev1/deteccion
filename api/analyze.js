const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- CONFIGURACIÓN DE AZURE ---
// Pega tus credenciales del portal de Azure aquí
const AZURE_ENDPOINT = 'https://prueba150.cognitiveservices.azure.com/';
const AZURE_KEY = 'EstuQZXkTw6kD3En3GLfhsd8JUmLRP4Wewbhgb92ua3HuMeGHW0DJQQJ99BHACYeBjFXJ3w3AAAFACOGVqt2';
// ------------------------------------------------

// La URL específica para la API de lectura (OCR) de Azure
const AZURE_OCR_URL = `${AZURE_ENDPOINT}vision/v4.0/read/analyze`;

// Función para esperar un tiempo determinado (pausa entre reintentos)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// El endpoint se define en la raíz del archivo
app.post('/', async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No se proporcionó ninguna imagen.' });
        }

        // Convierte la imagen de base64 a un buffer
        const imageBuffer = Buffer.from(image.split(',')[1], 'base64');

        // --- PASO 1: Enviar la imagen a Azure para que inicie el análisis ---
        const initialResponse = await axios.post(AZURE_OCR_URL, imageBuffer, {
            headers: {
                'Ocp-Apim-Subscription-Key': AZURE_KEY,
                'Content-Type': 'application/octet-stream'
            }
        });

        // Azure responde con una URL para consultar el estado del análisis
        const operationUrl = initialResponse.headers['operation-location'];
        let analysisResult;

        // --- PASO 2: Preguntar repetidamente a Azure si el análisis ha terminado ---
        while (true) {
            const resultResponse = await axios.get(operationUrl, {
                headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY }
            });

            const status = resultResponse.data.status;
            if (status === 'succeeded') {
                analysisResult = resultResponse.data.analyzeResult;
                break; // Salimos del bucle si el análisis fue exitoso
            }
            if (status === 'failed') {
                throw new Error('El análisis de la imagen en Azure falló.');
            }
            
            await sleep(500); // Esperamos medio segundo antes de volver a preguntar
        }

        // --- PASO 3: Unir todo el texto encontrado línea por línea ---
        let extractedText = '';
        if (analysisResult && analysisResult.readResults) {
            analysisResult.readResults.forEach(page => {
                page.lines.forEach(line => {
                    extractedText += line.text + '\n';
                });
            });
        }

        // Enviar el texto extraído de vuelta al frontend
        res.json({ text: extractedText.trim() || 'No se encontró texto.' });

    } catch (error) {
        // Manejo de errores
        console.error('ERROR CON AZURE VISION API:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Error al procesar la imagen con Azure.' });
    }
});

// Exporta la app para que Vercel la pueda usar como una serverless function.
// NO se usa app.listen().
module.exports = app;