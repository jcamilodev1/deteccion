document.addEventListener('DOMContentLoaded', () => {

    // --- Constantes de configuración ---
    const ANALYSIS_WIDTH = 320;
    const CAPTURE_WIDTH = 1280;
    const SHARPNESS_THRESHOLD = 150;
    const STABILITY_THRESHOLD = 1; 
    const BURST_COUNT = 3;

    // --- Elementos del DOM ---
    const liveContainer = document.getElementById('liveContainer');
    const previewContainer = document.getElementById('previewContainer');
    const previewImage = document.getElementById('previewImage');
    const acceptButton = document.getElementById('acceptButton');
    const retryButton = document.getElementById('retryButton');
    const analyzeButton = document.getElementById('analyzeButton');
    const video = document.getElementById('video');
    const analysisCanvas = document.getElementById('canvas');
    const resultElement = document.getElementById('result');
    const codeResultElement = document.getElementById('codeResult');
    const roiBox = document.getElementById('roiBox');
    const stabilityIndicator = document.getElementById('stabilityIndicator');

    // --- Variables de estado ---
    let analysisInterval = null;
    let capturedImageDataUrl = null;
    let isDeviceStable = false;
    let isCapturingBurst = false;

    // --- FUNCIONES DE INICIALIZACIÓN ---
    function startApp() {
        analyzeButton.disabled = false;
        analyzeButton.textContent = 'Iniciar Análisis';
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(stream => { video.srcObject = stream; video.play(); })
                .catch(err => { console.error("Error al acceder a la cámara:", err); });
        }
        analyzeButton.addEventListener('click', toggleAnalysis);
        acceptButton.addEventListener('click', handleAccept);
        retryButton.addEventListener('click', handleRetry);
    }

    async function toggleAnalysis() {
        if (analysisInterval) {
            stopAnalysis();
        } else {
            const permissionGranted = await requestMotionPermissions();
            if (permissionGranted) {
                startAnalysis();
            } else {
                alert("Se necesita permiso para acceder a los sensores de movimiento para la detección de estabilidad.");
            }
        }
    }

    async function requestMotionPermissions() {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceMotionEvent.requestPermission();
                return permissionState === 'granted';
            } catch (error) {
                console.error("No se pudo solicitar el permiso de movimiento:", error);
                return false;
            }
        }
        return true;
    }

    function startAnalysis() {
        analyzeButton.textContent = 'Detener Análisis';
        resultElement.textContent = 'Alinea el objetivo y mantén el dispositivo estable...';
        roiBox.style.display = 'block';
        startStabilityDetector();
        analysisInterval = setInterval(analyzeAndHandleSharpness, 500);
    }

    function stopAnalysis() {
        clearInterval(analysisInterval);
        analysisInterval = null;
        analyzeButton.textContent = 'Iniciar Análisis';
        roiBox.style.display = 'none';
        stopStabilityDetector();
    }

    // --- LÓGICA DE ESTABILIDAD ---
    const handleMotionEvent = (event) => {
        const { x, y, z } = event.acceleration;
        const motion = Math.abs(x) + Math.abs(y) + Math.abs(z);
        isDeviceStable = motion < STABILITY_THRESHOLD;
        
        if (isDeviceStable) {
            stabilityIndicator.classList.add('stable');
            roiBox.style.borderColor = 'rgba(40, 167, 69, 0.9)';
        } else {
            stabilityIndicator.classList.remove('stable');
            roiBox.style.borderColor = 'rgba(255, 255, 255, 0.9)';
        }
    };
    
    function startStabilityDetector() {
        window.addEventListener('devicemotion', handleMotionEvent);
    }

    function stopStabilityDetector() {
        window.removeEventListener('devicemotion', handleMotionEvent);
    }

    // --- LÓGICA DE ANÁLISIS Y CAPTURA ---
    function analyzeAndHandleSharpness() {
        if (video.readyState < 2 || isCapturingBurst) return;

        const lowResScore = calculateSharpness(video, analysisCanvas, ANALYSIS_WIDTH);
        resultElement.textContent = `Puntaje de nitidez: ${lowResScore.toFixed(2)}`;

        if (lowResScore > SHARPNESS_THRESHOLD && isDeviceStable) {
            processBurstCapture();
        }
    }

    async function processBurstCapture() {
        isCapturingBurst = true;
        clearInterval(analysisInterval);
        resultElement.textContent = '¡Capturando! No te muevas...';

        const burstShots = [];
        const captureCanvas = document.createElement('canvas');

        for (let i = 0; i < BURST_COUNT; i++) {
            const score = calculateSharpness(video, captureCanvas, CAPTURE_WIDTH);
            burstShots.push({
                imageDataUrl: captureCanvas.toDataURL('image/jpeg', 0.9),
                score: score
            });
            await new Promise(resolve => setTimeout(resolve, 100)); 
        }

        burstShots.sort((a, b) => b.score - a.score);
        capturedImageDataUrl = burstShots[0].imageDataUrl;
        
        console.log(`Mejor puntaje de ráfaga: ${burstShots[0].score.toFixed(2)}`);
        showPreview();
    }

    function calculateSharpness(videoSource, targetCanvas, width) {
        const aspectRatio = videoSource.videoHeight / videoSource.videoWidth;
        targetCanvas.width = width;
        targetCanvas.height = width * aspectRatio;
        const context = targetCanvas.getContext('2d');
        context.drawImage(videoSource, 0, 0, targetCanvas.width, targetCanvas.height);
        
        let score = 0;
        try {
            let src = cv.imread(targetCanvas);
            let matGray = new cv.Mat();
            let matLaplacian = new cv.Mat();
            let mean = new cv.Mat();
            let stdDev = new cv.Mat();
            
            const roiRect = new cv.Rect(
                targetCanvas.width * 0.1, 
                targetCanvas.height * 0.25, 
                targetCanvas.width * 0.8, 
                targetCanvas.height * 0.5);
            let roi = src.roi(roiRect);
            
            cv.cvtColor(roi, matGray, cv.COLOR_RGBA2GRAY, 0);
            cv.Laplacian(matGray, matLaplacian, cv.CV_64F, 1, 1, 0, cv.BORDER_DEFAULT);
            cv.meanStdDev(matLaplacian, mean, stdDev);
            score = stdDev.data64F[0] * stdDev.data64F[0];

            src.delete(); roi.delete(); matGray.delete(); matLaplacian.delete(); mean.delete(); stdDev.delete();
        } catch (e) { console.error(e); }
        
        return score;
    }

    // --- Funciones de UI y API ---
    function showPreview() {
        roiBox.style.display = 'none';
        stopStabilityDetector();
        previewImage.src = capturedImageDataUrl; 
        liveContainer.style.display = 'none';
        previewContainer.style.display = 'flex';
        isCapturingBurst = false;
    }
    
    // ---> LIGERO CAMBIO: La función ahora es asíncrona para esperar el pre-procesamiento
    async function handleAccept() {
        acceptButton.disabled = true;
        retryButton.disabled = true;
        codeResultElement.textContent = 'Pre-procesando imagen...';

        await enviarParaAnalisis();

        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
        analyzeButton.textContent = 'Iniciar Análisis';
        acceptButton.disabled = false;
        retryButton.disabled = false;
    }
    
    function handleRetry() {
        capturedImageDataUrl = null;
        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
        startAnalysis();
    }

    // ---> ¡NUEVA FUNCIÓN DE PRE-PROCESAMIENTO!
    async function preprocessImageForOCR(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                try {
                    const src = cv.imread(img);
                    const gray = new cv.Mat();
                    const processed = new cv.Mat();

                    // 1. Convertir a escala de grises
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

                    // 2. Aplicar Binarización Adaptativa para hacer los negros más negros
                    // Parámetros: (imagen fuente, destino, valor máximo, método, tipo de umbral, tamaño del bloque, constante C)
                    // El tamaño del bloque (11) y la constante C (4) se pueden ajustar para obtener mejores resultados.
                    cv.adaptiveThreshold(gray, processed, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 4);

                    // Convertir la imagen procesada de vuelta a un formato de imagen
                    const outputCanvas = document.createElement('canvas');
                    cv.imshow(outputCanvas, processed);
                    
                    // Liberar memoria
                    src.delete();
                    gray.delete();
                    processed.delete();

                    resolve(outputCanvas.toDataURL('image/jpeg'));
                } catch (error) {
                    console.error("Error en el pre-procesamiento de OpenCV:", error);
                    reject(error);
                }
            };
            img.onerror = reject;
            img.src = imageUrl;
        });
    }

    // ---> CAMBIO PRINCIPAL: Ahora llama a la función de pre-procesamiento primero.
    async function enviarParaAnalisis() {
        if (!capturedImageDataUrl) return;

        try {
            // 1. Pre-procesar la imagen
            const processedImageUrl = await preprocessImageForOCR(capturedImageDataUrl);

            // Opcional: Actualizar la vista previa para ver la imagen procesada
            // previewImage.src = processedImageUrl;

            codeResultElement.textContent = 'Enviando a Google Vision...';

            // 2. Enviar la imagen procesada a la API
            const API_KEY = 'AIzaSyB1jlhNM7RSGwf_vfkJ0bJHo2ReTgYQiNw'; // <-- RECUERDA PONER TU CLAVE
            const GOOGLE_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
            const base64ImageData = processedImageUrl.split(',')[1];
            const requestBody = { requests: [ { image: { content: base64ImageData }, features: [ { type: 'TEXT_DETECTION' } ] } ] };

            const response = await fetch(GOOGLE_VISION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
            
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
            console.error('Error durante el análisis:', error);
            codeResultElement.textContent = `Error: ${error.message}`;
        }
    }

    // --- Carga de OpenCV ---
    const checkOpenCv = setInterval(() => {
        if (window.cv && window.cv.Mat) {
            clearInterval(checkOpenCv);
            startApp();
        }
    }, 50);
});