document.addEventListener('DOMContentLoaded', () => {

    // --- Constantes de configuración ---
    const ANALYSIS_WIDTH = 320;
    const CAPTURE_WIDTH = 1280;
    const SHARPNESS_THRESHOLD = 150;
    const STABILITY_THRESHOLD = 1; 
    const BURST_COUNT = 3;

    // ---> NUEVO: Referencias a los nuevos elementos de resultado
    const googleResultElement = document.getElementById('googleResult');
    const gptResultElement = document.getElementById('gptResult');
    
    // --- (El resto de referencias al DOM no cambia) ---
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

    // --- (Variables de estado no cambian) ---
    let analysisInterval = null;
    let capturedImageDataUrl = null;
    let isDeviceStable = false;
    let isCapturingBurst = false;

    // --- (Las funciones de inicialización y captura no cambian) ---
    // startApp, toggleAnalysis, requestMotionPermissions, startAnalysis, stopAnalysis,
    // handleMotionEvent, startStabilityDetector, stopStabilityDetector, analyzeAndHandleSharpness,
    // processBurstCapture, calculateSharpness, showPreview
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
                alert("Se necesita permiso para acceder a los sensores de movimiento.");
            }
        }
    }
    async function requestMotionPermissions() {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceMotionEvent.requestPermission();
                return permissionState === 'granted';
            } catch (error) { return false; }
        }
        return true;
    }
    function startAnalysis() {
        analyzeButton.textContent = 'Detener Análisis';
        resultElement.textContent = 'Alinea y mantén estable...';
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
    function startStabilityDetector() { window.addEventListener('devicemotion', handleMotionEvent); }
    function stopStabilityDetector() { window.removeEventListener('devicemotion', handleMotionEvent); }
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
        resultElement.textContent = '¡Capturando!';
        const burstShots = [];
        const captureCanvas = document.createElement('canvas');
        for (let i = 0; i < BURST_COUNT; i++) {
            const score = calculateSharpness(video, captureCanvas, CAPTURE_WIDTH);
            burstShots.push({ imageDataUrl: captureCanvas.toDataURL('image/jpeg', 0.9), score: score });
            await new Promise(resolve => setTimeout(resolve, 100)); 
        }
        burstShots.sort((a, b) => b.score - a.score);
        capturedImageDataUrl = burstShots[0].imageDataUrl;
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
            const roiRect = new cv.Rect(targetCanvas.width * 0.1, targetCanvas.height * 0.25, targetCanvas.width * 0.8, targetCanvas.height * 0.5);
            let roi = src.roi(roiRect);
            cv.cvtColor(roi, matGray, cv.COLOR_RGBA2GRAY, 0);
            cv.Laplacian(matGray, matLaplacian, cv.CV_64F, 1, 1, 0, cv.BORDER_DEFAULT);
            cv.meanStdDev(matLaplacian, mean, stdDev);
            score = stdDev.data64F[0] * stdDev.data64F[0];
            src.delete(); roi.delete(); matGray.delete(); matLaplacian.delete(); mean.delete(); stdDev.delete();
        } catch (e) { console.error(e); }
        return score;
    }
    function showPreview() {
        roiBox.style.display = 'none';
        stopStabilityDetector();
        previewImage.src = capturedImageDataUrl; 
        liveContainer.style.display = 'none';
        previewContainer.style.display = 'flex';
        isCapturingBurst = false;
    }
    
    // ---> CAMBIO: Esta función ahora orquesta el envío a ambos servicios
    async function handleAccept() {
        // Deshabilita botones para evitar múltiples clics
        acceptButton.disabled = true;
        retryButton.disabled = true;

        // Limpia resultados anteriores y muestra mensaje de carga
        googleResultElement.textContent = 'Analizando...';
        gptResultElement.textContent = 'Analizando...';

        // Oculta la vista previa y regresa a la vista principal
        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
        analyzeButton.textContent = 'Iniciar Análisis';
        resultElement.textContent = 'Análisis en proceso...';

        // Llama a ambos servicios en paralelo
        await Promise.all([
            enviarParaAnalisisGoogle(),
            enviarParaAnalisisGPT()
        ]);
        
        // Reactiva los botones
        acceptButton.disabled = false;
        retryButton.disabled = false;
        resultElement.textContent = 'Análisis completado.';
    }
    
    function handleRetry() {
        capturedImageDataUrl = null;
        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
        googleResultElement.textContent = '-';
        gptResultElement.textContent = '-';
        startAnalysis();
    }
    
    // ---> FUNCIÓN 1: ANÁLISIS CON GOOGLE VISION API (antes era enviarParaAnalisis)
    async function enviarParaAnalisisGoogle() {
        if (!capturedImageDataUrl) return;
        const API_KEY = 'AIzaSyB1jlhNM7RSGwf_vfkJ0bJHo2ReTgYQiNw'; // <-- PON TU CLAVE DE GOOGLE AQUÍ
        const GOOGLE_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
        const base64ImageData = capturedImageDataUrl.split(',')[1];
        const requestBody = { requests: [ { image: { content: base64ImageData }, features: [ { type: 'TEXT_DETECTION' } ] } ] };
        
        try {
            const response = await fetch(GOOGLE_VISION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(`Error de Google: ${errorData.error.message}`); }
            const result = await response.json();
            const detections = result.responses[0].textAnnotations;
            if (detections && detections.length > 0) {
                googleResultElement.textContent = detections[0].description;
            } else {
                googleResultElement.textContent = 'No se encontró texto.';
            }
        } catch (error) {
            console.error('Error con Google Vision API:', error);
            googleResultElement.textContent = `Error: ${error.message}`;
        }
    }

    // ---> FUNCIÓN 2: ¡NUEVA! ANÁLISIS CON OPENAI (GPT-4o)
    async function enviarParaAnalisisGPT() {
        if (!capturedImageDataUrl) return;
        
        // La URL ahora apunta a tu función serverless. 
        // Vercel la hará disponible en /api/proxy-openai
        const PROXY_URL = '/api/proxy-openai';
    
        try {
            const response = await fetch(PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // ¡YA NO SE PONE LA CLAVE DE API AQUÍ!
                },
                // Solo enviamos la imagen. El prompt y el modelo ya están en el backend.
                body: JSON.stringify({ image: capturedImageDataUrl }) 
            });
    
            if (!response.ok) { 
                const errorData = await response.json(); 
                // El mensaje de error ahora viene de tu propio servidor
                throw new Error(`Error del Proxy: ${errorData.error.message || JSON.stringify(errorData)}`); 
            }
    
            const result = await response.json();
    
            if (result.choices && result.choices.length > 0) {
                gptResultElement.textContent = result.choices[0].message.content;
            } else {
                gptResultElement.textContent = 'No se recibió una respuesta válida.';
            }
        } catch (error) {
            console.error('Error al llamar al proxy de OpenAI:', error);
            gptResultElement.textContent = `${error.message}`;
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