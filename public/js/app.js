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

// Carga Inicial Resiliente
document.addEventListener('DOMContentLoaded', async () => {
  // Configurar ruteador y botones primero para respuesta táctil instantánea
  try { setupRouter(); } catch(e) { console.error('Error al inicializar router:', e); }

  // Cada módulo se inicializa de forma aislada para que un fallo nunca congele la app
  try { setupAgentsModule(); } catch(e) { console.error('Error en setupAgentsModule:', e); }
  try { setupGymModule(); } catch(e) { console.error('Error en setupGymModule:', e); }
  try { setupSitemapsModule(); } catch(e) { console.error('Error en setupSitemapsModule:', e); }
  try { setupSecurityModule(); } catch(e) { console.error('Error en setupSecurityModule:', e); }
  try { setupSalesModule(); } catch(e) { console.error('Error en setupSalesModule:', e); }
  try { setupConfigModule(); } catch(e) { console.error('Error en setupConfigModule:', e); }
  try { setupLeadsModule(); } catch(e) { console.error('Error en setupLeadsModule:', e); }
  try { setupStudySyncModule(); } catch(e) { console.error('Error en setupStudySyncModule:', e); }
  try { setupGradesModule(); } catch(e) { console.error('Error en setupGradesModule:', e); }

  // Verificación de sesión en segundo plano sin bloquear interacción
  verifySession().catch(e => console.error('Error en verifySession:', e));
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
      
      if (statusGeminiVal) {
        if (config.geminiApiKey) {
          statusGeminiVal.textContent = 'Activo';
          statusGeminiVal.classList.remove('err');
        } else {
          statusGeminiVal.textContent = 'Sin config';
          statusGeminiVal.classList.add('err');
        }
      }

      if (statusGmailVal) {
        if (config.gmailUser && config.gmailAppPassword) {
          statusGmailVal.textContent = 'Conectado';
          statusGmailVal.classList.remove('err');
        } else {
          statusGmailVal.textContent = 'Sin config';
          statusGmailVal.classList.add('err');
        }
      }
    }
  } catch (e) {
    console.error('Error cargando estado global:', e);
  }
}

function loadDashboardData() {
  // Carga silenciosa en segundo plano para que los paneles tengan datos frescos
  loadAgentsData();
  loadLeadsData();
  loadGymData();
  loadSitemapsData();
  loadSecurityData();
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
  if (btnNavConfig) {
    btnNavConfig.addEventListener('click', () => showPanel('panel-config'));
  }

  // Navegación de Cabecera: Panel de Vida y Cabina Ventas
  const navBtnLife = document.getElementById('nav-btn-life');
  if (navBtnLife) {
    navBtnLife.addEventListener('click', () => showPanel('panel-agents'));
  }

  const navBtnCabina = document.getElementById('nav-btn-cabina');
  if (navBtnCabina) {
    navBtnCabina.addEventListener('click', () => showPanel('panel-sales'));
  }

  // Banner y Botones Hero en Dashboard
  const bannerOpenAgents = document.getElementById('banner-open-agents');
  if (bannerOpenAgents) {
    bannerOpenAgents.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        showPanel('panel-agents');
      }
    });
  }

  const btnHeroAgents = document.getElementById('btn-hero-agents');
  if (btnHeroAgents) {
    btnHeroAgents.addEventListener('click', (e) => {
      e.stopPropagation();
      showPanel('panel-agents');
    });
  }

  const btnHeroChat = document.getElementById('btn-hero-chat');
  if (btnHeroChat) {
    btnHeroChat.addEventListener('click', (e) => {
      e.stopPropagation();
      showPanel('panel-agents');
      setTimeout(() => {
        const inp = document.getElementById('orch-input-text');
        if (inp) inp.focus();
      }, 150);
    });
  }
}

function showPanel(panelId) {
  panels.forEach(p => p.classList.remove('active'));
  const target = document.getElementById(panelId);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Actualizar estado activo en botones superiores
    const navBtnLife = document.getElementById('nav-btn-life');
    const navBtnCabina = document.getElementById('nav-btn-cabina');
    if (navBtnLife) navBtnLife.classList.toggle('active', panelId === 'panel-agents');
    if (navBtnCabina) navBtnCabina.classList.toggle('active', panelId === 'panel-sales');
    
    // Cargas de datos bajo demanda específicas al abrir paneles
    if (panelId === 'panel-agents') loadAgentsData();
    if (panelId === 'panel-leads') loadLeadsData();
    if (panelId === 'panel-gym') loadGymData();
    if (panelId === 'panel-sitemaps') loadSitemapsData();
    if (panelId === 'panel-security') loadSecurityData();
    if (panelId === 'panel-config') loadConfigData();
    if (panelId === 'panel-grades') loadGradesData();
  }
}


// ================= CABINA VENTAS · MOTOR COMPLETO VEROX =================
let cabinaQueue = [];
let cabinaCurrentIndex = 0;
let cabinaObjections = [];
let cabinaActiveStep = 1;
let cabinaCallTimerInterval = null;
let cabinaCallSeconds = 0;
let cabinaIsListening = false;
let cabinaRecognition = null;
let cabinaTalkWordsYou = 0;
let cabinaTalkWordsClient = 0;
let cabinaLastCoachCallTime = 0;
let cabinaLastClientPhrase = '';
let cabinaUndoTimer = null;
let cabinaLastInteractionId = null;
let cabinaSelectedSlot = '';
let cabinaLiveTranscriptArray = [];

function setupSalesModule() {
  // Inicialización de selectores
  const btnPrev = document.getElementById('cabina-btn-prev');
  const btnNext = document.getElementById('cabina-btn-next');
  const prospectSelect = document.getElementById('cabina-prospect-select');
  const btnCallPrimary = document.getElementById('btn-call-primary');
  const btnCoachListen = document.getElementById('btn-coach-listen');
  const btnCoachTestAudio = document.getElementById('btn-coach-test-audio');
  const btnClearTranscript = document.getElementById('btn-clear-transcript');
  const btnAskNewObjection = document.getElementById('btn-ask-new-objection');
  const inputNewObjection = document.getElementById('input-new-objection');
  const btnCabinaUndo = document.getElementById('btn-cabina-undo');
  const btnNextProspectDirect = document.getElementById('btn-next-prospect-direct');
  const btnOpenModelCalls = document.getElementById('btn-open-model-calls');
  const btnOpenImport = document.getElementById('btn-open-import');
  const btnCloseDiagModal = document.getElementById('btn-close-diag-modal');
  const btnCloseModelModal = document.getElementById('btn-close-model-modal');
  const btnCloseImportModal = document.getElementById('btn-close-import-modal');
  const btnDiagNextCall = document.getElementById('btn-diag-next-call');
  const btnSubmitImport = document.getElementById('btn-submit-import');

  // Inicializar carga de datos
  loadCabinaQueue();

  // Navegación de empresas
  if (btnPrev) btnPrev.addEventListener('click', () => navigateCabinaQueue(-1));
  if (btnNext) btnNext.addEventListener('click', () => navigateCabinaQueue(1));
  if (btnNextProspectDirect) btnNextProspectDirect.addEventListener('click', () => navigateCabinaQueue(1));
  if (prospectSelect) {
    prospectSelect.addEventListener('change', (e) => {
      cabinaCurrentIndex = parseInt(e.target.value, 10) || 0;
      renderCurrentProspect();
    });
  }

  // Pestañas de la Ficha
  document.querySelectorAll('.ftab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ftab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.ftab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.getAttribute('data-tab'));
      if (target) target.classList.add('active');
    });
  });

  // Pestañas de Munición
  document.querySelectorAll('.atab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.atab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.atab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.getAttribute('data-tab'));
      if (target) target.classList.add('active');
    });
  });

  // Pasos del Guion (1 a 4)
  document.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.getAttribute('data-step'), 10);
      setCabinaStep(step);
    });
  });
  document.querySelectorAll('.btn-next-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextStep = parseInt(btn.getAttribute('data-target'), 10);
      setCabinaStep(nextStep);
    });
  });

  // Calculadora de impacto
  setupImpactCalculator();

  // Botón Llamar Principal
  if (btnCallPrimary) {
    btnCallPrimary.addEventListener('click', () => {
      startCabinaTimer();
      const p = cabinaQueue[cabinaCurrentIndex];
      const tel = p?.telefonos?.[0]?.numero || '608000000';
      // Abrir marcador o tel
      window.open(`tel:${tel}`, '_self');
      if (!cabinaIsListening) toggleCoachListening(true);
    });
  }

  // Coach de audio
  if (btnCoachListen) {
    btnCoachListen.addEventListener('click', () => toggleCoachListening(!cabinaIsListening));
  }
  if (btnCoachTestAudio) {
    btnCoachTestAudio.addEventListener('click', runAudioTest20s);
  }
  if (btnClearTranscript) {
    btnClearTranscript.addEventListener('click', () => {
      cabinaLiveTranscriptArray = [];
      const box = document.getElementById('cabina-live-transcript');
      if (box) box.innerHTML = '<div class="transcript-msg system">Transcripción limpiada.</div>';
      updateTalkRatio(0, 0);
    });
  }

  // Objeción nueva con IA
  if (btnAskNewObjection) {
    btnAskNewObjection.addEventListener('click', handleAskNewObjection);
  }
  if (inputNewObjection) {
    inputNewObjection.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAskNewObjection();
      }
    });
  }

  // Botones de Resultados (Outcomes)
  document.querySelectorAll('.btn-outcome').forEach(btn => {
    btn.addEventListener('click', () => {
      const outcome = btn.getAttribute('data-outcome');
      handleRecordOutcome(outcome);
    });
  });

  // Deshacer (Undo)
  if (btnCabinaUndo) {
    btnCabinaUndo.addEventListener('click', handleUndoLastCall);
  }

  // Modales
  if (btnCloseDiagModal) btnCloseDiagModal.addEventListener('click', () => closeCabinaModal('modal-diagnostico'));
  if (btnCloseModelModal) btnCloseModelModal.addEventListener('click', () => closeCabinaModal('modal-model-calls'));
  if (btnCloseImportModal) btnCloseImportModal.addEventListener('click', () => closeCabinaModal('modal-import-prospects'));
  if (btnOpenModelCalls) btnOpenModelCalls.addEventListener('click', openModelCallsModal);
  if (btnOpenImport) btnOpenImport.addEventListener('click', () => openCabinaModal('modal-import-prospects'));
  if (btnDiagNextCall) {
    btnDiagNextCall.addEventListener('click', () => {
      closeCabinaModal('modal-diagnostico');
      navigateCabinaQueue(1);
    });
  }
  if (btnSubmitImport) btnSubmitImport.addEventListener('click', handleImportProspects);

  // Botón Imprimir Ficha Previa al Diagnóstico
  const btnDiagPrint = document.getElementById('btn-diag-print');
  if (btnDiagPrint) {
    btnDiagPrint.addEventListener('click', handlePrintDiagnosticSheet);
  }

  // Selector de Huecos en Cierre
  setupSlotPickers();

  // Atajos de teclado globales para la cabina
  setupCabinaKeybindings();
}

// Cargar la cola de llamadas desde el backend
async function loadCabinaQueue() {
  try {
    const res = await fetch('/api/cabina/queue');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        cabinaQueue = data.queue || [];
        cabinaObjections = data.objections || [];
        renderProspectSelect();
        renderCurrentProspect();
        renderObjectionsList();
      }
    }
  } catch (err) {
    console.error('Error cargando cola de la cabina:', err);
  }
}

function renderProspectSelect() {
  const select = document.getElementById('cabina-prospect-select');
  if (!select) return;
  select.innerHTML = cabinaQueue.map((p, idx) => `
    <option value="${idx}">[Prio ${p.prioridad || 'B'}] ${p.empresa}</option>
  `).join('');
  select.value = cabinaCurrentIndex;
}

function navigateCabinaQueue(delta) {
  if (cabinaQueue.length === 0) return;
  cabinaCurrentIndex = (cabinaCurrentIndex + delta + cabinaQueue.length) % cabinaQueue.length;
  const select = document.getElementById('cabina-prospect-select');
  if (select) select.value = cabinaCurrentIndex;
  renderCurrentProspect();
}

// Renderizar la empresa actual en toda la pantalla
function renderCurrentProspect() {
  if (cabinaQueue.length === 0) return;
  const p = cabinaQueue[cabinaCurrentIndex];
  if (!p) return;

  // Actualizar indicador de cola
  const ind = document.getElementById('cabina-queue-indicator');
  if (ind) ind.textContent = `Empresa ${cabinaCurrentIndex + 1} de ${cabinaQueue.length}`;

  // Reset del Guion al Paso 1
  setCabinaStep(1);

  // Reset de temporizador de llamada
  resetCabinaTimer();

  // COLUMNA 1: FICHA
  const scoreEl = document.getElementById('ficha-score');
  if (scoreEl) scoreEl.textContent = p.score || 50;

  const nameEl = document.getElementById('ficha-empresa-nombre');
  if (nameEl) nameEl.textContent = p.empresa;

  const prioTag = document.getElementById('ficha-prioridad-tag');
  if (prioTag) {
    prioTag.textContent = `Prioridad ${p.prioridad || 'B'}`;
    prioTag.className = `priority-tag prio-${p.prioridad || 'B'}`;
  }

  const subsectorEl = document.getElementById('ficha-subsector');
  if (subsectorEl) subsectorEl.textContent = p.subsector || p.nicho || 'Servicios';

  const provEl = document.getElementById('ficha-provincia');
  if (provEl) provEl.textContent = p.provincia || 'España';

  const webLink = document.getElementById('ficha-web-link');
  if (webLink) {
    webLink.href = p.web || '#';
    webLink.style.display = p.web ? 'inline' : 'none';
  }

  // Decisor
  const decisorNameEl = document.getElementById('ficha-decisor-nombre');
  if (decisorNameEl) decisorNameEl.textContent = p.decisor?.nombre || 'Decisor por confirmar';

  const decisorCargoEl = document.getElementById('ficha-decisor-cargo');
  if (decisorCargoEl) decisorCargoEl.textContent = p.decisor?.cargo || 'Gerente / Dirección';

  // Teléfonos
  const telPri = p.telefonos?.[0] || { numero: '600 00 00 00', etiqueta: 'gerencia' };
  const telLabelEl = document.getElementById('ficha-tel-label');
  if (telLabelEl) telLabelEl.textContent = `${telPri.tipo || 'móvil'} · ${telPri.etiqueta || 'contacto'}`;
  
  const telNumEl = document.getElementById('ficha-tel-numero');
  if (telNumEl) telNumEl.textContent = telPri.numero;

  const telSec = p.telefonos?.[1];
  const telSecEl = document.getElementById('ficha-tel-secondary');
  if (telSecEl) {
    if (telSec) {
      telSecEl.innerHTML = `<i class="fa-solid fa-phone-office"></i> ${telSec.numero}`;
      telSecEl.style.display = 'inline-flex';
    } else {
      telSecEl.style.display = 'none';
    }
  }

  // Enlace directo de WhatsApp
  const cleanPhone = (telPri.numero || '').replace(/\D/g, '');
  const btnWa = document.getElementById('btn-whatsapp-direct');
  if (btnWa) {
    btnWa.href = `https://wa.me/34${cleanPhone}`;
  }

  // Mejor franja
  const franjaEl = document.getElementById('ficha-mejor-franja');
  if (franjaEl) franjaEl.textContent = `Mejor franja: ${p.mejor_franja || '9:00 - 13:00'}`;

  // Qué hacen
  const queHacenEl = document.getElementById('ficha-que-hacen');
  if (queHacenEl) queHacenEl.textContent = p.que_hacen || 'Empresa de servicios técnicos y mantenimiento.';

  // Señales
  const senalesListEl = document.getElementById('ficha-senales-list');
  const ammoSenalesList = document.getElementById('ammo-signals-list');
  if (senalesListEl) {
    const listHtml = (p.senales || []).map(s => `<li>${s.senal}</li>`).join('') || '<li>Sin señales web específicas.</li>';
    senalesListEl.innerHTML = listHtml;
  }
  if (ammoSenalesList) {
    const ammoHtml = (p.senales || []).map(s => `
      <div class="signal-detail-item">
        <div class="signal-title">${s.senal}</div>
        ${s.fuente ? `<a href="${s.fuente}" target="_blank" class="signal-source-link"><i class="fa-solid fa-link"></i> Ver fuente en su web</a>` : ''}
      </div>
    `).join('') || '<p class="small-desc">Sin señales detalladas.</p>';
    ammoSenalesList.innerHTML = ammoHtml;
  }

  // Dolores
  const doloresListEl = document.getElementById('ficha-dolores-list');
  if (doloresListEl) {
    doloresListEl.innerHTML = (p.dolores || []).map(d => `
      <div class="pain-card">
        <div class="pain-title"><i class="fa-solid fa-circle-exclamation"></i> ${d.dolor}</div>
        <div class="pain-evidence">${d.por_que_lo_creemos || ''}</div>
        <div class="pain-question">«${d.pregunta_cuantificacion || ''}»</div>
      </div>
    `).join('') || '<p class="small-desc">Sin dolores registrados.</p>';
  }

  // Solución y Prueba
  const solPriEl = document.getElementById('ficha-solucion-principal');
  if (solPriEl) solPriEl.textContent = p.solucion_propuesta?.principal || 'Digitalización de partes y avisos a clientes.';
  const solSecEl = document.getElementById('ficha-solucion-complementaria');
  if (solSecEl) solSecEl.textContent = p.solucion_propuesta?.complementaria || '';
  
  const pruebaEl = document.getElementById('ficha-prueba-citar');
  const ammoPruebaEl = document.getElementById('ammo-proof-text');
  const pruebaText = p.solucion_propuesta?.prueba_a_citar || 'Un servicio técnico similar en Toledo redujo a cero las horas perdidas de facturación.';
  if (pruebaEl) pruebaEl.textContent = pruebaText;
  if (ammoPruebaEl) ammoPruebaEl.textContent = pruebaText;

  // COLUMNA 2: GUION
  // Paso 1: Apertura
  const aperturaTextEl = document.getElementById('script-text-apertura');
  if (aperturaTextEl) {
    const decisorName = p.decisor?.nombre || 'buenos días';
    const firstSignal = p.senales?.[0]?.senal?.toLowerCase() || 'vuestros servicios técnicos';
    const defaultApertura = p.apertura_siguiente || p.guion?.apertura || `«Hola, ¿${decisorName}? Soy zVaito, de Verox. Te llamo porque he visto en vuestra web que ${firstSignal}, y tengo una pregunta rápida sobre cómo os llegan los partes a la oficina. ¿Tienes un minuto?»`;
    aperturaTextEl.textContent = defaultApertura;
  }

  // Paso 2: ¿Decide él?
  const decideTextEl = document.getElementById('script-text-decide');
  if (decideTextEl) {
    decideTextEl.textContent = p.guion?.si_no_esta_el_decisor ? '«¿Eres tú quien decide esto o lo lleva otra persona?»' : '«¿Eres tú quien lleva la oficina y la facturación, o lo lleva otra persona?»';
  }

  // Paso 3: Preguntas de cuantificación
  const discoveryEl = document.getElementById('script-discovery-questions');
  if (discoveryEl) {
    const questions = p.guion?.preguntas_descubrimiento || (p.dolores || []).map(d => d.pregunta_cuantificacion).filter(Boolean);
    discoveryEl.innerHTML = questions.map((q, idx) => `
      <li><strong>Pregunta ${idx + 1}:</strong> «${q}»</li>
    `).join('') || '<li>«¿Cuántas horas a la semana se van en esto?»</li>';
  }

  // Paso 4: Cierre con huecos dinámicos
  updateDynamicSlots(p);

  // COLUMNA 3: RESET COACH
  const sayNowText = document.getElementById('say-now-text');
  if (sayNowText) {
    sayNowText.textContent = `Empieza la llamada con la apertura. Cuando ${p.decisor?.nombre || 'el cliente'} responda, el coach te dirá qué contestar aquí.`;
  }
  const sayNowTag = document.getElementById('say-now-tag');
  if (sayNowTag) sayNowTag.textContent = 'Listo';

  // Cargar transcripción en caché del navegador (3 horas según manual)
  loadCachedTranscript(p.id);
}

// Actualizar los 2 huecos de fecha dinámica
function updateDynamicSlots(p) {
  const now = new Date();
  
  // Hueco 1: Siguiente día laborable a las 9:00
  const slot1 = new Date(now);
  slot1.setDate(slot1.getDate() + 1);
  if (slot1.getDay() === 0) slot1.setDate(slot1.getDate() + 1); // Domingo -> Lunes
  if (slot1.getDay() === 6) slot1.setDate(slot1.getDate() + 2); // Sábado -> Lunes
  slot1.setHours(9, 0, 0, 0);

  // Hueco 2: Dos días laborables después a las 16:30
  const slot2 = new Date(slot1);
  slot2.setDate(slot2.getDate() + 2);
  if (slot2.getDay() === 0) slot2.setDate(slot2.getDate() + 1);
  if (slot2.getDay() === 6) slot2.setDate(slot2.getDate() + 2);
  slot2.setHours(16, 30, 0, 0);

  const formatSlot = (d) => {
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${days[d.getDay()]} ${d.getDate()} a las ${hh}:${mm}`;
  };

  const strSlot1 = formatSlot(slot1);
  const strSlot2 = formatSlot(slot2);

  const slot1TextEl = document.getElementById('slot-1-text');
  const slot2TextEl = document.getElementById('slot-2-text');
  if (slot1TextEl) slot1TextEl.textContent = strSlot1;
  if (slot2TextEl) slot2TextEl.textContent = strSlot2;

  cabinaSelectedSlot = strSlot1;

  // Frase de cierre con los dos huecos
  const cierreTextEl = document.getElementById('script-text-cierre');
  if (cierreTextEl) {
    cierreTextEl.textContent = `«Te propongo 30 minutos por videollamada: te enseño cómo lo resolvió una empresa de tu sector y te digo con tus números si en tu caso compensa o no. ¿Te va mejor el ${strSlot1} o el ${strSlot2}?»`;
  }
}

function setupSlotPickers() {
  const b1 = document.getElementById('btn-slot-1');
  const b2 = document.getElementById('btn-slot-2');
  const customInput = document.getElementById('slot-custom-datetime');

  if (b1) {
    b1.addEventListener('click', () => {
      b1.classList.add('active');
      if (b2) b2.classList.remove('active');
      const t = document.getElementById('slot-1-text');
      if (t) cabinaSelectedSlot = t.textContent;
    });
  }
  if (b2) {
    b2.addEventListener('click', () => {
      b2.classList.add('active');
      if (b1) b1.classList.remove('active');
      const t = document.getElementById('slot-2-text');
      if (t) cabinaSelectedSlot = t.textContent;
    });
  }
  if (customInput) {
    customInput.addEventListener('change', () => {
      if (b1) b1.classList.remove('active');
      if (b2) b2.classList.remove('active');
      const val = new Date(customInput.value);
      if (!isNaN(val.getTime())) {
        cabinaSelectedSlot = val.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' });
      }
    });
  }
}

// Navegación de pasos del guion (1 a 4)
function setCabinaStep(stepNumber) {
  cabinaActiveStep = stepNumber;
  document.querySelectorAll('.step-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.getAttribute('data-step'), 10) === stepNumber);
  });
  document.querySelectorAll('.guion-step-pane').forEach((pane, idx) => {
    pane.classList.toggle('active', idx + 1 === stepNumber);
  });
}

// Calculadora de impacto (Horas al año, año de 46 semanas / 220 días / 11 meses)
function setupImpactCalculator() {
  const btnVeces = document.getElementById('calc-mode-veces');
  const btnHoras = document.getElementById('calc-mode-horas');
  const inputsVeces = document.getElementById('calc-inputs-veces');
  const inputsHoras = document.getElementById('calc-inputs-horas');

  let mode = 'veces';

  if (btnVeces && btnHoras) {
    btnVeces.addEventListener('click', () => {
      mode = 'veces';
      btnVeces.classList.add('active');
      btnHoras.classList.remove('active');
      if (inputsVeces) inputsVeces.classList.remove('hidden');
      if (inputsHoras) inputsHoras.classList.add('hidden');
      recalcImpact();
    });
    btnHoras.addEventListener('click', () => {
      mode = 'horas';
      btnHoras.classList.add('active');
      btnVeces.classList.remove('active');
      if (inputsVeces) inputsVeces.classList.add('hidden');
      if (inputsHoras) inputsHoras.classList.remove('hidden');
      recalcImpact();
    });
  }

  const elements = [
    'calc-veces-cant', 'calc-veces-periodo', 'calc-veces-tiempo', 'calc-veces-unidad',
    'calc-horas-cant', 'calc-horas-periodo'
  ];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', recalcImpact);
  });

  function recalcImpact() {
    let annualHours = 0;
    if (mode === 'veces') {
      const cant = parseFloat(document.getElementById('calc-veces-cant')?.value) || 0;
      const periodo = document.getElementById('calc-veces-periodo')?.value || 'semana';
      const tiempo = parseFloat(document.getElementById('calc-veces-tiempo')?.value) || 0;
      const unidad = document.getElementById('calc-veces-unidad')?.value || 'min';

      const hoursPerOccurrence = unidad === 'min' ? tiempo / 60 : tiempo;
      let multiplier = 46; // año de 46 semanas laborales según manual Verox
      if (periodo === 'dia') multiplier = 220; // 220 días laborales
      if (periodo === 'mes') multiplier = 11;  // 11 meses

      annualHours = cant * hoursPerOccurrence * multiplier;
    } else {
      const cant = parseFloat(document.getElementById('calc-horas-cant')?.value) || 0;
      const periodo = document.getElementById('calc-horas-periodo')?.value || 'semana';
      let multiplier = 46;
      if (periodo === 'dia') multiplier = 220;
      if (periodo === 'mes') multiplier = 11;
      annualHours = cant * multiplier;
    }

    // Redondear de 10 en 10 desde 100h según regla del manual
    if (annualHours >= 100) {
      annualHours = Math.round(annualHours / 10) * 10;
    } else {
      annualHours = Math.round(annualHours);
    }

    const totalEl = document.getElementById('calc-total-hours');
    const quoteEl = document.getElementById('calc-quote-phrase');
    const equivEl = document.getElementById('calc-human-equiv');

    if (totalEl) totalEl.textContent = annualHours;
    if (quoteEl) quoteEl.textContent = `«Entonces, si no me equivoco, son unas ${annualHours} horas al año. ¿Es así?»`;

    // Equivalencia humana: con >= 160h, en meses de jornada completa (160h/mes)
    if (equivEl) {
      if (annualHours >= 160) {
        const months = (annualHours / 160).toFixed(1);
        equivEl.textContent = `(Equivale a ${months > 1 ? `más de ${Math.floor(months)} meses` : 'un mes'} de una persona a jornada completa)`;
      } else {
        const days = Math.round(annualHours / 8);
        equivEl.textContent = `(Equivale a unas ${days} jornadas laborales completas de 8 horas)`;
      }
    }
  }

  recalcImpact();
}

// Cronómetro de la llamada
function startCabinaTimer() {
  if (cabinaCallTimerInterval) clearInterval(cabinaCallTimerInterval);
  cabinaCallSeconds = 0;
  updateTimerDisplay();
  cabinaCallTimerInterval = setInterval(() => {
    cabinaCallSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopCabinaTimer() {
  if (cabinaCallTimerInterval) {
    clearInterval(cabinaCallTimerInterval);
    cabinaCallTimerInterval = null;
  }
}

function resetCabinaTimer() {
  stopCabinaTimer();
  cabinaCallSeconds = 0;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const el = document.getElementById('cabina-call-timer');
  if (!el) return;
  const m = String(Math.floor(cabinaCallSeconds / 60)).padStart(2, '0');
  const s = String(cabinaCallSeconds % 60).padStart(2, '0');
  el.textContent = `${m}:${s}`;
}

// Audio y Transcripción en Directo del Coach
function toggleCoachListening(shouldListen) {
  const btn = document.getElementById('btn-coach-listen');
  const badge = document.getElementById('coach-audio-indicator');
  
  if (shouldListen) {
    initSpeechCapture();
    cabinaIsListening = true;
    if (btn) {
      btn.classList.add('listening');
      btn.innerHTML = '<i class="fa-solid fa-stop"></i> <span>Detener escucha</span>';
    }
    if (badge) {
      badge.textContent = 'Escuchando...';
      badge.className = 'audio-badge listening';
    }
  } else {
    stopSpeechCapture();
    cabinaIsListening = false;
    if (btn) {
      btn.classList.remove('listening');
      btn.innerHTML = '<i class="fa-solid fa-microphone"></i> <span>Escuchar llamada</span>';
    }
    if (badge) {
      badge.textContent = 'Listo';
      badge.className = 'audio-badge ready';
    }
  }
}

// Inicializar captura de voz (Web Speech API con soporte para micrófono y audio)
function initSpeechCapture() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    addTranscriptMessage('system', 'Tu navegador no soporta reconocimiento de voz nativo. Usa Chrome para mejor experiencia.');
    return;
  }

  try {
    cabinaRecognition = new SpeechRecognition();
    cabinaRecognition.continuous = true;
    cabinaRecognition.interimResults = false;
    cabinaRecognition.lang = 'es-ES';

    cabinaRecognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const phrase = event.results[i][0].transcript.trim();
          handleRecognizedSpeech(phrase);
        }
      }
    };

    cabinaRecognition.onerror = (e) => {
      console.warn('Speech capture notice:', e.error);
    };

    cabinaRecognition.onend = () => {
      if (cabinaIsListening && cabinaRecognition) {
        try { cabinaRecognition.start(); } catch (err) {}
      }
    };

    cabinaRecognition.start();
    addTranscriptMessage('system', 'Escuchando llamada activa...');
  } catch (err) {
    console.error('Error iniciando SpeechRecognition:', err);
  }
}

function stopSpeechCapture() {
  if (cabinaRecognition) {
    try { cabinaRecognition.stop(); } catch (err) {}
    cabinaRecognition = null;
  }
}

// Procesar texto reconocido y separar voces / eco
function handleRecognizedSpeech(text) {
  if (!text) return;

  // Filtro de eco: si la misma frase llega repetida en menos de 3s, se descarta
  if (text.toLowerCase() === cabinaLastClientPhrase.toLowerCase()) {
    return;
  }

  // Deducir si habla el comercial o el cliente según palabras clave habituales
  const lower = text.toLowerCase();
  const isYou = lower.includes('soy zvaito') || lower.includes('de verox') || lower.includes('te llamo porque') || lower.includes('te propongo 30');
  const speaker = isYou ? 'you' : 'client';

  if (!isYou) {
    cabinaLastClientPhrase = text;
  }

  addTranscriptMessage(speaker, text);

  // Contabilizar palabras para ratio Tú vs Cliente
  const wordCount = text.split(/\s+/).length;
  if (speaker === 'you') cabinaTalkWordsYou += wordCount;
  else cabinaTalkWordsClient += wordCount;
  updateTalkRatio(cabinaTalkWordsYou, cabinaTalkWordsClient);

  // Reglas del manual Verox (B.4) para consultar al Coach:
  // - Solo cuando termina de hablar el CLIENTE
  // - Su última frase tiene 3 palabras o más
  // - Han pasado al menos 5 segundos desde la última sugerencia
  const now = Date.now();
  if (speaker === 'client' && wordCount >= 3 && (now - cabinaLastCoachCallTime >= 5000)) {
    cabinaLastCoachCallTime = now;
    requestCoachAdvice();
  }
}

function addTranscriptMessage(speaker, text) {
  const box = document.getElementById('cabina-live-transcript');
  if (!box) return;

  const msg = document.createElement('div');
  msg.className = `transcript-msg ${speaker}`;
  const label = speaker === 'you' ? 'Tú: ' : speaker === 'client' ? 'Cliente: ' : '';
  msg.textContent = `${label}${text}`;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;

  cabinaLiveTranscriptArray.push({ speaker, text, time: Date.now() });

  // Guardar en caché del navegador (3 horas según regla 6 del manual)
  saveCachedTranscript();
}

// Ratio de habla y alerta de > 60%
function updateTalkRatio(wordsYou, wordsClient) {
  const total = wordsYou + wordsClient;
  if (total === 0) return;

  const pctYou = Math.round((wordsYou / total) * 100);
  const pctClient = 100 - pctYou;

  const elYou = document.getElementById('talk-pct-you');
  const elClient = document.getElementById('talk-pct-client');
  const barYou = document.getElementById('talk-bar-fill-you');
  const barClient = document.getElementById('talk-bar-fill-client');
  const alertWarning = document.getElementById('talk-alert-warning');

  if (elYou) elYou.textContent = `${pctYou}%`;
  if (elClient) elClient.textContent = `${pctClient}%`;
  if (barYou) barYou.style.width = `${pctYou}%`;
  if (barClient) barClient.style.width = `${pctClient}%`;

  // Alerta si hablas más del 60%
  if (alertWarning) {
    alertWarning.classList.toggle('hidden', pctYou <= 60);
  }
}

// Consultar al coach en directo con IA
async function requestCoachAdvice() {
  const p = cabinaQueue[cabinaCurrentIndex];
  if (!p) return;

  const sayNowTag = document.getElementById('say-now-tag');
  if (sayNowTag) sayNowTag.textContent = 'Pensando...';

  const transcriptSnippet = cabinaLiveTranscriptArray.slice(-14).map(m => `${m.speaker === 'you' ? 'Comercial' : 'Cliente'}: ${m.text}`).join('\n');

  try {
    const res = await fetch('/api/cabina/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospect: p,
        step: cabinaActiveStep,
        transcript: transcriptSnippet,
        slots: { slot1: document.getElementById('slot-1-text')?.textContent, slot2: document.getElementById('slot-2-text')?.textContent },
        objections: cabinaObjections
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.advice) {
        applyCoachAdvice(data.advice);
      }
    }
  } catch (err) {
    console.error('Error consultando al coach:', err);
  }
}

function applyCoachAdvice(advice) {
  const sayNowText = document.getElementById('say-now-text');
  const sayNowTag = document.getElementById('say-now-tag');
  const sayNowReason = document.getElementById('say-now-reason');
  const sayNowMeta = document.getElementById('say-now-meta');

  if (advice.decir) {
    if (sayNowText) sayNowText.textContent = `«${advice.decir}»`;
    if (sayNowTag) {
      sayNowTag.textContent = advice.motivo ? advice.motivo.toUpperCase() : 'SUGERENCIA';
    }
    if (sayNowReason && advice.objecion) {
      sayNowReason.textContent = `Objeción detectada: ${advice.objecion}`;
      if (sayNowMeta) sayNowMeta.classList.remove('hidden');
    }
  }

  // Si trae cálculo automático, rellenar la calculadora
  if (advice.calculo && advice.calculo.modo !== 'ninguno') {
    const c = advice.calculo;
    if (c.modo === 'veces') {
      const btnVeces = document.getElementById('calc-mode-veces');
      if (btnVeces) btnVeces.click();
      if (c.cantidad) document.getElementById('calc-veces-cant').value = c.cantidad;
      if (c.periodo) document.getElementById('calc-veces-periodo').value = c.periodo;
      if (c.tiempo) document.getElementById('calc-veces-tiempo').value = c.tiempo;
      if (c.unidad) document.getElementById('calc-veces-unidad').value = c.unidad;
    } else if (c.modo === 'horas') {
      const btnHoras = document.getElementById('calc-mode-horas');
      if (btnHoras) btnHoras.click();
      if (c.cantidad) document.getElementById('calc-horas-cant').value = c.cantidad;
      if (c.periodo) document.getElementById('calc-horas-periodo').value = c.periodo;
    }
    // Disparar input para recalcular
    document.getElementById('calc-veces-cant')?.dispatchEvent(new Event('input'));
  }
}

// Prueba de audio local de 20 segundos
async function runAudioTest20s() {
  const btn = document.getElementById('btn-coach-test-audio');
  if (!navigator.mediaDevices?.getUserMedia) {
    alert('Tu navegador no permite acceso al micrófono.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks = [];

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
      if (btn) btn.innerHTML = '<i class="fa-solid fa-check"></i> Prueba OK (reproduciendo)';
      setTimeout(() => {
        if (btn) btn.innerHTML = '<i class="fa-solid fa-vial"></i> Probar audio (20s)';
      }, 5000);
    };

    mediaRecorder.start();
    let timeLeft = 20;
    if (btn) btn.innerHTML = `<i class="fa-solid fa-circle text-danger"></i> Grabando prueba (${timeLeft}s)...`;

    const countdown = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(countdown);
        mediaRecorder.stop();
        stream.getTracks().forEach(t => t.stop());
      } else if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-circle text-danger"></i> Grabando prueba (${timeLeft}s)...`;
      }
    }, 1000);
  } catch (err) {
    alert('No se pudo acceder al micrófono para la prueba: ' + err.message);
  }
}

// Biblioteca de objeciones y resolución con IA
function renderObjectionsList() {
  const listEl = document.getElementById('objections-library-list');
  if (!listEl) return;

  listEl.innerHTML = cabinaObjections.map((o, idx) => `
    <div class="obj-accordion-item">
      <div class="obj-acc-header" onclick="toggleObjectionBody(${idx})">
        <span>${o.etiqueta}</span>
        <span class="obj-stats-tag">${o.exitos || 0} diagnósticos</span>
      </div>
      <div id="obj-body-${idx}" class="obj-acc-body" style="display: ${idx === 0 ? 'block' : 'none'};">
        «${o.respuesta}»
      </div>
    </div>
  `).join('');
}

window.toggleObjectionBody = function(idx) {
  const body = document.getElementById(`obj-body-${idx}`);
  if (body) {
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
  }
};

async function handleAskNewObjection() {
  const input = document.getElementById('input-new-objection');
  if (!input || !input.value.trim()) return;

  const objectionText = input.value.trim();
  const btn = document.getElementById('btn-ask-new-objection');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resolviendo...';
  }

  const p = cabinaQueue[cabinaCurrentIndex];
  try {
    const res = await fetch('/api/cabina/objections/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect: p, objectionText })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.objection) {
        cabinaObjections.unshift(data.objection);
        renderObjectionsList();
        input.value = '';

        // Poner la respuesta en el DI AHORA
        const sayNowText = document.getElementById('say-now-text');
        const sayNowTag = document.getElementById('say-now-tag');
        if (sayNowText) sayNowText.textContent = `«${data.objection.respuesta}»`;
        if (sayNowTag) sayNowTag.textContent = 'OBJECIÓN RESUELTA';
      }
    }
  } catch (err) {
    console.error('Error resolviendo nueva objeción:', err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-brain"></i> Resolver con IA';
    }
  }
}

// Registrar resultado de llamada (Outcomes Z, A, D, V, R, X)
async function handleRecordOutcome(outcomeCode) {
  const p = cabinaQueue[cabinaCurrentIndex];
  if (!p) return;

  stopCabinaTimer();
  toggleCoachListening(false);

  const quickNote = document.getElementById('call-quick-note')?.value || '';
  const transcriptText = cabinaLiveTranscriptArray.map(m => `${m.speaker === 'you' ? 'Tú' : 'Cliente'}: ${m.text}`).join('\n');
  const annualHours = document.getElementById('calc-total-hours')?.textContent || '0';

  const bodyData = {
    prospect_id: p.id,
    comercial: currentUser || 'zVaito',
    resultado: outcomeCode,
    paso_alcanzado: cabinaActiveStep,
    duracion_segundos: cabinaCallSeconds,
    cifras: [{ clave: 'horas_al_anio', valor: `${annualHours} horas` }],
    nota_rapida: quickNote,
    transcripcion: transcriptText
  };

  try {
    const res = await fetch('/api/cabina/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.interaction) {
        cabinaLastInteractionId = data.interaction.id;
        showUndoBanner(outcomeCode);

        // Actualizar estadísticas en la cabina
        incrementStat('stat-calls');
        if (outcomeCode === 'pedir_decisor') incrementStat('stat-decision-makers');
        if (outcomeCode === 'diagnostico') {
          incrementStat('stat-diagnostics');
          openDiagnosticModal(p, cabinaSelectedSlot);
        } else {
          // Pasar a la siguiente llamada
          navigateCabinaQueue(1);
        }
      }
    }
  } catch (err) {
    console.error('Error guardando llamada:', err);
  }
}

function incrementStat(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = (parseInt(el.textContent, 10) || 0) + 1;
  }
}

// Banner de deshacer llamada (8s con Ctrl+Z)
function showUndoBanner(outcome) {
  const banner = document.getElementById('cabina-undo-banner');
  const text = document.getElementById('undo-result-text');
  const countdownEl = document.getElementById('undo-countdown');
  if (!banner || !text) return;

  const names = {
    no_contesta: 'No contesta',
    llamar_luego: 'Llamar luego',
    pedir_decisor: 'Pedir decisor',
    diagnostico: 'Diagnóstico ✓',
    no_interesa: 'No interesa',
    no_llamar_mas: 'No llamar más'
  };
  text.textContent = names[outcome] || outcome;
  banner.classList.remove('hidden');

  let seconds = 8;
  if (countdownEl) countdownEl.textContent = seconds;

  if (cabinaUndoTimer) clearInterval(cabinaUndoTimer);
  cabinaUndoTimer = setInterval(() => {
    seconds--;
    if (countdownEl) countdownEl.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(cabinaUndoTimer);
      banner.classList.add('hidden');
      cabinaLastInteractionId = null;
    }
  }, 1000);
}

async function handleUndoLastCall() {
  if (!cabinaLastInteractionId) return;
  try {
    const res = await fetch(`/api/cabina/undo/${cabinaLastInteractionId}`, { method: 'POST' });
    if (res.ok) {
      const banner = document.getElementById('cabina-undo-banner');
      if (banner) banner.classList.add('hidden');
      if (cabinaUndoTimer) clearInterval(cabinaUndoTimer);
      cabinaLastInteractionId = null;
      // Recargar cola
      await loadCabinaQueue();
    }
  } catch (err) {
    console.error('Error deshaciendo llamada:', err);
  }
}

// Modal Diagnóstico Agendado (WhatsApp F.1, Google Calendar F.5 y Ficha)
function openDiagnosticModal(prospect, slotText) {
  const modal = document.getElementById('modal-diagnostico');
  const summaryEl = document.getElementById('modal-diag-company-summary');
  const btnWa = document.getElementById('btn-diag-whatsapp');
  const btnCal = document.getElementById('btn-diag-calendar');

  if (summaryEl) {
    summaryEl.textContent = `${prospect.empresa} · ${slotText}`;
  }

  // Plantilla F.1: WhatsApp de Confirmación
  const decisorFirstName = prospect.decisor?.nombre ? prospect.decisor.nombre.split(' ')[0] : '';
  const greeting = decisorFirstName ? `Hola ${decisorFirstName}` : 'Hola';
  const waMessage = `${greeting}, soy zVaito, de Verox. Te confirmo el diagnóstico del ${slotText}: 30 minutos por videollamada, te mando el enlace por aquí. Si te surge algo, dímelo y lo movemos. ¡Hasta entonces!`;
  
  const phoneDigits = (prospect.telefonos?.[0]?.numero || '').replace(/\D/g, '');
  if (btnWa) {
    btnWa.href = `https://wa.me/34${phoneDigits}?text=${encodeURIComponent(waMessage)}`;
  }

  // Plantilla F.5: Enlace a Google Calendar (con Meet)
  const title = encodeURIComponent(`Diagnóstico Verox · ${prospect.empresa}`);
  const details = encodeURIComponent(`Diagnóstico gratuito · ${prospect.empresa}\nCon: ${prospect.decisor?.nombre || 'Decisor'} (${prospect.decisor?.cargo || 'Gerente'})\nQué hacen: ${prospect.que_hacen || ''}\nFicha completa en el CRM de prospección.`);
  if (btnCal) {
    btnCal.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`;
  }

  openCabinaModal('modal-diagnostico');
}

// Ficha previa al diagnóstico imprimible (versión PDF / Impresión)
function handlePrintDiagnosticSheet() {
  const p = cabinaQueue[cabinaCurrentIndex];
  if (!p) return;

  const printArea = document.createElement('div');
  printArea.className = 'print-area-diagnostico';
  printArea.innerHTML = `
    <h2>FICHA PREVIA AL DIAGNÓSTICO (30 MINUTOS)</h2>
    <hr>
    <p><strong>Empresa:</strong> ${p.empresa} (${p.subsector || p.nicho || 'Servicios'})</p>
    <p><strong>Decisor:</strong> ${p.decisor?.nombre || '—'} · ${p.decisor?.cargo || '—'}</p>
    <p><strong>Teléfono:</strong> ${p.telefonos?.[0]?.numero || '—'} · <strong>Web:</strong> ${p.web || '—'}</p>
    <p><strong>Qué hacen:</strong> ${p.que_hacen || '—'}</p>
    <p><strong>Dolores detectados:</strong> ${(p.dolores || []).map(d => d.dolor).join(', ') || '—'}</p>
    <p><strong>Solución propuesta:</strong> ${p.solucion_propuesta?.principal || '—'}</p>
    <p><strong>Horas al año estimadas:</strong> ${document.getElementById('calc-total-hours')?.textContent || '—'} h/año</p>
    <p><strong>Hueco acordado:</strong> ${cabinaSelectedSlot}</p>
  `;
  document.body.appendChild(printArea);
  window.print();
  document.body.removeChild(printArea);
}

// Modal Llamadas Modelo (Puntuadas >= 80)
async function openModelCallsModal() {
  openCabinaModal('modal-model-calls');
  const container = document.getElementById('model-calls-list-container');
  if (!container) return;
  container.innerHTML = '<p class="small-desc"><i class="fa-solid fa-spinner fa-spin"></i> Cargando llamadas modelo...</p>';

  try {
    const res = await fetch('/api/cabina/model-calls');
    if (res.ok) {
      const data = await res.json();
      if (data.calls && data.calls.length > 0) {
        container.innerHTML = data.calls.map(c => `
          <div class="model-call-item">
            <div class="model-call-top">
              <strong>Llamada de ${c.comercial || 'zVaito'} · Resultado: ${c.resultado}</strong>
              <span class="model-score-badge">Nota: ${c.nota_rubrica || 85}/100</span>
            </div>
            <div class="model-feedback">
              <strong>Comentario del Coach:</strong> ${c.rubrica_desglose?.comentario || c.resumen_ia || 'Llamada ejemplar con cuantificación y fecha cerrada.'}
            </div>
            ${c.transcripcion ? `<div class="model-snippet">${c.transcripcion}</div>` : ''}
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p class="empty-state-p">Aún no hay llamadas con nota ≥ 80. ¡Realiza llamadas para que el coach las puntúe!</p>';
      }
    }
  } catch (err) {
    container.innerHTML = '<p class="error-msg">Error cargando llamadas modelo.</p>';
  }
}

// Importar Lote de Empresas (Prompt A)
async function handleImportProspects() {
  const textarea = document.getElementById('import-json-textarea');
  const statusMsg = document.getElementById('import-status-msg');
  if (!textarea || !textarea.value.trim()) return;

  try {
    const parsed = JSON.parse(textarea.value.trim());
    const list = Array.isArray(parsed) ? parsed : [parsed];
    statusMsg.textContent = 'Importando empresas a la base de datos...';
    statusMsg.className = 'status-msg';

    const res = await fetch('/api/cabina/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list })
    });

    if (res.ok) {
      const data = await res.json();
      statusMsg.textContent = `¡Éxito! Se importaron ${data.imported || list.length} empresas a la cola.`;
      statusMsg.className = 'status-msg status-ok';
      setTimeout(async () => {
        closeCabinaModal('modal-import-prospects');
        textarea.value = '';
        statusMsg.textContent = '';
        await loadCabinaQueue();
      }, 1500);
    }
  } catch (err) {
    statusMsg.textContent = 'Error: JSON no válido. Verifica la sintaxis.';
    statusMsg.className = 'status-msg status-err';
  }
}

function openCabinaModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('hidden');
}

function closeCabinaModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('hidden');
}

// Atajos de teclado globales (1-4 pasos, Z, A, D, V, R, X, Ctrl+Z)
function setupCabinaKeybindings() {
  window.addEventListener('keydown', (e) => {
    // Si el panel de cabina ventas no está activo, no interceptar
    const panel = document.getElementById('panel-sales');
    if (!panel || !panel.classList.contains('active')) return;

    // Si el usuario está escribiendo en un input, textarea o select, ignorar teclas normales
    const targetTag = e.target.tagName.toLowerCase();
    if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndoLastCall();
      }
      return;
    }

    // Ctrl+Z para deshacer
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      handleUndoLastCall();
      return;
    }

    // Teclas 1 a 4 para cambiar paso del guion
    if (['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      setCabinaStep(parseInt(e.key, 10));
      return;
    }

    // Teclas de resultados
    const key = e.key.toLowerCase();
    if (key === 'z') { e.preventDefault(); handleRecordOutcome('no_contesta'); }
    else if (key === 'a') { e.preventDefault(); handleRecordOutcome('llamar_luego'); }
    else if (key === 'd') { e.preventDefault(); handleRecordOutcome('pedir_decisor'); }
    else if (key === 'v') { e.preventDefault(); handleRecordOutcome('diagnostico'); }
    else if (key === 'r') { e.preventDefault(); handleRecordOutcome('no_interesa'); }
    else if (key === 'x') { e.preventDefault(); handleRecordOutcome('no_llamar_mas'); }
  });
}

// Caché de transcripción de 3 horas en localStorage
function saveCachedTranscript() {
  const p = cabinaQueue[cabinaCurrentIndex];
  if (!p) return;
  const key = `cabina_trans_${p.id}`;
  localStorage.setItem(key, JSON.stringify({
    timestamp: Date.now(),
    items: cabinaLiveTranscriptArray
  }));
}

function loadCachedTranscript(prospectId) {
  cabinaLiveTranscriptArray = [];
  const box = document.getElementById('cabina-live-transcript');
  if (!box) return;
  box.innerHTML = '';

  const key = `cabina_trans_${prospectId}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // Validar expiración de 3 horas (10800000 ms)
      if (Date.now() - parsed.timestamp < 3 * 60 * 60 * 1000 && Array.isArray(parsed.items)) {
        cabinaLiveTranscriptArray = parsed.items;
        parsed.items.forEach(m => {
          const div = document.createElement('div');
          div.className = `transcript-msg ${m.speaker}`;
          const label = m.speaker === 'you' ? 'Tú: ' : m.speaker === 'client' ? 'Cliente: ' : '';
          div.textContent = `${label}${m.text}`;
          box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight;
        return;
      }
    } catch (e) {}
  }

  box.innerHTML = '<div class="transcript-msg system">Pulsa «Escuchar llamada» para transcribir a ambos interlocutores.</div>';
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


// ================= MODULO 4: GYM TRACKER =================
function setupGymModule() {
  const btnAddDay = document.getElementById('btn-add-gym-day');
  const gymModal = document.getElementById('gym-modal');
  const gymForm = document.getElementById('gym-form');
  const btnAddExerciseField = document.getElementById('btn-add-exercise-field');
  const exercisesInputsContainer = document.getElementById('exercises-list-inputs');
  
  // Cerrar Modales
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => gymModal && gymModal.classList.add('hidden'));
  });

  if (btnAddDay) {
    btnAddDay.addEventListener('click', () => {
      const idEl = document.getElementById('gym-day-id');
      const nameEl = document.getElementById('gym-day-name');
      const titleEl = document.getElementById('gym-modal-title');
      if (idEl) idEl.value = '';
      if (nameEl) nameEl.value = '';
      if (exercisesInputsContainer) exercisesInputsContainer.innerHTML = '';
      if (titleEl) titleEl.textContent = 'Añadir Día de Entrenamiento';
      const submitBtn = gymForm ? gymForm.querySelector('button[type="submit"]') : null;
      if (submitBtn) submitBtn.textContent = 'Crear Rutina';
      if (gymModal) gymModal.classList.remove('hidden');
      addExerciseInputField(); // Campo inicial
    });
  }

  if (btnAddExerciseField) {
    btnAddExerciseField.addEventListener('click', () => addExerciseInputField());
  }

  function addExerciseInputField(nameValue = '', exId = '', weight = 0, notes = '') {
    const rowId = 'ex_row_' + Math.random().toString(36).substr(2, 9);
    const row = document.createElement('div');
    row.className = 'exercise-field-row';
    row.id = rowId;
    row.innerHTML = `
      <input type="hidden" class="exercise-id-input" value="${escapeHTML(exId)}">
      <input type="hidden" class="exercise-weight-input" value="${weight || 0}">
      <input type="hidden" class="exercise-notes-input" value="${escapeHTML(notes || '')}">
      <input type="text" class="exercise-name-input" required placeholder="Nombre del ejercicio (Ej: Sentadillas)" value="${escapeHTML(nameValue)}">
      <button type="button" class="btn btn-danger btn-sm" onclick="document.getElementById('${rowId}').remove()" title="Eliminar este ejercicio de la rutina"><i class="fa-solid fa-trash"></i></button>
    `;
    exercisesInputsContainer.appendChild(row);
  }

  // Guardar Rutina (Crear o Editar)
  gymForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('gym-day-id').value;
    const dayName = document.getElementById('gym-day-name').value.trim();
    
    // Obtener los ejercicios preservando pesos y notas existentes
    const exerciseRows = exercisesInputsContainer.querySelectorAll('.exercise-field-row');
    const exercises = Array.from(exerciseRows).map((row, idx) => {
      const nameInput = row.querySelector('.exercise-name-input');
      const idInput = row.querySelector('.exercise-id-input');
      const weightInput = row.querySelector('.exercise-weight-input');
      const notesInput = row.querySelector('.exercise-notes-input');

      const existingId = idInput ? idInput.value : '';
      const existingWeight = weightInput ? parseFloat(weightInput.value) || 0 : 0;
      const existingNotes = notesInput ? notesInput.value : '';

      return {
        id: existingId || ('e_' + idx + '_' + Math.random().toString(36).substr(2, 6)),
        name: nameInput ? nameInput.value.trim() : '',
        weight: existingWeight,
        notes: existingNotes
      };
    }).filter(ex => ex.name.length > 0);

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
        showToast(id ? '¡Rutina actualizada correctamente!' : '¡Nueva rutina creada con éxito!');
      }
    } catch (err) {
      console.error(err);
      alert('Error al guardar la rutina.');
    }
  });

  // Abrir Modal para Editar Rutina
  window.editGymDay = async (dayId) => {
    try {
      const res = await fetch('/api/gym');
      const gymData = await res.json();
      const day = gymData.find(d => d.id === dayId);
      if (!day) return;

      document.getElementById('gym-day-id').value = day.id;
      document.getElementById('gym-day-name').value = day.dayName;
      document.getElementById('gym-modal-title').textContent = `Editar Rutina: ${day.dayName}`;
      
      const submitBtn = gymForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Guardar Cambios';

      exercisesInputsContainer.innerHTML = '';
      if (Array.isArray(day.exercises) && day.exercises.length > 0) {
        day.exercises.forEach(ex => {
          addExerciseInputField(ex.name, ex.id, ex.weight, ex.notes);
        });
      } else {
        addExerciseInputField();
      }

      gymModal.classList.remove('hidden');
    } catch (err) {
      console.error('Error cargando rutina para editar:', err);
    }
  };

  // Abrir y cerrar formulario inline de añadir ejercicio
  window.openAddExerciseInline = (dayId) => {
    const formContainer = document.getElementById(`inline-add-ex-${dayId}`);
    if (!formContainer) return;
    formContainer.classList.remove('hidden');
    const input = formContainer.querySelector('input');
    if (input) {
      input.value = '';
      input.focus();
    }
  };

  window.closeAddExerciseInline = (dayId) => {
    const formContainer = document.getElementById(`inline-add-ex-${dayId}`);
    if (formContainer) formContainer.classList.add('hidden');
  };

  // Guardar nuevo ejercicio rápidamente desde la tarjeta
  window.saveNewExerciseInline = async (dayId) => {
    const formContainer = document.getElementById(`inline-add-ex-${dayId}`);
    if (!formContainer) return;
    const input = formContainer.querySelector('input');
    const name = input ? input.value.trim() : '';
    if (!name) return;

    try {
      const resGet = await fetch('/api/gym');
      const gymData = await resGet.json();
      const day = gymData.find(d => d.id === dayId);
      if (!day) return;

      if (!Array.isArray(day.exercises)) day.exercises = [];
      day.exercises.push({
        id: 'e_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
        name,
        weight: 0,
        notes: ''
      });

      const resPost = await fetch('/api/gym', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(day)
      });

      if (resPost.ok) {
        const data = await resPost.json();
        renderGymDays(data.gym);
        showToast(`¡Ejercicio "${name}" añadido a la rutina!`);
      }
    } catch (err) {
      console.error(err);
      alert('Error al añadir el ejercicio.');
    }
  };

  // Renombrar un ejercicio específico
  window.renameExercise = async (dayId, exId) => {
    try {
      const resGet = await fetch('/api/gym');
      const gymData = await resGet.json();
      const day = gymData.find(d => d.id === dayId);
      if (!day) return;
      const ex = day.exercises.find(e => e.id === exId);
      if (!ex) return;

      const newName = prompt('Nuevo nombre para el ejercicio:', ex.name);
      if (!newName || !newName.trim() || newName.trim() === ex.name) return;

      ex.name = newName.trim();

      const resPost = await fetch('/api/gym', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(day)
      });

      if (resPost.ok) {
        const data = await resPost.json();
        renderGymDays(data.gym);
        showToast(`Ejercicio renombrado a "${ex.name}"`);
      }
    } catch (err) {
      console.error(err);
      alert('Error al renombrar el ejercicio.');
    }
  };

  // Eliminar un ejercicio específico de una rutina
  window.deleteExerciseFromDay = async (dayId, exId) => {
    if (!confirm('¿Deseas eliminar este ejercicio de la rutina?')) return;
    try {
      const resGet = await fetch('/api/gym');
      const gymData = await resGet.json();
      const day = gymData.find(d => d.id === dayId);
      if (!day) return;

      day.exercises = day.exercises.filter(e => e.id !== exId);

      const resPost = await fetch('/api/gym', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(day)
      });

      if (resPost.ok) {
        const data = await resPost.json();
        renderGymDays(data.gym);
        showToast('Ejercicio eliminado de la rutina.');
      }
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el ejercicio.');
    }
  };

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
          showToast('Rutina eliminada.');
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
          <button class="btn-edit-routine" onclick="editGymDay('${day.id}')" title="Editar Rutina (nombre y ejercicios)">
            <i class="fa-solid fa-pen-to-square"></i> Editar
          </button>
          <button class="btn btn-danger-link" onclick="deleteGymDay('${day.id}')" title="Eliminar Rutina">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
      <div class="gym-exercises-list">
        ${day.exercises.map(ex => `
          <div class="gym-exercise-item">
            <div class="gym-exercise-header">
              <span class="gym-exercise-name">${escapeHTML(ex.name)}</span>
              <div class="gym-exercise-actions">
                <button class="btn-icon-subtle" onclick="renameExercise('${day.id}', '${ex.id}')" title="Renombrar Ejercicio">
                  <i class="fa-solid fa-pencil"></i>
                </button>
                <button class="btn-icon-subtle btn-delete-ex" onclick="deleteExerciseFromDay('${day.id}', '${ex.id}')" title="Eliminar este ejercicio">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
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

        <div id="inline-add-ex-${day.id}" class="gym-add-inline-form hidden">
          <input type="text" placeholder="Nombre del ejercicio (Ej: Curl de bíceps)..." onkeypress="if(event.key==='Enter') saveNewExerciseInline('${day.id}')">
          <button type="button" class="btn btn-primary btn-sm" onclick="saveNewExerciseInline('${day.id}')"><i class="fa-solid fa-check"></i> Añadir</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="closeAddExerciseInline('${day.id}')"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <button class="btn-add-exercise-to-card" onclick="openAddExerciseInline('${day.id}')">
          <i class="fa-solid fa-plus"></i> Añadir Ejercicio
        </button>
      </div>
    </div>
  `).join('');
}


// ================= MODULO 5: MONITOR SITEMAPS =================
function setupSitemapsModule() {
  const formAddSitemap = document.getElementById('form-add-sitemap');
  const btnSitemapCheckNow = document.getElementById('btn-sitemap-check-now');

  if (formAddSitemap) {
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
  }

  if (btnSitemapCheckNow) {
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
  }

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
// ================= MODULO 6: PENTESTING BOT =================
let allSecurityLogs = [];
let allSecurityTargets = [];
let selectedSecurityWebFilter = 'ALL';

function setupSecurityModule() {
  const formAddTarget = document.getElementById('form-add-security-target');
  const btnRunPentest = document.getElementById('btn-run-pentest');
  const selectWebFilter = document.getElementById('select-filter-security-web');

  if (selectWebFilter) {
    selectWebFilter.addEventListener('change', (e) => {
      selectedSecurityWebFilter = e.target.value;
      renderFilteredSecurityLogs();
    });
  }

  if (formAddTarget) {
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
          allSecurityTargets = data.targets;
          renderSecurityTargets(allSecurityTargets);
          updateSecurityFilterDropdown();
          formAddTarget.reset();
          showToast('Web objetivo añadida al Pentesting Bot.');
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  if (btnRunPentest) {
    btnRunPentest.addEventListener('click', async () => {
      btnRunPentest.disabled = true;
      btnRunPentest.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ejecutando...';

      // Efecto interactivo de consola
      const consoleBox = document.getElementById('security-console');
      if (consoleBox) consoleBox.innerHTML = '';
      
      appendConsoleLine('[+] Iniciando Bot de Pentesting 24/7...', 'text-success');
      await sleep(600);
      appendConsoleLine('[+] Recuperando objetivos de auditoría activos...', 'text-success');
      await sleep(500);
      
      // Iniciar escaneo en backend
      try {
        const res = await fetch('/api/security/scan-now', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          allSecurityTargets = data.targets;
          allSecurityLogs = data.logs;
          
          // Simular salida interactiva en consola antes de mostrar resultados
          for (const target of data.targets) {
            appendConsoleLine(`[+] Cargando objetivo: ${target.url}`, 'text-success');
            await sleep(400);
            appendConsoleLine(`[~] Escaneando puertos abiertos de ${target.url}...`, 'text-warn');
            await sleep(500);
            appendConsoleLine(`[~] Comprobando HTTPS y certificados SSL...`, 'text-warn');
            await sleep(400);
            appendConsoleLine(`[~] Solicitando cabeceras de respuesta HTTP y políticas CSP...`, 'text-warn');
            await sleep(500);
            appendConsoleLine(`[~] Escaneando directorios y archivos sensibles (.env, .git, config)...`, 'text-warn');
            await sleep(400);
            
            const logsOfTarget = data.logs.filter(l => l.url === target.url);
            if (logsOfTarget.length > 0) {
              appendConsoleLine(`[!] ¡FALLO DE SEGURIDAD DETECTADO en ${target.url}!`, 'text-err');
              logsOfTarget.forEach(vuln => {
                appendConsoleLine(`    - [${vuln.severity}] ${vuln.title}`, 'text-err');
              });
            } else {
              appendConsoleLine(`[+] Escaneo completado para ${target.url}: SIN VULNERABILIDADES CRÍTICAS.`, 'text-success');
            }
            await sleep(300);
          }
          
          appendConsoleLine('[+] Todos los escaneos de vulnerabilidades han finalizado correctamente.', 'text-success');
          
          // Renderizar datos finales y actualizar selector
          renderSecurityTargets(allSecurityTargets);
          updateSecurityFilterDropdown();
          renderFilteredSecurityLogs();
        }
      } catch (e) {
        appendConsoleLine('[x] Error al ejecutar el pentest de red.', 'text-err');
      }

      btnRunPentest.disabled = false;
      btnRunPentest.innerHTML = '<i class="fa-solid fa-user-secret"></i> Lanzar Escaneo Completo';
    });
  }

  window.deleteSecurityTarget = async (id) => {
    if (confirm('¿Seguro que deseas eliminar esta web auditada? Se borrarán sus vulnerabilidades.')) {
      try {
        const res = await fetch(`/api/security/targets/${id}`, { method: 'DELETE' });
        if (res.ok) {
          const data = await res.json();
          allSecurityTargets = data.targets;
          renderSecurityTargets(allSecurityTargets);
          await loadSecurityLogs(); // Recargar historial de fallos
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Función expuesta para comprobar si una vulnerabilidad se ha solucionado
  window.recheckVulnerability = async (id) => {
    const btn = document.getElementById(`btn-recheck-${id}`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Comprobando solución...';
    }

    appendConsoleLine('[~] Auditando en tiempo real si el fallo de seguridad ha sido resuelto...', 'text-warn');

    try {
      const res = await fetch('/api/security/recheck-vuln', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      const data = await res.json();

      if (res.ok && data.solved) {
        allSecurityTargets = data.targets;
        allSecurityLogs = data.logs;
        renderSecurityTargets(allSecurityTargets);
        updateSecurityFilterDropdown();
        renderFilteredSecurityLogs();
        appendConsoleLine(`[✔] ¡SOLUCIONADO! "${data.vulnTitle}" en ${data.vulnUrl}. Vulnerabilidad eliminada de la bitácora.`, 'text-success');
        showToast('¡Vulnerabilidad solucionada con éxito! Se ha eliminado de la bitácora.');
      } else {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Comprobar si se ha solucionado';
        }
        const errorMsg = data.message || 'La vulnerabilidad aún sigue activa.';
        appendConsoleLine(`[!] ATENCIÓN: "${data.vulnTitle || 'Fallo'}" en ${data.vulnUrl || 'la web'} todavía no ha sido corregida.`, 'text-err');
        showToast('⚠️ La vulnerabilidad sigue presente en la web. Revisa la solución recomendada.');
      }
    } catch (err) {
      console.error(err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Comprobar si se ha solucionado';
      }
      appendConsoleLine('[x] Error al conectar con el servidor para la comprobación.', 'text-err');
      alert('Error al comprobar la vulnerabilidad.');
    }
  };
}

function appendConsoleLine(text, className = '') {
  const consoleBox = document.getElementById('security-console');
  if (!consoleBox) return;
  const div = document.createElement('div');
  div.className = `console-line ${className}`;
  div.textContent = text;
  consoleBox.appendChild(div);
  consoleBox.scrollTop = consoleBox.scrollHeight;
}

async function loadSecurityData() {
  try {
    const resT = await fetch('/api/security/targets');
    if (resT.ok) {
      allSecurityTargets = await resT.json();
      renderSecurityTargets(allSecurityTargets);
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
      allSecurityLogs = await resL.json();
      updateSecurityFilterDropdown();
      renderFilteredSecurityLogs();
    }
  } catch (e) {
    console.error(e);
  }
}

function updateSecurityFilterDropdown() {
  const select = document.getElementById('select-filter-security-web');
  if (!select) return;

  const currentVal = select.value || selectedSecurityWebFilter;

  // Extraer todas las URLs registradas o con logs
  const urlSet = new Set();
  allSecurityTargets.forEach(t => urlSet.add(t.url));
  allSecurityLogs.forEach(l => urlSet.add(l.url));

  const totalLogs = allSecurityLogs.length;

  let optionsHtml = `<option value="ALL">Todas las webs (${totalLogs} ${totalLogs === 1 ? 'fallo' : 'fallos'})</option>`;

  Array.from(urlSet).sort().forEach(url => {
    const count = allSecurityLogs.filter(l => l.url === url).length;
    const cleanUrl = url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    optionsHtml += `<option value="${escapeHTML(url)}">${escapeHTML(cleanUrl)} (${count} ${count === 1 ? 'fallo' : 'fallos'})</option>`;
  });

  select.innerHTML = optionsHtml;

  // Restaurar selección previa si aún existe
  if (Array.from(urlSet).includes(currentVal) || currentVal === 'ALL') {
    select.value = currentVal;
    selectedSecurityWebFilter = currentVal;
  } else {
    select.value = 'ALL';
    selectedSecurityWebFilter = 'ALL';
  }
}

function renderSecurityTargets(targets) {
  const body = document.getElementById('security-targets-table-body');
  if (!body) return;
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
        <button class="btn btn-danger-link" onclick="deleteSecurityTarget('${target.id}')" title="Eliminar objetivo"><i class="fa-regular fa-trash-can"></i></button>
      </td>
    </tr>
  `).join('');
}

function renderFilteredSecurityLogs() {
  const container = document.getElementById('vulnerability-list-container');
  if (!container) return;

  const logs = selectedSecurityWebFilter === 'ALL'
    ? allSecurityLogs
    : allSecurityLogs.filter(l => l.url === selectedSecurityWebFilter);

  if (logs.length === 0) {
    const isSpecific = selectedSecurityWebFilter !== 'ALL';
    const siteLabel = isSpecific ? selectedSecurityWebFilter.replace(/^https?:\/\//i, '') : '';

    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-circle-check security-safe-icon"></i>
        <p>${isSpecific ? `No se han detectado vulnerabilidades en <strong>${escapeHTML(siteLabel)}</strong>. ¡El sitio está seguro!` : 'No se han encontrado vulnerabilidades en tus sitios. Todo parece estar seguro.'}</p>
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
      <div class="vuln-actions-bar">
        <span class="text-muted" style="font-size:0.75rem;"><i class="fa-regular fa-clock"></i> Detectada el ${new Date(vuln.foundAt).toLocaleString()}</span>
        <button class="btn-check-vuln" id="btn-recheck-${vuln.id}" onclick="recheckVulnerability('${vuln.id}')" title="Comprobar en tiempo real si esta vulnerabilidad ha sido solucionada">
          <i class="fa-solid fa-arrows-rotate"></i> Comprobar si se ha solucionado
        </button>
      </div>
    </div>
  `).join('');
}


// ================= CONFIGURACIÓN DE SETTINGS =================
function setupConfigModule() {
  const form = document.getElementById('config-form');
  const msg = document.getElementById('config-status-msg');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (msg) {
        msg.textContent = '';
        msg.className = 'status-msg';
      }

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
      if (msg) {
        msg.textContent = 'Error de red.';
        msg.classList.add('error');
      }
    }
  });
  }
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
  'Lengua',
  'Inglés'
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

// =====================================================================
// LIFE HUB & AI AGENTS SWARM (PANEL DE VIDA DE zVaito)
// =====================================================================
let lifeAgentsList = [];
let lifeLogsList = [];
let lifeMetricsData = {};

function formatTimeAgo(isoString) {
  if (!isoString) return 'Nunca';
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 60) return 'Hace unos segundos';
  if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `Hace ${Math.floor(diffSec / 3600)} h`;
  return `Hace ${Math.floor(diffSec / 86400)} d`;
}

function formatMarkdownOrText(text) {
  if (!text) return '';
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Negritas **texto**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Cursivas *texto*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Viñetas - o * al inicio de línea
  formatted = formatted.replace(/(?:^|\n)[-*]\s+(.*)/g, '<div style="margin-left: 12px; margin-top: 3px;">• $1</div>');
  // Saltos de línea
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

// Carga principal de datos del enjambre de vida
async function loadAgentsData() {
  try {
    const res = await fetch('/api/life/agents');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;

    lifeAgentsList = data.agents || [];
    lifeLogsList = data.logs || [];
    lifeMetricsData = data.metrics || {};

    const activeCount = lifeAgentsList.filter(a => a.status === 'active').length;
    const totalCount = lifeAgentsList.length;

    // Actualizar badges superiores y contadores en Dashboard
    const navBadge = document.getElementById('nav-active-agents-badge');
    if (navBadge) navBadge.textContent = `${activeCount} IA`;

    const statActive = document.getElementById('stat-active-agents');
    if (statActive) statActive.textContent = activeCount;

    const statProspects = document.getElementById('stat-prospects-queue');
    if (statProspects) statProspects.textContent = lifeMetricsData.prospectsInCabina || 0;

    const statSec = document.getElementById('stat-sec-targets');
    if (statSec) statSec.textContent = lifeMetricsData.securityTargets || 0;

    const statGym = document.getElementById('stat-gym-sessions');
    if (statGym) statGym.textContent = lifeMetricsData.workoutsLogged || 0;

    // Actualizar KPIs del panel de agentes
    const kpiActive = document.getElementById('kpi-agents-active');
    if (kpiActive) kpiActive.textContent = `${activeCount} / ${totalCount}`;

    const kpiCabina = document.getElementById('kpi-cabina-prospects');
    if (kpiCabina) kpiCabina.textContent = lifeMetricsData.prospectsInCabina || 0;

    const kpiSec = document.getElementById('kpi-sec-protected');
    if (kpiSec) kpiSec.textContent = lifeMetricsData.securityTargets > 0 ? '100% OK' : '8 Objetivos';

    const kpiGym = document.getElementById('kpi-gym-workouts');
    if (kpiGym) kpiGym.textContent = lifeMetricsData.workoutsLogged || 0;

    const kpiGrades = document.getElementById('kpi-grades-count');
    if (kpiGrades) kpiGrades.textContent = `${lifeMetricsData.gradesCount || 0} Notas`;

    const badgeCount = document.getElementById('badge-agent-count');
    if (badgeCount) badgeCount.textContent = `${totalCount} Agentes Registrados`;

    // Sincronizar banners de agentes en módulos individuales
    ['agent-hunter', 'agent-radar', 'agent-sentinel'].forEach(aId => {
      const aObj = lifeAgentsList.find(a => a.id === aId);
      if (aObj) {
        const isAct = aObj.status === 'active';
        const pill = document.getElementById(`pill-status-${aId}`);
        if (pill) {
          pill.className = `apb-status-pill ${isAct ? 'active' : 'paused'}`;
          pill.innerHTML = `<span class="pulse ${isAct ? 'green' : ''}"></span> ${isAct ? 'En Servicio' : 'Pausado'}`;
        }
        const toggleBtn = document.querySelector(`.btn-agent-toggle[data-agent-id="${aId}"]`);
        if (toggleBtn) {
          toggleBtn.innerHTML = `<i class="fa-solid ${isAct ? 'fa-pause' : 'fa-play'}"></i> ${isAct ? 'Pausar Agente' : 'Activar Agente'}`;
        }
      }
    });

    renderAgentCards(lifeAgentsList);
    renderLifeTimeline(lifeLogsList);
  } catch (err) {
    console.error('Error cargando estado de agentes de vida:', err);
  }
}

// Renderizar tarjetas de cada agente
function renderAgentCards(agents) {
  const container = document.getElementById('agents-cards-container');
  if (!container) return;

  if (agents.length === 0) {
    container.innerHTML = '<div class="empty-state">No hay agentes registrados en el enjambre.</div>';
    return;
  }

  container.innerHTML = agents.map(agent => {
    const isActive = agent.status === 'active';
    const color = agent.color || '#8c52ff';
    const icon = agent.icon || 'fa-robot';
    const tasksCount = agent.metrics?.tasksExecuted || 0;
    const lastRunFormatted = formatTimeAgo(agent.metrics?.lastRun);

    return `
      <div class="agent-card ${isActive ? 'status-active' : 'status-paused'}" data-agent-id="${agent.id}">
        <div class="agent-card-top">
          <div class="agent-avatar-wrap">
            <div class="agent-icon-box" style="background: ${color};">
              <i class="fa-solid ${icon}"></i>
            </div>
            <div class="agent-info">
              <h4>${agent.name}</h4>
              <span class="agent-role-pill">${agent.role || 'Agente Autónomo'}</span>
            </div>
          </div>
          <div class="agent-status-badge ${isActive ? 'active' : 'paused'}">
            <span class="pulse ${isActive ? 'green' : ''}"></span>
            ${isActive ? 'Activo' : 'Pausado'}
          </div>
        </div>

        <div class="agent-cadence">
          <i class="fa-solid fa-clock"></i>
          <span>${agent.cadence || 'Bajo demanda'}</span>
        </div>

        <p class="agent-desc">${agent.description || 'Sin descripción detallada.'}</p>

        <div class="agent-metrics-row">
          <div class="agent-metric-chip">
            <strong>${tasksCount}</strong> misiones
          </div>
          <div class="agent-metric-chip">
            Última: <strong>${lastRunFormatted}</strong>
          </div>
        </div>

        <div class="agent-actions-row">
          <button class="btn-trigger-agent" data-id="${agent.id}" title="Lanzar tarea manual inmediatamente">
            <i class="fa-solid fa-bolt"></i> Ejecutar Misión
          </button>
          <button class="btn-toggle-agent" data-id="${agent.id}" title="${isActive ? 'Pausar agente' : 'Reanudar agente'}">
            <i class="fa-solid ${isActive ? 'fa-pause' : 'fa-play'}"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Vincular eventos de botones
  container.querySelectorAll('.btn-trigger-agent').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const agentId = btn.getAttribute('data-id');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ejecutando...';
      btn.disabled = true;

      try {
        const res = await fetch(`/api/life/agents/${agentId}/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          alert(`✅ ${data.message || 'Misión ejecutada con éxito.'}`);
          await loadAgentsData();
        } else {
          alert(`❌ Error al ejecutar: ${data.message || 'Fallo desconocido'}`);
        }
      } catch (err) {
        alert('❌ Error de conexión al disparar misión.');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  });

  container.querySelectorAll('.btn-toggle-agent').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const agentId = btn.getAttribute('data-id');
      try {
        const res = await fetch(`/api/life/agents/${agentId}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          await loadAgentsData();
        }
      } catch (err) {
        console.error('Error al alternar estado del agente:', err);
      }
    });
  });
}

// Renderizar timeline de actividad de vida
function renderLifeTimeline(logs) {
  const feed = document.getElementById('life-timeline-feed');
  if (!feed) return;

  if (logs.length === 0) {
    feed.innerHTML = '<div class="empty-state">No hay registros de actividad todavía.</div>';
    return;
  }

  feed.innerHTML = logs.slice(0, 30).map(log => {
    const color = log.color || '#8c52ff';
    const icon = log.icon || 'fa-robot';
    const timeAgo = formatTimeAgo(log.timestamp);

    return `
      <div class="timeline-item">
        <div class="timeline-item-icon" style="background: ${color};">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="timeline-item-content">
          <div class="timeline-item-top">
            <span class="timeline-agent-tag" style="color: ${color};">${log.agentName || 'Agente IA'}</span>
            <span class="timeline-time">${timeAgo}</span>
          </div>
          <div class="timeline-title">${log.title}</div>
          <p class="timeline-desc">${log.description}</p>
        </div>
      </div>
    `;
  }).join('');
}

// Inicializar módulo de Agentes y Orquestador
function setupAgentsModule() {
  const btnRefresh = document.getElementById('btn-refresh-agents');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      btnRefresh.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      loadAgentsData().finally(() => {
        btnRefresh.innerHTML = '<i class="fa-solid fa-rotate"></i>';
      });
    });
  }

  // Modal Reclutar Agente
  const modal = document.getElementById('modal-create-agent');
  const btnOpen = document.getElementById('btn-open-create-agent');
  const btnClose = document.getElementById('btn-close-modal-agent');
  const btnCancel = document.getElementById('btn-cancel-modal-agent');
  const btnSubmit = document.getElementById('btn-submit-modal-agent');

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => modal.classList.remove('hidden'));
  }
  if (btnClose && modal) {
    btnClose.addEventListener('click', () => modal.classList.add('hidden'));
  }
  if (btnCancel && modal) {
    btnCancel.addEventListener('click', () => modal.classList.add('hidden'));
  }

  if (btnSubmit && modal) {
    btnSubmit.addEventListener('click', async () => {
      const name = document.getElementById('new-agent-name').value.trim();
      const role = document.getElementById('new-agent-role').value.trim();
      const cadence = document.getElementById('new-agent-cadence').value.trim();
      const color = document.getElementById('new-agent-color').value;
      const description = document.getElementById('new-agent-desc').value.trim();
      const systemPrompt = document.getElementById('new-agent-prompt').value.trim();

      if (!name || !role) {
        alert('Por favor ingresa al menos el Nombre y Rol del agente.');
        return;
      }

      btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reclutando...';
      btnSubmit.disabled = true;

      try {
        const res = await fetch('/api/life/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, role, cadence, color, description, systemPrompt })
        });
        const data = await res.json();
        if (data.success) {
          modal.classList.add('hidden');
          // Limpiar formulario
          document.getElementById('new-agent-name').value = '';
          document.getElementById('new-agent-role').value = '';
          document.getElementById('new-agent-cadence').value = '';
          document.getElementById('new-agent-desc').value = '';
          document.getElementById('new-agent-prompt').value = '';
          await loadAgentsData();
          alert(`🤖 ¡Agente "${name}" reclutado y activado en el enjambre!`);
        } else {
          alert(`Error: ${data.message || 'No se pudo crear el agente'}`);
        }
      } catch (err) {
        alert('Error al conectar con el servidor.');
      } finally {
        btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Activar y Reclutar Agente';
        btnSubmit.disabled = false;
      }
    });
  }

  // Chat con el Orquestador Maestro de Vida
  const chatForm = document.getElementById('orch-chat-form');
  const chatInput = document.getElementById('orch-input-text');
  const chatMessages = document.getElementById('orch-chat-messages');

  async function sendOrchestratorMessage(message) {
    if (!message || !chatMessages) return;

    // Agregar mensaje del usuario
    const userMsgHtml = `
      <div class="orch-msg orch-msg-user">
        <div class="orch-msg-avatar"><i class="fa-solid fa-user"></i></div>
        <div class="orch-msg-bubble"><strong>zVaito:</strong><br>${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>
    `;
    chatMessages.insertAdjacentHTML('beforeend', userMsgHtml);

    // Indicador de "pensando"
    const thinkingId = 'orch-thinking-' + Date.now();
    const thinkingHtml = `
      <div class="orch-msg orch-msg-ai" id="${thinkingId}">
        <div class="orch-msg-avatar"><i class="fa-solid fa-brain-circuit"></i></div>
        <div class="orch-msg-bubble">
          <em><i class="fa-solid fa-spinner fa-spin"></i> El Orquestador está coordinando con tus agentes...</em>
        </div>
      </div>
    `;
    chatMessages.insertAdjacentHTML('beforeend', thinkingHtml);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const res = await fetch('/api/life/orchestrator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      const thinkingElem = document.getElementById(thinkingId);
      if (thinkingElem) thinkingElem.remove();

      if (data.success && data.reply) {
        const replyFormatted = formatMarkdownOrText(data.reply);
        const aiMsgHtml = `
          <div class="orch-msg orch-msg-ai">
            <div class="orch-msg-avatar"><i class="fa-solid fa-brain-circuit"></i></div>
            <div class="orch-msg-bubble">
              <strong>Orquestador Maestro:</strong><br>
              ${replyFormatted}
            </div>
          </div>
        `;
        chatMessages.insertAdjacentHTML('beforeend', aiMsgHtml);
      } else {
        const errorHtml = `
          <div class="orch-msg orch-msg-ai">
            <div class="orch-msg-avatar"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div class="orch-msg-bubble" style="color: #ff6b6b;">
              <strong>Error:</strong> No se pudo obtener respuesta del Orquestador.
            </div>
          </div>
        `;
        chatMessages.insertAdjacentHTML('beforeend', errorHtml);
      }
    } catch (err) {
      const thinkingElem = document.getElementById(thinkingId);
      if (thinkingElem) thinkingElem.remove();
      const errorHtml = `
        <div class="orch-msg orch-msg-ai">
          <div class="orch-msg-avatar"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="orch-msg-bubble" style="color: #ff6b6b;">
            <strong>Error:</strong> Error de red al comunicar con el Orquestador.
          </div>
        </div>
      `;
      chatMessages.insertAdjacentHTML('beforeend', errorHtml);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = chatInput.value.trim();
      if (!msg) return;
      chatInput.value = '';
      sendOrchestratorMessage(msg);
    });
  }

  // Chips de sugerencia rápida
  document.querySelectorAll('.orch-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const query = btn.getAttribute('data-query');
      if (query) {
        sendOrchestratorMessage(query);
      }
    });
  });

  // Botones de ejecución manual de agentes en los banners de módulos individuales
  document.querySelectorAll('.btn-agent-trigger').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const agentId = btn.getAttribute('data-agent-id');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ejecutando misión...';
      btn.disabled = true;

      try {
        const res = await fetch(`/api/life/agents/${agentId}/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          alert(`✅ ${data.message || 'Misión ejecutada con éxito.'}`);
          // Recargar datos del módulo activo
          if (agentId === 'agent-hunter') loadLeadsData();
          if (agentId === 'agent-radar') loadSitemapsData();
          if (agentId === 'agent-sentinel') loadSecurityData();
          await loadAgentsData();
        } else {
          alert(`❌ Error al ejecutar misión: ${data.message || 'Fallo desconocido'}`);
        }
      } catch (err) {
        alert('❌ Error de conexión al disparar misión del agente.');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  });

  // Botones de pausar/activar agente en banners de módulos individuales
  document.querySelectorAll('.btn-agent-toggle').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const agentId = btn.getAttribute('data-agent-id');
      try {
        const res = await fetch(`/api/life/agents/${agentId}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          const isAct = data.status === 'active';
          btn.innerHTML = `<i class="fa-solid ${isAct ? 'fa-pause' : 'fa-play'}"></i> ${isAct ? 'Pausar Agente' : 'Activar Agente'}`;
          const pill = document.getElementById(`pill-status-${agentId}`);
          if (pill) {
            pill.className = `apb-status-pill ${isAct ? 'active' : 'paused'}`;
            pill.innerHTML = `<span class="pulse ${isAct ? 'green' : ''}"></span> ${isAct ? 'En Servicio' : 'Pausado'}`;
          }
          await loadAgentsData();
        }
      } catch (err) {
        console.error('Error al alternar estado del agente:', err);
      }
    });
  });
}



