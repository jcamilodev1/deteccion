document.addEventListener('DOMContentLoaded', () => {

    const ANALYSIS_WIDTH = 320;

    const analyzeButton = document.getElementById('analyzeButton');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const resultElement = document.getElementById('result');
    const codeResultElement = document.getElementById('codeResult');

    let analysisInterval = null;
    let photoTaken = false;

    function startApp() {
        analyzeButton.disabled = false;
        analyzeButton.textContent = 'Iniciar Análisis en Tiempo Real';

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(stream => {
                    video.srcObject = stream;
                    video.play();
                })
                .catch(err => {
                    console.error("Error al acceder a la cámara:", err);
                    resultElement.textContent = "Error al acceder a la cámara.";
                });
        }

        analyzeButton.addEventListener('click', () => {
            if (analysisInterval) {
                clearInterval(analysisInterval);
                analysisInterval = null;
                analyzeButton.textContent = 'Iniciar Análisis en Tiempo Real';
                video.style.borderColor = '#ccc';
                resultElement.textContent = 'Análisis detenido.';
                codeResultElement.textContent = '';
            } else {
                analyzeButton.textContent = 'Detener Análisis';
                analysisInterval = setInterval(analyzeAndHandleSharpness, 500);
            }
        });
    }

    function analyzeAndHandleSharpness() {
        if (video.readyState < 2) return;

        const aspectRatio = video.videoHeight / video.videoWidth;
        canvas.width = ANALYSIS_WIDTH;
        canvas.height = ANALYSIS_WIDTH * aspectRatio;

        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
            let src = cv.imread(canvas);
            let matGray = new cv.Mat();
            let matLaplacian = new cv.Mat();
            let mean = new cv.Mat();
            let stdDev = new cv.Mat();

            cv.cvtColor(src, matGray, cv.COLOR_RGBA2GRAY, 0);
            cv.Laplacian(matGray, matLaplacian, cv.CV_64F, 1, 1, 0, cv.BORDER_DEFAULT);
            cv.meanStdDev(matLaplacian, mean, stdDev);
            let variance = stdDev.data64F[0] * stdDev.data64F[0];

            const sharpnessThreshold = 150;
            resultElement.textContent = `Puntaje de nitidez: ${variance.toFixed(2)}`;

            if (variance > sharpnessThreshold) {
                video.style.borderColor = 'green';
                resultElement.style.color = 'green';
                if (!photoTaken) {
                    resultElement.textContent += ' (✅ Nítida - Analizando...)';
                    enviarParaAnalisis();
                    photoTaken = true;
                } else {
                    resultElement.textContent += ' (✅ Nítida)';
                }
            } else {
                video.style.borderColor = 'red';
                resultElement.style.color = 'red';
                resultElement.textContent += ' (❌ Borrosa)';
                photoTaken = false;
                codeResultElement.textContent = '';
            }

            src.delete(); matGray.delete(); matLaplacian.delete(); mean.delete(); stdDev.delete();
        } catch (error) {
            console.error("Error en OpenCV:", error);
        }
    }

    async function enviarParaAnalisis() {
        // ===================================================================
        // ==  Pega la Clave de API que creaste en la Consola de Google Cloud ==
        // ==  (NO uses el contenido del archivo JSON)                      ==
        // ===================================================================
        const API_KEY = 'AIzaSyB1jlhNM7RSGwf_vfkJ0bJHo2ReTgYQiNw';
        // ===================================================================

        const GOOGLE_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
        const base64ImageData = canvas.toDataURL('image/jpeg').split(',')[1];
        const requestBody = {
            requests: [ { image: { content: base64ImageData }, features: [ { type: 'TEXT_DETECTION' } ] } ],
        };

        codeResultElement.textContent = 'Enviando a Google Vision...';

        try {
            const response = await fetch(GOOGLE_VISION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Error de Google: ${errorData.error.message}`);
            }

            const result = await response.json();
            const detections = result.responses[0].textAnnotations;

            if (detections && detections.length > 0) {
                codeResultElement.textContent = `Código Extraído: ${detections[0].description}`;
            } else {
                codeResultElement.textContent = 'No se encontró texto en la imagen.';
            }

        } catch (error) {
            console.error('Error al llamar a Google Vision API:', error);
            codeResultElement.textContent = `Error: ${error.message}`;
        }
    }

    const checkOpenCv = setInterval(() => {
        if (window.cv && window.cv.Mat) {
            console.log('OpenCV.js está listo.');
            clearInterval(checkOpenCv);
            startApp();
        }
    }, 50);
});