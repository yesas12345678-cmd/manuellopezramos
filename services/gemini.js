import dotenv from 'dotenv';
dotenv.config();

let activeModelCache = 'gemini-3.5-flash';

/**
 * Consulta la API ListModels de Google para descubrir qué modelos están autorizados para esta clave.
 */
async function discoverSupportedModels(apiKey) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) return [];
    const data = await res.json();
    const models = (data.models || [])
      .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''));

    // Priorizar modelos Flash sobre Pro (los Pro suelen tener cuota 0 en cuentas gratuitas)
    return models.sort((a, b) => {
      const aFlash = a.includes('flash') ? 0 : 1;
      const bFlash = b.includes('flash') ? 0 : 1;
      return aFlash - bFlash;
    });
  } catch (err) {
    console.warn('[Gemini API] Error al descubrir modelos dinámicamente:', err.message);
    return [];
  }
}

/**
 * Helper to call Gemini API directly using native fetch.
 * Implements dynamic model discovery, multi-model fallback chain and auto-retry.
 */
export async function callGemini(prompt, systemInstruction = '', options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno.');
  }

  // Modelos candidatos prioritarios y verificados
  let candidateModels = [
    activeModelCache,
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash'
  ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

  let lastError = null;
  let hasHighDemand = false;

  const tryCallModel = async (model) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const payload = {
          contents: [{ parts: [{ text: prompt }] }]
        };

        if (systemInstruction) {
          payload.system_instruction = {
            parts: [{ text: systemInstruction }]
          };
        }

        if (options.jsonMode) {
          payload.generationConfig = {
            responseMimeType: 'application/json'
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
            activeModelCache = model; // Cachear el modelo comprobado
            return text;
          }
        }

        const status = response.status;
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || response.statusText;

        if (status === 503 || status === 429) {
          console.warn(`[Gemini API] Modelo ${model} devolvió ${status} (${errMsg}). Reintento ${attempt}/2...`);
          hasHighDemand = true;
          lastError = new Error(`Límite o demanda temporal en Google Gemini (${status}): ${errMsg}`);
          await new Promise(r => setTimeout(r, 1200 * attempt));
          continue;
        }

        if (status === 404) {
          console.warn(`[Gemini API] Modelo ${model} no disponible (404: ${errMsg}). Probando siguiente...`);
          lastError = new Error(`Modelo ${model} no disponible: ${errMsg}`);
          return null; // Probar siguiente modelo
        }

        throw new Error(`Error de Gemini API (${status}): ${errMsg}`);
      } catch (err) {
        lastError = err;
        if (attempt === 2) return null;
      }
    }
    return null;
  };

  // 1. Probar lista inicial de modelos
  for (const model of candidateModels) {
    const text = await tryCallModel(model);
    if (text) return text;
  }

  // 2. Si ninguno de los modelos predefinidos funcionó (404), descubrir dinámicamente vía ListModels
  console.log('[Gemini API] Descubriendo modelos activos para esta clave...');
  const discoveredModels = await discoverSupportedModels(apiKey);
  for (const model of discoveredModels) {
    if (!candidateModels.includes(model)) {
      const text = await tryCallModel(model);
      if (text) return text;
    }
  }

  console.error('[Gemini API] No se pudo completar la llamada con ningún modelo:', lastError?.message);
  if (hasHighDemand) {
    throw new Error('Los servidores de Google Gemini están experimentando alta demanda o límite de cuota (503/429). Espera unos segundos y vuelve a pulsar el botón.');
  }
  throw lastError || new Error('No se pudo conectar con la API de Google Gemini.');
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
  const responseText = await callGemini(prompt, systemInstruction, { jsonMode: true });
  
  // Clean JSON block format if returned by Gemini (e.g. ```json ... ```)
  let cleanJson = responseText.trim();
  const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    cleanJson = jsonMatch[0];
  } else {
    cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  }
  
  try {
    const parsed = JSON.parse(cleanJson.trim());
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    throw new Error('Formato de lista de ideas no válido devuelto por Gemini');
  } catch (e) {
    console.error('Error al parsear JSON de ideas de Gemini:', responseText);
    throw new Error('Google Gemini no devolvió las ideas en formato estructurado requerido. Inténtalo de nuevo.');
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
  const responseText = await callGemini(prompt, systemInstruction, { jsonMode: true });
  
  let cleanJson = responseText.trim();
  const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    cleanJson = jsonMatch[0];
  } else {
    cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  }
  
  try {
    const parsed = JSON.parse(cleanJson.trim());
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    throw new Error('Formato de lista no válido devuelto por Gemini');
  } catch (e) {
    console.error('Error al parsear JSON de leads de Gemini:', responseText);
    throw new Error('Google Gemini no devolvió la lista en formato estructurado requerido. Inténtalo de nuevo.');
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
