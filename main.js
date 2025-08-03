document.addEventListener('DOMContentLoaded', () => {

    const ANALYSIS_WIDTH = 320; // Para el análisis en tiempo real (rápido)
    const CAPTURE_WIDTH = 1280; // Para la foto final (alta calidad)

    // --- Elementos del DOM ---
    const liveContainer = document.getElementById('liveContainer');
    const previewContainer = document.getElementById('previewContainer');
    const previewImage = document.getElementById('previewImage');
    const acceptButton = document.getElementById('acceptButton');
    const retryButton = document.getElementById('retryButton');
    const analyzeButton = document.getElementById('analyzeButton');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas'); // Canvas de baja resolución para análisis
    const resultElement = document.getElementById('result');
    const codeResultElement = document.getElementById('codeResult');
    const roiBox = document.getElementById('roiBox');

    let analysisInterval = null;
    let capturedImageDataUrl = null; // <-- Variable para guardar la imagen de alta resolución

    // (El resto de las funciones startApp, toggleAnalysis, startAnalysis, stopAnalysis no cambian)
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
        codeResultElement.textContent = '';
        resultElement.textContent = 'Buscando una imagen nítida...';
        roiBox.style.display = 'block';
        analysisInterval = setInterval(analyzeAndHandleSharpness, 500);
    }

    function stopAnalysis() {
        clearInterval(analysisInterval);
        analysisInterval = null;
        analyzeButton.textContent = 'Iniciar Análisis';
        video.style.borderColor = '#ccc';
        resultElement.textContent = 'Análisis detenido.';
        roiBox.style.display = 'none';
    }


    function analyzeAndHandleSharpness() {
        if (video.readyState < 2) return;

        // Usa el canvas de BAJA resolución solo para el análisis
        const aspectRatio = video.videoHeight / video.videoWidth;
        canvas.width = ANALYSIS_WIDTH;
        canvas.height = ANALYSIS_WIDTH * aspectRatio;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
            // (La lógica de análisis con OpenCV sigue siendo la misma)
            let src = cv.imread(canvas);
            let matGray = new cv.Mat();
            let matLaplacian = new cv.Mat();
            let mean = new cv.Mat();
            let stdDev = new cv.Mat();
            
            const roiWidth = 250 * (ANALYSIS_WIDTH / video.videoWidth); 
            const roiHeight = 150 * (ANALYSIS_WIDTH / video.videoWidth); 
            const x = (canvas.width - roiWidth) / 2;
            const y = (canvas.height - roiHeight) / 2;

            if (x < 0 || y < 0 || (x + roiWidth) > canvas.width || (y + roiHeight) > canvas.height) {
                cv.cvtColor(src, matGray, cv.COLOR_RGBA2GRAY, 0);
            } else {
                let rect = new cv.Rect(x, y, roiWidth, roiHeight);
                let roi = src.roi(rect);
                cv.cvtColor(roi, matGray, cv.COLOR_RGBA2GRAY, 0);
                roi.delete();
            }

            cv.Laplacian(matGray, matLaplacian, cv.CV_64F, 1, 1, 0, cv.BORDER_DEFAULT);
            cv.meanStdDev(matLaplacian, mean, stdDev);
            let variance = stdDev.data64F[0] * stdDev.data64F[0];
            const sharpnessThreshold = 250;
            resultElement.textContent = `Puntaje de nitidez: ${variance.toFixed(2)}`;

            if (variance > sharpnessThreshold) {
                // --- CAMBIO PRINCIPAL ---
                // ¡Disparador activado! Detiene el análisis y toma una foto en ALTA RESOLUCIÓN.
                clearInterval(analysisInterval); 
                analysisInterval = null;
                
                video.style.borderColor = 'green';
                roiBox.style.borderColor = 'rgba(40, 167, 69, 0.9)';
                resultElement.style.color = 'green';
                resultElement.textContent += ' (✅ Nítida - ¡Capturada!)';

                takeHighResPhotoAndShowPreview(); // Llama a la nueva función
                // --- FIN DEL CAMBIO ---

            } else {
                video.style.borderColor = 'red';
                roiBox.style.borderColor = 'rgba(255, 255, 255, 0.9)';
                resultElement.style.color = 'red';
                resultElement.textContent += ' (❌ Borrosa)';
            }

            src.delete(); matGray.delete(); matLaplacian.delete(); mean.delete(); stdDev.delete();
        } catch (error) {
            console.error("Error en OpenCV:", error);
        }
    }
    
    // --- ¡NUEVA FUNCIÓN! ---
    function takeHighResPhotoAndShowPreview() {
        // Crea un canvas temporal en memoria para la alta resolución
        const highResCanvas = document.createElement('canvas');
        const aspectRatio = video.videoHeight / video.videoWidth;
        
        highResCanvas.width = CAPTURE_WIDTH;
        highResCanvas.height = CAPTURE_WIDTH * aspectRatio;
        
        const context = highResCanvas.getContext('2d');
        // Dibuja la imagen del video en el canvas de alta resolución
        context.drawImage(video, 0, 0, highResCanvas.width, highResCanvas.height);
        
        // Guarda la imagen de alta calidad (con compresión JPEG al 90%)
        capturedImageDataUrl = highResCanvas.toDataURL('image/jpeg', 0.9);
        
        // Ahora muestra la previsualización
        showPreview();
    }

    function showPreview() {
        roiBox.style.display = 'none';
        // Usa la imagen de alta resolución que acabamos de guardar
        previewImage.src = capturedImageDataUrl; 
        liveContainer.style.display = 'none';
        previewContainer.style.display = 'flex';
    }
    
    function handleAccept() {
        codeResultElement.textContent = 'Enviando a Google Vision...';
        enviarParaAnalisis();
        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
        analyzeButton.textContent = 'Iniciar Análisis';
        roiBox.style.borderColor = 'rgba(255, 255, 255, 0.9)';
    }
    
    function handleRetry() {
        capturedImageDataUrl = null; // Limpia la imagen guardada
        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
        startAnalysis();
    }

    async function enviarParaAnalisis() {
        // Ya no necesita capturar la imagen, solo usar la que guardamos
        if (!capturedImageDataUrl) {
            console.error("No hay imagen capturada para enviar.");
            return;
        }

        const API_KEY = 'TU_API_KEY_DE_GOOGLE_VISION';
        const GOOGLE_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
        // Extrae los datos base64 de la URL de la imagen de alta resolución
        const base64ImageData = capturedImageDataUrl.split(',')[1];
        
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