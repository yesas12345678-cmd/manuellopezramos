import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Importar servicios locales
import { readDB, writeDB } from './services/dbHelper.js';
import { getSalesAdvice } from './services/gemini.js';
import {
  initPostgresTables,
  getCabinaState,
  getCallQueue,
  recordInteraction,
  undoInteraction,
  getObjections,
  addObjection,
  getModelCalls,
  importProspects
} from './services/cabinaService.js';
import {
  getLiveCoachAdvice,
  generateCallSummary,
  gradeCallRubric,
  generateObjectionResponse
} from './services/cabinaAi.js';
import {
  getAgentsState,
  triggerAgentMission,
  toggleAgentStatus,
  createCustomAgent,
  chatWithLifeMaster
} from './services/agentService.js';
import { runSitemapAuditAll } from './services/cronTasks.js';
import { runSecurityScanAll } from './services/cronTasks.js';
import { runLeadGeneration } from './services/cronTasks.js';
import { initCronTasks } from './services/cronTasks.js';
import { google } from 'googleapis';
import {
  getUpcomingCalendarEvents,
  groupConsecutiveSlots,
  syncSlotGroupInstance,
  createAllDayExamEvent,
  scheduleFishingDay,
  getRequiredHours
} from './services/googleCalendar.js';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'zVaitoSecretJWTKeyForAuthentication2026!';

// ================= RED DE SEGURIDAD GLOBAL =================
// Evita que errores asíncronos no capturados (ej: timeouts IMAP, sockets) maten el proceso
process.on('uncaughtException', (err) => {
  console.error('[ERROR NO CAPTURADO] El servidor sigue activo:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[PROMESA RECHAZADA] El servidor sigue activo:', reason?.message || reason);
});


// Configurar confianza en reverse proxy (Traefik en Dokploy / SSL)
app.set('trust proxy', 1);

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Servir la carpeta frontend
app.use(express.static('public'));

// Middleware de Autenticación
function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ success: false, message: 'No autorizado. Por favor inicie sesión.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Sesión expirada o token inválido.' });
  }
}

// ================= AUTH API =================

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const adminUserEnv = (process.env.ADMIN_USER || 'zVaito').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'xPDMNM12';
  const inputUser = (username || '').trim().toLowerCase();
  const validUsers = [adminUserEnv, 'zvaito', 'admin'];

  if (validUsers.includes(inputUser) && password === adminPassword) {
    const token = jwt.sign({ username: username.trim() }, JWT_SECRET, { expiresIn: '7d' });
    
    // Cookie persistente por 7 días
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    });

    return res.json({ success: true, username: username.trim() });
  }

  return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/verify', authMiddleware, (req, res) => {
  res.json({ success: true, username: req.user.username });
});

// ================= GYM API =================

app.get('/api/gym', authMiddleware, async (req, res) => {
  try {
    const db = await readDB();
    res.json(db.gym || []);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/gym', authMiddleware, async (req, res) => {
  try {
    const { id, dayName, exercises } = req.body;
    const db = await readDB();
    
    if (id) {
      // Actualizar existente
      const index = db.gym.findIndex(d => d.id === id);
      if (index !== -1) {
        db.gym[index] = { id, dayName, exercises };
      } else {
        db.gym.push({ id, dayName, exercises });
      }
    } else {
      // Crear nuevo
      const newDay = {
        id: 'd_' + Math.random().toString(36).substr(2, 9),
        dayName,
        exercises: exercises || []
      };
      db.gym.push(newDay);
    }
    
    await writeDB(db);
    res.json({ success: true, gym: db.gym });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/gym/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await readDB();
    db.gym = db.gym.filter(d => d.id !== id);
    await writeDB(db);
    res.json({ success: true, gym: db.gym });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= SITEMAPS API =================

app.get('/api/sitemaps', authMiddleware, async (req, res) => {
  try {
    const db = await readDB();
    res.json(db.sitemaps || []);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sitemaps', authMiddleware, async (req, res) => {
  try {
    const { url, sitemapUrl } = req.body;
    const db = await readDB();
    
    const newSite = {
      id: 's_' + Math.random().toString(36).substr(2, 9),
      url,
      sitemapUrl,
      lastStatus: 'Sin comprobar',
      lastChecked: null,
      expectedCount: 0,
      actualCount: 0
    };
    
    db.sitemaps.push(newSite);
    await writeDB(db);
    res.json({ success: true, sitemaps: db.sitemaps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/sitemaps/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await readDB();
    db.sitemaps = db.sitemaps.filter(s => s.id !== id);
    await writeDB(db);
    res.json({ success: true, sitemaps: db.sitemaps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sitemaps/check-now', authMiddleware, async (req, res) => {
  try {
    await runSitemapAuditAll();
    const db = await readDB();
    res.json({ success: true, sitemaps: db.sitemaps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= SECURITY API =================

app.get('/api/security/targets', authMiddleware, async (req, res) => {
  try {
    const db = await readDB();
    res.json(db.security?.targets || []);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/security/targets', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    const db = await readDB();
    
    const newTarget = {
      id: 't_' + Math.random().toString(36).substr(2, 9),
      url,
      lastScanDate: null,
      lastScanStatus: 'Sin escanear'
    };
    
    db.security.targets.push(newTarget);
    await writeDB(db);
    res.json({ success: true, targets: db.security.targets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/security/targets/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await readDB();
    
    const target = db.security.targets.find(t => t.id === id);
    if (target) {
      db.security.logs = db.security.logs.filter(log => log.url !== target.url);
    }
    db.security.targets = db.security.targets.filter(t => t.id !== id);
    
    await writeDB(db);
    res.json({ success: true, targets: db.security.targets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/security/logs', authMiddleware, async (req, res) => {
  try {
    const db = await readDB();
    res.json(db.security?.logs || []);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/security/scan-now', authMiddleware, async (req, res) => {
  try {
    await runSecurityScanAll();
    const db = await readDB();
    res.json({ success: true, targets: db.security.targets, logs: db.security.logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/security/recheck-vuln', authMiddleware, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Falta el ID de la vulnerabilidad.' });
    }

    const db = await readDB();
    const vulnIndex = (db.security?.logs || []).findIndex(l => l.id === id);
    if (vulnIndex === -1) {
      return res.status(404).json({ success: false, message: 'Vulnerabilidad no encontrada o ya eliminada.' });
    }

    const vuln = db.security.logs[vulnIndex];

    // Ejecutar escaneo en la URL específica
    const { runSecurityScan } = await import('./services/pentest.js');
    const scanResult = await runSecurityScan(vuln.url);

    // Comprobar si esta vulnerabilidad concreta sigue presente
    const stillPresent = scanResult.vulnerabilities.some(v => 
      v.title.toLowerCase() === vuln.title.toLowerCase() || 
      (v.type && vuln.type && v.type.toLowerCase() === vuln.type.toLowerCase())
    );

    if (!stillPresent) {
      // ¡Solucionado! Eliminar de la bitácora
      db.security.logs.splice(vulnIndex, 1);

      // Comprobar si este objetivo tiene más vulnerabilidades pendientes
      const remainingForTarget = db.security.logs.filter(l => l.url === vuln.url);
      const target = (db.security.targets || []).find(t => t.url === vuln.url);
      if (target) {
        target.lastScanDate = new Date().toISOString();
        if (remainingForTarget.length === 0) {
          target.lastScanStatus = 'Seguro';
        }
      }

      await writeDB(db);

      return res.json({
        success: true,
        solved: true,
        vulnTitle: vuln.title,
        vulnUrl: vuln.url,
        message: `¡Solucionado! "${vuln.title}" ha sido resuelto en ${vuln.url} y se ha eliminado de la bitácora.`,
        targets: db.security.targets,
        logs: db.security.logs
      });
    } else {
      // Aún presente
      return res.json({
        success: true,
        solved: false,
        vulnTitle: vuln.title,
        vulnUrl: vuln.url,
        message: `La vulnerabilidad "${vuln.title}" sigue detectándose en ${vuln.url}.`,
        targets: db.security.targets,
        logs: db.security.logs
      });
    }
  } catch (err) {
    console.error('Error re-verificando vulnerabilidad:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= CABINA VENTAS API (MOTOR VEROX) =================

// Obtener cola inteligente de llamadas
app.get('/api/cabina/queue', authMiddleware, async (req, res) => {
  try {
    const queue = await getCallQueue();
    const objections = await getObjections();
    res.json({ success: true, queue, objections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Obtener todas las empresas registradas
app.get('/api/cabina/prospects', authMiddleware, async (req, res) => {
  try {
    const state = await getCabinaState();
    res.json({ success: true, prospects: state.prospects });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// El Coach en Directo (Prompt B)
app.post('/api/cabina/coach', authMiddleware, async (req, res) => {
  try {
    const { prospect, step, transcript, slots, objections } = req.body;
    if (!prospect) {
      return res.status(400).json({ success: false, message: 'Falta información de la empresa prospecto' });
    }
    const advice = await getLiveCoachAdvice({ prospect, step, transcript, slots, objections });
    res.json({ success: true, advice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Registrar llamada / resultado con cálculo de resumen y rúbrica
app.post('/api/cabina/interactions', authMiddleware, async (req, res) => {
  try {
    const interaction = await recordInteraction(req.body);

    // Procesar en segundo plano para máxima velocidad de respuesta en la cabina
    (async () => {
      try {
        const state = await getCabinaState();
        const prospect = state.prospects.find(p => p.id === req.body.prospect_id) || { empresa: 'Empresa' };

        const summary = await generateCallSummary({
          prospect,
          resultado: req.body.resultado,
          paso: req.body.paso_alcanzado,
          cifras: req.body.cifras,
          objeciones: req.body.objeciones,
          nota: req.body.nota_rapida,
          transcripcion: req.body.transcripcion
        });

        const rubric = await gradeCallRubric({
          prospect,
          resultado: req.body.resultado,
          resumen: summary.resumen,
          transcripcion: req.body.transcripcion
        });

        // Actualizar en la base de datos
        const db = await readDB();
        if (db.cabina && Array.isArray(db.cabina.interactions)) {
          const target = db.cabina.interactions.find(i => i.id === interaction.id);
          if (target) {
            target.resumen_ia = summary.resumen;
            target.proxima_accion = summary.proxima_accion;
            target.nota_rubrica = rubric.nota_total;
            target.rubrica_desglose = rubric;
            target.es_modelo = rubric.es_modelo;
            await writeDB(db);
          }
        }
      } catch (bgErr) {
        console.error('[Cabina AI Background] Error generando resumen/rúbrica:', bgErr.message);
      }
    })();

    res.json({ success: true, interaction });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Deshacer última llamada (margen de 8 segundos Ctrl+Z)
app.post('/api/cabina/undo/:id', authMiddleware, async (req, res) => {
  try {
    const result = await undoInteraction(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Biblioteca de objeciones
app.get('/api/cabina/objections', authMiddleware, async (req, res) => {
  try {
    const objections = await getObjections(req.query.sector);
    res.json({ success: true, objections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Resolver objeción nueva con IA (Prompt E) y guardarla en la biblioteca
app.post('/api/cabina/objections/ask', authMiddleware, async (req, res) => {
  try {
    const { prospect, objectionText } = req.body;
    if (!objectionText) {
      return res.status(400).json({ success: false, message: 'Falta texto de la objeción' });
    }
    const aiAnswer = await generateObjectionResponse({ prospect, objectionText });
    const saved = await addObjection({
      etiqueta: aiAnswer.etiqueta || objectionText.slice(0, 40),
      respuesta: aiAnswer.respuesta,
      sector: prospect?.nicho || 'general'
    });
    res.json({ success: true, objection: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Llamadas modelo (≥ 80 puntos)
app.get('/api/cabina/model-calls', authMiddleware, async (req, res) => {
  try {
    const calls = await getModelCalls();
    res.json({ success: true, calls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Importar lote de empresas investigadas (Prompt A)
app.post('/api/cabina/import', authMiddleware, async (req, res) => {
  try {
    const { list } = req.body;
    if (!Array.isArray(list)) {
      return res.status(400).json({ success: false, message: 'Se esperaba un array de empresas' });
    }
    const result = await importProspects(list);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint legado de compatibilidad
app.post('/api/sales/advice', authMiddleware, async (req, res) => {
  try {
    const { transcript, productContext } = req.body;
    const advice = await getSalesAdvice(transcript || '', productContext || '');
    res.json({ success: true, advice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= LIFE HUB & AI AGENTS SWARM API =================

// Obtener estado completo de agentes, logs y métricas de vida de zVaito
app.get('/api/life/agents', authMiddleware, async (req, res) => {
  try {
    const agentsData = await getAgentsState();
    const db = await readDB();

    // Métricas unificadas de vida y operaciones
    const lifeMetrics = {
      activeAgentsCount: agentsData.agents.filter(a => a.status === 'active').length,
      totalAgentsCount: agentsData.agents.length,
      prospectsInCabina: db.cabina?.prospects?.length || 0,
      securityTargets: db.security?.targets?.length || 0,
      sitemapsAudited: db.sitemaps?.length || 0,
      workoutsLogged: db.gym?.history?.length || 0,
      gradesCount: db.grades?.entries?.length || 0
    };

    res.json({
      success: true,
      agents: agentsData.agents,
      logs: agentsData.logs,
      metrics: lifeMetrics
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Disparar la misión de un agente específico
app.post('/api/life/agents/:id/trigger', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await triggerAgentMission(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Alternar estado de un agente (Activo / Pausado)
app.post('/api/life/agents/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await toggleAgentStatus(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Crear nuevo agente personalizado
app.post('/api/life/agents', authMiddleware, async (req, res) => {
  try {
    const { name, role, icon, color, cadence, description, systemPrompt } = req.body;
    const newAgent = await createCustomAgent({
      name,
      role,
      icon,
      color,
      cadence,
      description,
      systemPrompt
    });
    res.json({ success: true, agent: newAgent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Chat con el Orquestador Maestro de Vida
app.post('/api/life/orchestrator/chat', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Falta el mensaje para el orquestador.' });
    }
    const reply = await chatWithLifeMaster(message);
    res.json({ success: true, reply });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= CLIENT LEAD / IDEAS API =================

app.get('/api/leads', authMiddleware, async (req, res) => {
  try {
    const db = await readDB();
    res.json({
      productIdeas: db.leads?.productIdeas || [],
      leadsList: db.leads?.leadsList || []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/leads/trigger', authMiddleware, async (req, res) => {
  try {
    await runLeadGeneration();
    const db = await readDB();
    res.json({
      success: true,
      productIdeas: db.leads.productIdeas,
      leadsList: db.leads.leadsList
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= CONFIGURATION API =================

// Ruta para obtener la configuración actual (ocultando claves parcialmente por seguridad)
app.get('/api/config', authMiddleware, (req, res) => {
  res.json({
    geminiApiKey: process.env.GEMINI_API_KEY ? '✔ Configurada (comienza con ' + process.env.GEMINI_API_KEY.substring(0, 5) + '...)' : '',
    gmailUser: process.env.GMAIL_USER || '',
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD ? '✔ Configurada (contraseña de aplicación activa)' : ''
  });
});

app.post('/api/config/save', authMiddleware, async (req, res) => {
  try {
    const { geminiApiKey, gmailUser, gmailAppPassword } = req.body;
    const sanitizedAppPassword = gmailAppPassword !== undefined ? gmailAppPassword.replace(/\s+/g, '') : undefined;
    
    // Actualizar en memoria inmediatamente
    if (geminiApiKey !== undefined) process.env.GEMINI_API_KEY = geminiApiKey.trim();
    if (gmailUser !== undefined) process.env.GMAIL_USER = gmailUser.trim();
    if (sanitizedAppPassword !== undefined) process.env.GMAIL_APP_PASSWORD = sanitizedAppPassword;

    // Actualizar el archivo .env leyendo el archivo actual
    const envPath = path.resolve('.env');
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch (e) {
      // Si no existe, crear uno vacío
    }

    const lines = envContent.split('\n');
    const newLines = [];
    const keysHandled = new Set();

    const updates = {
      GEMINI_API_KEY: geminiApiKey ? geminiApiKey.trim() : undefined,
      GMAIL_USER: gmailUser ? gmailUser.trim() : undefined,
      GMAIL_APP_PASSWORD: sanitizedAppPassword
    };

    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed) {
        newLines.push(line);
        continue;
      }
      
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) {
        newLines.push(line);
        continue;
      }

      const key = trimmed.substring(0, equalIndex).trim();
      if (updates[key] !== undefined) {
        newLines.push(`${key}=${updates[key]}`);
        keysHandled.add(key);
      } else {
        newLines.push(line);
      }
    }

    // Agregar claves que no estaban en el archivo
    Object.keys(updates).forEach(key => {
      if (!keysHandled.has(key) && updates[key] !== undefined) {
        newLines.push(`${key}=${updates[key]}`);
      }
    });

    await fs.writeFile(envPath, newLines.join('\n'), 'utf-8');

    res.json({
      success: true,
      message: 'Configuración guardada correctamente.',
      config: {
        geminiApiKey: process.env.GEMINI_API_KEY ? '✔ Configurada' : '',
        gmailUser: process.env.GMAIL_USER || '',
        gmailAppPassword: process.env.GMAIL_APP_PASSWORD ? '✔ Configurada' : ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error guardando config: ' + err.message });
  }
});



// ================= STUDYSYNC ARCADE: GOOGLE OAUTH & CALENDAR API =================


// Almacén en memoria de tokens de Google (por usuario zVaito, sesión de servidor)
const googleTokenStore = { accessToken: null, refreshToken: null, expiresAt: 0 };

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/api/studysync/oauth/callback`
  );
}

async function getValidAccessToken() {
  if (googleTokenStore.accessToken && Date.now() < googleTokenStore.expiresAt - 60000) {
    return googleTokenStore.accessToken;
  }
  if (googleTokenStore.refreshToken) {
    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({ refresh_token: googleTokenStore.refreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();
      googleTokenStore.accessToken = credentials.access_token;
      googleTokenStore.expiresAt = credentials.expiry_date || (Date.now() + 3600 * 1000);
      if (credentials.refresh_token) googleTokenStore.refreshToken = credentials.refresh_token;
      return googleTokenStore.accessToken;
    } catch (err) {
      console.error('Error renovando token de Google:', err.message);
      googleTokenStore.accessToken = null;
      return null;
    }
  }
  return null;
}

// GET /api/studysync/status — Estado de conexión Google
app.get('/api/studysync/status', authMiddleware, (req, res) => {
  const isConnected = !!(googleTokenStore.accessToken || googleTokenStore.refreshToken);
  res.json({ success: true, connected: isConnected });
});

// GET /api/studysync/oauth/start — Inicia el flujo OAuth2 de Google
app.get('/api/studysync/oauth/start', authMiddleware, (req, res) => {
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar'
    ]
  });
  res.json({ success: true, url });
});

// GET /api/studysync/oauth/callback — Callback de Google OAuth2
app.get('/api/studysync/oauth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.send(`<script>window.opener?.postMessage({type:'GOOGLE_AUTH_ERROR',error:'${error}'},'*');window.close();</script>`);
  if (!code) return res.send(`<script>window.opener?.postMessage({type:'GOOGLE_AUTH_ERROR',error:'No code received'},'*');window.close();</script>`);
  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    googleTokenStore.accessToken = tokens.access_token;
    googleTokenStore.refreshToken = tokens.refresh_token || googleTokenStore.refreshToken;
    googleTokenStore.expiresAt = tokens.expiry_date || (Date.now() + 3600 * 1000);
    res.send(`<script>window.opener?.postMessage({type:'GOOGLE_AUTH_SUCCESS'},'*');window.close();</script>`);
  } catch (err) {
    console.error('Error en callback OAuth2:', err.message);
    res.send(`<script>window.opener?.postMessage({type:'GOOGLE_AUTH_ERROR',error:'${err.message}'},'*');window.close();</script>`);
  }
});

// GET /api/studysync/calendar/events — Obtiene bloques del calendario
app.get('/api/studysync/calendar/events', authMiddleware, async (req, res) => {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return res.status(401).json({ success: false, error: 'No autenticado con Google. Conecta tu cuenta en el módulo StudySync.' });
    const events = await getUpcomingCalendarEvents(accessToken, 14);
    res.json({ success: true, data: events });
  } catch (err) {
    console.error('Error en /api/studysync/calendar/events:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/studysync/sync — Sincroniza examen en Google Calendar
app.post('/api/studysync/sync', authMiddleware, async (req, res) => {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return res.status(401).json({ success: false, error: 'No autenticado con Google.' });
    const { exam, selectedSlotIds, allSlots } = req.body;
    if (!exam || !exam.name || !exam.date) return res.status(400).json({ success: false, error: 'Nombre y fecha del examen son obligatorios.' });
    if (!selectedSlotIds || selectedSlotIds.length === 0) return res.status(400).json({ success: false, error: 'Debes seleccionar al menos un bloque de tiempo.' });
    const requiredSlots = getRequiredHours(exam.effortLevel);
    if (selectedSlotIds.length !== requiredSlots) return res.status(400).json({ success: false, error: `Has seleccionado ${selectedSlotIds.length} bloques, pero se necesitan exactamente ${requiredSlots} horas.` });

    let selectedSlots = (allSlots || []).filter(s => selectedSlotIds.includes(s.id));

    // Reconstruir slots virtuales que no se encontraron
    for (const id of selectedSlotIds) {
      if (!selectedSlots.some(s => s.id === id)) {
        const match = id.match(/^virtual_(\d{2})(\d{2})_(\d{4}-\d{2}-\d{2})$/);
        if (match) {
          const [, sh, sm, dateStr] = match;
          const h = Number(sh), m = Number(sm);
          const [year, month, day] = dateStr.split('-').map(Number);
          const pad = n => String(n).padStart(2, '0');
          const startIso = `${year}-${pad(month)}-${pad(day)}T${pad(h)}:${pad(m)}:00`;
          const endH = (h === 21 && m === 10) ? 22 : h + 1;
          const endM = (h === 21 && m === 10) ? 0 : m;
          selectedSlots.push({ id, summary: 'Bloque', start: startIso, end: `${year}-${pad(month)}-${pad(day)}T${pad(endH)}:${pad(endM)}:00`, isTimeBlock: true });
        }
      }
    }

    const groups = groupConsecutiveSlots(selectedSlots);
    const updatedCalendarEvents = [];
    const calendarErrors = [];
    for (const group of groups) {
      try {
        const result = await syncSlotGroupInstance(accessToken, group, exam.name);
        updatedCalendarEvents.push(result);
      } catch (err) {
        calendarErrors.push(err.message || 'Error en grupo de bloques');
      }
    }

    let allDayExamResult = null, allDayExamError = null;
    try {
      allDayExamResult = await createAllDayExamEvent(accessToken, exam);
    } catch (err) {
      allDayExamError = err.message;
    }

    if (calendarErrors.length > 0) return res.status(500).json({ success: false, error: `Fallo al procesar bloques: ${calendarErrors.join(', ')}` });

    let message = `¡Genial! Se crearon ${updatedCalendarEvents.length} bloque(s) de estudio en azul`;
    if (allDayExamResult) message += ` y se registró el examen "Examen: ${exam.name}" en tu calendario.`;
    else if (allDayExamError) message += `, pero hubo una advertencia: ${allDayExamError}`;

    res.json({ success: true, message, data: { updatedBlocksCount: updatedCalendarEvents.length, allDayExamResult } });
  } catch (err) {
    console.error('Error en /api/studysync/sync:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/studysync/fishing — Programa jornada de pesca
app.post('/api/studysync/fishing', authMiddleware, async (req, res) => {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return res.status(401).json({ success: false, error: 'No autenticado con Google.' });
    const { date, startTime, endTime } = req.body;
    if (!date || !startTime || !endTime) return res.status(400).json({ success: false, error: 'La fecha, hora de inicio y hora de fin son obligatorias.' });
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek !== 6 && dayOfWeek !== 0) return res.status(400).json({ success: false, error: 'La jornada de pesca solo puede programarse en Sábado o Domingo.' });
    const result = await scheduleFishingDay(accessToken, date, startTime, endTime);
    const dayName = dayOfWeek === 6 ? 'Sábado' : 'Domingo';
    const targetDayName = dayOfWeek === 6 ? 'Domingo' : 'Sábado';
    let message = `🎣 ¡Jornada de pesca programada para el ${dayName} ${date} (${startTime} - ${endTime})!`;
    if (result.movedCount > 0 || result.deletedCount > 0) message += ` Tareas ajustadas: ${result.movedCount} pasada(s) al ${targetDayName}, ${result.deletedCount} eliminada(s).`;
    res.json({ success: true, message, data: result });
  } catch (err) {
    console.error('Error en /api/studysync/fishing:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= CALIFICACIONES API =================

const DEFAULT_SUBJECTS = [
  'Matemáticas',
  'FyQ',
  'Dibujo Técnico',
  'Filosofía',
  'Tecnología',
  'Lengua',
  'Inglés'
];

app.get('/api/grades', authMiddleware, async (req, res) => {
  try {
    const db = await readDB();
    if (!db.grades) {
      db.grades = { subjects: DEFAULT_SUBJECTS, entries: [] };
      await writeDB(db);
    }
    if (!Array.isArray(db.grades.subjects) || db.grades.subjects.length === 0) {
      db.grades.subjects = [...DEFAULT_SUBJECTS];
      await writeDB(db);
    } else {
      let changed = false;
      for (const subj of DEFAULT_SUBJECTS) {
        if (!db.grades.subjects.includes(subj)) {
          db.grades.subjects.push(subj);
          changed = true;
        }
      }
      if (changed) await writeDB(db);
    }
    if (!Array.isArray(db.grades.entries)) {
      db.grades.entries = [];
      await writeDB(db);
    }
    res.json({ success: true, subjects: db.grades.subjects, entries: db.grades.entries });
  } catch (err) {
    console.error('Error al obtener calificaciones:', err);
    res.status(500).json({ success: false, error: 'Error al obtener calificaciones' });
  }
});

app.post('/api/grades', authMiddleware, async (req, res) => {
  try {
    const { subject, value, label, date } = req.body;
    if (!subject || value === undefined || value === null || value === '') {
      return res.status(400).json({ success: false, error: 'La asignatura y la nota son obligatorias.' });
    }
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal < 0 || numVal > 10) {
      return res.status(400).json({ success: false, error: 'La nota debe ser un número entre 0 y 10.' });
    }

    const db = await readDB();
    if (!db.grades) {
      db.grades = { subjects: DEFAULT_SUBJECTS, entries: [] };
    }
    if (!db.grades.subjects.includes(subject)) {
      db.grades.subjects.push(subject);
    }

    const newEntry = {
      id: 'g_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      subject: subject.trim(),
      value: Math.round(numVal * 100) / 100,
      label: (label || '').trim(),
      date: date || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString()
    };

    db.grades.entries.unshift(newEntry);
    await writeDB(db);

    res.json({ success: true, entry: newEntry, message: 'Nota registrada con éxito' });
  } catch (err) {
    console.error('Error al guardar nota:', err);
    res.status(500).json({ success: false, error: 'Error al registrar nota' });
  }
});

app.delete('/api/grades/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await readDB();
    if (!db.grades || !Array.isArray(db.grades.entries)) {
      return res.json({ success: true });
    }
    db.grades.entries = db.grades.entries.filter(e => e.id !== id);
    await writeDB(db);
    res.json({ success: true, message: 'Nota eliminada correctamente' });
  } catch (err) {
    console.error('Error al eliminar nota:', err);
    res.status(500).json({ success: false, error: 'Error al eliminar nota' });
  }
});

app.post('/api/grades/subject', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre de la asignatura es obligatorio.' });
    }
    const cleanName = name.trim();
    const db = await readDB();
    if (!db.grades) {
      db.grades = { subjects: DEFAULT_SUBJECTS, entries: [] };
    }
    if (!db.grades.subjects.includes(cleanName)) {
      db.grades.subjects.push(cleanName);
      await writeDB(db);
    }
    res.json({ success: true, subjects: db.grades.subjects, message: `Asignatura "${cleanName}" añadida.` });
  } catch (err) {
    console.error('Error al añadir asignatura:', err);
    res.status(500).json({ success: false, error: 'Error al añadir asignatura' });
  }
});

// ================= RUN SERVER =================

// Iniciar tareas cron y verificar base de datos al encender el servidor
initCronTasks();
initPostgresTables();

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Servidor de zVaito corriendo en puerto ${PORT}`);
  console.log(` Accede localmente en: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
