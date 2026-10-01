// ================= GLOBAL STATE & ROUTING =================
let currentUser = null;

// Selectores del DOM
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const panels = document.querySelectorAll('.panel');
const dashCards = document.querySelectorAll('.dash-card');
const btnLogoHome = document.getElementById('btn-logo-home');
const btnNavConfig = document.getElementById('btn-nav-config');
const btnLogout = document.getElementById('btn-logout');

// Indicadores de cabecera
const statusGeminiVal = document.querySelector('#status-gemini .val');
const statusGmailVal = document.querySelector('#status-gmail .val');

// Carga Inicial
document.addEventListener('DOMContentLoaded', async () => {
  await verifySession();
  setupRouter();
  setupGymModule();
  setupSitemapsModule();
  setupSecurityModule();
  setupSalesModule();
  setupGmailModule();
  setupConfigModule();
  setupLeadsModule();
  setupStudySyncModule();
  setupGradesModule();
});

// Verificar si hay sesión activa
async function verifySession() {
  try {
    const res = await fetch('/api/verify');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        handleLoginSuccess(data.username);
        return;
      }
    }
  } catch (e) {
    console.error('Error verificando sesión:', e);
  }
  showLogin();
}

function showLogin() {
  loginContainer.classList.add('active');
  appContainer.classList.add('hidden');
}

function handleLoginSuccess(username) {
  currentUser = username;
  loginContainer.classList.remove('active');
  appContainer.classList.remove('hidden');
  
  // Cargar datos iniciales
  loadGlobalStatus();
  loadDashboardData();
}

// Actualizar indicadores de cabecera
async function loadGlobalStatus() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const config = await res.json();
      
      if (config.geminiApiKey) {
        statusGeminiVal.textContent = 'Activo';
        statusGeminiVal.classList.remove('err');
      } else {
        statusGeminiVal.textContent = 'Sin config';
        statusGeminiVal.classList.add('err');
      }

      if (config.gmailUser && config.gmailAppPassword) {
        statusGmailVal.textContent = 'Conectado';
        statusGmailVal.classList.remove('err');
      } else {
        statusGmailVal.textContent = 'Sin config';
        statusGmailVal.classList.add('err');
      }
    }
  } catch (e) {
    console.error('Error cargando estado global:', e);
  }
}

function loadDashboardData() {
  // Carga silenciosa en segundo plano para que los paneles tengan datos frescos
  loadLeadsData();
  loadGymData();
  loadSitemapsData();
  loadSecurityData();
  loadGmailInbox();
  loadGradesData();
}

// Ruteador del Single Page Application
function setupRouter() {
  // Evento Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        handleLoginSuccess(data.username);
      } else {
        loginError.textContent = data.message || 'Error al iniciar sesión';
      }
    } catch (err) {
      loginError.textContent = 'Error de conexión con el servidor.';
    }
  });

  // Evento Logout
  btnLogout.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      currentUser = null;
      showLogin();
    } catch (e) {
      console.error(e);
    }
  });

  // Navegación desde el Dashboard inicial
  dashCards.forEach(card => {
    card.addEventListener('click', () => {
      const targetPanel = card.getAttribute('data-target');
      showPanel(targetPanel);
    });
  });

  // Botón Logo vuelve al Home Dashboard
  btnLogoHome.addEventListener('click', () => showPanel('panel-dashboard'));
  
  // Botones "Volver"
  document.querySelectorAll('.btn-back-home').forEach(btn => {
    btn.addEventListener('click', () => showPanel('panel-dashboard'));
  });

  // Navegar a Config
  btnNavConfig.addEventListener('click', () => showPanel('panel-config'));
}

function showPanel(panelId) {
  panels.forEach(p => p.classList.remove('active'));
  const target = document.getElementById(panelId);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Cargas de datos bajo demanda específicas al abrir paneles
    if (panelId === 'panel-leads') loadLeadsData();
    if (panelId === 'panel-gym') loadGymData();
    if (panelId === 'panel-sitemaps') loadSitemapsData();
    if (panelId === 'panel-security') loadSecurityData();
    if (panelId === 'panel-gmail') {
      loadGmailInbox();
      loadGmailChatHistory();
    }
    if (panelId === 'panel-config') loadConfigData();
    if (panelId === 'panel-grades') loadGradesData();
  }
}


// ================= MODULO 1: VENTAS EN DIRECTO =================
function setupSalesModule() {
  const btnToggleListen = document.getElementById('btn-toggle-listen');
  const micPulse = document.getElementById('mic-pulse');
  const salesTranscript = document.getElementById('sales-transcript');
  const salesManualText = document.getElementById('sales-manual-text');
  const btnSendSalesContext = document.getElementById('btn-send-sales-context');
  const salesAdviceContainer = document.getElementById('sales-advice-container');
  const salesAiStatus = document.getElementById('sales-ai-status');

  let recognition = null;
  let isListening = false;

  // Inicializar Web Speech Recognition del navegador
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript) {
        salesTranscript.value += finalTranscript;
        // Hacer auto-scroll en el textarea
        salesTranscript.scrollTop = salesTranscript.scrollHeight;
        // Consultar IA de cierre de ventas
        triggerSalesAdvice(salesTranscript.value);
      }
    };

    recognition.onerror = (e) => {
      console.error('Speech recognition error:', e.error);
    };

    recognition.onend = () => {
      if (isListening) {
        // Reiniciar si se detiene accidentalmente
        recognition.start();
      }
    };
  } else {
    btnToggleListen.disabled = true;
    btnToggleListen.querySelector('span').textContent = 'Micrófono No Soportado (Usa Manual)';
    console.warn('El navegador no soporta Speech Recognition API.');
  }

  // Evento escuchar micrófono
  btnToggleListen.addEventListener('click', () => {
    if (!recognition) return;
    
    if (!isListening) {
      recognition.start();
      isListening = true;
      btnToggleListen.classList.add('active');
      btnToggleListen.querySelector('span').textContent = 'Escuchando llamada...';
      micPulse.classList.remove('hidden');
      salesAiStatus.textContent = 'Escuchando...';
    } else {
      isListening = false;
      recognition.stop();
      btnToggleListen.classList.remove('active');
      btnToggleListen.querySelector('span').textContent = 'Iniciar Escucha Activa';
      micPulse.classList.add('hidden');
      salesAiStatus.textContent = 'Listo';
    }
  });

  const salesProductContext = document.getElementById('sales-product-context-text');
  
  // Cargar contexto persistido
  salesProductContext.value = localStorage.getItem('sales_product_context') || '';
  
  salesProductContext.addEventListener('input', () => {
    localStorage.setItem('sales_product_context', salesProductContext.value);
  });

  // Enviar texto manual
  btnSendSalesContext.addEventListener('click', () => {
    const text = salesManualText.value.trim();
    if (!text) return;
    
    salesTranscript.value += `\n[Contexto Manual]: ${text}\n`;
    salesManualText.value = '';
    salesTranscript.scrollTop = salesTranscript.scrollHeight;
    
    triggerSalesAdvice(salesTranscript.value);
  });

  // Consultar consejos al backend
  async function triggerSalesAdvice(transcriptText) {
    salesAiStatus.textContent = 'Analizando...';
    salesAiStatus.className = 'badge';
    try {
      const res = await fetch('/api/sales/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript: transcriptText,
          productContext: salesProductContext.value.trim()
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        renderSalesAdvice(data.advice);
        salesAiStatus.textContent = 'Actualizado';
      } else {
        const data = await res.json();
        salesAiStatus.textContent = 'Error';
        salesAiStatus.className = 'badge badge-critical';
        renderSalesAdvice(`⚠️ **Error al consultar el asesor:**\n\n${data.message || 'Error en la API.'}\n\n*Por favor, asegúrate de configurar tu **API Key de Gemini** en los Ajustes de la Suite (esquina superior derecha) para activar este módulo.*`);
      }
    } catch (err) {
      console.error('Error obteniendo consejos de venta:', err);
      salesAiStatus.textContent = 'Error Red';
      salesAiStatus.className = 'badge badge-critical';
      renderSalesAdvice(`❌ **Error de Red:** No se pudo conectar con el servidor backend.`);
    }
  }

  function renderSalesAdvice(adviceMarkdown) {
    // Convertir de forma simple las viñetas y negritas a HTML limpio
    let htmlContent = '<div class="advice-block">';
    
    // Verificar si es un mensaje de alerta
    if (adviceMarkdown.includes('⚠️') || adviceMarkdown.includes('❌')) {
      htmlContent += '<h4><i class="fa-solid fa-triangle-exclamation"></i> Estado del Módulo</h4>';
    } else {
      htmlContent += '<h4><i class="fa-solid fa-lightbulb"></i> Consejos Tácticos de Cierre</h4>';
    }
    
    const lines = adviceMarkdown.split('\n');
    let inList = false;

    lines.forEach(line => {
      const cleanLine = line.trim();
      if (cleanLine.startsWith('-') || cleanLine.startsWith('*')) {
        if (!inList) {
          htmlContent += '<ul>';
          inList = true;
        }
        let listText = cleanLine.substring(1).trim();
        listText = listText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        htmlContent += `<li>${listText}</li>`;
      } else if (cleanLine) {
        if (inList) {
          htmlContent += '</ul>';
          inList = false;
        }
        let paraText = cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        htmlContent += `<p>${paraText}</p>`;
      }
    });

    if (inList) htmlContent += '</ul>';
    htmlContent += '</div>';

    salesAdviceContainer.innerHTML = htmlContent;
  }
}


// ================= MODULO 2: CAPTADOR B2B & IDEAS =================
let allProductIdeas = [];
let allLeadsList = [];
let ideasBatchIndex = 0;
let leadsBatchIndex = 0;
const BATCH_SIZE = 5;

function setupLeadsModule() {
  const btnTriggerLeads = document.getElementById('btn-trigger-leads');
  const btnPrevIdeas = document.getElementById('btn-prev-ideas');
  const btnNextIdeas = document.getElementById('btn-next-ideas');
  const btnPrevLeads = document.getElementById('btn-prev-leads');
  const btnNextLeads = document.getElementById('btn-next-leads');

  if (btnTriggerLeads) {
    btnTriggerLeads.addEventListener('click', async () => {
      btnTriggerLeads.disabled = true;
      btnTriggerLeads.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando 5 con IA...';
      
      try {
        const res = await fetch('/api/leads/trigger', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          allProductIdeas = Array.isArray(data.productIdeas) ? data.productIdeas : [];
          allLeadsList = Array.isArray(data.leadsList) ? data.leadsList : [];
          ideasBatchIndex = 0;
          leadsBatchIndex = 0;
          renderIdeasBatch();
          renderLeadsBatch();
          showToast('¡Se han generado 5 nuevos clientes y 5 nuevas ideas con IA!');
        } else {
          const data = await res.json();
          alert('⚠️ Error: ' + (data.message || 'No se pudo iniciar la captación.'));
        }
      } catch (e) {
        console.error(e);
        alert('⚠️ Error de conexión con el servidor.');
      } finally {
        btnTriggerLeads.disabled = false;
        btnTriggerLeads.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generar 5 Nuevos con IA';
      }
    });
  }

  if (btnPrevIdeas) {
    btnPrevIdeas.addEventListener('click', () => {
      if (ideasBatchIndex > 0) {
        ideasBatchIndex--;
        renderIdeasBatch();
      }
    });
  }
  if (btnNextIdeas) {
    btnNextIdeas.addEventListener('click', () => {
      const maxPages = Math.ceil(allProductIdeas.length / BATCH_SIZE);
      if (ideasBatchIndex < maxPages - 1) {
        ideasBatchIndex++;
        renderIdeasBatch();
      }
    });
  }

  if (btnPrevLeads) {
    btnPrevLeads.addEventListener('click', () => {
      if (leadsBatchIndex > 0) {
        leadsBatchIndex--;
        renderLeadsBatch();
      }
    });
  }
  if (btnNextLeads) {
    btnNextLeads.addEventListener('click', () => {
      const maxPages = Math.ceil(allLeadsList.length / BATCH_SIZE);
      if (leadsBatchIndex < maxPages - 1) {
        leadsBatchIndex++;
        renderLeadsBatch();
      }
    });
  }
}

async function loadLeadsData() {
  try {
    const res = await fetch('/api/leads');
    if (res.ok) {
      const data = await res.json();
      allProductIdeas = Array.isArray(data.productIdeas) ? data.productIdeas : [];
      allLeadsList = Array.isArray(data.leadsList) ? data.leadsList : [];
      renderIdeasBatch();
      renderLeadsBatch();
    }
  } catch (err) {
    console.error('Error cargando leads:', err);
  }
}

function renderIdeasBatch() {
  const container = document.getElementById('ideas-list-container');
  const pageInfo = document.getElementById('ideas-page-info');
  const btnPrev = document.getElementById('btn-prev-ideas');
  const btnNext = document.getElementById('btn-next-ideas');

  if (!container) return;

  const total = allProductIdeas.length;
  const totalPages = Math.max(1, Math.ceil(total / BATCH_SIZE));
  if (ideasBatchIndex >= totalPages) ideasBatchIndex = totalPages - 1;
  if (ideasBatchIndex < 0) ideasBatchIndex = 0;

  if (pageInfo) {
    pageInfo.textContent = `Lote ${ideasBatchIndex + 1} de ${totalPages} (${total} ideas)`;
  }
  if (btnPrev) btnPrev.disabled = ideasBatchIndex <= 0;
  if (btnNext) btnNext.disabled = ideasBatchIndex >= totalPages - 1;

  if (total === 0) {
    container.innerHTML = '<div class="empty-state"><p>Aún no hay ideas creadas. Presiona "Generar 5 Nuevos con IA" para iniciar.</p></div>';
    return;
  }

  const start = ideasBatchIndex * BATCH_SIZE;
  const slice = allProductIdeas.slice(start, start + BATCH_SIZE);

  container.innerHTML = slice.map(idea => `
    <div class="idea-card">
      <h4>${escapeHTML(idea.title)}</h4>
      <p>${escapeHTML(idea.description)}</p>
      <div class="idea-details">
        <div><strong>Mercado:</strong> ${escapeHTML(idea.marketNeeds)}</div>
        <div><strong>Stack:</strong> ${escapeHTML(idea.techStack)}</div>
        <div class="text-muted" style="margin-top:8px; font-size:0.75rem;"><i class="fa-regular fa-clock"></i> ${new Date(idea.createdAt).toLocaleString()}</div>
      </div>
    </div>
  `).join('');
}

function renderLeadsBatch() {
  const leadsTableBody = document.getElementById('leads-table-body');
  const pageInfo = document.getElementById('leads-page-info');
  const btnPrev = document.getElementById('btn-prev-leads');
  const btnNext = document.getElementById('btn-next-leads');

  if (!leadsTableBody) return;

  const total = allLeadsList.length;
  const totalPages = Math.max(1, Math.ceil(total / BATCH_SIZE));
  if (leadsBatchIndex >= totalPages) leadsBatchIndex = totalPages - 1;
  if (leadsBatchIndex < 0) leadsBatchIndex = 0;

  if (pageInfo) {
    pageInfo.textContent = `Lote ${leadsBatchIndex + 1} de ${totalPages} (${total} clientes)`;
  }
  if (btnPrev) btnPrev.disabled = leadsBatchIndex <= 0;
  if (btnNext) btnNext.disabled = leadsBatchIndex >= totalPages - 1;

  if (total === 0) {
    leadsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay clientes potenciales aún. Presiona "Generar 5 Nuevos con IA".</td></tr>';
    return;
  }

  const start = leadsBatchIndex * BATCH_SIZE;
  const slice = allLeadsList.slice(start, start + BATCH_SIZE);

  currentLeadsMap = {};
  leadsTableBody.innerHTML = slice.map(lead => {
    const contact = parseLeadContact(lead.phone);

    const whatsappText = 
`¡Hola, equipo de *${lead.name}*! 👋

He estado analizando su sitio web (*${lead.website}*) y he detectado una oportunidad de mejora directa:
👉 ${lead.whyTheyNeedWebDev}

Nos especializamos en desarrollo web de alto rendimiento y soluciones digitales para negocios de su sector.

He preparado una propuesta técnica rápida y sin compromiso para solucionar esto y ayudarles a captar más clientes. ¿Les vendría bien revisarla o comentar 5 minutos por aquí?

Un saludo,
Manuel López Ramos (zVaito)`.trim();

    const emailSubject = `Propuesta de mejora técnica y captación para ${lead.name}`;
    const emailBody = 
`Hola, equipo de ${lead.name}:

Espero que estéis teniendo una excelente semana.

Me pongo en contacto con vosotros porque he estado auditando vuestra página web (${lead.website}) y he identificado un punto de mejora directo:

▶ Diagnóstico y Propuesta:
${lead.whyTheyNeedWebDev}

Nos especializamos en desarrollo web de alto rendimiento, optimización de conversión y software a medida para negocios de vuestro sector.

¿Tendríais 5 minutos estos días para comentar los detalles sin ningún tipo de compromiso?

Quedo a vuestra disposición.

Un cordial saludo,
Manuel López Ramos (zVaito)
Desarrollo Web & Soluciones Digitales
Web: https://manuellopezramos.com`.trim();

    const whatsappUrl = contact.cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${contact.cleanPhone}&text=${encodeURIComponent(whatsappText)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contact.email || '')}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    const fullProposalText = `ASUNTO: ${emailSubject}\n\n${emailBody}\n\n---\nVERSIÓN WHATSAPP:\n${whatsappText}`;
    currentLeadsMap[lead.id] = { lead, proposalFull: fullProposalText, whatsappText, emailBody, emailSubject };

    const cleanSite = lead.website.replace(/^https?:\/\//, '');

    const mapsQuery = lead.address 
      ? `${lead.name}, ${lead.address}`
      : `${lead.name}`;
    const directMapsUrl = (lead.mapsUrl && lead.mapsUrl.startsWith('http'))
      ? lead.mapsUrl
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;

    return `
      <tr>
        <td>
          <div style="display:flex; flex-direction:column; gap:5px;">
            <strong style="font-size:0.95rem; line-height:1.3;">${escapeHTML(lead.name)}</strong>
            ${lead.address ? `<span style="font-size:0.74rem; color:var(--text-muted);"><i class="fa-solid fa-map-pin" style="font-size:0.7rem;margin-right:4px;color:#ff6b81;"></i>${escapeHTML(lead.address)}</span>` : ''}
            <a href="${directMapsUrl}" target="_blank" rel="noopener noreferrer" class="lead-maps-link" title="Abrir ficha exacta de ${escapeHTML(lead.name)} en Google Maps">
              <i class="fa-solid fa-location-dot"></i> Abrir en Maps
            </a>
          </div>
        </td>
        <td><span class="lead-status">${escapeHTML(lead.industry)}</span></td>
        <td><a href="https://${escapeHTML(cleanSite)}" target="_blank" class="text-muted"><i class="fa-solid fa-earth-americas"></i> ${escapeHTML(cleanSite)}</a></td>
        <td><div style="max-width:320px; font-size:0.85rem; line-height:1.4;">${escapeHTML(lead.whyTheyNeedWebDev)}</div></td>
        <td>
          <div style="font-size:0.84rem; display:flex; flex-direction:column; gap:4px;">
            ${contact.phone ? `<span><i class="fa-solid fa-phone" style="color:var(--text-muted);font-size:0.75rem;"></i> ${escapeHTML(contact.phone)}</span>` : ''}
            ${contact.email ? `<span><i class="fa-solid fa-envelope" style="color:var(--text-muted);font-size:0.75rem;"></i> ${escapeHTML(contact.email)}</span>` : ''}
            ${!contact.phone && !contact.email ? `<span class="text-muted">${escapeHTML(lead.phone)}</span>` : ''}
          </div>
        </td>
        <td>
          <div class="leads-actions-group">
            <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-lead-action btn-lead-whatsapp" title="Enviar Propuesta por WhatsApp (lista en el chat)">
              <i class="fa-brands fa-whatsapp"></i> WhatsApp
            </a>
            <a href="${gmailUrl}" target="_blank" rel="noopener noreferrer" class="btn-lead-action btn-lead-email" title="Abrir en Gmail con la propuesta lista para enviar">
              <i class="fa-solid fa-paper-plane"></i> Correo
            </a>
            <button type="button" class="btn-lead-action btn-lead-copy" onclick="copyLeadProposal('${lead.id}')" title="Copiar propuesta al portapapeles">
              <i class="fa-regular fa-copy"></i> Copiar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Helpers para Contacto y Portapapeles en Leads
let currentLeadsMap = {};

function parseLeadContact(contactStr) {
  const s = (contactStr || '').trim();
  const emailMatch = s.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';
  const withoutEmail = s.replace(email, '');
  const phoneMatch = withoutEmail.match(/(\+?\d[\d\s\-.()]{6,}\d)/);
  const phone = phoneMatch ? phoneMatch[0].trim() : '';
  let cleanPhone = phone.replace(/[^\d]/g, '');
  if (cleanPhone.length === 9) cleanPhone = '34' + cleanPhone;
  return { email, phone, cleanPhone };
}

window.copyLeadProposal = function(leadId) {
  const item = currentLeadsMap[leadId];
  if (!item) return;
  const text = item.proposalFull;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`¡Propuesta para ${item.lead.name} copiada!`);
    }).catch(() => {
      fallbackCopyText(text);
      showToast(`¡Propuesta para ${item.lead.name} copiada!`);
    });
  } else {
    fallbackCopyText(text);
    showToast(`¡Propuesta para ${item.lead.name} copiada!`);
  }
};

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function showToast(message) {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#00db8b;"></i> <span>${escapeHTML(message)}</span>`;
  toast.style.display = 'flex';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}


// ================= MODULO 3: ASISTENTE GMAIL =================
function setupGmailModule() {
  const gmailChatInput = document.getElementById('gmail-chat-input');
  const btnSendGmailChat = document.getElementById('btn-send-gmail-chat');
  const btnClearGmailChat = document.getElementById('btn-clear-gmail-chat');

  btnSendGmailChat.addEventListener('click', triggerGmailSendMessage);
  gmailChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') triggerGmailSendMessage();
  });

  btnClearGmailChat.addEventListener('click', async () => {
    if (confirm('¿Seguro que deseas vaciar el historial de conversación?')) {
      try {
        const res = await fetch('/api/gmail/clear', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          renderGmailChat(data);
        }
      } catch (e) {
        console.error(e);
      }
    }
  });

  async function triggerGmailSendMessage() {
    const message = gmailChatInput.value.trim();
    if (!message) return;

    gmailChatInput.value = '';
    appendUserMessage(message);

    try {
      const res = await fetch('/api/gmail/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      if (res.ok) {
        const data = await res.json();
        renderGmailChat(data.chatHistory);
        loadGmailInbox(); // Recargar la bandeja por si cambió algo
      }
    } catch (err) {
      console.error(err);
      appendAssistantMessage('❌ Error de red al comunicarse con el asistente de Gmail.');
    }
  }

  function appendUserMessage(msg) {
    const chatOutput = document.getElementById('gmail-chat-output');
    chatOutput.innerHTML += `
      <div class="msg user">
        <div class="msg-bubble">${escapeHTML(msg)}</div>
      </div>
    `;
    chatOutput.scrollTop = chatOutput.scrollHeight;
  }

  function appendAssistantMessage(msg) {
    const chatOutput = document.getElementById('gmail-chat-output');
    chatOutput.innerHTML += `
      <div class="msg assistant">
        <div class="msg-bubble">${msg}</div>
      </div>
    `;
    chatOutput.scrollTop = chatOutput.scrollHeight;
  }
}

async function loadGmailInbox() {
  const container = document.getElementById('inbox-list-container');
  try {
    const res = await fetch('/api/gmail/inbox');
    if (res.ok) {
      const emails = await res.json();
      
      if (emails.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Bandeja de entrada vacía o sin leer.</p></div>';
      } else {
        container.innerHTML = emails.map(email => `
          <div class="inbox-item">
            <div class="inbox-item-header">
              <span class="inbox-sender">${escapeHTML(email.from)}</span>
              <span class="inbox-date">${new Date(email.date).toLocaleDateString()}</span>
            </div>
            <div class="inbox-subject">${escapeHTML(email.subject)}</div>
          </div>
        `).join('');
      }
    } else {
      container.innerHTML = '<div class="empty-state"><p class="error-text">⚠️ No se pudo conectar al buzón IMAP. Verifica tu configuración en la pestaña de Ajustes.</p></div>';
    }
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error al cargar buzón.</p></div>';
  }
}

async function loadGmailChatHistory() {
  try {
    const res = await fetch('/api/gmail/chat');
    if (res.ok) {
      const history = await res.json();
      renderGmailChat(history);
    }
  } catch (e) {
    console.error(e);
  }
}

function renderGmailChat(chatHistory) {
  const chatOutput = document.getElementById('gmail-chat-output');
  if (chatHistory.length === 0) {
    chatOutput.innerHTML = `
      <div class="msg assistant">
        <div class="msg-bubble">
          Hola zVaito. Tengo acceso a tu Gmail. ¿Qué deseas gestionar?
        </div>
      </div>
    `;
    return;
  }

  chatOutput.innerHTML = chatHistory.map(msg => `
    <div class="msg ${msg.role}">
      <div class="msg-bubble">
        ${msg.role === 'user' ? escapeHTML(msg.content) : formatGmailAssistantMessage(msg.content)}
      </div>
    </div>
  `).join('');
  
  chatOutput.scrollTop = chatOutput.scrollHeight;
}

function formatGmailAssistantMessage(text) {
  // Conversión simple a listas y negritas del bot de Gmail
  let formatted = text.replace(/\n/g, '<br>');
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return formatted;
}


// ================= MODULO 4: GYM TRACKER =================
function setupGymModule() {
  const btnAddDay = document.getElementById('btn-add-gym-day');
  const gymModal = document.getElementById('gym-modal');
  const gymForm = document.getElementById('gym-form');
  const btnAddExerciseField = document.getElementById('btn-add-exercise-field');
  const exercisesInputsContainer = document.getElementById('exercises-list-inputs');
  
  // Cerrar Modales
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => gymModal.classList.add('hidden'));
  });

  btnAddDay.addEventListener('click', () => {
    document.getElementById('gym-day-id').value = '';
    document.getElementById('gym-day-name').value = '';
    exercisesInputsContainer.innerHTML = '';
    document.getElementById('gym-modal-title').textContent = 'Añadir Día de Entrenamiento';
    gymModal.classList.remove('hidden');
    addExerciseInputField(); // Campo inicial
  });

  btnAddExerciseField.addEventListener('click', () => addExerciseInputField());

  function addExerciseInputField(nameValue = '') {
    const rowId = 'ex_row_' + Math.random().toString(36).substr(2, 9);
    const row = document.createElement('div');
    row.className = 'exercise-field-row';
    row.id = rowId;
    row.innerHTML = `
      <input type="text" class="exercise-name-input" required placeholder="Nombre del ejercicio (Ej: Sentadillas)" value="${nameValue}">
      <button type="button" class="btn btn-danger btn-sm" onclick="document.getElementById('${rowId}').remove()"><i class="fa-solid fa-trash"></i></button>
    `;
    exercisesInputsContainer.appendChild(row);
  }

  // Guardar Rutina
  gymForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('gym-day-id').value;
    const dayName = document.getElementById('gym-day-name').value.trim();
    
    // Obtener los nombres de los ejercicios
    const exerciseInputs = document.querySelectorAll('.exercise-name-input');
    const exercises = Array.from(exerciseInputs).map((input, idx) => {
      return {
        id: 'e_' + idx + '_' + Math.random().toString(36).substr(2, 5),
        name: input.value.trim(),
        weight: 0,
        notes: ''
      };
    });

    try {
      const res = await fetch('/api/gym', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id || null, dayName, exercises })
      });

      if (res.ok) {
        const data = await res.json();
        renderGymDays(data.gym);
        gymModal.classList.add('hidden');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Escuchar cambios de peso y notas para auto-guardado
  const gridContainer = document.getElementById('gym-days-grid');
  gridContainer.addEventListener('change', async (e) => {
    if (e.target.classList.contains('gym-weight-input') || e.target.classList.contains('gym-notes-input')) {
      const dayId = e.target.getAttribute('data-day-id');
      const exId = e.target.getAttribute('data-ex-id');
      const isWeight = e.target.classList.contains('gym-weight-input');
      const val = e.target.value;

      try {
        const resGet = await fetch('/api/gym');
        const gymData = await resGet.json();
        const day = gymData.find(d => d.id === dayId);
        
        if (day) {
          const exercise = day.exercises.find(e => e.id === exId);
          if (exercise) {
            if (isWeight) {
              exercise.weight = parseFloat(val) || 0;
            } else {
              exercise.notes = val.trim();
            }

            // Guardar en el backend sin re-renderizar para no perder el foco
            await fetch('/api/gym', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(day)
            });
          }
        }
      } catch (err) {
        console.error('Error al guardar datos de gimnasio:', err);
      }
    }
  });

  // Exponer borrar día
  window.deleteGymDay = async (id) => {
    if (confirm('¿Seguro que deseas eliminar esta rutina?')) {
      try {
        const res = await fetch(`/api/gym/${id}`, { method: 'DELETE' });
        if (res.ok) {
          const data = await res.json();
          renderGymDays(data.gym);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };
}

async function loadGymData() {
  try {
    const res = await fetch('/api/gym');
    if (res.ok) {
      const gym = await res.json();
      renderGymDays(gym);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderGymDays(gymDays) {
  const container = document.getElementById('gym-days-grid');
  if (gymDays.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>No tienes rutinas añadidas. ¡Empieza creando una!</p></div>';
    return;
  }

  container.innerHTML = gymDays.map(day => `
    <div class="gym-card">
      <div class="gym-card-header">
        <h3>${escapeHTML(day.dayName)}</h3>
        <div class="gym-actions">
          <button class="btn btn-danger-link" onclick="deleteGymDay('${day.id}')" title="Eliminar Rutina"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>
      <div class="gym-exercises-list">
        ${day.exercises.map(ex => `
          <div class="gym-exercise-item">
            <div class="gym-exercise-name">${escapeHTML(ex.name)}</div>
            <div class="gym-exercise-inputs">
              <div class="gym-input-row">
                <label>Peso:</label>
                <div class="gym-weight-container">
                  <input type="number" class="gym-weight-input" data-day-id="${day.id}" data-ex-id="${ex.id}" value="${ex.weight || 0}" min="0" step="any">
                  <span>kg</span>
                </div>
              </div>
              <div class="gym-input-row">
                <label>Nota:</label>
                <input type="text" class="gym-notes-input" data-day-id="${day.id}" data-ex-id="${ex.id}" value="${escapeHTML(ex.notes || '')}" placeholder="Ej: Mantener codos cerrados...">
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}


// ================= MODULO 5: MONITOR SITEMAPS =================
function setupSitemapsModule() {
  const formAddSitemap = document.getElementById('form-add-sitemap');
  const btnSitemapCheckNow = document.getElementById('btn-sitemap-check-now');

  formAddSitemap.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('sitemap-site-url').value.trim();
    const sitemapUrl = document.getElementById('sitemap-xml-url').value.trim();

    try {
      const res = await fetch('/api/sitemaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, sitemapUrl })
      });

      if (res.ok) {
        const data = await res.json();
        renderSitemaps(data.sitemaps);
        formAddSitemap.reset();
      }
    } catch (err) {
      console.error(err);
    }
  });

  btnSitemapCheckNow.addEventListener('click', async () => {
    btnSitemapCheckNow.disabled = true;
    btnSitemapCheckNow.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Auditando...';
    
    try {
      const res = await fetch('/api/sitemaps/check-now', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        renderSitemaps(data.sitemaps);
      }
    } catch (e) {
      console.error(e);
    }

    btnSitemapCheckNow.disabled = false;
    btnSitemapCheckNow.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Auditar Todos Ahora';
  });

  window.deleteSitemapSite = async (id) => {
    if (confirm('¿Seguro que deseas eliminar este sitio de sitemaps?')) {
      try {
        const res = await fetch(`/api/sitemaps/${id}`, { method: 'DELETE' });
        if (res.ok) {
          const data = await res.json();
          renderSitemaps(data.sitemaps);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };
}

async function loadSitemapsData() {
  try {
    const res = await fetch('/api/sitemaps');
    if (res.ok) {
      const data = await res.json();
      renderSitemaps(data);
    }
  } catch (e) {
    console.error(e);
  }
}

function renderSitemaps(sitemaps) {
  const body = document.getElementById('sitemaps-table-body');
  if (sitemaps.length === 0) {
    body.innerHTML = '<tr><td colspan="7" class="text-center">No estás monitoreando ningún sitemap.</td></tr>';
    return;
  }

  body.innerHTML = sitemaps.map(site => `
    <tr>
      <td><a href="${site.url}" target="_blank" class="text-muted"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${escapeHTML(site.url)}</a></td>
      <td><a href="${site.sitemapUrl}" target="_blank" style="font-size:0.85rem;" class="text-muted">${escapeHTML(site.sitemapUrl)}</a></td>
      <td><span style="font-size:0.85rem;">${site.lastChecked ? new Date(site.lastChecked).toLocaleString() : 'Nunca'}</span></td>
      <td class="text-center"><strong>${site.actualCount}</strong></td>
      <td class="text-center">${site.expectedCount}</td>
      <td><span class="status-badge status-${site.lastStatus.toLowerCase()}">${site.lastStatus}</span></td>
      <td>
        <button class="btn btn-danger-link" onclick="deleteSitemapSite('${site.id}')"><i class="fa-regular fa-trash-can"></i></button>
      </td>
    </tr>
  `).join('');
}


// ================= MODULO 6: PENTESTING BOT =================
function setupSecurityModule() {
  const formAddTarget = document.getElementById('form-add-security-target');
  const btnRunPentest = document.getElementById('btn-run-pentest');

  formAddTarget.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('security-target-url').value.trim();

    try {
      const res = await fetch('/api/security/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (res.ok) {
        const data = await res.json();
        renderSecurityTargets(data.targets);
        formAddTarget.reset();
      }
    } catch (e) {
      console.error(e);
    }
  });

  btnRunPentest.addEventListener('click', async () => {
    btnRunPentest.disabled = true;
    btnRunPentest.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ejecutando...';

    // Efecto interactivo de consola
    const consoleBox = document.getElementById('security-console');
    consoleBox.innerHTML = '';
    
    appendConsoleLine('[+] Iniciando Bot de Pentesting 24/7...', 'text-success');
    await sleep(800);
    appendConsoleLine('[+] Recuperando objetivos de auditoría activos...', 'text-success');
    await sleep(600);
    
    // Iniciar escaneo en backend
    try {
      const res = await fetch('/api/security/scan-now', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        
        // Simular salida interactiva en consola antes de mostrar resultados
        for (const target of data.targets) {
          appendConsoleLine(`[+] Cargando objetivo: ${target.url}`, 'text-success');
          await sleep(500);
          appendConsoleLine(`[~] Escaneando puertos abiertos de ${target.url}...`, 'text-warn');
          await sleep(700);
          appendConsoleLine(`[~] Comprobando HTTPS y certificados SSL...`, 'text-warn');
          await sleep(600);
          appendConsoleLine(`[~] Solicitando cabeceras de respuesta HTTP y políticas CSP...`, 'text-warn');
          await sleep(800);
          appendConsoleLine(`[~] Escaneando directorios y archivos sensibles (.env, .git, config)...`, 'text-warn');
          await sleep(600);
          
          const logsOfTarget = data.logs.filter(l => l.url === target.url);
          if (logsOfTarget.length > 0) {
            appendConsoleLine(`[!] ¡FALLO DE SEGURIDAD DETECTADO en ${target.url}!`, 'text-err');
            logsOfTarget.forEach(vuln => {
              appendConsoleLine(`    - [${vuln.severity}] ${vuln.title}`, 'text-err');
            });
          } else {
            appendConsoleLine(`[+] Escaneo completado para ${target.url}: SIN VULNERABILIDADES CRÍTICAS.`, 'text-success');
          }
          await sleep(500);
        }
        
        appendConsoleLine('[+] Todos los escaneos de vulnerabilidades han finalizado correctamente.', 'text-success');
        
        // Renderizar datos finales
        renderSecurityTargets(data.targets);
        renderSecurityLogs(data.logs);
      }
    } catch (e) {
      appendConsoleLine('[x] Error al ejecutar el pentest de red.', 'text-err');
    }

    btnRunPentest.disabled = false;
    btnRunPentest.innerHTML = '<i class="fa-solid fa-user-secret"></i> Lanzar Escaneo Completo';
  });

  function appendConsoleLine(text, className = '') {
    const consoleBox = document.getElementById('security-console');
    const div = document.createElement('div');
    div.className = `console-line ${className}`;
    div.textContent = text;
    consoleBox.appendChild(div);
    consoleBox.scrollTop = consoleBox.scrollHeight;
  }

  window.deleteSecurityTarget = async (id) => {
    if (confirm('¿Seguro que deseas eliminar esta web auditada? Se borrarán sus vulnerabilidades.')) {
      try {
        const res = await fetch(`/api/security/targets/${id}`, { method: 'DELETE' });
        if (res.ok) {
          const data = await res.json();
          renderSecurityTargets(data.targets);
          loadSecurityLogs(); // Recargar historial de fallos
        }
      } catch (err) {
        console.error(err);
      }
    }
  };
}

async function loadSecurityData() {
  try {
    const resT = await fetch('/api/security/targets');
    if (resT.ok) {
      const targets = await resT.json();
      renderSecurityTargets(targets);
    }
    
    await loadSecurityLogs();
  } catch (e) {
    console.error(e);
  }
}

async function loadSecurityLogs() {
  try {
    const resL = await fetch('/api/security/logs');
    if (resL.ok) {
      const logs = await resL.json();
      renderSecurityLogs(logs);
    }
  } catch (e) {
    console.error(e);
  }
}

function renderSecurityTargets(targets) {
  const body = document.getElementById('security-targets-table-body');
  if (targets.length === 0) {
    body.innerHTML = '<tr><td colspan="4" class="text-center">No has añadido webs a auditar.</td></tr>';
    return;
  }

  body.innerHTML = targets.map(target => `
    <tr>
      <td><strong>${escapeHTML(target.url)}</strong></td>
      <td>${target.lastScanDate ? new Date(target.lastScanDate).toLocaleString() : 'Nunca'}</td>
      <td>
        <span class="status-badge status-${target.lastScanStatus === 'Seguro' ? 'ok' : target.lastScanStatus === 'Vulnerable' ? 'error' : 'mismatch'}">
          ${target.lastScanStatus}
        </span>
      </td>
      <td>
        <button class="btn btn-danger-link" onclick="deleteSecurityTarget('${target.id}')"><i class="fa-regular fa-trash-can"></i></button>
      </td>
    </tr>
  `).join('');
}

function renderSecurityLogs(logs) {
  const container = document.getElementById('vulnerability-list-container');
  if (logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-circle-check security-safe-icon"></i>
        <p>No se han encontrado vulnerabilidades en tus sitios. Todo parece estar seguro.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = logs.map(vuln => `
    <div class="vuln-item severity-${vuln.severity}">
      <div class="vuln-item-header">
        <h4>${escapeHTML(vuln.title)}</h4>
        <span class="badge badge-${vuln.severity.toLowerCase()}">${vuln.severity}</span>
      </div>
      <div class="vuln-target"><i class="fa-solid fa-link"></i> ${escapeHTML(vuln.url)}</div>
      <p>${escapeHTML(vuln.description)}</p>
      ${vuln.solution ? `
        <div class="vuln-solution">
          <strong><i class="fa-solid fa-screwdriver-wrench"></i> Solución Recomendada:</strong>
          <span>${escapeHTML(vuln.solution)}</span>
        </div>
      ` : ''}
      <div class="text-muted" style="margin-top:12px; font-size:0.75rem;"><i class="fa-regular fa-clock"></i> Detectada el ${new Date(vuln.foundAt).toLocaleString()}</div>
    </div>
  `).join('');
}


// ================= CONFIGURACIÓN DE SETTINGS =================
function setupConfigModule() {
  const form = document.getElementById('config-form');
  const msg = document.getElementById('config-status-msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'status-msg';

    const geminiApiKey = document.getElementById('config-gemini-key').value.trim();
    const gmailUser = document.getElementById('config-gmail-user').value.trim();
    const gmailAppPassword = document.getElementById('config-gmail-pass').value.trim();

    const bodyData = {};
    if (geminiApiKey) bodyData.geminiApiKey = geminiApiKey;
    if (gmailUser) bodyData.gmailUser = gmailUser;
    if (gmailAppPassword) bodyData.gmailAppPassword = gmailAppPassword;

    try {
      const res = await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      if (res.ok) {
        msg.textContent = 'Configuración guardada correctamente y recargada en memoria.';
        msg.classList.add('success');
        
        // Limpiar inputs de contraseña para seguridad
        document.getElementById('config-gemini-key').value = '';
        document.getElementById('config-gmail-pass').value = '';
        
        // Actualizar indicadores globales
        loadGlobalStatus();
      } else {
        msg.textContent = 'Error al guardar la configuración.';
        msg.classList.add('error');
      }
    } catch (err) {
      msg.textContent = 'Error de red.';
      msg.classList.add('error');
    }
  });
}

async function loadConfigData() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const config = await res.json();
      document.getElementById('config-gmail-user').value = config.gmailUser || '';
      
      // Mostrar pistas si ya están configuradas
      if (config.geminiApiKey) {
        document.getElementById('config-gemini-key').placeholder = '✔ Configurada. Introduce una nueva para sobrescribir.';
      }
      if (config.gmailAppPassword) {
        document.getElementById('config-gmail-pass').placeholder = '✔ Configurada. Introduce una nueva para sobrescribir.';
      }
    }
  } catch (err) {
    console.error(err);
  }
}


// ================= UTILIDADES AUXILIARES =================
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ================= STUDYSYNC ARCADE MODULE =================

function setupStudySyncModule() {
  // State
  let ssEvents = [];
  let ssSelectedSlotIds = [];
  let ssActiveTab = 'exam';
  let ssIsLoadingCalendar = false;
  let ssIsGoogleConnected = false;

  // DOM refs
  const statusBanner    = document.getElementById('studysync-status-banner');
  const googleStatusTxt = document.getElementById('studysync-google-status-text');
  const btnConnect      = document.getElementById('btn-connect-google');
  const btnReload       = document.getElementById('btn-reload-calendar');
  const tabExam         = document.getElementById('tab-exam');
  const tabFishing      = document.getElementById('tab-fishing');
  const formExam        = document.getElementById('form-exam');
  const formFishing     = document.getElementById('form-fishing');
  const calendarSlots   = document.getElementById('calendar-slots');
  const missionHours    = document.getElementById('mission-hours');
  const missionProgress = document.getElementById('mission-progress');
  const actionBar       = document.getElementById('studysync-action-bar');
  const actionBarName   = document.getElementById('action-bar-exam-name');
  const actionBarSlots  = document.getElementById('action-bar-slots');
  const btnSaveSync     = document.getElementById('btn-save-sync');
  const btnRefreshCal   = document.getElementById('btn-refresh-calendar');
  const refreshIcon     = document.getElementById('calendar-refresh-icon');
  const examName        = document.getElementById('exam-name');
  const examDate        = document.getElementById('exam-date');
  const examHours       = document.getElementById('exam-hours');
  const weekendPicker   = document.getElementById('weekend-picker');
  const fishingDate     = document.getElementById('fishing-date');
  const fishingStart    = document.getElementById('fishing-start');
  const fishingEnd      = document.getElementById('fishing-end');
  const fishingWarning  = document.getElementById('fishing-weekend-warning');
  const btnSubmitFish   = document.getElementById('btn-submit-fishing');

  if (!statusBanner) return; // Module not rendered yet

  // Set default date for exam
  examDate.value = new Date().toISOString().split('T')[0];

  // === BANNER ===
  function showBanner(type, message) {
    statusBanner.className = `studysync-banner ${type}`;
    statusBanner.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'circle-xmark' : 'triangle-exclamation'}"></i> ${message}`;
    statusBanner.classList.remove('hidden');
    setTimeout(() => statusBanner.classList.add('hidden'), 7000);
  }

  // === GOOGLE CONNECTION STATUS ===
  async function checkGoogleStatus() {
    try {
      const res = await fetch('/api/studysync/status');
      const data = await res.json();
      ssIsGoogleConnected = data.connected;
      if (ssIsGoogleConnected) {
        googleStatusTxt.textContent = '✓ Conectado a Google Calendar';
        googleStatusTxt.style.color = '#00db8b';
        btnConnect.style.display = 'none';
        btnReload.style.display = 'inline-flex';
        loadCalendarEvents();
      } else {
        googleStatusTxt.textContent = 'No conectado. Haz clic para conectar tu cuenta.';
        googleStatusTxt.style.color = '';
        btnConnect.style.display = 'inline-flex';
        btnReload.style.display = 'none';
      }
    } catch (e) {
      googleStatusTxt.textContent = 'Error al verificar conexión.';
    }
  }

  // Only check status when the panel becomes visible
  const studySyncSection = document.getElementById('panel-studysync');
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.target === studySyncSection && studySyncSection.classList.contains('active') && !ssIsGoogleConnected) {
        checkGoogleStatus();
        observer.disconnect();
        break;
      }
    }
  });
  if (studySyncSection) observer.observe(studySyncSection, { attributes: true, attributeFilter: ['class'] });

  // === GOOGLE AUTH ===
  btnConnect.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/studysync/oauth/start');
      const data = await res.json();
      if (data.url) {
        const popup = window.open(data.url, 'google-oauth', 'width=500,height=620,top=100,left=200');
        const handler = async (e) => {
          if (e.data?.type === 'GOOGLE_AUTH_SUCCESS') {
            window.removeEventListener('message', handler);
            await checkGoogleStatus();
            showBanner('success', '¡Cuenta de Google conectada correctamente!');
          } else if (e.data?.type === 'GOOGLE_AUTH_ERROR') {
            window.removeEventListener('message', handler);
            showBanner('error', `Error al autenticar: ${e.data.error}`);
          }
        };
        window.addEventListener('message', handler);
      }
    } catch (e) {
      showBanner('error', 'Error iniciando la autenticación con Google.');
    }
  });

  btnReload.addEventListener('click', () => loadCalendarEvents());
  btnRefreshCal.addEventListener('click', () => loadCalendarEvents());

  // === LOAD CALENDAR EVENTS ===
  async function loadCalendarEvents() {
    if (ssIsLoadingCalendar) return;
    ssIsLoadingCalendar = true;
    refreshIcon.classList.add('fa-spin');
    btnRefreshCal.disabled = true;
    calendarSlots.innerHTML = '<div class="calendar-empty"><i class="fa-solid fa-rotate-right fa-spin" style="color:#facc15;font-size:1.5rem"></i><p>Cargando eventos de Google Calendar...</p></div>';

    try {
      const res = await fetch('/api/studysync/calendar/events');
      const json = await res.json();
      if (json.success && json.data) {
        ssEvents = json.data;
        ssSelectedSlotIds = [];
        renderCalendarSlots();
      } else {
        calendarSlots.innerHTML = `<div class="calendar-empty"><i class="fa-solid fa-circle-xmark" style="color:#ff4757"></i><p>${json.error || 'Error al cargar eventos.'}</p></div>`;
        if (json.error?.includes('autenticado') || json.error?.includes('No autenticado')) {
          ssIsGoogleConnected = false;
          googleStatusTxt.textContent = 'Sesión expirada. Vuelve a conectar tu cuenta.';
          googleStatusTxt.style.color = '#ff4757';
          btnConnect.style.display = 'inline-flex';
          btnReload.style.display = 'none';
        }
      }
    } catch (e) {
      calendarSlots.innerHTML = '<div class="calendar-empty"><i class="fa-solid fa-wifi" style="color:#ff4757"></i><p>Error de conexión al cargar el calendario.</p></div>';
    } finally {
      ssIsLoadingCalendar = false;
      refreshIcon.classList.remove('fa-spin');
      btnRefreshCal.disabled = false;
    }
  }

  // === RENDER CALENDAR ===
  function renderCalendarSlots() {
    const maxSlots = parseInt(examHours.value, 10) || 2;
    missionHours.textContent = maxSlots;
    const prog = ssSelectedSlotIds.length;
    missionProgress.innerHTML = `Completado: <strong style="color:${prog === maxSlots ? '#facc15' : '#fbbf24'}">${prog} / ${maxSlots} horas</strong>${prog === maxSlots ? ' <i class="fa-solid fa-check-circle" style="color:#facc15"></i>' : ''}`;

    // Update action bar
    if (ssActiveTab === 'exam') {
      actionBar.classList.remove('hidden');
      actionBarName.textContent = examName.value || 'Sin nombre';
      actionBarSlots.textContent = `${ssSelectedSlotIds.length} seleccionados`;
    } else {
      actionBar.classList.add('hidden');
    }

    if (!ssEvents.length) {
      calendarSlots.innerHTML = '<div class="calendar-empty"><i class="fa-solid fa-calendar-xmark"></i><p>Sin bloques libres disponibles. Asegúrate de tener espacio libre en tu Google Calendar en los próximos 14 días.</p></div>';
      return;
    }

    // Group by date
    const grouped = {};
    for (const ev of ssEvents) {
      if (!ev.start) continue;
      const dateKey = ev.start.split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(ev);
    }

    const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

    let html = '';
    for (const [dateStr, daySlots] of Object.entries(grouped)) {
      const d = new Date(dateStr + 'T12:00:00');
      const dayName = days[d.getDay()];
      const label = `${dayName.charAt(0).toUpperCase()+dayName.slice(1)} ${d.getDate()} de ${months[d.getMonth()]}`;

      html += `<div class="calendar-day-group">`;
      html += `<div class="calendar-day-label"><span class="dot"></span>${label}</div>`;
      html += `<div class="calendar-slots-grid">`;

      for (const slot of daySlots) {
        const startT = slot.start.split('T')[1]?.substring(0,5) || '';
        const endT   = slot.end.split('T')[1]?.substring(0,5) || '';
        const isSelected = ssSelectedSlotIds.includes(slot.id);

        if (slot.isFishing) {
          html += `<div class="slot-fishing-card">
            <div class="slot-fishing-time"><i class="fa-solid fa-fish"></i> ${startT} - ${endT}</div>
            <span class="slot-fishing-badge">Pesca 🎣</span>
          </div>`;
          continue;
        }

        const nightBadge = slot.isDefaultNightSlot
          ? `<span class="slot-night-badge"><i class="fa-solid fa-moon"></i>Noche</span>` : '';

        html += `<button class="slot-btn${slot.isDefaultNightSlot ? ' night' : ''}${isSelected ? ' selected' : ''}" data-slot-id="${slot.id}">
          <div>
            <div class="slot-time"><i class="fa-solid fa-clock"></i>${startT} - ${endT} ${nightBadge}</div>
            <div class="slot-summary">${slot.summary}</div>
          </div>
          <div class="slot-check">${isSelected ? '<i class="fa-solid fa-check"></i>' : '+'}</div>
        </button>`;
      }

      html += `</div></div>`;
    }

    calendarSlots.innerHTML = html;

    // Attach slot click handlers
    calendarSlots.querySelectorAll('.slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const slotId = btn.dataset.slotId;
        const maxSlots = parseInt(examHours.value, 10) || 2;
        const isAlready = ssSelectedSlotIds.includes(slotId);
        if (isAlready) {
          ssSelectedSlotIds = ssSelectedSlotIds.filter(id => id !== slotId);
        } else {
          if (ssSelectedSlotIds.length >= maxSlots) {
            ssSelectedSlotIds = [...ssSelectedSlotIds.slice(1), slotId];
          } else {
            ssSelectedSlotIds.push(slotId);
          }
        }
        renderCalendarSlots();
      });
    });
  }

  // === TABS ===
  tabExam.addEventListener('click', () => {
    ssActiveTab = 'exam';
    tabExam.classList.add('active');
    tabFishing.classList.remove('active');
    formExam.classList.remove('hidden');
    formFishing.classList.add('hidden');
    actionBar.classList.remove('hidden');
    renderCalendarSlots();
  });

  tabFishing.addEventListener('click', () => {
    ssActiveTab = 'fishing';
    tabFishing.classList.add('active');
    tabExam.classList.remove('active');
    formFishing.classList.remove('hidden');
    formExam.classList.add('hidden');
    actionBar.classList.add('hidden');
    buildWeekendPicker();
  });

  // Live update action bar & calendar as exam params change
  examName.addEventListener('input', () => renderCalendarSlots());
  examHours.addEventListener('change', () => { ssSelectedSlotIds = []; renderCalendarSlots(); });

  // === WEEKEND PICKER ===
  function buildWeekendPicker() {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 28; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dow = d.getDay();
      if (dow === 6 || dow === 0) {
        const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
        const dateStr = `${y}-${m}-${day}`;
        const dayName = dow === 6 ? 'Sábado' : 'Domingo';
        const months2 = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
        const label = `${d.getDate()} de ${months2[d.getMonth()]}`;
        options.push({ dateStr, dayName, label, isSat: dow === 6 });
      }
    }

    const currentDate = fishingDate.value || (options[0]?.dateStr || '');
    if (!fishingDate.value && options[0]) fishingDate.value = options[0].dateStr;

    weekendPicker.innerHTML = options.map(opt => `
      <button type="button" class="weekend-btn${opt.dateStr === currentDate ? ' selected' : ''}" data-date="${opt.dateStr}">
        <span class="day-name ${opt.isSat ? 'sat' : 'sun'}">${opt.dayName}</span>
        ${opt.label}
      </button>
    `).join('');

    weekendPicker.querySelectorAll('.weekend-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        fishingDate.value = btn.dataset.date;
        buildWeekendPicker();
        validateFishingDate();
      });
    });
  }

  function validateFishingDate() {
    if (!fishingDate.value) return true;
    const [y, m, d] = fishingDate.value.split('-').map(Number);
    const dow = new Date(y, m-1, d).getDay();
    const valid = dow === 6 || dow === 0;
    fishingWarning.classList.toggle('hidden', valid);
    return valid;
  }

  fishingDate.addEventListener('change', () => {
    validateFishingDate();
    buildWeekendPicker();
  });

  // === FISHING SUBMIT ===
  btnSubmitFish.addEventListener('click', async () => {
    if (!validateFishingDate()) return showBanner('error', 'La jornada de pesca solo puede programarse en Sábado o Domingo.');
    if (!fishingDate.value || !fishingStart.value || !fishingEnd.value) return showBanner('error', 'Fecha, hora de inicio y hora de fin son obligatorios.');
    if (fishingStart.value >= fishingEnd.value) return showBanner('error', 'La hora de inicio debe ser anterior a la hora de fin.');

    btnSubmitFish.disabled = true;
    btnSubmitFish.innerHTML = '<div class="loading-spinner"></div> Procesando Jornada...';

    try {
      const res = await fetch('/api/studysync/fishing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: fishingDate.value, startTime: fishingStart.value, endTime: fishingEnd.value })
      });
      const json = await res.json();
      if (json.success) {
        showBanner('success', json.message);
        loadCalendarEvents();
      } else {
        showBanner('error', json.error || 'Error al programar la jornada de pesca.');
      }
    } catch (e) {
      showBanner('error', 'Error de conexión con el servidor.');
    } finally {
      btnSubmitFish.disabled = false;
      btnSubmitFish.innerHTML = '<i class="fa-solid fa-fish"></i> Programar Jornada de Pesca';
    }
  });

  // === EXAM SAVE & SYNC ===
  btnSaveSync.addEventListener('click', async () => {
    if (!examName.value.trim()) return showBanner('error', 'El nombre del examen es obligatorio.');
    const reqSlots = parseInt(examHours.value, 10) || 2;
    if (ssSelectedSlotIds.length !== reqSlots) return showBanner('error', `Debes seleccionar exactamente ${reqSlots} horas. Tienes ${ssSelectedSlotIds.length} seleccionadas.`);

    btnSaveSync.disabled = true;
    btnSaveSync.innerHTML = '<div class="loading-spinner" style="border-color:rgba(0,0,0,0.2);border-top-color:#000"></div> Sincronizando...';

    try {
      const res = await fetch('/api/studysync/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam: { name: examName.value, date: examDate.value, effortLevel: examHours.value },
          selectedSlotIds: ssSelectedSlotIds,
          allSlots: ssEvents
        })
      });
      const json = await res.json();
      if (json.success) {
        showBanner('success', json.message);
        ssSelectedSlotIds = [];
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadCalendarEvents();
      } else {
        showBanner('error', json.error || 'Error al sincronizar el examen.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) {
      showBanner('error', 'Error de conexión al sincronizar.');
    } finally {
      btnSaveSync.disabled = false;
      btnSaveSync.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Guardar y Sincronizar Examen';
    }
  });
}

// ================= CALIFICACIONES MODULE =================

let gradesList = [];
let gradesSubjects = [
  'Matemáticas',
  'FyQ',
  'Dibujo Técnico',
  'Filosofía',
  'Tecnología',
  'Lengua'
];
let currentGradeFilter = 'all';

function getGradeTier(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return { label: '—', class: '', avgClass: '' };
  if (n >= 8.5) return { label: 'Sobresaliente', class: 'grade-excellent', avgClass: 'avg-excellent' };
  if (n >= 6.5) return { label: 'Notable',       class: 'grade-good',      avgClass: 'avg-good' };
  if (n >= 5.0) return { label: 'Aprobado',      class: 'grade-pass',      avgClass: 'avg-pass' };
  return               { label: 'Suspenso',      class: 'grade-fail',      avgClass: 'avg-fail' };
}

function showGradesBanner(type, message) {
  const banner = document.getElementById('grades-banner');
  if (!banner) return;
  banner.className = `grades-banner ${type}`;
  banner.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> <span>${escapeHTML(message)}</span>`;
  banner.classList.remove('hidden');
  setTimeout(() => {
    banner.classList.add('hidden');
  }, 4500);
}

async function loadGradesData() {
  try {
    const res = await fetch('/api/grades');
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      if (Array.isArray(data.subjects) && data.subjects.length > 0) {
        gradesSubjects = data.subjects;
      }
      gradesList = Array.isArray(data.entries) ? data.entries : [];
      renderSubjectDropdowns();
      renderGradesOverview();
      renderGradesTable();
    }
  } catch (err) {
    console.error('Error cargando calificaciones:', err);
  }
}

function renderSubjectDropdowns() {
  const selectSubject = document.getElementById('grade-subject');
  const filterSubject = document.getElementById('grades-filter-subject');

  if (selectSubject) {
    const curVal = selectSubject.value;
    selectSubject.innerHTML = gradesSubjects
      .map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`)
      .join('');
    if (curVal && gradesSubjects.includes(curVal)) {
      selectSubject.value = curVal;
    }
  }

  if (filterSubject) {
    const curFilter = filterSubject.value || currentGradeFilter;
    filterSubject.innerHTML = `<option value="all">Todas las asignaturas</option>` +
      gradesSubjects.map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('');
    if (gradesSubjects.includes(curFilter) || curFilter === 'all') {
      filterSubject.value = curFilter;
      currentGradeFilter = curFilter;
    }
  }
}

function renderGradesOverview() {
  const overview = document.getElementById('grades-overview');
  if (!overview) return;

  // Media global
  let globalAvgHtml = '—';
  let globalCount = gradesList.length;
  let globalTierClass = '';

  if (globalCount > 0) {
    const sum = gradesList.reduce((acc, g) => acc + (parseFloat(g.value) || 0), 0);
    const avg = sum / globalCount;
    const tier = getGradeTier(avg);
    globalAvgHtml = avg.toFixed(2);
    globalTierClass = tier.avgClass;
  }

  let html = `
    <div class="grades-overview-card" style="border-color: rgba(167,139,250,0.4); cursor: pointer;" onclick="filterGradesSubject('all')">
      <div class="grades-overview-subject"><i class="fa-solid fa-calculator"></i> MEDIA GLOBAL</div>
      <div class="grades-overview-avg ${globalTierClass}">${globalAvgHtml}</div>
      <div class="grades-overview-count">${globalCount} nota${globalCount === 1 ? '' : 's'} en total</div>
    </div>
  `;

  // Medias por cada asignatura
  gradesSubjects.forEach(sub => {
    const subGrades = gradesList.filter(g => g.subject === sub);
    const count = subGrades.length;
    let avgText = '—';
    let avgClass = '';

    if (count > 0) {
      const sum = subGrades.reduce((acc, g) => acc + (parseFloat(g.value) || 0), 0);
      const avg = sum / count;
      avgText = avg.toFixed(2);
      avgClass = getGradeTier(avg).avgClass;
    }

    const isActive = currentGradeFilter === sub ? 'style="border-color:#a78bfa; background:rgba(167,139,250,0.15);"' : '';

    html += `
      <div class="grades-overview-card" ${isActive} style="cursor: pointer;" onclick="filterGradesSubject('${escapeHTML(sub)}')">
        <div class="grades-overview-subject" title="${escapeHTML(sub)}">${escapeHTML(sub)}</div>
        <div class="grades-overview-avg ${avgClass}">${avgText}</div>
        <div class="grades-overview-count">${count} nota${count === 1 ? '' : 's'}</div>
      </div>
    `;
  });

  overview.innerHTML = html;
}

window.filterGradesSubject = function(sub) {
  currentGradeFilter = sub;
  const filterSelect = document.getElementById('grades-filter-subject');
  if (filterSelect) filterSelect.value = sub;
  renderGradesOverview();
  renderGradesTable();
};

function renderGradesTable() {
  const container = document.getElementById('grades-table-body');
  if (!container) return;

  const filtered = currentGradeFilter === 'all'
    ? gradesList
    : gradesList.filter(g => g.subject === currentGradeFilter);

  if (filtered.length === 0) {
    const subMsg = currentGradeFilter === 'all'
      ? 'Aún no hay notas registradas.<br>Añade tu primera calificación en el formulario.'
      : `No hay notas registradas para <strong>${escapeHTML(currentGradeFilter)}</strong>.`;

    container.innerHTML = `
      <div class="grades-empty">
        <i class="fa-solid fa-inbox"></i>
        <p>${subMsg}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(g => {
    const tier = getGradeTier(g.value);
    const numDisplay = Number(g.value).toFixed(1);
    const labelText = g.label ? escapeHTML(g.label) : 'Calificación';
    const dateFormatted = g.date ? escapeHTML(g.date) : 'Sin fecha';

    return `
      <div class="grade-row" id="grade-row-${g.id}">
        <div class="grade-badge ${tier.class}" title="${tier.label}">${numDisplay}</div>
        <div class="grade-row-info">
          <div class="grade-row-subject">${escapeHTML(g.subject)}</div>
          <div class="grade-row-label">${labelText}</div>
          <div class="grade-row-date"><i class="fa-regular fa-calendar"></i> ${dateFormatted} · ${tier.label}</div>
        </div>
        <button class="btn-del-grade" onclick="deleteGrade('${g.id}')" title="Eliminar nota">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
  }).join('');
}

window.deleteGrade = async function(id) {
  if (!confirm('¿Seguro que deseas eliminar esta calificación?')) return;
  try {
    const res = await fetch(`/api/grades/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      gradesList = gradesList.filter(g => g.id !== id);
      renderGradesOverview();
      renderGradesTable();
      showGradesBanner('success', 'Calificación eliminada.');
    } else {
      showGradesBanner('error', data.error || 'Error al eliminar');
    }
  } catch (err) {
    showGradesBanner('error', 'Error de conexión.');
  }
};

function setupGradesModule() {
  const valInput = document.getElementById('grade-value');
  const previewBadge = document.getElementById('grade-preview-badge');
  const btnAdd = document.getElementById('btn-add-grade');
  const subjectSelect = document.getElementById('grade-subject');
  const labelInput = document.getElementById('grade-label');
  const dateInput = document.getElementById('grade-date');
  const newSubjectInput = document.getElementById('new-subject-name');
  const btnAddSubject = document.getElementById('btn-add-subject');
  const filterSubject = document.getElementById('grades-filter-subject');

  // Inicializar fecha con hoy
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  // Preview dinámico de la nota al escribir
  if (valInput && previewBadge) {
    valInput.addEventListener('input', () => {
      const val = parseFloat(valInput.value);
      if (isNaN(val) || valInput.value === '') {
        previewBadge.textContent = '—';
        previewBadge.className = 'grade-badge-lg';
      } else {
        const tier = getGradeTier(val);
        previewBadge.textContent = val.toFixed(1);
        previewBadge.className = `grade-badge-lg ${tier.class}`;
      }
    });
  }

  // Añadir nota
  if (btnAdd) {
    btnAdd.addEventListener('click', async () => {
      const subject = subjectSelect ? subjectSelect.value : '';
      const rawVal = valInput ? valInput.value : '';
      const label = labelInput ? labelInput.value.trim() : '';
      const date = dateInput ? dateInput.value : '';

      if (!subject) return showGradesBanner('error', 'Selecciona una asignatura.');
      if (rawVal === '') return showGradesBanner('error', 'Introduce una nota.');

      const numVal = parseFloat(rawVal);
      if (isNaN(numVal) || numVal < 0 || numVal > 10) {
        return showGradesBanner('error', 'La nota debe estar entre 0 y 10.');
      }

      btnAdd.disabled = true;
      btnAdd.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

      try {
        const res = await fetch('/api/grades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, value: numVal, label, date })
        });
        const data = await res.json();
        if (data.success) {
          showGradesBanner('success', `¡Nota de ${subject} guardada correctamente!`);
          if (data.entry) {
            gradesList.unshift(data.entry);
          }
          if (valInput) {
            valInput.value = '';
            if (previewBadge) {
              previewBadge.textContent = '—';
              previewBadge.className = 'grade-badge-lg';
            }
          }
          if (labelInput) labelInput.value = '';
          renderGradesOverview();
          renderGradesTable();
        } else {
          showGradesBanner('error', data.error || 'Error al guardar calificación.');
        }
      } catch (err) {
        showGradesBanner('error', 'Error de conexión con el servidor.');
      } finally {
        btnAdd.disabled = false;
        btnAdd.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir Nota';
      }
    });
  }

  // Añadir asignatura personalizada
  async function handleAddCustomSubject() {
    if (!newSubjectInput) return;
    const name = newSubjectInput.value.trim();
    if (!name) return showGradesBanner('error', 'Escribe el nombre de la asignatura.');

    try {
      const res = await fetch('/api/grades/subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.subjects)) {
          gradesSubjects = data.subjects;
        } else if (!gradesSubjects.includes(name)) {
          gradesSubjects.push(name);
        }
        newSubjectInput.value = '';
        renderSubjectDropdowns();
        renderGradesOverview();
        if (subjectSelect) subjectSelect.value = name;
        showGradesBanner('success', `Asignatura "${name}" añadida.`);
      } else {
        showGradesBanner('error', data.error || 'Error al añadir asignatura.');
      }
    } catch (e) {
      showGradesBanner('error', 'Error al comunicar con el servidor.');
    }
  }

  if (btnAddSubject) {
    btnAddSubject.addEventListener('click', handleAddCustomSubject);
  }
  if (newSubjectInput) {
    newSubjectInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomSubject();
      }
    });
  }

  // Filtrar notas
  if (filterSubject) {
    filterSubject.addEventListener('change', () => {
      currentGradeFilter = filterSubject.value;
      renderGradesOverview();
      renderGradesTable();
    });
  }
}


