import dotenv from 'dotenv';
dotenv.config();

/**
 * Helper to call Gemini API directly using native fetch.
 * Uses gemini-3.5-flash (or configured GEMINI_MODEL) for speed and reliability.
 */
export async function callGemini(prompt, systemInstruction = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada en el archivo .env');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
  console.log('[DEBUG Gemini] Model being used:', model);
  console.log('[DEBUG Gemini] URL:', url.replace(apiKey, 'REDACTED'));
  
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ]
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [
        { text: systemInstruction }
      ]
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error de Gemini API (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error('Error al llamar a Gemini:', error);
    throw error;
  }
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
Genera 2 o 3 ideas de software altamente creativas y detalladas.
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

  const prompt = `Genera nuevas ideas de software disruptivas y útiles para productividad o venta a negocios.${context ? ` Ten en cuenta este contexto o ideas previas: ${context}` : ''}`;
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
  const systemInstruction = `Eres un captador de clientes automático y estratega B2B.
Tu tarea es simular la recolección y análisis de negocios reales que necesiten mejoras web o software (ej. web desactualizada, sin reservas online, carga lenta, falta de SEO).
Genera 2 o 3 leads de negocios realistas con problemas específicos en su presencia digital.
Devuelve el resultado estrictamente en formato JSON válido.
Formato de respuesta esperado (sin bloques de markdown de código, solo el texto JSON):
[
  {
    "name": "Nombre del Negocio Ejemplo",
    "website": "www.ejemplonegocio.com",
    "phone": "+34 600 000 000 / email@ejemplo.com",
    "industry": "Categoría de negocio",
    "whyTheyNeedWebDev": "Problema crítico detectado en su web (ej. no es responsiva, carga lenta, no tiene pasarela de pago) y propuesta de solución."
  }
]`;

  const prompt = `Encuentra y analiza negocios en el sector de: ${niche}.`;
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
