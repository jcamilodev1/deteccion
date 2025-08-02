document.addEventListener('DOMContentLoaded', () => {

    const ANALYSIS_WIDTH = 320;

    const analyzeButton = document.getElementById('analyzeButton');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const resultElement = document.getElementById('result');
    const codeResultElement = document.getElementById('codeResult');

    let analysisInterval = null;
    let photoTaken = false;

    /**
     * Inicia la aplicación, pide acceso a la cámara y configura el botón de análisis.
     */
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

    /**
     * Analiza el frame actual del video para determinar su nitidez.
     * Si es nítido, llama a la función de reconocimiento de texto.
     */
    function analyzeAndHandleSharpness() {
        if (video.readyState < 2) return; // Espera a que el video esté listo

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

            // Liberar memoria de OpenCV
            src.delete(); matGray.delete(); matLaplacian.delete(); mean.delete(); stdDev.delete();
        } catch (error) {
            console.error("Error en el análisis de OpenCV:", error);
        }
    }

    /**
     * Llama a Tesseract.js para realizar el OCR directamente en el navegador.
     */
    async function enviarParaAnalisis() {
        codeResultElement.textContent = 'Analizando con Tesseract.js...';

        try {
            // Tesseract.recognize() toma la imagen del canvas y el idioma
            const { data: { text } } = await Tesseract.recognize(
                canvas,
                'spa', // 'spa' para español, 'eng' para inglés
                {
                    logger: m => {
                        console.log(m); // Muestra el progreso en la consola
                        if (m.status === 'recognizing text') {
                           codeResultElement.textContent = `Analizando... ${Math.round(m.progress * 100)}%`;
                        }
                    }
                }
            );

            if (text) {
                codeResultElement.textContent = `Texto Extraído: ${text}`;
            } else {
                codeResultElement.textContent = 'No se encontró texto.';
            }

        } catch (error) {
            console.error('Error en Tesseract.js:', error);
            codeResultElement.textContent = 'Error durante el análisis OCR.';
        }
    }

    /**
     * Bucle que verifica si la librería de OpenCV está lista antes de iniciar la app.
     */
    const checkOpenCv = setInterval(() => {
        if (window.cv && window.cv.Mat) {
            console.log('OpenCV.js está listo.');
            clearInterval(checkOpenCv);
            startApp();
        }
    }, 50);
});