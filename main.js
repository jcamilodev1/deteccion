document.addEventListener('DOMContentLoaded', () => {

    const ANALYSIS_WIDTH = 320;

    // --- Elementos del DOM ---
    const liveContainer = document.getElementById('liveContainer');
    const previewContainer = document.getElementById('previewContainer');
    const previewImage = document.getElementById('previewImage');
    const acceptButton = document.getElementById('acceptButton');
    const retryButton = document.getElementById('retryButton');
    const analyzeButton = document.getElementById('analyzeButton');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const resultElement = document.getElementById('result');
    const codeResultElement = document.getElementById('codeResult');
    const roiBox = document.getElementById('roiBox'); // Referencia al visor

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
        roiBox.style.display = 'block'; // Muestra el visor
        analysisInterval = setInterval(analyzeAndHandleSharpness, 500);
    }

    function stopAnalysis() {
        clearInterval(analysisInterval);
        analysisInterval = null;
        analyzeButton.textContent = 'Iniciar Análisis';
        video.style.borderColor = '#ccc';
        resultElement.textContent = 'Análisis detenido.';
        roiBox.style.display = 'none'; // Oculta el visor
    }

    function analyzeAndHandleSharpness() {
        if (video.readyState < 2) return;

        // Dibuja el cuadro de video completo en el canvas
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
            
            // --- NUEVA LÓGICA PARA RECORTAR LA IMAGEN (ROI) ---
            // Define el tamaño del recorte (ROI). Usamos 250x150 como referencia.
            const roiWidth = 250; 
            const roiHeight = 150;
            // Calcula las coordenadas para centrar el recorte en el canvas de análisis
            const x = (canvas.width - roiWidth) / 2;
            const y = (canvas.height - roiHeight) / 2;

            // Asegúrate de que el recorte no se salga del canvas
            if (x < 0 || y < 0 || (x + roiWidth) > canvas.width || (y + roiHeight) > canvas.height) {
                console.warn("El visor es más grande que el área de análisis. Analizando el cuadro completo.");
                cv.cvtColor(src, matGray, cv.COLOR_RGBA2GRAY, 0); // Analiza la imagen completa como fallback
            } else {
                let rect = new cv.Rect(x, y, roiWidth, roiHeight);
                let roi = src.roi(rect); // Crea una nueva Mat que es solo la región de interés
                cv.cvtColor(roi, matGray, cv.COLOR_RGBA2GRAY, 0); // Convierte a gris solo el recorte
                roi.delete(); // Libera la memoria del recorte
            }
            // --- FIN DE LA LÓGICA DE RECORTE ---

            // El resto del análisis se hace sobre 'matGray', que ahora es la imagen recortada y en gris
            cv.Laplacian(matGray, matLaplacian, cv.CV_64F, 1, 1, 0, cv.BORDER_DEFAULT);
            cv.meanStdDev(matLaplacian, mean, stdDev);
            let variance = stdDev.data64F[0] * stdDev.data64F[0];

            const sharpnessThreshold = 100; // Puedes ajustar este umbral
            resultElement.textContent = `Puntaje de nitidez: ${variance.toFixed(2)}`;

            if (variance > sharpnessThreshold) {
                video.style.borderColor = 'green';
                roiBox.style.borderColor = 'rgba(40, 167, 69, 0.9)'; // Borde del visor en verde
                resultElement.style.color = 'green';
                resultElement.textContent += ' (✅ Nítida - Capturada)';
                
                clearInterval(analysisInterval); 
                analysisInterval = null;
                showPreview();

            } else {
                video.style.borderColor = 'red';
                roiBox.style.borderColor = 'rgba(255, 255, 255, 0.9)'; // Borde del visor normal
                resultElement.style.color = 'red';
                resultElement.textContent += ' (❌ Borrosa)';
            }

            src.delete(); matGray.delete(); matLaplacian.delete(); mean.delete(); stdDev.delete();
        } catch (error) {
            console.error("Error en OpenCV:", error);
        }
    }
    
    function showPreview() {
        roiBox.style.display = 'none'; // Oculta el visor en la vista previa
        previewImage.src = canvas.toDataURL('image/jpeg');
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
        previewContainer.style.display = 'none';
        liveContainer.style.display = 'flex';
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