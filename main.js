document.addEventListener('DOMContentLoaded', () => {

    const ANALYSIS_WIDTH = 320;

    // --- NUEVOS ELEMENTOS DEL DOM ---
    const liveContainer = document.getElementById('liveContainer');
    const previewContainer = document.getElementById('previewContainer');
    const previewImage = document.getElementById('previewImage');
    const acceptButton = document.getElementById('acceptButton');
    const retryButton = document.getElementById('retryButton');
    // --- ---

    const analyzeButton = document.getElementById('analyzeButton');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const resultElement = document.getElementById('result');
    const codeResultElement = document.getElementById('codeResult');

    let analysisInterval = null;

    function startApp() {
        analyzeButton.disabled = false;
        analyzeButton.textContent = 'Iniciar Análisis';

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

        analyzeButton.addEventListener('click', toggleAnalysis);
        
        // --- EVENT LISTENERS PARA NUEVOS BOTONES ---
        acceptButton.addEventListener('click', handleAccept);
        retryButton.addEventListener('click', handleRetry);
    }

    function toggleAnalysis() {
        if (analysisInterval) {
            stopAnalysis();
        } else {
            startAnalysis();
        }
    }
    
    function startAnalysis() {
        analyzeButton.textContent = 'Detener Análisis';
        codeResultElement.textContent = ''; // Limpiar resultados anteriores
        resultElement.textContent = 'Buscando una imagen nítida...';
        analysisInterval = setInterval(analyzeAndHandleSharpness, 500);
    }

    function stopAnalysis() {
        clearInterval(analysisInterval);
        analysisInterval = null;
        analyzeButton.textContent = 'Iniciar Análisis';
        video.style.borderColor = '#ccc';
        resultElement.textContent = 'Análisis detenido.';
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

            const sharpnessThreshold = 200;
            resultElement.textContent = `Puntaje de nitidez: ${variance.toFixed(2)}`;

            if (variance > sharpnessThreshold) {
                video.style.borderColor = 'green';
                resultElement.style.color = 'green';
                resultElement.textContent += ' (✅ Nítida - Capturada)';
                
                // --- LÓGICA DE PREVISUALIZACIÓN ---
                // Detiene el análisis y muestra la vista previa
                clearInterval(analysisInterval); 
                analysisInterval = null;
                showPreview();
                // --- ---

            } else {
                video.style.borderColor = 'red';
                resultElement.style.color = 'red';
                resultElement.textContent += ' (❌ Borrosa)';
            }

            src.delete(); matGray.delete(); matLaplacian.delete(); mean.delete(); stdDev.delete();
        } catch (error) {
            console.error("Error en OpenCV:", error);
        }
    }
    
    function showPreview() {
        // Captura la imagen del canvas y la pone en la etiqueta <img>
        previewImage.src = canvas.toDataURL('image/jpeg');
        liveContainer.style.display = 'none'; // Oculta la vista en vivo
        previewContainer.style.display = 'flex'; // Muestra la previsualización
    }
    
    function handleAccept() {
        // Muestra un mensaje y ejecuta el análisis de Google Vision
        codeResultElement.textContent = 'Enviando a Google Vision...';
        enviarParaAnalisis();

        // Opcional: Oculta la vista previa después de aceptar
        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
        // Reinicia el botón principal
        analyzeButton.textContent = 'Iniciar Análisis';
    }
    
    function handleRetry() {
        // Oculta la vista previa y muestra de nuevo la cámara
        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
        // Reinicia el análisis para buscar otra foto
        startAnalysis();
    }


    async function enviarParaAnalisis() {
        const API_KEY = 'AIzaSyB1jlhNM7RSGwf_vfkJ0bJHo2ReTgYQiNw'; // <-- RECUERDA PONER TU CLAVE API
        const GOOGLE_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
        const base64ImageData = canvas.toDataURL('image/jpeg').split(',')[1];
        const requestBody = {
            requests: [ { image: { content: base64ImageData }, features: [ { type: 'TEXT_DETECTION' } ] } ],
        };

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
                codeResultElement.textContent = `Texto Extraído: ${detections[0].description}`;
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
            clearInterval(checkOpenCv);
            startApp();
        }
    }, 50);
});