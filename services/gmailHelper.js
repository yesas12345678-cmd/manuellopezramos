import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { callGemini } from './gemini.js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Envía un correo electrónico utilizando SMTP y Nodemailer.
 */
export async function sendGmail({ to, subject, text, html }) {
  const email = (process.env.GMAIL_USER || '').trim();
  const password = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!email || !password) {
    throw new Error('Credenciales de Gmail no configuradas en el archivo .env');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: email,
      pass: password
    }
  });

  const mailOptions = {
    from: email,
    to,
    subject,
    text,
    html: html || text
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('Correo enviado con éxito:', info.messageId);
  return info;
}

/**
 * Crea e inicializa un cliente ImapFlow con control de errores seguro.
 */
function createImapClient() {
  const email = (process.env.GMAIL_USER || '').trim();
  const password = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!email || !password) {
    const err = new Error('Credenciales de Gmail no configuradas');
    err.code = 'NO_CREDENTIALS';
    throw err;
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    logger: false,
    auth: {
      user: email,
      pass: password
    },
    socketTimeout: 10000,
    connectionTimeout: 10000
  });

  // Prevenir que errores de socket no controlados cierren el proceso de Node
  client.on('error', (err) => {
    console.error('[IMAP Warning Capturado]:', err.message);
  });

  return client;
}

/**
 * Lee los correos más recientes de la bandeja de entrada usando ImapFlow.
 */
export async function fetchRecentEmails(limit = 8) {
  let client;
  try {
    client = createImapClient();
    await client.connect();
  } catch (connErr) {
    if (client) {
      try { client.close(); } catch (_) {}
    }
    const isAuth = connErr.authenticationFailed || 
                   connErr.serverResponseCode === 'AUTHENTICATIONFAILED' || 
                   /invalid credentials|command failed|badcredentials/i.test(connErr.message || '');
    if (isAuth) {
      const err = new Error('AUTH_FAILED');
      err.isAuthError = true;
      throw err;
    }
    throw connErr;
  }

  const emails = [];
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const totalMessages = client.mailbox.exists;
      if (totalMessages > 0) {
        const startRange = Math.max(1, totalMessages - limit + 1);
        const range = `${startRange}:${totalMessages}`;
        
        for await (let message of client.fetch(range, { envelope: true })) {
          emails.push({
            uid: message.uid,
            seq: message.seq,
            subject: message.envelope.subject || '(Sin Asunto)',
            from: message.envelope.from?.map(f => `${f.name || ''} <${f.address}>`).join(', ') || 'Desconocido',
            date: message.envelope.date,
            messageId: message.envelope.messageId
          });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch (_) {
      try { client.close(); } catch (_) {}
    }
  }

  return emails.reverse();
}

/**
 * Busca correos en IMAP según un término de búsqueda (ej: GLS, facturas, etc.).
 */
export async function searchEmails(queryText, limit = 8) {
  if (!queryText || !queryText.trim()) return [];
  const cleanQuery = queryText.trim();

  let client;
  try {
    client = createImapClient();
    await client.connect();
  } catch (connErr) {
    if (client) {
      try { client.close(); } catch (_) {}
    }
    const isAuth = connErr.authenticationFailed || 
                   connErr.serverResponseCode === 'AUTHENTICATIONFAILED' || 
                   /invalid credentials|command failed|badcredentials/i.test(connErr.message || '');
    if (isAuth) {
      const err = new Error('AUTH_FAILED');
      err.isAuthError = true;
      throw err;
    }
    throw connErr;
  }

  const emails = [];
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const searchResult = await client.search({
        or: [
          { from: cleanQuery },
          { subject: cleanQuery },
          { body: cleanQuery }
        ]
      });

      if (Array.isArray(searchResult) && searchResult.length > 0) {
        const targetSeqs = searchResult.slice(-limit);
        for await (let message of client.fetch(targetSeqs, { envelope: true })) {
          emails.push({
            uid: message.uid,
            seq: message.seq,
            subject: message.envelope.subject || '(Sin Asunto)',
            from: message.envelope.from?.map(f => `${f.name || ''} <${f.address}>`).join(', ') || 'Desconocido',
            date: message.envelope.date,
            messageId: message.envelope.messageId
          });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch (_) {
      try { client.close(); } catch (_) {}
    }
  }

  return emails.reverse();
}

/**
 * Procesa comandos de chat para Gmail combinando ImapFlow, Nodemailer y Gemini.
 */
export async function processGmailChat(userMessage) {
  const email = (process.env.GMAIL_USER || '').trim();
  const password = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!email || !password) {
    return {
      success: false,
      response: "⚠️ Las credenciales de Gmail no están configuradas. Por favor, añade tu dirección de correo (`GMAIL_USER`) y tu contraseña de aplicación de 16 caracteres (`GMAIL_APP_PASSWORD`) en la pestaña de **Configuración**."
    };
  }

  try {
    // Detectar si el usuario pide buscar algo específico
    const searchMatch = userMessage.match(/(?:busca(?:r)?|encuentra|tengo|hay|ver|mostrar|dame)\s+(?:correos|emails|mensajes|mails)?\s*(?:de|sobre|con)?\s*([a-zA-Z0-9_\-\.]{2,})/i);
    const potentialSearchTerm = searchMatch ? searchMatch[1] : null;

    let relevantEmails = [];
    let searchAttempted = false;

    try {
      if (potentialSearchTerm && !['los', 'mis', 'hoy', 'ayer', 'algo', 'uno'].includes(potentialSearchTerm.toLowerCase())) {
        searchAttempted = true;
        relevantEmails = await searchEmails(potentialSearchTerm, 6);
      }
      
      // Si no se buscó término específico o no hubo resultados, recuperar los últimos correos
      if (relevantEmails.length === 0) {
        const recent = await fetchRecentEmails(6);
        if (!searchAttempted) {
          relevantEmails = recent;
        }
      }
    } catch (fetchErr) {
      if (fetchErr.isAuthError || fetchErr.message === 'AUTH_FAILED') {
        return {
          success: true,
          response: `⚠️ **Error de autenticación con Gmail**: Google ha rechazado las credenciales configuradas (contraseña de aplicación incorrecta, revocada o IMAP desactivado).

**Pasos para solucionarlo:**
1. Ve a tu Cuenta de Google en: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Crea una nueva **Contraseña de Aplicación** (código de 16 letras).
3. Entra a la pestaña **Configuración** de esta plataforma y pega la nueva contraseña.
4. Asegúrate también de tener habilitado **IMAP** en [mail.google.com](https://mail.google.com) > Ajustes (engranaje) > *Ver todos los ajustes* > *Reenvío y correo POP/IMAP* > *Habilitar IMAP*.`
        };
      }
      console.error('Error recuperando correos para el chat:', fetchErr.message);
    }

    // Estructurar el contexto de correos para Gemini
    const emailContext = relevantEmails.length > 0
      ? relevantEmails.map((e, idx) => 
          `${idx + 1}. DE: ${e.from} | ASUNTO: ${e.subject} | FECHA: ${e.date ? new Date(e.date).toLocaleString('es-ES') : 'Desconocida'}`
        ).join('\n')
      : (searchAttempted 
          ? `Se realizó una búsqueda en el buzón para el término "${potentialSearchTerm}" pero no se encontró ningún correo con ese criterio.`
          : 'No se pudieron recuperar correos recientes o la bandeja de entrada está vacía.');

    // Instrucciones del sistema para Gemini
    const systemInstruction = `Eres un asistente de inteligencia artificial para gestionar el correo Gmail del usuario Manuel López Ramos.
Tienes acceso a información de su buzón provista en el contexto y capacidad de redactar respuestas o enviar emails.

Tu tarea:
1. Si el usuario pregunta por correos específicos (como GLS, Amazon, etc.):
   - Revisa el contexto provisto. Si aparecen correos coincidentes, dale los detalles (remitente, asunto, fecha).
   - Si no aparece ningún correo de ese remitente en el contexto, indícaselo claramente y con amabilidad.

2. Si el usuario quiere ENVIAR un correo:
   - Responde con un objeto JSON (sin comillas invertidas de código ni texto adicional):
   {
     "action": "send_email",
     "to": "correo@destino.com",
     "subject": "Asunto",
     "body": "Cuerpo redactado del correo",
     "assistantResponse": "Mensaje en español confirmando que vas a enviar el correo."
   }

3. Responde siempre de forma clara, directa y concisa en español.`;

    const prompt = `Instrucción del usuario: "${userMessage}"
Contexto del buzón:
${emailContext}

Responde al usuario adecuadamente:`;

    const aiResponse = await callGemini(prompt, systemInstruction);

    // Verificar si Gemini solicitó enviar un correo
    let cleanResponse = aiResponse.trim();
    if (cleanResponse.startsWith('```json')) cleanResponse = cleanResponse.substring(7);
    if (cleanResponse.endsWith('```')) cleanResponse = cleanResponse.substring(0, cleanResponse.length - 3);

    try {
      const jsonAction = JSON.parse(cleanResponse.trim());
      if (jsonAction.action === 'send_email' && jsonAction.to && jsonAction.subject && jsonAction.body) {
        await sendGmail({
          to: jsonAction.to,
          subject: jsonAction.subject,
          text: jsonAction.body
        });
        
        return {
          success: true,
          response: jsonAction.assistantResponse || `✅ Correo enviado con éxito a **${jsonAction.to}** con el asunto *"${jsonAction.subject}"*.`,
          actionTaken: 'send_email',
          details: { to: jsonAction.to, subject: jsonAction.subject }
        };
      }
    } catch (_) {
      // Conversación normal
    }

    return {
      success: true,
      response: aiResponse
    };

  } catch (error) {
    console.error('Error general en processGmailChat:', error);
    return {
      success: false,
      response: `❌ Error al procesar tu solicitud: ${error.message}`
    };
  }
}
