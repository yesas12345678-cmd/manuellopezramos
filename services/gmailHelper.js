import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { callGemini } from './gemini.js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Envía un correo electrónico utilizando SMTP y Nodemailer.
 */
export async function sendGmail({ to, subject, text, html }) {
  const email = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;

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
 * Lee los correos más recientes de la bandeja de entrada usando ImapFlow.
 */
export async function fetchRecentEmails(limit = 5) {
  const email = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;

  if (!email || !password) {
    throw new Error('Credenciales de Gmail no configuradas en el archivo .env');
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
    socketTimeout: 15000,
    connectionTimeout: 15000
  });

  // Capturar errores de socket para que no maten el proceso
  client.on('error', (err) => {
    console.error('[IMAP] Error de conexión capturado:', err.message);
  });

  try {
    await client.connect();
  } catch (connErr) {
    console.error('[IMAP] No se pudo conectar a Gmail:', connErr.message);
    return [];
  }

  const lock = await client.getMailboxLock('INBOX');
  const emails = [];

  try {
    const totalMessages = client.mailbox.exists;
    
    if (totalMessages > 0) {
      const startRange = Math.max(1, totalMessages - limit + 1);
      const range = `${startRange}:${totalMessages}`;
      
      for await (let message of client.fetch(range, { envelope: true, bodyStructure: true })) {
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

  try {
    await client.logout();
  } catch (e) {
    // Ignorar errores en logout
  }

  return emails.reverse();
}

/**
 * Procesa comandos de chat para Gmail combinando ImapFlow, Nodemailer y Gemini.
 */
export async function processGmailChat(userMessage) {
  const email = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;

  if (!email || !password) {
    return {
      success: false,
      response: "⚠️ Las credenciales de Gmail no están configuradas en el archivo `.env`. Por favor, añade tu dirección de correo (`GMAIL_USER`) y tu contraseña de aplicación (`GMAIL_APP_PASSWORD`) para activar la bandeja de entrada funcional."
    };
  }

  try {
    // 1. Obtener correos recientes para dar contexto a la IA
    let recentEmails = [];
    try {
      recentEmails = await fetchRecentEmails(8);
    } catch (err) {
      console.error('Error obteniendo correos para el chat de IA:', err);
    }

    // Estructurar el contexto de correos para Gemini
    const emailContext = recentEmails.map((e, idx) => 
      `${idx + 1}. DE: ${e.from} | ASUNTO: ${e.subject} | FECHA: ${e.date}`
    ).join('\n') || 'No se pudieron recuperar correos recientes o la bandeja está vacía.';

    // 2. Instrucciones del sistema para Gemini
    const systemInstruction = `Eres un agente de IA autónomo para gestionar la bandeja de entrada de Gmail del usuario.
Tienes acceso para leer los correos recientes (provistos en el contexto) y para redactar/enviar correos usando la API de nodemailer.
Tu tarea es analizar el mensaje del usuario y responder de una de las siguientes maneras:

Si el usuario quiere ENVIAR un correo:
Debes responder con un objeto JSON en tu respuesta (sin formato de markdown, solo el texto JSON) que contenga la estructura del email que vas a enviar, así el backend sabrá qué hacer.
El JSON debe ser:
{
  "action": "send_email",
  "to": "destinatario@correo.com",
  "subject": "Asunto redactado",
  "body": "Cuerpo del correo redactado de forma profesional y completa",
  "assistantResponse": "Mensaje en español para el usuario indicándole que vas a enviar el correo."
}

Si el usuario pregunta sobre sus correos recientes o quiere buscar:
Analiza la lista de correos provistos en el contexto y redacta un resumen o respuesta personalizada en español respondiendo a su pregunta.

Si el usuario da una instrucción ambigua:
Pídele educadamente más información.`;

    const prompt = `Mensaje del usuario: "${userMessage}"
Contexto de correos recientes:\n${emailContext}

Decide qué hacer y responde.`;

    const aiResponse = await callGemini(prompt, systemInstruction);

    // 3. Verificar si Gemini decidió enviar un correo
    let cleanResponse = aiResponse.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.substring(7);
    }
    if (cleanResponse.endsWith('```')) {
      cleanResponse = cleanResponse.substring(0, cleanResponse.length - 3);
    }

    try {
      const jsonAction = JSON.parse(cleanResponse.trim());
      if (jsonAction.action === 'send_email' && jsonAction.to && jsonAction.subject && jsonAction.body) {
        // Enviar el correo electrónico
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
    } catch (e) {
      // Si no es un JSON válido, significa que la IA devolvió una respuesta de conversación normal
    }

    // Respuesta conversacional normal
    return {
      success: true,
      response: aiResponse
    };

  } catch (error) {
    console.error('Error en el asistente de Gmail:', error);
    return {
      success: false,
      response: `❌ Error en el asistente: ${error.message}`
    };
  }
}
