// api/proxy-openai.js

// Esta función se ejecutará en un entorno de Node.js en Vercel.
export default async function handler(request, response) {
  // Solo permitir peticiones POST
  if (request.method !== 'POST') {
      return response.status(405).json({ message: 'Method Not Allowed' });
  }

  // --- 1. Obtener la clave secreta de las variables de entorno (¡Seguro!) ---
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
      return response.status(500).json({ message: 'La clave API de OpenAI no está configurada en el servidor.' });
  }

  try {
      // --- 2. Recibir la URL de la imagen desde el frontend ---
      const { image: imageDataUrl } = request.body;
      if (!imageDataUrl) {
          return response.status(400).json({ message: 'No se proporcionó la imagen.' });
      }

      // ---> ¡NUEVO PROMPT MEJORADO! <---
      const prompt = `
          Actúa como un sistema experto de OCR industrial para control de calidad.

          **Contexto:** La imagen es una fotografía de la base de un envase de plástico, posiblemente tomada con un teléfono en condiciones de iluminación no ideales. El texto está grabado o impreso con matriz de puntos sobre una superficie curva y reflectante.

          **Tarea:** Analiza la imagen y extrae la siguiente información en un formato JSON estricto.

          1.  **"fecha_vencimiento"**: Busca una fecha de vencimiento, usualmente precedida por "EXP". El formato debe ser "DD MMM AA" (ej. "19 SEP 25"). Si no la encuentras, el valor debe ser null.
          2.  **"numero_lote"**: Busca un número de lote, usualmente precedido por "L." o "LOTE". Este es un código alfanumérico. Si no lo encuentras, el valor debe ser null.
          3.  **"texto_adicional"**: Transcribe cualquier otro texto visible en la etiqueta, como códigos de producción, horas o texto circular (ej. "HECHO CON MATERIAL RECICLADO").
          4.  **"transcripcion_completa"**: Proporciona una transcripción completa de todo el texto legible en el orden en que aparece.

          **Reglas Importantes:**
          - Ignora reflejos, sombras y suciedad. Concéntrate solo en los caracteres.
          - Si un carácter es completamente ilegible, usa un signo de interrogación (?) en su lugar.
          - No inventes información. Si un campo no es visible, el valor del campo debe ser null.
          - Tu respuesta debe ser únicamente el objeto JSON, sin texto introductorio, explicaciones, ni comillas de bloque de código (\`\`\`).
      `;

      const payload = {
          model: "gpt-4o",
          // ---> NUEVO: Forzar la salida en formato JSON
          response_format: { "type": "json_object" },
          messages: [
              {
                  role: "user",
                  content: [
                      { type: "text", text: prompt },
                      { type: "image_url", image_url: { url: imageDataUrl } }
                  ]
              }
          ],
          max_tokens: 1000 
      };

      // --- 3. Llamar a OpenAI desde el servidor ---
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify(payload)
      });

      if (!openaiResponse.ok) {
          const errorData = await openaiResponse.json();
          return response.status(openaiResponse.status).json(errorData);
      }

      const openaiResult = await openaiResponse.json();

      // --- 4. Enviar el resultado de vuelta al frontend ---
      // Ahora, el resultado es un objeto JSON, no solo texto plano.
      return response.status(200).json(openaiResult);

  } catch (error) {
      return response.status(500).json({ message: `Error en el servidor: ${error.message}` });
  }
}