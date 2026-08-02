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
    try {
      const res = await fetch('/api/sales/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptText })
      });
      
      if (res.ok) {
        const data = await res.json();
        renderSalesAdvice(data.advice);
        salesAiStatus.textContent = 'Actualizado';
      } else {
        salesAiStatus.textContent = 'Error';
      }
    } catch (err) {
      console.error('Error obteniendo consejos de venta:', err);
      salesAiStatus.textContent = 'Error Red';
    }
  }

  function renderSalesAdvice(adviceMarkdown) {
    // Convertir de forma simple las viñetas a HTML limpio
    let htmlContent = '<div class="advice-block">';
    htmlContent += '<h4><i class="fa-solid fa-lightbulb"></i> Consejos Tácticos de Cierre</h4>';
    
    const lines = adviceMarkdown.split('\n');
    let inList = false;

    lines.forEach(line => {
      const cleanLine = line.trim();
      if (cleanLine.startsWith('-') || cleanLine.startsWith('*')) {
        if (!inList) {
          htmlContent += '<ul>';
          inList = true;
        }
        // Reemplazar marcadores de negrita **texto**
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


// ================= MODULO 2: CAPTADOR B2B =================
function setupLeadsModule() {
  const btnTriggerLeads = document.getElementById('btn-trigger-leads');
  
  btnTriggerLeads.addEventListener('click', async () => {
    btnTriggerLeads.disabled = true;
    btnTriggerLeads.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';
    
    try {
      const res = await fetch('/api/leads/trigger', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        renderLeads(data.productIdeas, data.leadsList);
      }
    } catch (e) {
      console.error(e);
    }
    
    btnTriggerLeads.disabled = false;
    btnTriggerLeads.innerHTML = '<i class="fa-solid fa-rotate"></i> Forzar Ejecución 24/7';
  });
}

async function loadLeadsData() {
  try {
    const res = await fetch('/api/leads');
    if (res.ok) {
      const data = await res.json();
      renderLeads(data.productIdeas, data.leadsList);
    }
  } catch (err) {
    console.error('Error cargando leads:', err);
  }
}

function renderLeads(ideas, leads) {
  const ideasContainer = document.getElementById('ideas-list-container');
  const leadsTableBody = document.getElementById('leads-table-body');

  // 1. Renderizar Ideas
  if (ideas.length === 0) {
    ideasContainer.innerHTML = '<div class="empty-state"><p>Aún no hay ideas creadas. Presiona "Forzar Ejecución" para iniciar.</p></div>';
  } else {
    ideasContainer.innerHTML = ideas.map(idea => `
      <div class="idea-card">
        <h4>${idea.title}</h4>
        <p>${idea.description}</p>
        <div class="idea-details">
          <div><strong>Mercado:</strong> ${idea.marketNeeds}</div>
          <div><strong>Stack:</strong> ${idea.techStack}</div>
          <div class="text-muted" style="margin-top:8px; font-size:0.75rem;"><i class="fa-regular fa-clock"></i> ${new Date(idea.createdAt).toLocaleString()}</div>
        </div>
      </div>
    `).join('');
  }

  // 2. Renderizar Clientes Potenciales
  if (leads.length === 0) {
    leadsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay clientes potenciales aún. Presiona "Forzar Ejecución".</td></tr>';
  } else {
    leadsTableBody.innerHTML = leads.map(lead => {
      // Propuesta rápida de email a copiar
      const emailSubject = encodeURIComponent(`Propuesta de mejora web para tu negocio - Desarrollo Web`);
      const emailBody = encodeURIComponent(`Hola ${lead.name},\n\nHe estado revisando tu sitio web (${lead.website}) y he notado algunos puntos clave de mejora:\n\n- ${lead.whyTheyNeedWebDev}\n\nMe encantaría presentarte una propuesta rápida de software o rediseño para solucionar esto y ayudarte a conseguir más clientes.\n\n¿Te vendría bien una breve llamada de 5 minutos?\n\nUn saludo,\nzVaito`);
      const mailtoUrl = `mailto:${lead.phone.includes('@') ? lead.phone : ''}?subject=${emailSubject}&body=${emailBody}`;

      return `
        <tr>
          <td><strong>${lead.name}</strong></td>
          <td><span class="lead-status">${lead.industry}</span></td>
          <td><a href="https://${lead.website}" target="_blank" class="text-muted"><i class="fa-solid fa-earth-americas"></i> ${lead.website}</a></td>
          <td><div style="max-width:320px; font-size:0.85rem; line-height:1.4;">${lead.whyTheyNeedWebDev}</div></td>
          <td><span style="font-size:0.85rem;">${lead.phone}</span></td>
          <td>
            <a href="${mailtoUrl}" class="btn btn-secondary btn-sm" title="Enviar Propuesta por Email">
              <i class="fa-regular fa-envelope"></i> Contactar
            </a>
          </td>
        </tr>
      `;
    }).join('');
  }
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
      <div class="text-muted" style="margin-top:10px; font-size:0.75rem;"><i class="fa-regular fa-clock"></i> Detectada el ${new Date(vuln.foundAt).toLocaleString()}</div>
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
