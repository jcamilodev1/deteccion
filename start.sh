#!/bin/bash

echo "🔧 Configurando servidor para análisis de nitidez..."

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor instálalo primero:"
    echo "   sudo apt update && sudo apt install nodejs npm"
    exit 1
fi

# Verificar si npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm no está instalado. Por favor instálalo primero:"
    echo "   sudo apt update && sudo apt install npm"
    exit 1
fi

# Instalar dependencias si no existen
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Error al instalar dependencias"
        exit 1
    fi
fi

echo "✅ Dependencias instaladas correctamente"
echo "🚀 Iniciando servidor..."
echo ""

# Iniciar servidor
npm start