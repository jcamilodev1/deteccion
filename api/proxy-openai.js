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

      const prompt = "Extrae todo el texto visible en esta imagen de una etiqueta. Si ves números de serie, códigos o fechas, identifícalos claramente. Transcribe el texto de la forma más precisa posible.";

      const payload = {
          model: "gpt-4o",
          messages: [
              {
                  role: "user",
                  content: [
                      { type: "text", text: prompt },
                      { type: "image_url", image_url: { url: imageDataUrl } }
                  ]
              }
          ],
          max_tokens: 500
      };

      // --- 3. Llamar a OpenAI desde el servidor ---
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_API_KEY}` // La clave se añade aquí, en el backend.
          },
          body: JSON.stringify(payload)
      });

      if (!openaiResponse.ok) {
          const errorData = await openaiResponse.json();
          // Reenviar el error de OpenAI al frontend
          return response.status(openaiResponse.status).json(errorData);
      }

      const openaiResult = await openaiResponse.json();

      // --- 4. Enviar el resultado de vuelta al frontend ---
      return response.status(200).json(openaiResult);

  } catch (error) {
      return response.status(500).json({ message: `Error en el servidor: ${error.message}` });
  }
}