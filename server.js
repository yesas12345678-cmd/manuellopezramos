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
import { runSitemapAuditAll } from './services/cronTasks.js';
import { runSecurityScanAll } from './services/cronTasks.js';
import { runLeadGeneration } from './services/cronTasks.js';
import { processGmailChat } from './services/gmailHelper.js';
import { initCronTasks } from './services/cronTasks.js';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'zVaitoSecretJWTKeyForAuthentication2026!';

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
  const adminUser = process.env.ADMIN_USER || 'zVaito';
  const adminPassword = process.env.ADMIN_PASSWORD || 'XPDMNM12';

  if (username === adminUser && password === adminPassword) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    
    // Cookie persistente por 7 días
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Cambiar a true si se despliega en HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    });

    return res.json({ success: true, username });
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

// ================= SALES CLOSING API =================

app.post('/api/sales/advice', authMiddleware, async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ success: false, message: 'Falta transcripción' });
    }
    const advice = await getSalesAdvice(transcript);
    res.json({ success: true, advice });
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

// ================= GMAIL ASSISTANT API =================

app.get('/api/gmail/inbox', authMiddleware, async (req, res) => {
  try {
    const { fetchRecentEmails } = await import('./services/gmailHelper.js');
    const emails = await fetchRecentEmails(8);
    res.json(emails);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/gmail/chat', authMiddleware, async (req, res) => {
  try {
    const db = await readDB();
    res.json(db.gmail?.chatHistory || []);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/gmail/chat', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Falta el mensaje.' });
    }

    const db = await readDB();
    
    // Guardar el mensaje del usuario en la base de datos
    db.gmail.chatHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // Llamar al procesador inteligente
    const result = await processGmailChat(message);

    // Guardar respuesta de la IA
    db.gmail.chatHistory.push({
      role: 'assistant',
      content: result.response,
      timestamp: new Date().toISOString(),
      actionTaken: result.actionTaken || null,
      details: result.details || null
    });

    await writeDB(db);
    res.json({ success: true, chatHistory: db.gmail.chatHistory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/gmail/clear', authMiddleware, async (req, res) => {
  try {
    const db = await readDB();
    db.gmail.chatHistory = [];
    await writeDB(db);
    res.json({ success: true, chatHistory: [] });
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
    
    // Actualizar en memoria inmediatamente
    if (geminiApiKey !== undefined) process.env.GEMINI_API_KEY = geminiApiKey;
    if (gmailUser !== undefined) process.env.GMAIL_USER = gmailUser;
    if (gmailAppPassword !== undefined) process.env.GMAIL_APP_PASSWORD = gmailAppPassword;

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
      GEMINI_API_KEY: geminiApiKey,
      GMAIL_USER: gmailUser,
      GMAIL_APP_PASSWORD: gmailAppPassword
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

// ================= RUN SERVER =================

// Iniciar tareas cron al encender el servidor
initCronTasks();

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Servidor de zVaito corriendo en puerto ${PORT}`);
  console.log(` Accede localmente en: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
