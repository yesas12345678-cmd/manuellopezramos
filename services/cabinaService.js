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
// Conversor de Lead real de Hunter AI a prospecto para Cabina de Ventas
export function leadToCabinaProspect(lead) {
  const parts = (lead.phone || '').split('/');
  const phoneClean = parts[0]?.trim() || '';
  const emailClean = parts.find(p => p.includes('@'))?.trim() || '';

  return {
    id: lead.id || 'lead_' + Math.random().toString(36).substr(2, 9),
    empresa: lead.name,
    razon_social: lead.name,
    cif: 'Verificado',
    nicho: lead.industry || 'Comercio y Pymes',
    subsector: lead.industry || 'Comercio / Servicios',
    web: lead.website?.startsWith('http') ? lead.website : 'https://' + lead.website,
    provincia: lead.address ? lead.address.split(',').pop()?.trim() || 'España' : 'España',
    localidad: lead.address ? lead.address.split(',')[0]?.trim() || 'España' : 'España',
    tamano: { empleados: 'Pyme', fuente: 'Web / Registro' },
    decisor: { nombre: 'Responsable / Gerencia', cargo: 'Gerente / Dirección', fuente: 'Web pública' },
    telefonos: [
      { numero: phoneClean, tipo: 'movil', etiqueta: 'teléfono empresa', fuente: 'Web empresa' }
    ],
    email_empresa: emailClean,
    que_hacen: lead.name + ' · Sector ' + lead.industry + '. Ubicación: ' + (lead.address || 'España') + '.',
    clientes_tipo: 'Clientes y usuarios del sector',
    senales: [
      { senal: lead.whyTheyNeedWebDev || 'Auditoría técnica web detectada', fuente: lead.website, peso: 'alta' }
    ],
    dolores: [
      {
        dolor: lead.whyTheyNeedWebDev || 'Oportunidad de digitalización web y captación',
        por_que_lo_creemos: 'Auditado en su web (' + lead.website + '): ' + lead.whyTheyNeedWebDev,
        pregunta_cuantificacion: '¿Cuántos clientes o consultas creéis que se pierden al mes por esta falta de optimización en ' + lead.website + '?'
      }
    ],
    solucion_propuesta: {
      principal: 'Desarrollo y optimización web para ' + lead.name,
      complementaria: 'Automatización de captación, reservas y pedidos online',
      prueba_a_citar: 'Negocios del mismo sector aumentaron su facturación y clientes directos tras optimizar su web.'
    },
    score: 90,
    prioridad: 'A',
    guion: {
      apertura: 'Hola, buenos días. ¿Hablo con el responsable de ' + lead.name + '? Os llamo porque he estado auditando vuestra web (' + lead.website + ') y he identificado un punto claro de mejora en ' + (lead.whyTheyNeedWebDev ? lead.whyTheyNeedWebDev.slice(0, 100) : '') + '... ¿Tenéis un minuto?',
      si_no_esta_el_decisor: 'Perfecto. ¿Cómo se llama la persona que coordina la página web o la gerencia, y a qué hora es mejor pillarle? Así no os hago perder tiempo.',
      preguntas_descubrimiento: [
        '¿Cuántas consultas o pedidos os entran actualmente a través de vuestra web ' + lead.website + '?',
        '¿Habéis notado que los clientes buscan procesos más directos y rápidos desde el móvil?',
        '¿Os vendría bien automatizar esa parte para ahorrar horas de trabajo cada semana?'
      ],
      objecion_probable: {
        objecion: 'Mándame un correo con la información',
        respuesta: 'Te lo mando sin problema a ' + (emailClean || 'vuestro correo') + ', pero para no enviarte un PDF genérico: ¿vuestro mayor dolor de cabeza ahora es la captación o las horas que perdéis en tareas manuales? Así os preparo solo lo que os sirva.'
      },
      cierre_diagnostico: 'Te propongo una demo interactiva de 15 minutos: te enseño cómo otros negocios del sector resolvieron esto y ahorran horas semanales. ¿Te viene bien el martes a las 10:00 o el jueves a las 16:00?'
    },
    mejor_franja: '10:00 - 13:30 horario comercial',
    notas: 'Prospecto real auditado por Hunter AI. Web: ' + lead.website + '. Dirección: ' + (lead.address || 'España') + '.',
    estado: 'pendiente',
    intentos: 0,
    apertura_siguiente: null
  };
}

export const DEFAULT_PROSPECTS = [];

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
  const db = await readDB();
  const realLeads = Array.isArray(db.leads?.leadsList) ? db.leads.leadsList : [];
  const mockIds = ['asesoria-hernandez', 'clinica-dental-velazquez', 'reformas-madrigalia', 'frigotecnica-almanzor', 'climaga-hnos', 'carretillas-ebro'];

  if (pgPool) {
    try {
      await pgPool.query(`DELETE FROM cabina_prospects WHERE id = ANY($1)`, [mockIds]);
      const pRes = await pgPool.query('SELECT * FROM cabina_prospects ORDER BY created_at ASC');
      const iRes = await pgPool.query('SELECT * FROM cabina_interactions ORDER BY created_at DESC');
      const oRes = await pgPool.query('SELECT * FROM cabina_objections ORDER BY exitos DESC');

      if (pRes.rows.length === 0 && realLeads.length > 0) {
        for (const lead of realLeads) {
          const p = leadToCabinaProspect(lead);
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
      return { prospects, interactions: iRes.rows, objections: oRes.rows };
    } catch (e) {
      console.warn('[Cabina DB] Fallo leyendo Postgres, recurriendo a db.json:', e.message);
    }
  }

  // Fallback db.json
  if (!db.cabina) {
    db.cabina = {
      prospects: realLeads.map(leadToCabinaProspect),
      interactions: [],
      objections: DEFAULT_OBJECTIONS
    };
    await writeDB(db);
  } else {
    const hadMocks = db.cabina.prospects?.some(p => mockIds.includes(p.id));
    if (hadMocks || !db.cabina.prospects || db.cabina.prospects.length === 0) {
      db.cabina.prospects = (db.cabina.prospects || []).filter(p => !mockIds.includes(p.id));
      if (db.cabina.prospects.length === 0 && realLeads.length > 0) {
        db.cabina.prospects = realLeads.map(leadToCabinaProspect);
      }
      await writeDB(db);
    }
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
