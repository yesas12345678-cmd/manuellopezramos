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

// 3 Empresas de ejemplo del manual Verox (Javi Eleta)
export const DEFAULT_PROSPECTS = [
  {
    id: "frigotecnica-almanzor",
    nicho: "servicios-tecnicos",
    subsector: "Mantenimiento y frío industrial / comercial",
    empresa: "Frigotécnica Almanzor",
    razon_social: "Frigotécnica Almanzor S.L.",
    cif: "B05123456",
    web: "https://frigotecnica-almanzor.es",
    provincia: "Ávila",
    localidad: "Ávila",
    tamano: { empleados: "10-25", fuente: "Web y Registro mercantil" },
    decisor: { nombre: "Andrés Sanz", cargo: "Gerente", fuente: "Web / Registro" },
    telefonos: [
      { numero: "608 00 00 01", tipo: "movil", etiqueta: "gerencia", fuente: "Web empresa" },
      { numero: "910 00 00 01", tipo: "fijo", etiqueta: "oficina", fuente: "Web empresa" }
    ],
    email_empresa: "contacto@frigotecnica-almanzor.es",
    que_hacen: "Instalan y mantienen cámaras frigoríficas y equipos de frío para supermercados, hostelería y almacenes de la provincia, con técnicos propios en ruta.",
    clientes_tipo: "Supermercados, hostelería y almacenes",
    senales: [
      { senal: "Urgencias 24 h a supermercados", fuente: "https://frigotecnica-almanzor.es", peso: "alta" },
      { senal: "Contratos de mantenimiento preventivo", fuente: "https://frigotecnica-almanzor.es/servicios", peso: "media" },
      { senal: "Busca técnico frigorista en su web", fuente: "https://frigotecnica-almanzor.es/empleo", peso: "alta" }
    ],
    dolores: [
      {
        dolor: "Partes en papel que alguien pasa a mano al programa",
        por_que_lo_creemos: "Su web pide al cliente que firme el parte del técnico y buscan un administrativo para la oficina.",
        pregunta_cuantificacion: "¿Cuántas horas a la semana se van en pasar los partes al programa?"
      },
      {
        dolor: "Retraso en facturación de materiales y horas de urgencia",
        por_que_lo_creemos: "Indican servicio 24h urgente pero no tienen portal de clientes ni tracking.",
        pregunta_cuantificacion: "¿Cuántos días pasan desde la urgencia hasta que emitís la factura?"
      }
    ],
    solucion_propuesta: {
      principal: "Partes digitales en tablet con firma del cliente y envío inmediato a oficina",
      complementaria: "Aviso automático al cliente al cerrar el parte con albarán digital",
      prueba_a_citar: "Un servicio técnico de frío similar en Toledo con 8 técnicos tardaba 4 días en facturar; ahora facturan en el mismo día y han ganado 12 horas de oficina a la semana."
    },
    score: 86,
    prioridad: "A",
    guion: {
      apertura: "Hola, ¿Andrés? Soy zVaito, de Verox. Te llamo porque he visto en vuestra web que hacéis urgencias 24 horas a supermercados, y tengo una pregunta rápida sobre cómo os llegan los partes a la oficina. ¿Tienes un minuto?",
      si_no_esta_el_decisor: "Perfecto. ¿Cómo se llama la persona que lleva la oficina y la facturación, y a qué hora es mejor pillarle? Así no te hago perder tiempo.",
      preguntas_descubrimiento: [
        "¿Cuántos partes rellenan a la semana entre todos los técnicos?",
        "¿Cuánto tiempo se tarda en pasar cada parte a mano al ordenador?",
        "¿Os ha pasado que se traspapela algún material gastado en una urgencia?"
      ],
      objecion_probable: {
        objecion: "Ya tenemos un programa",
        respuesta: "Perfecto, no vengo a que cambies el programa. Solo quiero saber una cosa: ¿los técnicos os mandan el parte en el momento o llega más tarde a la oficina?"
      },
      cierre_diagnostico: "Te propongo 30 minutos por videollamada: te enseño cómo lo resolvió una empresa de tu sector y te digo con tus números si en tu caso compensa o no. ¿Te va mejor el martes a las 09:00 o el jueves a las 16:30?"
    },
    mejor_franja: "8:00-9:30 antes de que salgan los técnicos a ruta",
    notas: "Empresa sólida, técnicos con mucha movilidad, alta probabilidad de interés.",
    estado: "pendiente",
    intentos: 0,
    apertura_siguiente: null
  },
  {
    id: "climaga-hnos",
    nicho: "servicios-tecnicos",
    subsector: "Climatización y calefacción industrial",
    empresa: "Climaga Hnos S.L.",
    razon_social: "Climaga Hermanos Climatización S.L.",
    cif: "B46876543",
    web: "https://climaga-hnos.com",
    provincia: "Valencia",
    localidad: "Paterna",
    tamano: { empleados: "15-30", fuente: "Web corporativa" },
    decisor: { nombre: "Roberto García", cargo: "Administrador Único", fuente: "BORME / Web" },
    telefonos: [
      { numero: "620 11 22 33", tipo: "movil", etiqueta: "gerencia", fuente: "Web" },
      { numero: "963 44 55 66", tipo: "fijo", etiqueta: "oficina", fuente: "Web" }
    ],
    email_empresa: "info@climaga-hnos.com",
    que_hacen: "Mantenimiento preventivo e instalación de climatización industrial en polígonos y naves de la Comunidad Valenciana.",
    clientes_tipo: "Fábricas, oficinas grandes y centros logísticos",
    senales: [
      { senal: "Contratos de mantenimiento preventivo mensual", fuente: "Web", peso: "alta" },
      { senal: "Sin área de clientes ni partes telemáticos", fuente: "Web", peso: "alta" }
    ],
    dolores: [
      {
        dolor: "Descuadre de albaranes de recambios comprados en distribuidores locales",
        por_que_lo_creemos: "Los técnicos compran piezas en ruta y los albaranes llegan arrugados a final de mes.",
        pregunta_cuantificacion: "¿Cuántas horas al mes dedicáis a casar albaranes de recambios con cada orden de trabajo?"
      }
    ],
    solucion_propuesta: {
      principal: "Fotografía y OCR inmediato de albaranes desde el móvil asignados a cada cliente",
      complementaria: "Historial de mantenimientos accesible por el cliente",
      prueba_a_citar: "Una empresa de clima en Castellón ahorró 16 horas al mes eliminando el cuadre manual de albaranes de piezas."
    },
    score: 78,
    prioridad: "A",
    guion: {
      apertura: "Hola, ¿Roberto? Soy zVaito, de Verox. Te llamo porque he visto en vuestra web que gestionáis mantenimiento preventivo en naves industriales, y quería hacerte una pregunta rápida sobre cómo gestionáis los albaranes de piezas que compran los técnicos. ¿Tienes un minuto?",
      si_no_esta_el_decisor: "¿Quién coordina a los técnicos y proveedores en la oficina? ¿Cuál es su teléfono?",
      preguntas_descubrimiento: [
        "¿Cuántos albaranes de compra de repuestos recogen vuestros técnicos al mes?",
        "¿Cuánto tiempo tardáis en imputar cada recambio a la factura del cliente final?"
      ],
      objecion_probable: {
        objecion: "Mándame un correo con la información",
        respuesta: "Te lo mando sin problema, pero antes de enviarte nada genérico: ¿los técnicos os traen los albaranes al día o a final de mes? Así te paso solo lo que os aplique."
      },
      cierre_diagnostico: "Te propongo 30 minutos por videollamada: vemos tus cifras de técnicos y piezas y te digo con números si os compensa o no. ¿Te va mejor el martes a las 09:00 o el jueves a las 16:30?"
    },
    mejor_franja: "13:30-15:00 o a primera hora 8:15",
    notas: "Roberto es directo, prefiere cifras claras de ahorro de tiempo.",
    estado: "pendiente",
    intentos: 0,
    apertura_siguiente: null
  },
  {
    id: "carretillas-ebro",
    nicho: "logistica-maquinaria",
    subsector: "Venta y SAT de maquinaria de almacén y carretillas",
    empresa: "Carretillas & Elevación del Ebro",
    razon_social: "Elevación del Ebro Maquinaria S.L.",
    cif: "B50998877",
    web: "https://carretillasebro.es",
    provincia: "Zaragoza",
    localidad: "Zaragoza",
    tamano: { empleados: "8-15", fuente: "Web" },
    decisor: { nombre: "Manuel Viela", cargo: "Director de Operaciones", fuente: "Web / Equipo" },
    telefonos: [
      { numero: "654 99 88 77", tipo: "movil", etiqueta: "SAT", fuente: "Web" },
      { numero: "976 22 33 44", tipo: "fijo", etiqueta: "general", fuente: "Web" }
    ],
    email_empresa: "sat@carretillasebro.es",
    que_hacen: "Reparación in-situ y renting de carretillas elevadoras para naves logísticas de la plataforma Plaza y alrededores.",
    clientes_tipo: "Operadores logísticos y almacenes de alimentación",
    senales: [
      { senal: "Flota de 6 talleres móviles para asistencia en menos de 2 horas", fuente: "Web", peso: "alta" },
      { senal: "Web tradicional sin portal digital para firmas", fuente: "Web", peso: "media" }
    ],
    dolores: [
      {
        dolor: "Falta de firma inmediata del jefe de turno en el almacén del cliente",
        por_que_lo_creemos: "Cuando el técnico acaba la reparación, el encargado no siempre está y el parte queda sin validar.",
        pregunta_cuantificacion: "¿Cuántos partes se os quedan pendientes de firma o cobro cada semana?"
      }
    ],
    solucion_propuesta: {
      principal: "Firma digital en móvil con copia instantánea por WhatsApp o email al jefe de planta",
      complementaria: "Checklist preventivo obligatorio antes de arrancar cada intervención",
      prueba_a_citar: "Un taller móvil de elevación en Madrid redujo los partes pendientes de firma de 18 a cero la primera semana."
    },
    score: 68,
    prioridad: "B",
    guion: {
      apertura: "Hola, ¿Manuel? Soy zVaito, de Verox. Te llamo porque he visto en vuestra web vuestros talleres móviles de asistencia rápida en Plaza, y tengo una pregunta rápida sobre cómo os firman los partes los encargados de almacén. ¿Tienes un minuto?",
      si_no_esta_el_decisor: "¿Quién lleva la coordinación del servicio técnico y talleres móviles?",
      preguntas_descubrimiento: [
        "¿Cuántas asistencias en cliente hacéis a la semana con los 6 talleres móviles?",
        "¿Qué pasa cuando el técnico acaba y el jefe de almacén no está disponible para firmar?"
      ],
      objecion_probable: {
        objecion: "No tenemos presupuesto ahora mismo",
        respuesta: "Lo entiendo perfectamente. No te llamo para venderte nada hoy, solo para enseñarte en 30 minutos lo que están haciendo otros talleres de maquinaria para cobrar los partes al día. Si luego no os encaja, os quedáis la idea gratis. ¿Te cuadra el martes a las 09:00 o el jueves a las 16:30?"
      },
      cierre_diagnostico: "Te propongo una videollamada corta de 30 min: lo revisamos con tus números y te digo si os compensa. ¿Te va mejor el martes a las 09:00 o el jueves a las 16:30?"
    },
    mejor_franja: "9:00-10:00",
    notas: "Tienen prisa habitual por el volumen de Plaza, ser muy ágil.",
    estado: "pendiente",
    intentos: 0,
    apertura_siguiente: null
  }
];

export const DEFAULT_OBJECTIONS = [
  {
    id: "obj-1",
    etiqueta: "Ya tenemos un programa",
    respuesta: "Perfecto, no vengo a que cambies el programa ni a quitar lo que ya os funciona. Solo quiero saber una cosa: ¿los técnicos os mandan los partes cerrados en el momento o llegan horas o días más tarde a la oficina?",
    sector: "servicios-tecnicos",
    veces: 24,
    exitos: 11
  },
  {
    id: "obj-2",
    etiqueta: "Mándame un correo con la info",
    respuesta: "Te lo mando sin problema, pero antes de enviarte un PDF genérico que no te sirva: ¿cuántos técnicos tenéis en ruta ahora mismo? Así te preparo solo lo que aplica a vuestro tamaño.",
    sector: "general",
    veces: 31,
    exitos: 9
  },
  {
    id: "obj-3",
    etiqueta: "Ahora no tengo tiempo / Estoy ocupado",
    respuesta: "Te entiendo perfectamente, te he pillado en mal momento. Son literalmente 30 segundos: ¿cuándo te viene mejor que te dé un toque rápido, a primera hora mañana o sobre las dos?",
    sector: "general",
    veces: 18,
    exitos: 7
  },
  {
    id: "obj-4",
    etiqueta: "No nos interesa",
    respuesta: "Sin problema, lo respeto al cien por cien. Solo una duda antes de cerrar la ficha: ¿los partes de trabajo y la facturación ya los tenéis al día sin perder horas de oficina?",
    sector: "general",
    veces: 15,
    exitos: 3
  },
  {
    id: "obj-5",
    etiqueta: "No tenemos presupuesto",
    respuesta: "Tiene todo el sentido. No te llamo para venderte nada hoy, sino para enseñarte en 30 minutos cómo otras empresas de tu sector ahorran tiempo de oficina con sus mismos recursos. Si no te cuadra, te quedas las ideas sin compromiso. ¿Te encaja el martes o el jueves?",
    sector: "general",
    veces: 12,
    exitos: 5
  }
];

// Helper para leer base de datos híbrida (Postgres o db.json)
export async function getCabinaState() {
  if (pgPool) {
    try {
      const pRes = await pgPool.query('SELECT * FROM cabina_prospects ORDER BY created_at ASC');
      const iRes = await pgPool.query('SELECT * FROM cabina_interactions ORDER BY created_at DESC');
      const oRes = await pgPool.query('SELECT * FROM cabina_objections ORDER BY exitos DESC');

      if (pRes.rows.length === 0) {
        // Inicializar empresas en Postgres
        for (const p of DEFAULT_PROSPECTS) {
          await saveProspectPG(p);
        }
        for (const o of DEFAULT_OBJECTIONS) {
          await pgPool.query(
            `INSERT INTO cabina_objections (id, etiqueta, respuesta, sector, veces, exitos) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
            [o.id, o.etiqueta, o.respuesta, o.sector, o.veces, o.exitos]
          );
        }
        return { prospects: DEFAULT_PROSPECTS, interactions: [], objections: DEFAULT_OBJECTIONS };
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
  if (!db.cabina) {
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
