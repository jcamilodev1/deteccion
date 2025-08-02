document.addEventListener('DOMContentLoaded', () => {

    const ANALYSIS_WIDTH = 320;

    const analyzeButton = document.getElementById('analyzeButton');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const resultElement = document.getElementById('result');

    // --- Variables de estado para el análisis en tiempo real ---
    let analysisInterval = null; // Guardará el ID de nuestro bucle setInterval
    let photoTaken = false;      // Bandera para evitar tomar fotos repetidas

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

        // --- El botón ahora INICIA o DETIENE el bucle de análisis ---
        analyzeButton.addEventListener('click', () => {
            if (analysisInterval) {
                // Si el análisis está activo, lo detenemos
                clearInterval(analysisInterval);
                analysisInterval = null;
                analyzeButton.textContent = 'Iniciar Análisis en Tiempo Real';
                video.style.borderColor = '#ccc'; // Restaura el borde
                resultElement.textContent = 'Análisis detenido.';
            } else {
                // Si el análisis está detenido, lo iniciamos
                analyzeButton.textContent = 'Detener Análisis';
                // El bucle se ejecutará aproximadamente 2 veces por segundo
                analysisInterval = setInterval(analyzeAndHandleSharpness, 500);
            }
        });

        function analyzeAndHandleSharpness() {
            if (video.readyState < 2) return; // Si el video no está listo, no hacer nada

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
                    
                    // --- Lógica para tomar UNA SOLA FOTO ---
                    if (!photoTaken) {
                        resultElement.textContent += ' (✅ Nítida - Foto Guardada)';
                        guardarFoto();
                        photoTaken = true; // Marcamos que ya tomamos la foto
                    } else {
                        resultElement.textContent += ' (✅ Nítida)';
                    }

                } else {
                    video.style.borderColor = 'red';
                    resultElement.style.color = 'red';
                    resultElement.textContent += ' (❌ Borrosa)';
                    photoTaken = false; // Se resetea para poder tomar otra foto cuando vuelva a ser nítida
                }

                // Liberar memoria
                src.delete();
                matGray.delete();
                matLaplacian.delete();
                mean.delete();
                stdDev.delete();

            } catch (error) {
                // No mostrar errores en la UI para no interrumpir el flujo
                console.error("Error en el procesamiento de OpenCV:", error);
            }
        }
    }

    function guardarFoto() {
        const dataUrl = canvas.toDataURL('image/jpeg');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `foto_nitida_${Date.now()}.jpg`;
        link.click();
    }

    const checkOpenCv = setInterval(() => {
        if (window.cv && window.cv.Mat) {
            console.log('OpenCV.js está listo.');
            clearInterval(checkOpenCv);
            startApp();
        }
    }, 50);
});