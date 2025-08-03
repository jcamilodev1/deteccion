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
    const roiBox = document.getElementById('roiBox');
    const stabilityIndicator = document.getElementById('stabilityIndicator');
    const googleResultElement = document.getElementById('googleResult');
    const gptResultElement = document.getElementById('gptResult');

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
            burstShots.push({ imageDataUrl: captureCanvas.toDataURL('image/jpeg', 0.9), score: score });
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
            let src = cv.imread(targetCanvas); let matGray = new cv.Mat(); let matLaplacian = new cv.Mat(); let mean = new cv.Mat(); let stdDev = new cv.Mat();
            const roiRect = new cv.Rect( targetCanvas.width * 0.1, targetCanvas.height * 0.25, targetCanvas.width * 0.8, targetCanvas.height * 0.5);
            let roi = src.roi(roiRect);
            cv.cvtColor(roi, matGray, cv.COLOR_RGBA2GRAY, 0);
            cv.Laplacian(matGray, matLaplacian, cv.CV_64F, 1, 1, 0, cv.BORDER_DEFAULT);
            cv.meanStdDev(matLaplacian, mean, stdDev);
            score = stdDev.data64F[0] * stdDev.data64F[0];
            src.delete(); roi.delete(); matGray.delete(); matLaplacian.delete(); mean.delete(); stdDev.delete();
        } catch (e) { console.error(e); }
        return score;
    }

    // --- FUNCIÓN PARA RECORTAR LA IMAGEN AL VISOR ---
    async function cropImageToRoi(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                try {
                    const roiWidthPercent = 0.80; const roiHeightPercent = 0.50;
                    const cropWidth = img.width * roiWidthPercent;
                    const cropHeight = img.height * roiHeightPercent;
                    const cropX = (img.width - cropWidth) / 2;
                    const cropY = (img.height - cropHeight) / 2;
                    const cropCanvas = document.createElement('canvas');
                    cropCanvas.width = cropWidth;
                    cropCanvas.height = cropHeight;
                    const context = cropCanvas.getContext('2d');
                    context.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                    resolve(cropCanvas.toDataURL('image/jpeg', 0.95));
                } catch (error) { reject(error); }
            };
            img.onerror = reject;
            img.src = imageUrl;
        });
    }

    // --- FUNCIÓN DE PRE-PROCESAMIENTO CON MEJORAS ---
    async function preprocessImageForOCR(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                try {
                    let src = cv.imread(img);
                    let gray = new cv.Mat();
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

                    // 1. Reducción de Ruido con Filtro Bilateral
                    let denoised = new cv.Mat();
                    cv.bilateralFilter(gray, denoised, 9, 75, 75, cv.BORDER_DEFAULT);

                    // 2. Mejora de Contraste Local con CLAHE
                    let clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
                    let contrasted = new cv.Mat();
                    clahe.apply(denoised, contrasted);
                    clahe.delete();
                    
                    // 3. Aumento de Nitidez con Máscara de Enfoque
                    let blurred = new cv.Mat();
                    let sharpened = new cv.Mat();
                    cv.GaussianBlur(contrasted, blurred, new cv.Size(0, 0), 3);
                    cv.addWeighted(contrasted, 1.5, blurred, -0.5, 0, sharpened);
                    
                    const outputCanvas = document.createElement('canvas');
                    cv.imshow(outputCanvas, sharpened);
                    
                    // Liberar memoria
                    src.delete(); gray.delete(); denoised.delete(); contrasted.delete(); blurred.delete(); sharpened.delete();
                    resolve(outputCanvas.toDataURL('image/jpeg'));
                } catch (error) { reject(error); }
            };
            img.onerror = reject;
            img.src = imageUrl;
        });
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
    
    async function handleAccept() {
        acceptButton.disabled = true;
        retryButton.disabled = true;
        googleResultElement.textContent = 'Procesando...';
        gptResultElement.textContent = 'Procesando...';
        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
        analyzeButton.textContent = 'Iniciar Análisis';
        
        try {
            resultElement.textContent = 'Recortando imagen...';
            const croppedImageDataUrl = await cropImageToRoi(capturedImageDataUrl);

            resultElement.textContent = 'Mejorando calidad de imagen...';
            const processedImageDataUrl = await preprocessImageForOCR(croppedImageDataUrl);

            resultElement.textContent = 'Análisis en proceso...';
            await Promise.all([
                enviarParaAnalisisGoogle(processedImageDataUrl),
                enviarParaAnalisisGPT(processedImageDataUrl)
            ]);
            resultElement.textContent = 'Análisis completado.';

        } catch (error) {
            resultElement.textContent = `Error en el procesamiento: ${error.message}`;
            console.error(error);
        } finally {
            acceptButton.disabled = false;
            retryButton.disabled = false;
        }
    }
    
    function handleRetry() {
        capturedImageDataUrl = null;
        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
        googleResultElement.textContent = '-';
        gptResultElement.textContent = '-';
        startAnalysis();
    }
    
    async function enviarParaAnalisisGoogle(imageDataUrl) {
        if (!imageDataUrl) return;
        const API_KEY = 'AIzaSyB1jlhNM7RSGwf_vfkJ0bJHo2ReTgYQiNw';
        const GOOGLE_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
        const base64ImageData = imageDataUrl.split(',')[1];
        const requestBody = { requests: [ { image: { content: base64ImageData }, features: [ { type: 'TEXT_DETECTION' } ] } ] };
        try {
            const response = await fetch(GOOGLE_VISION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(`Error de Google: ${errorData.error.message}`); }
            const result = await response.json();
            const detections = result.responses[0].textAnnotations;
            if (detections && detections.length > 0) { googleResultElement.textContent = detections[0].description; } 
            else { googleResultElement.textContent = 'No se encontró texto.'; }
        } catch (error) { console.error('Error con Google Vision API:', error); googleResultElement.textContent = `Error: ${error.message}`; }
    }

    async function enviarParaAnalisisGPT(imageDataUrl) {
        if (!imageDataUrl) return;
        const PROXY_URL = '/api/proxy-openai';
        try {
            const response = await fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: imageDataUrl }) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(`Error del Proxy: ${errorData.error.message || JSON.stringify(errorData)}`); }
            const result = await response.json();
            if (result.choices && result.choices.length > 0) { gptResultElement.textContent = result.choices[0].message.content; } 
            else { gptResultElement.textContent = 'No se recibió una respuesta válida.'; }
        } catch (error) { console.error('Error al llamar al proxy de OpenAI:', error); gptResultElement.textContent = `${error.message}`; }
    }

    // --- Carga de OpenCV ---
    const checkOpenCv = setInterval(() => {
        if (window.cv && window.cv.Mat) {
            clearInterval(checkOpenCv);
            startApp();
        }
    }, 50);
});