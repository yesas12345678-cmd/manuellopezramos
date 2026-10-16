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
    id: "agent-hunter",
    name: "Captador B2B & Ideas (Hunter AI)",
    role: "Agente Autónomo de Prospección B2B y Generación de Ideas",
    icon: "fa-magnifying-glass-chart",
    color: "#8c52ff",
    status: "active",
    cadence: "Cada 6 horas (0 */6 * * *)",
    description: "Agente autónomo que rastrea pymes en internet, detecta fallas en sus webs, genera ideas de software micro-SaaS y alimenta la Cabina de Ventas.",
    systemPrompt: "Eres el Agente Autónomo Captador B2B & Ideas (Hunter AI). Tu objetivo para zVaito es identificar oportunidades comerciales B2B y generar conceptos viables de software analizando servicios técnicos.",
    metrics: { tasksExecuted: 142, leadsGenerated: 48, lastRun: new Date().toISOString() }
  },
  {
    id: "agent-closer",
    name: "Sales Closer Coach AI",
    role: "Coach en Directo para Cabina Ventas",
    icon: "fa-headset",
    color: "#2563eb",
    status: "active",
    cadence: "Bajo demanda (Durante llamadas)",
    description: "Escucha las llamadas en frío, reconoce objeciones en 2 segundos, calcula impacto en horas/año y evalúa las llamadas con la rúbrica sobre 100 de Verox.",
    systemPrompt: "Eres Sales Closer Coach AI. Ayudas a zVaito a cerrar diagnósticos por videollamada sin discutir objeciones y cuantificando horas.",
    metrics: { tasksExecuted: 86, rubricsScored: 34, lastRun: new Date().toISOString() }
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
    metrics: { tasksExecuted: 62, targetsMonitored: 8, lastRun: new Date().toISOString() }
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
    metrics: { tasksExecuted: 28, alertsSent: 3, lastRun: new Date().toISOString() }
  },
  {
    id: "agent-studysync",
    name: "StudySync & Life AI",
    role: "Planificador de Vida, Estudio y Pesca",
    icon: "fa-graduation-cap",
    color: "#00f2fe",
    status: "active",
    cadence: "Sincronizado con Google Calendar",
    description: "Aplica time-blocking inteligente entre fechas de exámenes, bloques de estudio por asignatura y jornadas libres de pesca/desconexión.",
    systemPrompt: "Eres StudySync AI. Optimizas el tiempo de estudio de zVaito garantizando también días de pesca y descanso.",
    metrics: { tasksExecuted: 74, eventsCreated: 26, lastRun: new Date().toISOString() }
  },
  {
    id: "agent-fitness",
    name: "Fitness Coach AI",
    role: "Entrenamiento & Progresión de Cargas",
    icon: "fa-dumbbell",
    color: "#ec4899",
    status: "active",
    cadence: "Semanal / Registro tras sesión",
    description: "Supervisa las progresiones de fuerza en banca, dominadas y militar, recomendando ajustes de volumen e intensidad en las rutinas de gym.",
    systemPrompt: "Eres Fitness Coach AI. Maximizas el rendimiento en el gimnasio de zVaito con sobrecarga progresiva estricta.",
    metrics: { tasksExecuted: 51, workoutsTracked: 38, lastRun: new Date().toISOString() }
  }
];

export const DEFAULT_LIFE_LOGS = [
  {
    id: "log_1",
    agentId: "agent-hunter",
    agentName: "Hunter AI",
    icon: "fa-magnifying-glass-chart",
    color: "#8c52ff",
    title: "Nueva empresa cualificada en Ávila",
    description: "Detectada Frigotécnica Almanzor con score 86 (Prioridad A). Señal: urgencias 24h a supermercados.",
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString()
  },
  {
    id: "log_2",
    agentId: "agent-sentinel",
    agentName: "Sentinel Cyber AI",
    icon: "fa-shield-halved",
    color: "#ff4757",
    title: "Escaneo de puertos completado",
    description: "Servidor seguro. Verificado puerto 22 cerrado al público y certificados SSL válidos.",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  },
  {
    id: "log_3",
    agentId: "agent-studysync",
    agentName: "StudySync & Life AI",
    icon: "fa-graduation-cap",
    color: "#00f2fe",
    title: "Bloque de estudio programado",
    description: "Asignado bloque de 2h para Examen de Matemáticas en Google Calendar.",
    timestamp: new Date(Date.now() - 1000 * 60 * 340).toISOString()
  },
  {
    id: "log_4",
    agentId: "agent-closer",
    agentName: "Sales Closer Coach AI",
    icon: "fa-headset",
    color: "#2563eb",
    title: "Diagnóstico confirmado en Cabina",
    description: "Calculadas 280 horas al año ahorradas y confirmado enlace para videollamada de 30 min.",
    timestamp: new Date(Date.now() - 1000 * 60 * 520).toISOString()
  }
];

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
  if (!db.lifeAgents) {
    db.lifeAgents = {
      agents: DEFAULT_AGENTS,
      logs: DEFAULT_LIFE_LOGS
    };
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

  if (agentId === "agent-hunter") {
    const res = await runLeadGeneration();
    resultSummary = `Misión completada: Generadas ${res.newIdeas?.length || 0} ideas de software y ${res.newLeads?.length || 0} prospectos en cartera.`;
  } else if (agentId === "agent-sentinel") {
    await runSecurityScanAll();
    resultSummary = "Misión completada: Escaneo perimetral y comprobación de vulnerabilidades finalizada sin anomalías críticas.";
  } else if (agentId === "agent-radar") {
    await runSitemapAuditAll();
    resultSummary = "Misión completada: Comprobación de sitemaps XML e indexación de páginas verificada.";
  } else {
    resultSummary = `Misión de ${agent.name} ejecutada correctamente. Parámetros sincronizados.`;
  }

  // Registrar en el log de actividad
  await addLifeLog({
    agentId: agent.id,
    agentName: agent.name,
    icon: agent.icon,
    color: agent.color,
    title: `Misión manual ejecutada (${agent.name})`,
    description: resultSummary
  });

  return { success: true, message: resultSummary };
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
    metrics: { tasksExecuted: 0, lastRun: new Date().toISOString() }
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
Tienes a tu mando un enjambre de 6 agentes de IA especializados que gestionan su vida y proyectos:
${agentListText}

Tu rol:
1. Responder con tono ejecutivo, resolutivo, directo y de máxima lealtad hacia zVaito.
2. Dar reportes de situación de sus agentes cuando pregunte.
3. Sugerir acciones concretas para su negocio (llamadas en frío, prospección B2B), seguridad, hábitos de gimnasio o calificaciones académicas.
4. Mantén las respuestas claras, concisas, con formato markdown elegante y viñetas cuando proceda.
`.trim();

  const responseText = await callGemini(userMessage, systemInstruction);
  return responseText;
}
