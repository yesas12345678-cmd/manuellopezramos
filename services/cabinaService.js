import pg from 'pg';
import { readDB, writeDB } from './dbHelper.js';

const { Pool } = pg;

let pgPool = null;
if (process.env.DATABASE_URL) {
  try {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    });
    console.log('[Cabina DB] Configurado pool de PostgreSQL desde DATABASE_URL (Dokploy)');
  } catch (err) {
    console.error('[Cabina DB] Error inicializando pool PostgreSQL:', err.message);
  }
}

// Inicialización de tablas PostgreSQL si está conectado
export async function initPostgresTables() {
  if (!pgPool) return;
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS cabina_prospects (
        id VARCHAR(100) PRIMARY KEY,
        empresa VARCHAR(255) NOT NULL,
        nicho VARCHAR(100),
        subsector VARCHAR(255),
        razon_social VARCHAR(255),
        cif VARCHAR(50),
        web VARCHAR(255),
        provincia VARCHAR(100),
        localidad VARCHAR(100),
        tamano JSONB,
        decisor JSONB,
        telefonos JSONB,
        email_empresa VARCHAR(255),
        que_hacen TEXT,
        clientes_tipo TEXT,
        senales JSONB,
        dolores JSONB,
        solucion_propuesta JSONB,
        score INTEGER DEFAULT 0,
        prioridad VARCHAR(10) DEFAULT 'B',
        guion JSONB,
        mejor_franja VARCHAR(100),
        notas TEXT,
        estado VARCHAR(50) DEFAULT 'pendiente',
        intentos INTEGER DEFAULT 0,
        proxima_llamada TIMESTAMP,
        apertura_siguiente TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cabina_interactions (
        id VARCHAR(100) PRIMARY KEY,
        prospect_id VARCHAR(100) REFERENCES cabina_prospects(id) ON DELETE CASCADE,
        comercial VARCHAR(100) DEFAULT 'zVaito',
        resultado VARCHAR(50) NOT NULL,
        paso_alcanzado INTEGER DEFAULT 1,
        duracion_segundos INTEGER DEFAULT 0,
        cifras JSONB DEFAULT '[]'::jsonb,
        calculo JSONB DEFAULT '{}'::jsonb,
        objeciones JSONB DEFAULT '[]'::jsonb,
        nota_rapida TEXT,
        transcripcion TEXT,
        resumen_ia TEXT,
        proxima_accion TEXT,
        nota_rubrica INTEGER,
        rubrica_desglose JSONB,
        es_modelo BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cabina_objections (
        id VARCHAR(100) PRIMARY KEY,
        etiqueta VARCHAR(255) NOT NULL,
        respuesta TEXT NOT NULL,
        sector VARCHAR(100) DEFAULT 'general',
        veces INTEGER DEFAULT 0,
        exitos INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Cabina DB] Tablas PostgreSQL listas o verificadas en Dokploy');
  } catch (err) {
    console.warn('[Cabina DB] Error verificando tablas en PostgreSQL, usando fallback local si falla:', err.message);
  }
}

// 3 Pymes reales adaptadas a la venta de: Desarrollo web, automatizaciones con IA y software a medida
export const DEFAULT_PROSPECTS = [
  {
    id: "asesoria-hernandez",
    nicho: "servicios-profesionales",
    subsector: "Asesoría fiscal, contable y laboral para pymes",
    empresa: "Hernández & Asociados · Asesoría Integral",
    razon_social: "Hernández & Asociados Asesores S.L.",
    cif: "B28123456",
    web: "https://asesoriahernandez.es",
    provincia: "Madrid",
    localidad: "Madrid",
    tamano: { empleados: "10-20", fuente: "Web y Registro Mercantil" },
    decisor: { nombre: "Carlos Hernández", cargo: "Socio Director", fuente: "Web / BORME" },
    telefonos: [
      { numero: "618 20 30 40", tipo: "movil", etiqueta: "móvil · gerencia", fuente: "Web empresa" },
      { numero: "912 34 56 78", tipo: "fijo", etiqueta: "oficina central", fuente: "Web empresa" }
    ],
    email_empresa: "direccion@asesoriahernandez.es",
    que_hacen: "Gestión fiscal, laboral y contable para más de 250 empresas y autónomos. Tienen 6 contables procesando documentación.",
    clientes_tipo: "Pymes, autónomos y comercios locales",
    senales: [
      { senal: "Web estática tradicional sin portal web del cliente", fuente: "https://asesoriahernandez.es", peso: "alta" },
      { senal: "Indican en la web que gestionan más de 250 clientes", fuente: "https://asesoriahernandez.es/nosotros", peso: "media" },
      { senal: "Oferta de empleo activa buscando auxiliar contable para picar facturas", fuente: "LinkedIn / Web", peso: "alta" }
    ],
    dolores: [
      {
        dolor: "Horas perdidas clasificando facturas y tickets a mano a final de trimestre",
        por_que_lo_creemos: "Los clientes mandan fotos borrosas por WhatsApp o correos sueltos y el equipo pasa días transcribiendo datos a mano.",
        pregunta_cuantificacion: "¿Cuántas horas a la semana dedica tu equipo a clasificar y picar facturas de clientes a mano?"
      },
      {
        dolor: "Web corporativa que no capta clientes nuevos ni automatiza altas",
        por_que_lo_creemos: "Tienen un formulario simple que llega a un buzón sin seguimiento automatizado ni agendamiento.",
        pregunta_cuantificacion: "¿Cuántos clientes nuevos os entran de forma automática al mes a través de la web?"
      }
    ],
    solucion_propuesta: {
      principal: "Portal web de clientes con extracción automática de facturas mediante IA (OCR en 3 segundos)",
      complementaria: "Automatización de recordatorios automáticos por WhatsApp antes del cierre de trimestre",
      prueba_a_citar: "Una asesoría similar en Toledo con 180 clientes ahorró 14 horas semanales de oficina automatizando la recepción de facturas con IA."
    },
    score: 88,
    prioridad: "A",
    guion: {
      apertura: "Hola, ¿Carlos? Soy zVaito. Te llamo porque he visto en vuestra web que asesoráis a más de 200 pymes, y quería hacerte una pregunta rápida sobre cómo os hacen llegar las facturas y tickets los clientes a la oficina. ¿Tienes un minuto?",
      si_no_esta_el_decisor: "Perfecto. ¿Cómo se llama la persona que coordina los procesos contables y la oficina, y a qué hora es mejor pillarle? Así no te hago perder tiempo.",
      preguntas_descubrimiento: [
        "¿Cuántas horas a la semana se os van en clasificar y transcribir a mano facturas de clientes?",
        "¿Os ha pasado a final de trimestre que se acumulan decenas de tickets a última hora y os bloquean el trabajo?",
        "¿Vuestra página web actual os está generando clientes cualificados o solo funciona como tarjeta de visita?"
      ],
      objecion_probable: {
        objecion: "Ya tenemos un programa de contabilidad",
        respuesta: "Me parece excelente, nosotros no venimos a sustituir vuestro programa contable. Solo una pregunta: ¿los clientes os suben las facturas ya ordenadas o vuestro equipo tiene que revisarlas y picarlas una por una? Lo que hacemos se conecta a lo que ya tenéis para ahorraros ese paso."
      },
      cierre_diagnostico: "Te propongo una demo interactiva de 15 minutos: te enseño en pantalla cómo otra asesoría automatizó la recepción de facturas con IA y cómo podéis ahorrar más de 12 horas a la semana. ¿Te va mejor el martes a las 09:00 o el jueves a las 16:30?"
    },
    mejor_franja: "9:00 - 10:30 antes de reuniones con clientes",
    notas: "Carlos busca eficiencia y reducir horas extras de su equipo en trimestres.",
    estado: "pendiente",
    intentos: 0,
    apertura_siguiente: null
  },
  {
    id: "clinica-dental-valero",
    nicho: "salud-bienestar",
    subsector: "Clínica odontológica y estética avanzada",
    empresa: "Clínica Dental & Estética Valero",
    razon_social: "Valero Dental Care S.L.",
    cif: "B46112233",
    web: "https://clinicavalero.es",
    provincia: "Valencia",
    localidad: "Valencia",
    tamano: { empleados: "8-15", fuente: "Web clínica" },
    decisor: { nombre: "Dra. Elena Valero", cargo: "Directora Médica & Propietaria", fuente: "Web / Colegio Oficial" },
    telefonos: [
      { numero: "633 45 67 89", tipo: "movil", etiqueta: "móvil · dirección", fuente: "Web" },
      { numero: "963 88 99 00", tipo: "fijo", etiqueta: "recepción clínica", fuente: "Web" }
    ],
    email_empresa: "direccion@clinicavalero.es",
    que_hacen: "Tratamientos de ortodoncia invisible, implantes y estética dental con 4 gabinetes activos.",
    clientes_tipo: "Pacientes particulares y familias",
    senales: [
      { senal: "Web no adaptada correctamente a móviles sin reserva online", fuente: "https://clinicavalero.es", peso: "alta" },
      { senal: "Piden llamar por teléfono solo en horario de mañana", fuente: "https://clinicavalero.es/contacto", peso: "media" },
      { senal: "Anuncios en Instagram que mandan a una web lenta", fuente: "Meta Ads / Web", peso: "alta" }
    ],
    dolores: [
      {
        dolor: "Huecos vacíos por cancelaciones de última hora (no-shows)",
        por_que_lo_creemos: "Recepción confirma citas llamando a mano y muchos pacientes no contestan o lo olvidan.",
        pregunta_cuantificacion: "¿Cuántas citas al mes se os quedan colgadas por pacientes que no avisan con tiempo?"
      },
      {
        dolor: "Pérdida de pacientes potenciales que entran por la tarde o noche cuando la clínica está cerrada",
        por_que_lo_creemos: "No tienen ningún asistente ni sistema web que capture citas fuera de horario.",
        pregunta_cuantificacion: "¿Cuántos pacientes crees que visitan la web por la noche y se van a otra clínica porque no pueden reservar al momento?"
      }
    ],
    solucion_propuesta: {
      principal: "Web de alta conversión con reserva inteligente de citas adaptada a móvil",
      complementaria: "Agente IA en WhatsApp que confirma citas, responde dudas frecuentes 24/7 y cubre cancelaciones automáticamente",
      prueba_a_citar: "Una clínica en Alicante redujo los no-shows del 18% a menos del 3% y aumentó un 28% las citas captadas fuera de horario de clínica."
    },
    score: 82,
    prioridad: "A",
    guion: {
      apertura: "Hola, ¿Elena? Soy zVaito. Te llamo porque he visto vuestra clínica en Valencia y quería hacerte una pregunta muy rápida sobre cómo gestionáis los recordatorios de citas para evitar cancelaciones de última hora. ¿Tienes un minuto?",
      si_no_esta_el_decisor: "¿Quién coordina la gestión de recepción y las citas con la Dra. Valero? ¿Cuál es su contacto directo?",
      preguntas_descubrimiento: [
        "¿Cuántos pacientes os fallan o cancelan a última hora cada semana?",
        "¿Cuánto tiempo dedica vuestro equipo de recepción a llamar o enviar mensajes uno a uno para confirmar la agenda del día siguiente?",
        "¿Tenéis forma de que un paciente agende directamente desde el móvil un domingo por la noche?"
      ],
      objecion_probable: {
        objecion: "Ya tenemos bastante trabajo / No damos abasto",
        respuesta: "Precisamente por eso te llamo. No se trata de sobrecargaros con más llamadas, sino de automatizar las citas y recordatorios para que recepción no pierda 2 horas al día al teléfono."
      },
      cierre_diagnostico: "Te propongo una demo interactiva de 15 minutos: te enseño en pantalla cómo otra clínica automatizó los recordatorios por WhatsApp y cómo los pacientes agendan solos desde el móvil. ¿Te va mejor el martes a las 09:00 o el jueves a las 16:30?"
    },
    mejor_franja: "13:30 - 15:00 entre turnos de consulta",
    notas: "Elena valora mucho la puntualidad y que las recepcionistas atiendan mejor a los pacientes presenciales.",
    estado: "pendiente",
    intentos: 0,
    apertura_siguiente: null
  },
  {
    id: "reformas-alarcon",
    nicho: "servicios-instalaciones",
    subsector: "Reformas integrales e instalaciones de climatización",
    empresa: "Instalaciones & Reformas Técnicas Alarcón S.L.",
    razon_social: "Construcciones y Reformas Alarcón S.L.",
    cif: "B50889900",
    web: "https://reformasalarcon.es",
    provincia: "Zaragoza",
    localidad: "Zaragoza",
    tamano: { empleados: "12-25", fuente: "Web corporativa" },
    decisor: { nombre: "Javier Alarcón", cargo: "Gerente y Director de Obra", fuente: "Web / Registro" },
    telefonos: [
      { numero: "644 12 34 56", tipo: "movil", etiqueta: "móvil · Javier", fuente: "Web" },
      { numero: "976 55 66 77", tipo: "fijo", etiqueta: "oficina técnica", fuente: "Web" }
    ],
    email_empresa: "javier@reformasalarcon.es",
    que_hacen: "Reformas integrales de viviendas, locales comerciales e instalaciones de climatización y aerotermia.",
    clientes_tipo: "Propietarios de viviendas, locales y comunidades de vecinos",
    senales: [
      { senal: "Web desactualizada con fotos de proyectos antiguas sin cotizador", fuente: "https://reformasalarcon.es", peso: "alta" },
      { senal: "Formulario de contacto básico que no pide metros cuadrados ni tipología", fuente: "https://reformasalarcon.es/contacto", peso: "media" },
      { senal: "Gran volumen de trabajo en obra pero retrasos en oficina", fuente: "Reseñas / Web", peso: "alta" }
    ],
    dolores: [
      {
        dolor: "Tardan entre 4 y 7 días en entregar un presupuesto tras visitar la obra",
        por_que_lo_creemos: "Toman medidas con libreta de papel y tienen que pasarlo a Excel por las noches o fines de semana.",
        pregunta_cuantificacion: "¿Cuántas horas a la semana dedicas fuera de la jornada de obra a redactar presupuestos en el ordenador?"
      },
      {
        dolor: "Pérdida de clientes que contratan a la competencia porque les respondieron antes",
        por_que_lo_creemos: "En reformas, el primer presupuesto detallado que entra tiene un 60% más de probabilidad de cierre.",
        pregunta_cuantificacion: "¿Te ha pasado que un cliente te diga 'ya lo he cerrado con otro' antes de que pudieras enviarle el tuyo?"
      }
    ],
    solucion_propuesta: {
      principal: "Software a medida en móvil/tablet para generar presupuestos técnicos en 3 minutos in situ",
      complementaria: "Web corporativa con estimador de reformas que filtra y cualifica los contactos antes de visitarlos",
      prueba_a_citar: "Una empresa de reformas en Zaragoza pasó de tardar 5 días a entregar la propuesta en PDF en la misma visita, aumentando su tasa de cierre un 35%."
    },
    score: 84,
    prioridad: "A",
    guion: {
      apertura: "Hola, ¿Javier? Soy zVaito. Te llamo porque he visto vuestros proyectos de reformas en vuestra web, y tengo una pregunta rápida sobre cuánto tardáis normalmente en entregar un presupuesto desde que visitáis la obra. ¿Tienes un minuto?",
      si_no_esta_el_decisor: "¿Quién coordina la elaboración de presupuestos y la oficina técnica? ¿Cómo puedo contactarle?",
      preguntas_descubrimiento: [
        "¿Cuántas horas a la semana te quita por las noches pasar las notas de obra a presupuestos en limpio?",
        "¿Cuánto tiempo pasa normalmente desde que visitas al cliente hasta que le llega el PDF con el precio?",
        "¿Os ha pasado que un cliente se decante por otro presupuesto porque se lo enviaron antes?"
      ],
      objecion_probable: {
        objecion: "Mándame un correo con la información",
        respuesta: "Te lo mando sin problema, pero para no enviarte un PDF genérico: ¿los presupuestos los haces tú personalmente en Excel o tenéis a alguien en oficina? Así te preparo solo lo que os ahorre tiempo real."
      },
      cierre_diagnostico: "Te propongo una demo interactiva de 15 minutos: te enseño cómo otros instaladores y reformistas pasaron de tardar 4 días a entregar presupuestos en 2 minutos desde el móvil con plantillas inteligentes. ¿Te va mejor el martes a las 09:00 o el jueves a las 16:30?"
    },
    mejor_franja: "8:00 - 9:00 o sobre las 14:00",
    notas: "Javier pasa mucho tiempo a pie de obra. Prefiere soluciones prácticas que funcionen desde el móvil.",
    estado: "pendiente",
    intentos: 0,
    apertura_siguiente: null
  }
];

export const DEFAULT_OBJECTIONS = [
  {
    id: "obj-1",
    etiqueta: "Ya tenemos página web",
    respuesta: "Me parece excelente, y no te llamo para rehacer lo que ya tengáis bien hecho. Solo una pregunta: ¿vuestra web actual os está generando clientes cualificados cada semana de forma automática o es solo una tarjeta de visita digital? En 15 min te enseño cómo convertirla en un captador real.",
    sector: "desarrollo-web",
    veces: 42,
    exitos: 18
  },
  {
    id: "obj-2",
    etiqueta: "Mándame un correo con la información",
    respuesta: "Te lo mando encantado, pero para no enviarte un dossier genérico que acabe en la papelera: ¿vuestro mayor dolor de cabeza ahora mismo es captar más clientes o las horas que perdéis en tareas administrativas repetitivas? Así te preparo solo lo que os sirva a vosotros.",
    sector: "general",
    veces: 35,
    exitos: 12
  },
  {
    id: "obj-3",
    etiqueta: "Ahora no tengo tiempo / Estoy ocupado",
    respuesta: "Te entiendo perfectamente, te pillo en mitad del trabajo. Precisamente por eso te llamo: los clientes que trabajan con nosotros estaban desbordados de trabajo manual. La demo dura literalmente 15 minutos y te enseña cómo liberar entre 10 y 15 horas al mes con software e IA. ¿Te va mejor a primera hora o a media tarde?",
    sector: "general",
    veces: 28,
    exitos: 10
  },
  {
    id: "obj-4",
    etiqueta: "La IA y el software a medida son muy caros",
    respuesta: "Tiene todo el sentido que pienses eso, porque muchas agencias inflan los precios con cosas que no sirven. Nosotros creamos herramientas pragmáticas y automatizaciones que se amortizan en las primeras 4 semanas. En la demo de 15 minutos ves con números reales si a ti te compensa o no antes de poner un solo euro.",
    sector: "software-ia",
    veces: 22,
    exitos: 9
  },
  {
    id: "obj-5",
    etiqueta: "No nos interesa",
    respuesta: "Lo respeto al cien por cien. Solo una duda antes de cerrar tu ficha: ¿en vuestra empresa tenéis todos los procesos, captación y tareas administrativas automatizados al 100% sin perder horas de oficina? Si no es así, te guardo una demo de 15 minutos sin ningún compromiso.",
    sector: "general",
    veces: 19,
    exitos: 4
  }
];

// Helper para leer base de datos híbrida (Postgres o db.json)
export async function getCabinaState() {
  if (pgPool) {
    try {
      const pRes = await pgPool.query('SELECT * FROM cabina_prospects ORDER BY created_at ASC');
      const iRes = await pgPool.query('SELECT * FROM cabina_interactions ORDER BY created_at DESC');
      const oRes = await pgPool.query('SELECT * FROM cabina_objections ORDER BY exitos DESC');

      const hasOldFrigo = pRes.rows.some(r => r.id === 'frigotecnica-almanzor');
      if (pRes.rows.length === 0 || hasOldFrigo) {
        if (hasOldFrigo) {
          await pgPool.query("DELETE FROM cabina_prospects WHERE id IN ('frigotecnica-almanzor', 'climaga-hnos', 'carretillas-ebro')");
          await pgPool.query("DELETE FROM cabina_objections");
        }
        for (const p of DEFAULT_PROSPECTS) {
          await saveProspectPG(p);
        }
        for (const o of DEFAULT_OBJECTIONS) {
          await pgPool.query(
            `INSERT INTO cabina_objections (id, etiqueta, respuesta, sector, veces, exitos) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET etiqueta = EXCLUDED.etiqueta, respuesta = EXCLUDED.respuesta`,
            [o.id, o.etiqueta, o.respuesta, o.sector, o.veces, o.exitos]
          );
        }
        const fresh = await pgPool.query('SELECT * FROM cabina_prospects ORDER BY created_at ASC');
        return { prospects: fresh.rows.map(normalizePGProspect), interactions: iRes.rows, objections: DEFAULT_OBJECTIONS };
      }

      const prospects = pRes.rows.map(normalizePGProspect);
      const interactions = iRes.rows;
      const objections = oRes.rows;
      return { prospects, interactions, objections };
    } catch (e) {
      console.warn('[Cabina DB] Fallo leyendo Postgres, recurriendo a db.json:', e.message);
    }
  }

  // Fallback db.json
  const db = await readDB();
  if (!db.cabina || db.cabina.prospects?.some(p => p.id === 'frigotecnica-almanzor')) {
    db.cabina = {
      prospects: DEFAULT_PROSPECTS,
      interactions: [],
      objections: DEFAULT_OBJECTIONS
    };
    await writeDB(db);
  }
  return db.cabina;
}

function normalizePGProspect(r) {
  return {
    ...r,
    tamano: r.tamano || {},
    decisor: r.decisor || {},
    telefonos: r.telefonos || [],
    senales: r.senales || [],
    dolores: r.dolores || [],
    solucion_propuesta: r.solucion_propuesta || {},
    guion: r.guion || {}
  };
}

async function saveProspectPG(p) {
  const q = `
    INSERT INTO cabina_prospects (
      id, empresa, nicho, subsector, razon_social, cif, web, provincia, localidad,
      tamano, decisor, telefonos, email_empresa, que_hacen, clientes_tipo, senales,
      dolores, solucion_propuesta, score, prioridad, guion, mejor_franja, notas, estado, intentos, apertura_siguiente
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
    ) ON CONFLICT (id) DO UPDATE SET
      estado = EXCLUDED.estado,
      intentos = EXCLUDED.intentos,
      apertura_siguiente = EXCLUDED.apertura_siguiente,
      updated_at = CURRENT_TIMESTAMP;
  `;
  await pgPool.query(q, [
    p.id, p.empresa, p.nicho || 'servicios-tecnicos', p.subsector || '', p.razon_social || null, p.cif || null,
    p.web || '', p.provincia || '', p.localidad || '',
    JSON.stringify(p.tamano || {}), JSON.stringify(p.decisor || {}), JSON.stringify(p.telefonos || []),
    p.email_empresa || null, p.que_hacen || '', p.clientes_tipo || '', JSON.stringify(p.senales || []),
    JSON.stringify(p.dolores || []), JSON.stringify(p.solucion_propuesta || {}),
    p.score || 50, p.prioridad || 'B', JSON.stringify(p.guion || {}), p.mejor_franja || '', p.notas || '',
    p.estado || 'pendiente', p.intentos || 0, p.apertura_siguiente || null
  ]);
}

// Obtener la cola de llamadas (Filtro inteligente de Verox)
// 1. Rellamadas vencidas (llamar_luego con fecha pasada)
// 2. Empresas en su mejor hora
// 3. Por prioridad (A > B > C)
// Excluidas: "no_llamar_mas" y las que tienen >= 6 intentos
export async function getCallQueue() {
  const state = await getCabinaState();
  const list = state.prospects.filter(p => {
    if (p.estado === 'no_llamar_mas') return false;
    if ((p.intentos || 0) >= 6) return false;
    return true;
  });

  // Ordenar según prioridad y score
  return list.sort((a, b) => {
    // Si una es prioridad A y otra B
    const prioWeight = { 'A': 3, 'B': 2, 'C': 1 };
    const pA = prioWeight[a.prioridad] || 1;
    const pB = prioWeight[b.prioridad] || 1;
    if (pA !== pB) return pB - pA;
    return (b.score || 0) - (a.score || 0);
  });
}

// Registrar llamada / interacción
export async function recordInteraction(data) {
  const id = 'call_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const interaction = {
    id,
    prospect_id: data.prospect_id,
    comercial: data.comercial || 'zVaito',
    resultado: data.resultado, // no_contesta, llamar_luego, pedir_decisor, diagnostico, no_interesa, no_llamar_mas
    paso_alcanzado: data.paso_alcanzado || 1,
    duracion_segundos: data.duracion_segundos || 0,
    cifras: data.cifras || [],
    calculo: data.calculo || {},
    objeciones: data.objeciones || [],
    nota_rapida: data.nota_rapida || '',
    transcripcion: data.transcripcion || '',
    resumen_ia: data.resumen_ia || null,
    proxima_accion: data.proxima_accion || null,
    nota_rubrica: data.nota_rubrica || null,
    rubrica_desglose: data.rubrica_desglose || null,
    es_modelo: !!data.es_modelo,
    created_at: new Date().toISOString()
  };

  if (pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO cabina_interactions (
          id, prospect_id, comercial, resultado, paso_alcanzado, duracion_segundos,
          cifras, calculo, objeciones, nota_rapida, transcripcion, resumen_ia,
          proxima_accion, nota_rubrica, rubrica_desglose, es_modelo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        interaction.id, interaction.prospect_id, interaction.comercial, interaction.resultado,
        interaction.paso_alcanzado, interaction.duracion_segundos, JSON.stringify(interaction.cifras),
        JSON.stringify(interaction.calculo), JSON.stringify(interaction.objeciones), interaction.nota_rapida,
        interaction.transcripcion, interaction.resumen_ia, interaction.proxima_accion, interaction.nota_rubrica,
        JSON.stringify(interaction.rubrica_desglose), interaction.es_modelo
      ]);

      // Actualizar prospect en Postgres
      await pgPool.query(`
        UPDATE cabina_prospects SET
          estado = $1,
          intentos = intentos + 1,
          apertura_siguiente = COALESCE($2, apertura_siguiente),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [interaction.resultado, data.apertura_siguiente || null, interaction.prospect_id]);

      // Si fue diagnóstico, sumar éxito a las objeciones
      if (interaction.resultado === 'diagnostico' && Array.isArray(interaction.objeciones)) {
        for (const objTag of interaction.objeciones) {
          await pgPool.query(`
            UPDATE cabina_objections SET veces = veces + 1, exitos = exitos + 1 WHERE etiqueta ILIKE $1
          `, [`%${objTag}%`]);
        }
      }

      return interaction;
    } catch (e) {
      console.warn('[Cabina DB] Fallo guardando interacción en Postgres, usando db.json:', e.message);
    }
  }

  // Fallback db.json
  const db = await readDB();
  if (!db.cabina) db.cabina = { prospects: DEFAULT_PROSPECTS, interactions: [], objections: DEFAULT_OBJECTIONS };
  db.cabina.interactions.unshift(interaction);

  const prospect = db.cabina.prospects.find(p => p.id === data.prospect_id);
  if (prospect) {
    prospect.estado = data.resultado;
    prospect.intentos = (prospect.intentos || 0) + 1;
    if (data.apertura_siguiente && data.resultado !== 'no_interesa' && data.resultado !== 'no_llamar_mas') {
      prospect.apertura_siguiente = data.apertura_siguiente;
    }
  }

  // Incrementar conteo en objeciones
  if (Array.isArray(data.objeciones)) {
    data.objeciones.forEach(tag => {
      const found = db.cabina.objections.find(o => o.etiqueta.toLowerCase().includes(tag.toLowerCase()));
      if (found) {
        found.veces = (found.veces || 0) + 1;
        if (data.resultado === 'diagnostico') found.exitos = (found.exitos || 0) + 1;
      }
    });
  }

  await writeDB(db);
  return interaction;
}

// Deshacer última llamada (en los 8 segundos de margen)
export async function undoInteraction(interactionId) {
  if (pgPool) {
    try {
      const intRes = await pgPool.query('SELECT * FROM cabina_interactions WHERE id = $1', [interactionId]);
      if (intRes.rows.length > 0) {
        const item = intRes.rows[0];
        await pgPool.query('DELETE FROM cabina_interactions WHERE id = $1', [interactionId]);
        await pgPool.query(`
          UPDATE cabina_prospects SET
            estado = 'pendiente',
            intentos = GREATEST(intentos - 1, 0)
          WHERE id = $1
        `, [item.prospect_id]);
        return { success: true };
      }
    } catch (e) {
      console.warn('[Cabina DB] Fallo deshaciendo en Postgres:', e.message);
    }
  }

  const db = await readDB();
  if (!db.cabina) return { success: false };
  const idx = db.cabina.interactions.findIndex(i => i.id === interactionId);
  if (idx !== -1) {
    const item = db.cabina.interactions[idx];
    db.cabina.interactions.splice(idx, 1);
    const prospect = db.cabina.prospects.find(p => p.id === item.prospect_id);
    if (prospect) {
      prospect.estado = 'pendiente';
      prospect.intentos = Math.max((prospect.intentos || 1) - 1, 0);
    }
    await writeDB(db);
    return { success: true };
  }
  return { success: false };
}

// Obtener biblioteca de objeciones
export async function getObjections(sector = '') {
  const state = await getCabinaState();
  if (!sector) return state.objections;
  return state.objections.filter(o => o.sector === 'general' || o.sector === sector);
}

// Guardar nueva objeción aprendida
export async function addObjection({ etiqueta, respuesta, sector = 'general' }) {
  const id = 'obj_' + Date.now();
  const newObj = {
    id,
    etiqueta,
    respuesta,
    sector,
    veces: 1,
    exitos: 0
  };

  if (pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO cabina_objections (id, etiqueta, respuesta, sector, veces, exitos)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [newObj.id, newObj.etiqueta, newObj.respuesta, newObj.sector, newObj.veces, newObj.exitos]);
      return newObj;
    } catch (e) {
      console.warn('[Cabina DB] Fallo insertando objeción en Postgres:', e.message);
    }
  }

  const db = await readDB();
  if (!db.cabina) db.cabina = { prospects: DEFAULT_PROSPECTS, interactions: [], objections: DEFAULT_OBJECTIONS };
  db.cabina.objections.push(newObj);
  await writeDB(db);
  return newObj;
}

// Obtener llamadas modelo (Puntaje >= 80)
export async function getModelCalls() {
  const state = await getCabinaState();
  return state.interactions.filter(i => (i.nota_rubrica || 0) >= 80 || i.es_modelo);
}

// Importar lote de empresas investigadas (Esquema prompt A)
export async function importProspects(list) {
  if (!Array.isArray(list)) return { imported: 0 };
  const state = await getCabinaState();
  let count = 0;

  for (const item of list) {
    if (!item.empresa) continue;
    const slug = item.id || item.empresa.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const prospect = {
      ...item,
      id: slug,
      estado: item.estado || 'pendiente',
      intentos: item.intentos || 0,
      score: item.score || 50,
      prioridad: item.prioridad || (item.score >= 70 ? 'A' : item.score >= 50 ? 'B' : 'C')
    };

    if (pgPool) {
      await saveProspectPG(prospect);
      count++;
    } else {
      const db = await readDB();
      if (!db.cabina) db.cabina = { prospects: DEFAULT_PROSPECTS, interactions: [], objections: DEFAULT_OBJECTIONS };
      const existsIndex = db.cabina.prospects.findIndex(p => p.id === prospect.id || p.empresa === prospect.empresa);
      if (existsIndex >= 0) {
        db.cabina.prospects[existsIndex] = { ...db.cabina.prospects[existsIndex], ...prospect };
      } else {
        db.cabina.prospects.push(prospect);
      }
      await writeDB(db);
      count++;
    }
  }

  return { imported: count };
}
