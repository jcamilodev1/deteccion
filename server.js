const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

// Middleware para servir archivos estáticos
app.use(express.static(__dirname));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Función para obtener la IP local
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            // Buscar IPv4 que no sea localhost
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost';
}

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('\n🚀 ¡Servidor iniciado exitosamente!');
    console.log('==========================================');
    console.log(`📱 Acceso local: http://localhost:${PORT}`);
    console.log(`🌐 Acceso desde otros dispositivos: http://${localIP}:${PORT}`);
    console.log('==========================================');
    console.log('📋 Para acceder desde otros dispositivos:');
    console.log('   1. Conecta tu dispositivo a la misma red WiFi');
    console.log(`   2. Abre el navegador y ve a: http://${localIP}:${PORT}`);
    console.log('   3. ¡Listo! Tu app estará disponible');
    console.log('\n💡 Presiona Ctrl+C para detener el servidor\n');
});

// Manejo graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Deteniendo servidor...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Deteniendo servidor...');
    process.exit(0);
});