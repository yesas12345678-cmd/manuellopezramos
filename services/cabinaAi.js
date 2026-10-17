import dotenv from 'dotenv';
import { callGemini } from './gemini.js';

dotenv.config();

// Prompt G · Contexto común
const COMMON_CONTEXT = `
Trabajas dentro de la Cabina de Ventas de zVaito, especializada en desarrollo web de alta conversión, automatizaciones con IA y software a medida para pymes y empresas de servicios profesionales. Los comerciales llaman en frío para cerrar una demo interactiva de 15 minutos enseñando en pantalla cómo lo resolvió una empresa de su sector.
Reglas de estilo: español de España, frases cortas y contundentes que se puedan decir en voz alta con naturalidad, tono humano, cercano y profesional. Nunca vendas «IA por vender humo»: habla de clientes que entran automáticamente, horas de oficina ahorradas picando facturas/citas, presupuestos en 2 minutos y rentabilidad. Nunca inventes cifras ni porcentajes: solo usa lo que dijo el cliente y lo que está en su ficha.
`.trim();

/**
 * Llama al motor de IA configurado (Anthropic Claude si hay ANTHROPIC_API_KEY, o Gemini como motor rápido)
 */
async function callAiJson(systemPrompt, userMessage) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (anthropicKey) {
    try {
      const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        return cleanJsonParse(text);
      }
      console.warn('[Cabina AI] Error en Anthropic API, recurriendo a Gemini...');
    } catch (err) {
      console.warn('[Cabina AI] Fallo conectando a Anthropic:', err.message);
    }
  }

  // Fallback a Gemini
  const combinedPrompt = `INSTRUCCIÓN DE SISTEMA:\n${systemPrompt}\n\nRESPONDE ESTRICTAMENTE CON UN OBJETO JSON VÁLIDO SIN TEXTO ADICIONAL NI MARKDOWN:\n${userMessage}`;
  const responseText = await callGemini(combinedPrompt);
  return cleanJsonParse(responseText);
}

function cleanJsonParse(text) {
  if (!text) return null;
  let clean = text.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
  }
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('[Cabina AI] Error parseando JSON de respuesta:', e.message, 'Texto recibido:', text);
    return null;
  }
}

/**
 * B · El coach en directo
 */
export async function getLiveCoachAdvice({
  prospect,
  step = 1,
  transcript = '',
  slots = { slot1: 'martes a las 09:00', slot2: 'jueves a las 16:30' },
  objections = []
}) {
  const systemPrompt = `
${COMMON_CONTEXT}

B.1 · Reglas del coach en directo:
Eres el coach en directo de un comercial de Verox que está en plena llamada en frío. El objetivo de la llamada es cerrar una demo interactiva de 15 minutos enseñando cómo lo resolvió una empresa de su sector (desarrollo web, automatizaciones con IA y software a medida), con fecha concreta.
Lees lo último que se ha dicho y devuelves un objeto JSON con:
- «decir»: la frase que el comercial puede decir YA. Máximo 2 frases cortas, naturales, de tú, en español de España. Si el cliente pone una objeción, reconócela sin discutir y termina con una pregunta. Si da una cifra, devuélvesela con sus palabras y pasa a la siguiente pregunta o al cierre. Si muestra interés, propón la demo interactiva con las dos horas disponibles. Si el comercial va bien y no hace falta nada, deja «decir» vacío "".
- «motivo»: uno de ["objecion", "pregunta", "cifra", "interes", "decisor", "cierre", "nada"].
- «objecion»: si el cliente acaba de poner una objeción, su etiqueta corta de 3-6 palabras. Si no, vacío "".
- «cifras»: array de objetos [{ "id": "d1", "valor": "60 a la semana" }]. Solo números que haya dicho el CLIENTE (nunca los que dice el comercial), y solo de sus últimas intervenciones. Escríbelos SIEMPRE con dígitos: «sesenta» = 60, «media hora» = 30 minutos, «seis horas y media» = 6,5 horas.
- «calculo»: objeto { "modo": "veces" | "horas" | "ninguno", "cantidad": number, "periodo": "dia" | "semana" | "mes", "tiempo": number, "unidad": "min" | "h" }. Rellénalo solo cuando el cliente ya haya dicho cuántas veces pasa algo y cuánto tarda cada vez, o directamente cuántas horas le dedican. Si falta algo, modo "ninguno" con 0.
- Usa SOLO lo que ha dicho el cliente y los datos de la ficha. Nunca inventes cifras ni porcentajes.
`.trim();

  const userMessage = `
Empresa: ${prospect.empresa} (${prospect.subsector || prospect.nicho || 'Servicios'}).
Qué hacen: ${prospect.que_hacen || 'Servicios profesionales y pymes'}.
Decisor: ${prospect.decisor?.nombre ? `${prospect.decisor.nombre} (${prospect.decisor.cargo || 'Responsable'})` : 'desconocido'}.
Lo que le encaja: ${prospect.solucion_propuesta?.principal || 'Desarrollo web moderno y automatizaciones con IA'}.
Prueba que se puede contar: ${prospect.solucion_propuesta?.prueba_a_citar || 'Una asesoría en Madrid automatizó la recepción de facturas ahorrando 14h semanales.'}.
Paso del guion ahora: Paso ${step} de 4.
Huecos para la demo interactiva (15 min): ${slots.slot1} o ${slots.slot2}.
Preguntas de cifra: ${prospect.dolores?.map((d, i) => `d${i + 1}: ${d.pregunta_cuantificacion}`).join(' | ') || 'd1: ¿Cuántas horas a la semana se van en esto?'}.
Banco de objeciones: ${objections.map(o => o.etiqueta).join(' · ')}.

Lo último de la llamada:
${transcript || 'Cliente: Hola, dígame.'}
`.trim();

  const result = await callAiJson(systemPrompt, userMessage);
  return result || {
    decir: "",
    motivo: "nada",
    objecion: "",
    cifras: [],
    calculo: { modo: "ninguno", cantidad: 0, periodo: "dia", tiempo: 0, unidad: "min" }
  };
}

/**
 * C · El resumen al colgar
 */
export async function generateCallSummary({
  prospect,
  resultado = 'no_contesta',
  paso = 1,
  cifras = [],
  objeciones = [],
  nota = '',
  transcripcion = ''
}) {
  const systemPrompt = `
${COMMON_CONTEXT}

C.1 · Prompt de sistema:
Resume una llamada comercial a partir de la nota rápida del comercial y de la transcripción de la llamada. Sé fiel a lo dicho: no añadas nada que no esté.
Devuelve un JSON con:
- «resumen»: Dos o tres frases claras: con quién se habló, qué dijo y en qué quedó.
- «proxima_accion»: Una acción concreta, con fecha si la hay.
- «cifras_detectadas»: Array de [{ "clave": "horas_semana", "valor": "6" }] solo si las dijo el cliente.
- «apertura_siguiente»: Primera frase para la próxima llamada a esta empresa, retomando lo hablado. Si el resultado es "no_interesa" o "no_llamar_mas", vacío "".
`.trim();

  const userMessage = `
Empresa: ${prospect.empresa} (${prospect.subsector || prospect.nicho || 'Servicios'}).
Decisor: ${prospect.decisor?.nombre || 'desconocido'}.
Llamó: zVaito. Resultado registrado: ${resultado}. Paso del guion alcanzado: ${paso} de 4.
Cifras apuntadas en el guion: ${JSON.stringify(cifras)}.
Objeciones que salieron: ${objeciones.join(' · ') || 'ninguna'}.
Nota rápida del comercial:
"""${nota}"""
Transcripción de la llamada:
"""${transcripcion.slice(-15000)}"""
`.trim();

  const result = await callAiJson(systemPrompt, userMessage);
  return result || {
    resumen: `Llamada con resultado: ${resultado}. ${nota || 'Sin notas registradas.'}`,
    proxima_accion: resultado === 'diagnostico' ? 'Enviar WhatsApp y preparar enlace de Meet.' : 'Reintentar según mejor franja.',
    cifras_detectadas: [],
    apertura_siguiente: ""
  };
}

/**
 * D · La nota de la llamada (Rúbrica sobre 100)
 */
export async function gradeCallRubric({
  prospect,
  resultado = '',
  resumen = '',
  transcripcion = ''
}) {
  const wordCount = transcripcion ? transcripcion.trim().split(/\s+/).length : 0;
  if (wordCount < 40) {
    return {
      nota_total: 0,
      nivel: "Sin transcripción suficiente",
      comentario: "Llamada demasiado corta o sin transcripción para aplicar la rúbrica.",
      notas: { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0, C7: 0, C8: 0 },
      es_modelo: false
    };
  }

  const systemPrompt = `
${COMMON_CONTEXT}

D.1 · Rúbrica de llamada en frío (8 criterios):
Puntúa cada criterio con 0 (no lo hizo o mal), 1 (parcial) o 2 (bien):
- C1 Identidad correcta (peso 8): «Soy X, de Verox» y qué hacemos por su sector, sin cargos inflados.
- C2 Gancho de dolor concreto (peso 12): engancha un dolor concreto y reconocible de su sector.
- C3 Cualificación del decisor (peso 18): sabe pronto si habla con quien decide; si no, consigue nombre y vía.
- C4 Embudo de cuantificación (peso 22): sale con una cifra en € u horas dicha por el cliente.
- C5 Manejo de objeciones (peso 10): ante «ya tengo X» enseña que Verox complementa, no compite.
- C6 Cierre de cita con fecha (peso 20): propone dos horas concretas y confirma por WhatsApp; «ya te llamo» es 0.
- C7 Lenguaje (peso 5): frases cortas, sin muletillas, sin «IA por IA».
- C8 Escucha/habla (peso 5): el cliente habla más o al menos un 50-60%.

Devuelve un JSON con:
{
  "notas": { "C1": 0|1|2, "C2": 0|1|2, "C3": 0|1|2, "C4": 0|1|2, "C5": 0|1|2, "C6": 0|1|2, "C7": 0|1|2, "C8": 0|1|2 },
  "comentario": "La mejora más importante para la próxima llamada, en una o dos frases."
}
`.trim();

  const userMessage = `
Empresa: ${prospect.empresa} (${prospect.subsector || 'Servicios'}).
Resultado registrado: ${resultado}.
Resumen: ${resumen || '—'}
Transcripción de la llamada:
"""${transcripcion.slice(-20000)}"""
`.trim();

  const result = await callAiJson(systemPrompt, userMessage);
  const notas = result?.notas || { C1: 1, C2: 1, C3: 1, C4: 0, C5: 1, C6: 0, C7: 1, C8: 1 };
  const comentario = result?.comentario || "Seguir reforzando la cuantificación de horas y el cierre con dos fechas.";

  // Cálculo según D.5 del manual:
  // Puntos = (nota / 2) * peso
  const weights = { C1: 8, C2: 12, C3: 18, C4: 22, C5: 10, C6: 20, C7: 5, C8: 5 };
  let totalScore = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const val = notas[key] !== undefined ? notas[key] : 1;
    totalScore += (val / 2) * weight;
  }
  totalScore = Math.round(totalScore);

  // Filtro duro: sin cifra (C4 = 0) o sin fecha (C6 = 0) -> «A pulir»
  let nivel = "Listo";
  if (notas.C4 === 0 || notas.C6 === 0 || totalScore < 50) {
    nivel = "A pulir";
  } else if (totalScore < 75) {
    nivel = "Sólido";
  }

  const es_modelo = totalScore >= 80;

  return {
    nota_total: totalScore,
    nivel,
    comentario,
    notas,
    es_modelo
  };
}

/**
 * E · Respuesta a una objeción nueva
 */
export async function generateObjectionResponse({ prospect, objectionText }) {
  const systemPrompt = `
${COMMON_CONTEXT}

E.1 · Prompt de sistema:
El comercial está en plena llamada y el cliente acaba de poner una objeción. Da una respuesta que pueda decir ya: reconoce lo que dice, no discutas, reencuadra (si ya tiene una herramienta, Verox la complementa y no la sustituye) y cierra con una pregunta que mantenga viva la conversación o acerque el diagnóstico. Sin presión ni trucos.
Devuelve un JSON con:
- «etiqueta»: La objeción resumida en 3-6 palabras, como la diría el cliente.
- «respuesta»: Lo que dice el comercial: 2-3 frases cortas, reconoce la objeción y termina con una pregunta.
`.trim();

  const userMessage = `
Empresa: ${prospect?.empresa || 'Empresa técnica'} · ${prospect?.subsector || 'Servicios'}
Qué hacen: ${prospect?.que_hacen || 'Servicio técnico con técnicos en ruta'}
Lo que le encajaría: ${prospect?.solucion_propuesta?.principal || 'Partes de trabajo digitales'}
Objeción del cliente: """${objectionText}"""
`.trim();

  const result = await callAiJson(systemPrompt, userMessage);
  return result || {
    etiqueta: objectionText.slice(0, 30),
    respuesta: `Entiendo perfectamente lo que me dices. No vengo a cambiar nada que ya os funcione; solo quería saber: ¿cómo gestionáis esto en el día a día para evitar cuellos de botella?`
  };
}
