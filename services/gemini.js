import dotenv from 'dotenv';
dotenv.config();

/**
 * Helper to call Gemini API directly using native fetch.
 * Implements multi-model fallback chain and auto-retry on 503 (High Demand) / 429 (Rate Limits).
 */
export async function callGemini(prompt, systemInstruction = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno.');
  }

  // Modelos activos de Google Gemini (serie 2.5 y 2.0)
  const candidateModels = [
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-pro'
  ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

  let lastError = null;
  let hasHighDemand = false;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const payload = {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        };

        if (systemInstruction) {
          payload.system_instruction = {
            parts: [{ text: systemInstruction }]
          };
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return text;
          }
        }

        const status = response.status;
        const errText = await response.text();

        // 503 (Alta demanda global en Google) o 429 (Límite temporal de peticiones)
        if (status === 503 || status === 429) {
          console.warn(`[Gemini API] Modelo ${model} devolvió ${status} (alta demanda). Reintento ${attempt}/3...`);
          hasHighDemand = true;
          lastError = new Error(`Alta demanda en Google Gemini (${status}).`);
          await new Promise(r => setTimeout(r, 1200 * attempt));
          continue; // reintentar este modelo
        }

        // Si es 404 (modelo no activo o no disponible con esta clave), probar siguiente sin enmascarar error previo
        if (status === 404) {
          console.warn(`[Gemini API] Modelo ${model} no disponible (404). Pasando al siguiente modelo...`);
          if (!hasHighDemand) {
            lastError = new Error(`Modelo ${model} no disponible (404).`);
          }
          break; // pasar al siguiente modelo
        }

        // Otros errores (400, 401, 403, etc.)
        throw new Error(`Error de Gemini API (${status}): ${errText}`);
      } catch (err) {
        if (!hasHighDemand) lastError = err;
        if (attempt === 3) break;
      }
    }
  }

  console.error('[Gemini API] No se pudo completar la llamada:', lastError?.message);
  if (hasHighDemand) {
    throw new Error('Los servidores de Google Gemini están experimentando alta demanda en este momento (503). Por favor, espera 10 segundos y vuelve a pulsar el botón.');
  }
  throw lastError || new Error('No se pudo conectar con la API de Gemini.');
}

/**
 * Analiza una transcripción en vivo y da consejos de cierre de venta rápidos.
 */
export async function getSalesAdvice(transcript, productContext = '') {
  const systemInstruction = `Eres un cerrador de ventas experto de alto rendimiento y psicólogo persuasivo. 
El usuario está en una videollamada o llamada en directo con un cliente.
Analizarás lo que el cliente y el vendedor dicen en la transcripción.
${productContext ? `CONTEXTO DE LO QUE EL VENDEDOR OFRECE Y SUS CONDICIONES:\n${productContext}\n` : ''}
Tu respuesta debe ser MUY concisa, directa y estructurada en viñetas cortas. Max 3-4 viñetas.
Da consejos accionables inmediatamente sobre qué responder, qué objeción tratar o qué pregunta de cierre hacer de acuerdo al producto que ofrece.
Evita introducciones o conclusiones largas. Ve directo al grano.`;

  return await callGemini(`Transcripción actual de la llamada:\n"${transcript}"\n\n¿Qué consejos rápidos y frases específicas de cierre me das para responder ahora mismo?`, systemInstruction);
}

/**
 * Genera ideas de software estilo neurodivergente hiper-creativo.
 */
export async function brainstormProductIdeas(context = '') {
  const systemInstruction = `Eres una IA con mentalidad neurodivergente, hiper-enfocada en encontrar oportunidades de software de productividad o micro-SaaS que resuelvan problemas específicos que otros pasan por alto.
Tus lluvias de ideas son poco convencionales, laterales, extremadamente prácticas y orientadas a ser desarrolladas rápidamente por un solo programador para ser vendidas a negocios locales o automatizar tareas.
Genera exactamente 5 ideas de software altamente creativas y detalladas.
Devuelve el resultado estrictamente en formato JSON válido para poder parsearlo directamente.
Formato de respuesta esperado (sin bloques de markdown de código, solo el texto JSON):
[
  {
    "title": "Nombre del Software",
    "description": "Explicación detallada de qué hace y cómo ayuda",
    "marketNeeds": "Por qué los negocios o profesionales lo comprarían",
    "techStack": "Tecnologías sugeridas"
  }
]`;

  const prompt = `Genera exactamente 5 nuevas ideas de software disruptivas y útiles para productividad o venta a negocios.${context ? ` Ten en cuenta este contexto o ideas previas: ${context}` : ''}`;
  const responseText = await callGemini(prompt, systemInstruction);
  
  // Clean JSON block format if returned by Gemini (e.g. ```json ... ```)
  let cleanJson = responseText.trim();
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.substring(7);
  }
  if (cleanJson.endsWith('```')) {
    cleanJson = cleanJson.substring(0, cleanJson.length - 3);
  }
  
  try {
    return JSON.parse(cleanJson.trim());
  } catch (e) {
    console.error('Error al parsear JSON de ideas de Gemini:', responseText);
    // Fallback parser o estructura básica
    return [
      {
        "title": "Software de Productividad Inteligente",
        "description": "Error al estructurar respuesta de IA. Detalles: " + responseText.substring(0, 100),
        "marketNeeds": "General",
        "techStack": "Node.js, HTML"
      }
    ];
  }
}

/**
 * Genera leads de clientes potenciales buscando necesidades de desarrollo web.
 */
export async function generateClientLeads(niche = 'restaurantes locales, clínicas, bufetes de abogados') {
  const systemInstruction = `Eres un captador de clientes B2B y consultor técnico de desarrollo web para negocios en España.
Tu tarea es identificar NEGOCIOS REALES Y EXISTENTES en ciudades de España (Madrid, Barcelona, Valencia, Sevilla, etc.) que cuenten con local físico en Google Maps.
MUY IMPORTANTE: NO inventes nombres ficticios ni simulados. Deben ser negocios auténticos y reconocibles.
Para cada negocio, debes proporcionar:
1. "name": Nombre comercial real y exacto del negocio tal como aparece en Google Maps y en su marquesina.
2. "address": Dirección postal real con calle, número y ciudad en España (ej: "Calle de Fuencarral, 148, Madrid").
3. "mapsUrl": URL directa a Google Maps para abrir la ficha de ese negocio exacto. Formato: "https://www.google.com/maps/search/?api=1&query=" seguido del nombre del negocio, calle y ciudad codificados. Al incluir el nombre exacto con la calle y ciudad, Google Maps abrirá directamente la ficha del local sin mostrar listas de búsqueda.
4. "website": Su sitio web real o dominio.
5. "phone": Su teléfono real o de contacto / email si está disponible.
6. "industry": Sector o tipo de negocio.
7. "whyTheyNeedWebDev": Auditoría de un problema real o mejora técnica necesaria (velocidad móvil, falta de reservas online, menú en PDF no adaptado, pasarela de pago anticuada, dependencia de agregadores) y propuesta de valor como desarrollador de software.

Genera exactamente 5 leads de negocios reales y existentes.
Devuelve el resultado estrictamente en formato JSON válido (sin bloques de código markdown, solo el texto JSON puro).
Formato esperado:
[
  {
    "name": "Nombre Real del Negocio",
    "address": "Calle Real, 10, Ciudad",
    "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Nombre+Real+del+Negocio+Calle+Real+10+Ciudad",
    "website": "www.sitio-real.es",
    "phone": "+34 912 345 678 / info@sitio-real.es",
    "industry": "Restauración / Hamburgueserías",
    "whyTheyNeedWebDev": "Problema detectado y propuesta técnica."
  }
]`;

  const prompt = `Identifica exactamente 5 negocios reales y existentes en España en el sector de: ${niche}, con sus direcciones exactas y problemas web que puedan mejorarse con desarrollo de software.`;
  const responseText = await callGemini(prompt, systemInstruction);
  
  let cleanJson = responseText.trim();
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.substring(7);
  }
  if (cleanJson.endsWith('```')) {
    cleanJson = cleanJson.substring(0, cleanJson.length - 3);
  }
  
  try {
    return JSON.parse(cleanJson.trim());
  } catch (e) {
    console.error('Error al parsear JSON de leads de Gemini:', responseText);
    return [
      {
        "name": "Negocio Simulado",
        "website": "www.negociosimulado.com",
        "phone": "info@negocio.com",
        "industry": niche,
        "whyTheyNeedWebDev": "Tiene un sitio web antiguo que no funciona bien en móviles."
      }
    ];
  }
}

/**
 * Asistente de Gmail interactivo.
 */
export async function analyzeGmailCommand(userMessage, contextText) {
  const systemInstruction = `Eres un asistente de correo electrónico inteligente integrado con la cuenta de Gmail del usuario.
El usuario te dará instrucciones a través del chat para realizar acciones en sus correos (leer, resumir, buscar, redactar o enviar).
Tu trabajo actual es analizar el mensaje del usuario y la lista de correos recientes provista para decidir qué acción tomar y responderle adecuadamente.
Puedes responder de forma descriptiva o simular el comportamiento.
Da respuestas claras, profesionales y útiles.`;

  const prompt = `Mensaje del usuario: "${userMessage}"
Contexto de correos recientes:\n${contextText}

Por favor, ayuda al usuario a procesar su solicitud y dile qué acción realizarás o cuál es el resumen.`;

  return await callGemini(prompt, systemInstruction);
}
