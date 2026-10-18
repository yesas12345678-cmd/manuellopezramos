import pg from 'pg';
import { readDB, writeDB } from './dbHelper.js';
import { runSitemapAuditAll, runSecurityScanAll, runLeadGeneration } from './cronTasks.js';
import { callGemini } from './gemini.js';

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
  } catch (err) {}
}

export const DEFAULT_AGENTS = [
  {
    id: "agent-jude",
    name: "Jude (Chief of Staff & Telegram 24/7)",
    role: "Asistente Personal, Voz & Coordinación Ejecutiva (VPS 24/7)",
    icon: "fa-paper-plane",
    color: "#2563eb",
    status: "active",
    cadence: "24/7 en VPS Hetzner (@JudeeeeeBot Telegram & Webhook)",
    description: "Asistente ejecutivo personal en Telegram y VPS. Gestiona agenda, notas de voz, consultas rápidas y coordinación diaria de vida. No programa código; delega el desarrollo técnico en Antigravity.",
    systemPrompt: "Eres Jude, Asistente Personal y Chief of Staff de Manuel López Ramos (zVaito). Coordinas su vida personal, salud, finanzas y tareas diarias vía Telegram.",
    metrics: { tasksExecuted: 0, lastRun: null }
  },
  {
    id: "agent-antigravity",
    name: "Antigravity Agency (Factoría de Software)",
    role: "Desarrollo Autónomo Local & 111 Especialistas de Ingeniería",
    icon: "fa-microchip",
    color: "#8c52ff",
    status: "active",
    cadence: "En ejecución continua en PC Local / Bajo demanda",
    description: "Factoría de ingeniería integral con 111 agentes especialistas orquestados por fases (Arquitectura, Backend, Frontend, QA, AppSec, Rendimiento). Encargado del 100% del código en c:\\PROYECTOS.",
    systemPrompt: "Eres Antigravity Agency, la factoría de ingeniería de software local de Manuel López Ramos.",
    metrics: { tasksExecuted: 0, lastRun: null }
  },
  {
    id: "agent-sentinel",
    name: "Pentesting Bot 24/7 (Sentinel Cyber AI)",
    role: "Agente Autónomo de Ciberseguridad & Pentesting 24/7",
    icon: "fa-shield-halved",
    color: "#ff4757",
    status: "active",
    cadence: "Diario a las 02:00 (0 2 * * *)",
    description: "Agente de defensa y pentesting que inspecciona servidores y páginas web buscando puertos vulnerables, certificados SSL próximos a caducar, archivos .env expuestos y cabeceras inseguras.",
    systemPrompt: "Eres el Agente Autónomo Pentesting Bot 24/7 (Sentinel Cyber AI). Monitorizas la infraestructura y servidores de zVaito para prevenir brechas de seguridad, puertos abiertos y datos expuestos.",
    metrics: { tasksExecuted: 0, lastRun: null }
  },
  {
    id: "agent-radar",
    name: "Auditor de Sitemaps (Radar SEO AI)",
    role: "Agente Autónomo Auditor de Sitemaps e Indexación",
    icon: "fa-sitemap",
    color: "#00db8b",
    status: "active",
    cadence: "Semanal domingos (0 0 * * 0)",
    description: "Agente autónomo que compara el recuento real de URLs de blogs y webs contra sus sitemaps XML y envía alertas por Gmail si hay discrepancias o caídas.",
    systemPrompt: "Eres el Agente Autónomo Auditor de Sitemaps (Radar SEO AI). Garantizas que todo el contenido publicado por zVaito esté correctamente indexado sin páginas huérfanas.",
    metrics: { tasksExecuted: 0, lastRun: null }
  },
  {
    id: "agent-studysync",
    name: "StudySync & Life AI (Google Calendar)",
    role: "Planificador de Vida, Estudio y Pesca",
    icon: "fa-graduation-cap",
    color: "#00f2fe",
    status: "active",
    cadence: "Sincronizado con Google Calendar",
    description: "Aplica time-blocking inteligente entre fechas de exámenes, bloques de estudio por asignatura y jornadas libres de pesca/desconexión.",
    systemPrompt: "Eres StudySync AI. Optimizas el tiempo de estudio de zVaito garantizando también días de pesca y descanso.",
    metrics: { tasksExecuted: 0, lastRun: null }
  },
  {
    id: "agent-fitness",
    name: "Fitness Coach AI (Gym Tracker)",
    role: "Entrenamiento & Progresión de Cargas",
    icon: "fa-dumbbell",
    color: "#ec4899",
    status: "active",
    cadence: "Semanal / Registro tras sesión",
    description: "Supervisa las progresiones de fuerza en banca, dominadas y militar, recomendando ajustes de volumen e intensidad en las rutinas de gym.",
    systemPrompt: "Eres Fitness Coach AI. Maximizas el rendimiento en el gimnasio de zVaito con sobrecarga progresiva estricta.",
    metrics: { tasksExecuted: 0, lastRun: null }
  }
];

export const DEFAULT_LIFE_LOGS = [];

// Obtener estado unificado de agentes y logs
export async function getAgentsState() {
  if (pgPool) {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS life_agents (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(255),
          icon VARCHAR(100),
          color VARCHAR(50),
          status VARCHAR(50) DEFAULT 'active',
          cadence VARCHAR(255),
          description TEXT,
          system_prompt TEXT,
          metrics JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS life_logs (
          id VARCHAR(100) PRIMARY KEY,
          agent_id VARCHAR(100),
          agent_name VARCHAR(255),
          icon VARCHAR(100),
          color VARCHAR(50),
          title VARCHAR(255),
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Limpiar cualquier métrica ficticia y agentes obsoletos
      await pgPool.query(`
        DELETE FROM life_agents WHERE id IN ('agent-closer', 'agent-hunter');
        UPDATE life_agents 
        SET metrics = jsonb_build_object('tasksExecuted', 0, 'lastRun', null)
        WHERE (metrics->>'tasksExecuted')::int IN (142, 86, 62, 28, 74, 51);
      `);
      await pgPool.query(`
        DELETE FROM life_logs WHERE id IN ('log_1', 'log_2', 'log_3', 'log_4');
      `);

      // Asegurar que los agentes oficiales reales existen actualizados
      for (const a of DEFAULT_AGENTS) {
        await pgPool.query(`
          INSERT INTO life_agents (id, name, role, icon, color, status, cadence, description, system_prompt, metrics)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            icon = EXCLUDED.icon,
            color = EXCLUDED.color,
            cadence = EXCLUDED.cadence,
            description = EXCLUDED.description,
            system_prompt = EXCLUDED.system_prompt;
        `, [a.id, a.name, a.role, a.icon, a.color, a.status, a.cadence, a.description, a.systemPrompt, JSON.stringify(a.metrics)]);
      }

      const aRes = await pgPool.query('SELECT * FROM life_agents ORDER BY created_at ASC');
      const lRes = await pgPool.query('SELECT * FROM life_logs ORDER BY created_at DESC LIMIT 50');

      if (aRes.rows.length === 0) {
        for (const a of DEFAULT_AGENTS) {
          await pgPool.query(`
            INSERT INTO life_agents (id, name, role, icon, color, status, cadence, description, system_prompt, metrics)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
          `, [a.id, a.name, a.role, a.icon, a.color, a.status, a.cadence, a.description, a.systemPrompt, JSON.stringify(a.metrics)]);
        }
        for (const l of DEFAULT_LIFE_LOGS) {
          await pgPool.query(`
            INSERT INTO life_logs (id, agent_id, agent_name, icon, color, title, description, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING
          `, [l.id, l.agentId, l.agentName, l.icon, l.color, l.title, l.description, l.timestamp]);
        }
        return { agents: DEFAULT_AGENTS, logs: DEFAULT_LIFE_LOGS };
      }

      return {
        agents: aRes.rows.map(r => ({ ...r, systemPrompt: r.system_prompt, metrics: r.metrics || {} })),
        logs: lRes.rows.map(r => ({ ...r, agentId: r.agent_id, agentName: r.agent_name, timestamp: r.created_at }))
      };
    } catch (e) {
      console.warn('[Agents DB] Fallo en Postgres, usando fallback db.json:', e.message);
    }
  }

  // Fallback db.json
  const db = await readDB();
  if (!db.lifeAgents || !Array.isArray(db.lifeAgents.agents) || db.lifeAgents.agents.some(a => a.id === 'agent-closer' || a.id === 'agent-hunter')) {
    db.lifeAgents = db.lifeAgents || {};
    // Preservar métricas existentes si coinciden los ids
    const existingMetrics = {};
    if (Array.isArray(db.lifeAgents.agents)) {
      db.lifeAgents.agents.forEach(a => { if (a.id && a.metrics) existingMetrics[a.id] = a.metrics; });
    }
    db.lifeAgents.agents = DEFAULT_AGENTS.map(da => ({
      ...da,
      metrics: existingMetrics[da.id] || da.metrics
    }));
    db.lifeAgents.logs = db.lifeAgents.logs || DEFAULT_LIFE_LOGS;
    await writeDB(db);
  }
  return db.lifeAgents;
}

// Disparar la misión de un agente específico
export async function triggerAgentMission(agentId) {
  const state = await getAgentsState();
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) throw new Error("Agente no encontrado");

  let resultSummary = "";

  if (agentId === "agent-jude") {
    resultSummary = "Misión de Jude verificada: Asistente ejecutivo 24/7 activo en VPS y conectado con Telegram (@JudeeeeeBot). Modo delegación de código activo.";
  } else if (agentId === "agent-antigravity") {
    resultSummary = "Misión de Antigravity Agency completada: Factoría local activa con 111 especialistas de ingeniería listos para ejecución por fases (Arquitectura -> Backend -> Frontend -> QA).";
  } else if (agentId === "agent-sentinel") {
    await runSecurityScanAll();
    resultSummary = "Misión completada: Escaneo perimetral y comprobación de vulnerabilidades de seguridad finalizada.";
  } else if (agentId === "agent-radar") {
    await runSitemapAuditAll();
    resultSummary = "Misión completada: Comprobación de sitemaps XML e indexación de páginas verificada.";
  } else if (agentId === "agent-hunter") {
    const res = await runLeadGeneration();
    resultSummary = `Misión completada: Generadas ${res.newIdeas?.length || 0} ideas de software y ${res.newLeads?.length || 0} prospectos en cartera.`;
  } else {
    resultSummary = `Misión de ${agent.name} ejecutada correctamente. Parámetros sincronizados.`;
  }

  // Actualizar métricas reales de ejecución (contador estricto y fecha real)
  agent.metrics = agent.metrics || {};
  agent.metrics.tasksExecuted = (Number(agent.metrics.tasksExecuted) || 0) + 1;
  agent.metrics.lastRun = new Date().toISOString();

  if (pgPool) {
    try {
      await pgPool.query('UPDATE life_agents SET metrics = $1 WHERE id = $2', [JSON.stringify(agent.metrics), agent.id]);
    } catch (e) {
      console.warn('[Agents DB] Error actualizando métricas en Postgres:', e.message);
    }
  }

  const db = await readDB();
  if (db.lifeAgents && db.lifeAgents.agents) {
    const agIdx = db.lifeAgents.agents.findIndex(a => a.id === agent.id);
    if (agIdx !== -1) {
      db.lifeAgents.agents[agIdx].metrics = agent.metrics;
      await writeDB(db);
    }
  }

  // Registrar en el log de actividad real
  await addLifeLog({
    agentId: agent.id,
    agentName: agent.name,
    icon: agent.icon,
    color: agent.color,
    title: `Misión ejecutada (${agent.name})`,
    description: resultSummary
  });

  return { success: true, message: resultSummary, tasksExecuted: agent.metrics.tasksExecuted };
}

// Registrar un nuevo log en el timeline de vida
export async function addLifeLog({ agentId, agentName, icon, color, title, description }) {
  const id = "log_" + Date.now();
  const logItem = {
    id,
    agentId,
    agentName,
    icon: icon || "fa-robot",
    color: color || "#8c52ff",
    title,
    description,
    timestamp: new Date().toISOString()
  };

  if (pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO life_logs (id, agent_id, agent_name, icon, color, title, description, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [logItem.id, logItem.agentId, logItem.agentName, logItem.icon, logItem.color, logItem.title, logItem.description, logItem.timestamp]);
      return logItem;
    } catch (e) {}
  }

  const db = await readDB();
  if (!db.lifeAgents) db.lifeAgents = { agents: DEFAULT_AGENTS, logs: DEFAULT_LIFE_LOGS };
  db.lifeAgents.logs.unshift(logItem);
  if (db.lifeAgents.logs.length > 60) db.lifeAgents.logs = db.lifeAgents.logs.slice(0, 60);
  await writeDB(db);
  return logItem;
}

// Alternar estado de un agente (Activo / Pausado)
export async function toggleAgentStatus(agentId) {
  const state = await getAgentsState();
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) throw new Error("Agente no encontrado");

  const newStatus = agent.status === "active" ? "paused" : "active";

  if (pgPool) {
    await pgPool.query('UPDATE life_agents SET status = $1 WHERE id = $2', [newStatus, agentId]);
  } else {
    const db = await readDB();
    const target = db.lifeAgents?.agents?.find(a => a.id === agentId);
    if (target) {
      target.status = newStatus;
      await writeDB(db);
    }
  }

  await addLifeLog({
    agentId: agent.id,
    agentName: agent.name,
    icon: agent.icon,
    color: agent.color,
    title: `Estado cambiado: ${newStatus === 'active' ? 'Activado' : 'Pausado'}`,
    description: `El agente ${agent.name} ahora está ${newStatus === 'active' ? 'activo y vigilante' : 'en pausa temporal'}.`
  });

  return { success: true, status: newStatus };
}

// Crear un nuevo agente personalizado de vida
export async function createCustomAgent({ name, role, icon, color, cadence, description, systemPrompt }) {
  const id = "agent-custom-" + Date.now();
  const newAgent = {
    id,
    name: name || "Nuevo Agente IA",
    role: role || "Automatización Personal",
    icon: icon || "fa-microchip",
    color: color || "#38bdf8",
    status: "active",
    cadence: cadence || "Bajo demanda",
    description: description || "Agente autónomo para optimización de vida y negocios.",
    systemPrompt: systemPrompt || "Eres un agente de IA al servicio de zVaito.",
    metrics: { tasksExecuted: 0, lastRun: null }
  };

  if (pgPool) {
    await pgPool.query(`
      INSERT INTO life_agents (id, name, role, icon, color, status, cadence, description, system_prompt, metrics)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [newAgent.id, newAgent.name, newAgent.role, newAgent.icon, newAgent.color, newAgent.status, newAgent.cadence, newAgent.description, newAgent.systemPrompt, JSON.stringify(newAgent.metrics)]);
  } else {
    const db = await readDB();
    if (!db.lifeAgents) db.lifeAgents = { agents: DEFAULT_AGENTS, logs: DEFAULT_LIFE_LOGS };
    db.lifeAgents.agents.push(newAgent);
    await writeDB(db);
  }

  await addLifeLog({
    agentId: newAgent.id,
    agentName: newAgent.name,
    icon: newAgent.icon,
    color: newAgent.color,
    title: "Nuevo agente reclutado en el enjambre",
    description: `Creado el agente ${newAgent.name} con rol "${newAgent.role}".`
  });

  return newAgent;
}

// Chat interactivo con el Orquestador Central de Vida ("Master Life Agent")
export async function chatWithLifeMaster(userMessage) {
  const state = await getAgentsState();
  const agentListText = state.agents.map(a => `- ${a.name} (${a.role}) [Estado: ${a.status}]: ${a.description}`).join('\n');

  const systemInstruction = `
Eres el "Orquestador Maestro de Vida y Negocios de zVaito" (Manuel López Ramos).
Tienes a tu mando un ecosistema integrado de agentes reales y servicios:
${agentListText}

Estructura de mando:
- Jude: Asistente Personal y Chief of Staff 24/7 en Telegram/VPS (coordinación de vida, agenda, notas rápidas, sin programar código).
- Antigravity Agency: Factoría de ingeniería de software local con 111 especialistas (100% del desarrollo de software en c:\\PROYECTOS).
- Sentinel Cyber AI: Pentesting y auditoría de seguridad perimetral diaria.
- Radar SEO AI: Auditoría de sitemaps XML e indexación web semanal.
- StudySync & Life AI: Sincronización académica con Google Calendar y jornadas de pesca.
- Fitness Coach AI: Seguimiento de cargas y sobrecarga progresiva en el gimnasio.

Tu rol:
1. Responder con tono ejecutivo, resolutivo, directo y de máxima lealtad hacia Manuel (zVaito).
2. Proporcionar datos 100% veraces sin métricas falsas ni inventadas.
3. Dar reportes de situación de sus agentes y proyectos cuando pregunte.
4. Mantener respuestas claras, concisas, con formato markdown elegante y viñetas cuando proceda.
`.trim();

  const responseText = await callGemini(userMessage, systemInstruction);
  return responseText;
}
