document.addEventListener('DOMContentLoaded', () => {

    // --- Constantes de configuración ---
    const ANALYSIS_WIDTH = 320; // Para el análisis en tiempo real (rápido)
    const CAPTURE_WIDTH = 1280; // Para la foto final (alta calidad)
    const SHARPNESS_THRESHOLD = 250; // Umbral de nitidez para disparar la captura
    const STABILITY_THRESHOLD = 1; // Umbral de movimiento. Más bajo = más estricto
    const BURST_COUNT = 3; // Número de fotos a tomar en la ráfaga

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
        return true; // Para dispositivos que no requieren permiso explícito (Android)
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
            roiBox.style.borderColor = 'rgba(40, 167, 69, 0.9)'; // Verde
        } else {
            stabilityIndicator.classList.remove('stable');
            roiBox.style.borderColor = 'rgba(255, 255, 255, 0.9)'; // Blanco
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

        // CONDICIÓN DE CAPTURA: Nítido + Estable + No capturando ya
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
    
    function handleAccept() {
        codeResultElement.textContent = 'Enviando a Google Vision...';
        enviarParaAnalisis();
        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
        analyzeButton.textContent = 'Iniciar Análisis';
    }
    
    function handleRetry() {
        capturedImageDataUrl = null;
        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
        startAnalysis();
    }

    async function enviarParaAnalisis() {
        if (!capturedImageDataUrl) return;
        const API_KEY = 'TU_API_KEY_DE_GOOGLE_VISION'; // <-- RECUERDA PONER TU CLAVE
        const GOOGLE_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
        const base64ImageData = capturedImageDataUrl.split(',')[1];
        const requestBody = { requests: [ { image: { content: base64ImageData }, features: [ { type: 'TEXT_DETECTION' } ] } ] };
        try {
            const response = await fetch(GOOGLE_VISION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(`Error de Google: ${errorData.error.message}`); }
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

    // --- Carga de OpenCV ---
    const checkOpenCv = setInterval(() => {
        if (window.cv && window.cv.Mat) {
            clearInterval(checkOpenCv);
            startApp();
        }
    }, 50);
});