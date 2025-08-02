# 📸 Analizador de Nitidez - Servidor Web

Tu aplicación de análisis de nitidez ahora está configurada como servidor web y puedes acceder desde cualquier dispositivo conectado a tu WiFi.

## 🚀 Cómo usar

### Opción 1: Script automático (Recomendado)
```bash
./start.sh
```

### Opción 2: Comando directo
```bash
npm start
```

## 🌐 URLs de Acceso

- **En tu computadora**: `http://localhost:3000`
- **Desde otros dispositivos**: `http://172.20.40.164:3000`

## 📱 Acceso desde móvil u otros dispositivos

1. **Conecta tu dispositivo** (móvil, tablet, otra computadora) a la **misma red WiFi**
2. **Abre el navegador** en ese dispositivo
3. **Ve a la URL**: `http://172.20.40.164:3000`
4. **¡Listo!** Podrás usar tu analizador de nitidez

## 🔧 Comandos útiles

- **Iniciar servidor**: `npm start` o `./start.sh`
- **Detener servidor**: `Ctrl + C`
- **Ver status**: El servidor te mostrará la información de conexión al iniciar

## 📂 Archivos creados

- `server.js` - Servidor Express.js
- `package.json` - Dependencias del proyecto
- `start.sh` - Script de inicio automático
- `README.md` - Esta documentación

## 🆘 Solución de problemas

- **Error "Puerto ocupado"**: Cambia el puerto en `server.js` (línea 5: `const PORT = 3000;`)
- **No se puede acceder desde otros dispositivos**: Verifica que estén en la misma red WiFi
- **IP diferente**: Ejecuta `hostname -I` para obtener tu IP actual

---
*Creado automáticamente para facilitar el acceso a tu aplicación desde múltiples dispositivos*