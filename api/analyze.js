const axios = require('axios');

// Este es el formato nativo para una Serverless Function de Vercel
module.exports = async (req, res) => {
    // 1. Permitir CORS y verificar que sea un método POST
    res.setHeader('Access-Control-Allow-Origin', '*'); // Permite cualquier origen
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejar la petición "preflight" de CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Método no permitido' });
    }

    try {
        // 2. Leer las variables de entorno de forma segura desde Vercel
const AZURE_ENDPOINT = 'https://prueba150.cognitiveservices.azure.com/';
const AZURE_KEY = 'EstuQZXkTw6kD3En3GLfhsd8JUmLRP4Wewbhgb92ua3HuMeGHW0DJQQJ99BHACYeBjFXJ3w3AAAFACOGVqt2';

        if (!AZURE_KEY || !AZURE_ENDPOINT) {
            throw new Error('Las variables de entorno de Azure no están configuradas en Vercel.');
        }

        const AZURE_OCR_URL = `${AZURE_ENDPOINT}vision/v4.0/read/analyze`;
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No se proporcionó ninguna imagen.' });
        }

        const imageBuffer = Buffer.from(image.split(',')[1], 'base64');

        // 3. El resto de la lógica para llamar a Azure es idéntica
        const initialResponse = await axios.post(AZURE_OCR_URL, imageBuffer, {
            headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY, 'Content-Type': 'application/octet-stream' }
        });

        const operationUrl = initialResponse.headers['operation-location'];
        let analysisResult;

        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        while (true) {
            const resultResponse = await axios.get(operationUrl, { headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY } });
            const status = resultResponse.data.status;
            if (status === 'succeeded') {
                analysisResult = resultResponse.data.analyzeResult;
                break;
            }
            if (status === 'failed') {
                throw new Error('El análisis de la imagen en Azure falló.');
            }
            await sleep(500);
        }

        let extractedText = '';
        if (analysisResult && analysisResult.readResults) {
            analysisResult.readResults.forEach(page => page.lines.forEach(line => { extractedText += line.text + '\n'; }));
        }

        // 4. Enviar la respuesta exitosa
        res.status(200).json({ text: extractedText.trim() || 'No se encontró texto.' });

    } catch (error) {
        console.error('ERROR EN LA FUNCIÓN SERVERLESS:', error.message);
        res.status(500).json({ error: error.message });
    }
};