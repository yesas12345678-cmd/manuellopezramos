import cron from 'node-cron';
import { readDB, writeDB } from './dbHelper.js';
import { auditSitemap } from './sitemapChecker.js';
import { runSecurityScan } from './pentest.js';
import { sendGmail } from './gmailHelper.js';
import { brainstormProductIdeas, generateClientLeads } from './gemini.js';

/**
 * Ejecuta la auditoría en todos los sitemaps guardados.
 */
export async function runSitemapAuditAll() {
  console.log('[Cron] Iniciando revisión de sitemaps...');
  const db = await readDB();
  const sitemaps = db.sitemaps || [];
  
  if (sitemaps.length === 0) {
    console.log('[Cron] No hay sitemaps para verificar.');
    return;
  }

  let alertDetails = [];

  for (let i = 0; i < sitemaps.length; i++) {
    const site = sitemaps[i];
    try {
      const result = await auditSitemap(site.url, site.sitemapUrl);
      
      // Actualizar el estado en base de datos
      sitemaps[i] = {
        ...site,
        lastStatus: result.status,
        lastChecked: result.checkedAt,
        expectedCount: result.webCount,
        actualCount: result.sitemapCount
      };

      if (result.status !== 'OK') {
        alertDetails.push(`- Sitio: ${site.url}\n  Estado: ${result.status}\n  Mensaje: ${result.message}`);
      }
    } catch (err) {
      sitemaps[i].lastStatus = 'Error';
      sitemaps[i].lastChecked = new Date().toISOString();
      alertDetails.push(`- Sitio: ${site.url}\n  Error: ${err.message}`);
    }
  }

  db.sitemaps = sitemaps;
  await writeDB(db);

  // Si hay fallos y Gmail está configurado, mandar correo
  if (alertDetails.length > 0 && process.env.GMAIL_USER) {
    const bodyText = `Hola zVaito,\n\nSe han detectado problemas en la revisión semanal de tus sitemaps:\n\n${alertDetails.join('\n\n')}\n\nPor favor, ingresa a tu panel de control para revisar los detalles.`;
    try {
      await sendGmail({
        to: process.env.GMAIL_USER,
        subject: `⚠️ Alerta de Sitemaps - zVaito Personal Web`,
        text: bodyText
      });
      console.log('[Cron] Correo de alerta de sitemaps enviado.');
    } catch (emailErr) {
      console.error('[Cron] No se pudo enviar el correo de alerta de sitemaps:', emailErr.message);
    }
  }

  console.log('[Cron] Revisión de sitemaps finalizada.');
}

/**
 * Ejecuta el escaneo de vulnerabilidades en todos los objetivos guardados.
 */
export async function runSecurityScanAll() {
  console.log('[Cron] Iniciando escaneo de vulnerabilidades de seguridad...');
  const db = await readDB();
  const targets = db.security?.targets || [];
  
  if (targets.length === 0) {
    console.log('[Cron] No hay objetivos de seguridad registrados.');
    return;
  }

  let highRiskAlerts = [];
  const logs = db.security.logs || [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    try {
      const scanResult = await runSecurityScan(target.url);
      
      // Actualizar estado del objetivo
      targets[i].lastScanDate = scanResult.scanDate;
      targets[i].lastScanStatus = scanResult.vulnerabilities.length > 0 ? 'Vulnerable' : 'Seguro';

      // Agregar vulnerabilidades encontradas a la bitácora
      scanResult.vulnerabilities.forEach(vuln => {
        const id = 'v_' + Math.random().toString(36).substr(2, 9);
        logs.push({
          id,
          url: target.url,
          title: vuln.title,
          description: vuln.description,
          solution: vuln.solution,
          severity: vuln.severity,
          type: vuln.type,
          status: 'Open',
          foundAt: scanResult.scanDate
        });

        // Filtrar alertas críticas/altas
        if (vuln.severity === 'Critical' || vuln.severity === 'High') {
          highRiskAlerts.push(`- Web: ${target.url}\n  Vulnerabilidad: ${vuln.title}\n  Severidad: ${vuln.severity}\n  Descripción: ${vuln.description}`);
        }
      });
    } catch (err) {
      console.error(`[Cron] Error escaneando ${target.url}:`, err);
    }
  }

  db.security.targets = targets;
  db.security.logs = logs;
  await writeDB(db);

  // Enviar alerta crítica si hay vulnerabilidades graves y correo configurado
  if (highRiskAlerts.length > 0 && process.env.GMAIL_USER) {
    const bodyText = `Hola zVaito,\n\nSe han detectado vulnerabilidades graves de seguridad (High/Critical) en tus webs:\n\n${highRiskAlerts.join('\n\n')}\n\nPor favor, ingresa al panel de control inmediatamente y toma medidas correctivas.`;
    try {
      await sendGmail({
        to: process.env.GMAIL_USER,
        subject: `🚨 ALERTA DE SEGURIDAD CRÍTICA - zVaito Personal Web`,
        text: bodyText
      });
      console.log('[Cron] Correo de alerta de seguridad enviado.');
    } catch (emailErr) {
      console.error('[Cron] No se pudo enviar el correo de alerta de seguridad:', emailErr.message);
    }
  }

  console.log('[Cron] Escaneo de seguridad finalizado.');
}

/**
 * Ejecuta la tarea de captación de clientes y lluvia de ideas de software.
 */
export async function runLeadGeneration() {
  console.log('[Cron] Iniciando captador de clientes y lluvia de ideas...');
  const db = await readDB();
  
  // 1. Brainstorming neurodivergente con contexto de ideas anteriores
  const prevIdeasText = db.leads.productIdeas.slice(-5).map(i => i.title).join(', ');
  const newIdeas = await brainstormProductIdeas(prevIdeasText);
  
  newIdeas.forEach(idea => {
    idea.id = 'i_' + Math.random().toString(36).substr(2, 9);
    idea.createdAt = new Date().toISOString();
    db.leads.productIdeas.push(idea);
  });

  // 2. Captación de clientes (leads)
  const niches = ['gimnasios locales', 'restaurantes de comida rápida', 'asesorías contables', 'dentistas', 'tiendas online locales'];
  const selectedNiche = niches[Math.floor(Math.random() * niches.length)];
  const newLeads = await generateClientLeads(selectedNiche);

  newLeads.forEach(lead => {
    lead.id = 'l_' + Math.random().toString(36).substr(2, 9);
    lead.status = 'Nuevo';
    lead.foundAt = new Date().toISOString();
    db.leads.leadsList.push(lead);
  });

  await writeDB(db);
  console.log('[Cron] Captación completada. Creadas', newIdeas.length, 'ideas y', newLeads.length, 'leads.');
}

/**
 * Inicializa las tareas programadas (Cron Jobs)
 */
export function initCronTasks() {
  console.log('[Cron] Inicializando tareas programadas...');

  // 1. Revisión de Sitemap: Una vez a la semana (ej: domingos a las 00:00)
  // '0 0 * * 0'
  // Para pruebas rápidas o simulación, también se puede forzar manualmente.
  cron.schedule('0 0 * * 0', async () => {
    try {
      await runSitemapAuditAll();
    } catch (err) {
      console.error('[Cron] Error en sitemaps automático:', err.message);
    }
  });

  // 2. Escaneo de vulnerabilidades: Diario (ej: a las 02:00 am)
  // '0 2 * * *'
  cron.schedule('0 2 * * *', async () => {
    try {
      await runSecurityScanAll();
    } catch (err) {
      console.error('[Cron] Error en pentesting automático:', err.message);
    }
  });

  // 3. Captador de leads y lluvia de ideas: Cada 6 horas
  // '0 */6 * * *'
  cron.schedule('0 */6 * * *', async () => {
    try {
      await runLeadGeneration();
    } catch (err) {
      console.error('[Cron] Error en captación automática:', err.message);
    }
  });

  console.log('[Cron] Tareas programadas configuradas con éxito.');
}
