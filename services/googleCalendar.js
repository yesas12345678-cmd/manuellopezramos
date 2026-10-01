import { google } from 'googleapis';

export function getGoogleCalendarClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

function createNaiveLocalIsoString(year, month, day, hours, minutes = 0) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;
}

function createSpainIsoString(year, month, day, hours, minutes = 0) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+02:00`;
}

function getRequiredHours(effortLevel) {
  if (effortLevel === undefined || effortLevel === null) return 2;
  if (typeof effortLevel === 'number') return effortLevel;
  const parsed = parseInt(effortLevel, 10);
  if (!isNaN(parsed)) return parsed;
  const legacyMap = { '1_day': 2, '2_days': 4, '3_days': 6 };
  return legacyMap[effortLevel] || 2;
}

function isPcPescaSummary(summary) {
  if (!summary) return false;
  const lower = summary.toLowerCase().trim();
  if (lower.includes('jornada de pesca')) return false;
  return lower.includes('pc o pesca') || lower === 'pc' || lower === 'pesca' || lower.includes('pc/pesca');
}

function isEmptyTimeBlock(summary) {
  if (!summary || !summary.trim()) return true;
  const s = summary.trim();
  const lower = s.toLowerCase();
  if (lower.startsWith('bloque libre') || lower.startsWith('bloque noche')) return true;
  const timeRangeRegex = /^\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}$/;
  if (timeRangeRegex.test(s)) return true;
  return false;
}

export async function getOrCreateExamenesCalendarId(accessToken) {
  const calendar = getGoogleCalendarClient(accessToken);
  try {
    const listResponse = await calendar.calendarList.list();
    const calendars = listResponse.data.items || [];
    const examenesCal = calendars.find(
      (c) => c.summary && (c.summary.toLowerCase().trim() === 'examenes' || c.summary.toLowerCase().trim() === 'exámenes')
    );
    if (examenesCal && examenesCal.id) return examenesCal.id;

    const newCalResponse = await calendar.calendars.insert({
      requestBody: { summary: 'examenes', timeZone: 'Europe/Madrid' },
    });
    return newCalResponse.data.id || 'primary';
  } catch (error) {
    console.warn("Fallo buscando o creando calendario 'examenes', se usará el primario:", error);
    return 'primary';
  }
}

export async function createAllDayExamEvent(accessToken, exam) {
  const calendar = getGoogleCalendarClient(accessToken);
  const calendarId = await getOrCreateExamenesCalendarId(accessToken);
  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `Examen: ${exam.name}`,
        start: { date: exam.date },
        end: { date: exam.date },
        colorId: '11',
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 540 }] },
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.message || 'No se pudo crear el evento de todo el día para el examen.');
  }
}

export async function createOrEnsurePcPescaForDate(accessToken, targetInput) {
  let dateObj;
  if (typeof targetInput === 'string') {
    if (!targetInput.includes('+') && !targetInput.includes('Z')) {
      const [dPart] = targetInput.split('T');
      const [y, m, d] = dPart.split('-').map(Number);
      dateObj = new Date(y, m - 1, d);
    } else {
      dateObj = new Date(targetInput);
    }
  } else {
    dateObj = targetInput;
  }

  const madridStr = dateObj.toLocaleString('en-US', { timeZone: 'Europe/Madrid' });
  const madridDate = new Date(madridStr);
  if (madridDate.getDay() !== 6) return;

  const year = madridDate.getFullYear();
  const month = madridDate.getMonth();
  const dateNum = madridDate.getDate();

  const start100Iso = createSpainIsoString(year, month, dateNum, 1, 0);
  const end130Iso = createSpainIsoString(year, month, dateNum, 1, 30);
  const queryMin = createSpainIsoString(year, month, dateNum, 0, 50);
  const queryMax = createSpainIsoString(year, month, dateNum, 2, 40);

  const calendar = getGoogleCalendarClient(accessToken);
  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: queryMin,
      timeMax: queryMax,
      singleEvents: true,
    });
    const items = response.data.items || [];
    const hasCorrectSlot = items.some((item) => {
      if (!isPcPescaSummary(item.summary)) return false;
      if (!item.start?.dateTime || !item.end?.dateTime) return false;
      const sM = new Date(new Date(item.start.dateTime).toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
      const eM = new Date(new Date(item.end.dateTime).toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
      return sM.getHours() === 1 && sM.getMinutes() === 0 && eM.getHours() === 1 && eM.getMinutes() === 30;
    });

    if (!hasCorrectSlot) {
      const existingPcPesca = items.find((item) => isPcPescaSummary(item.summary));
      if (existingPcPesca && existingPcPesca.id) {
        await calendar.events.patch({
          calendarId: 'primary',
          eventId: existingPcPesca.id,
          requestBody: {
            summary: 'pc o pesca',
            colorId: '10',
            reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
            start: { dateTime: start100Iso },
            end: { dateTime: end130Iso },
          },
        });
      } else {
        await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: 'pc o pesca',
            colorId: '10',
            reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
            start: { dateTime: start100Iso },
            end: { dateTime: end130Iso },
          },
        });
      }
    }
  } catch (err) {
    console.warn('Fallo creando/asegurando pc o pesca:', err);
  }
}

export async function getUpcomingCalendarEvents(accessToken, daysAhead = 14) {
  const calendar = getGoogleCalendarClient(accessToken);
  const now = new Date();
  const future = new Date();
  future.setDate(now.getDate() + daysAhead);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const items = response.data.items || [];
  const existingEventsList = [];
  for (const item of items) {
    const summary = item.summary ? item.summary.trim() : '';
    const evStartStr = item.start?.dateTime;
    const evEndStr = item.end?.dateTime;
    if (evStartStr && evEndStr) {
      const summaryLower = summary.toLowerCase();
      existingEventsList.push({
        startMs: new Date(evStartStr).getTime(),
        endMs: new Date(evEndStr).getTime(),
        summary,
        isStudy: summary.startsWith('Estudio:'),
        isFishing: summaryLower.includes('jornada de pesca'),
      });
    }
  }

  const resultSlots = [];
  for (let d = 0; d < daysAhead; d++) {
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const dayOfWeek = dayDate.getDay();
    const year = dayDate.getFullYear();
    const month = dayDate.getMonth();
    const dateNum = dayDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;

    const allowedHourRanges = [];
    if ([1, 2, 3, 4].includes(dayOfWeek)) {
      allowedHourRanges.push({ startH: 21, startM: 10, endH: 22, endM: 0, isNight: true });
      allowedHourRanges.push({ startH: 22, startM: 0, endH: 23, endM: 0, isNight: true });
    }
    if (dayOfWeek === 2) allowedHourRanges.push({ startH: 16, startM: 0, endH: 17, endM: 0 });
    if (dayOfWeek === 4) {
      allowedHourRanges.push({ startH: 16, startM: 0, endH: 17, endM: 0 });
      allowedHourRanges.push({ startH: 17, startM: 0, endH: 18, endM: 0 });
    }
    if ([6, 0].includes(dayOfWeek)) {
      allowedHourRanges.push({ startH: 10, startM: 0, endH: 11, endM: 0 });
      allowedHourRanges.push({ startH: 11, startM: 0, endH: 12, endM: 0 });
      allowedHourRanges.push({ startH: 12, startM: 0, endH: 13, endM: 0 });
      allowedHourRanges.push({ startH: 13, startM: 0, endH: 14, endM: 0 });
      allowedHourRanges.push({ startH: 14, startM: 0, endH: 15, endM: 0 });
      allowedHourRanges.push({ startH: 16, startM: 0, endH: 17, endM: 0 });
      allowedHourRanges.push({ startH: 17, startM: 0, endH: 18, endM: 0 });
    }
    if (dayOfWeek === 6) allowedHourRanges.push({ startH: 1, startM: 30, endH: 2, endM: 30, isNight: true });

    allowedHourRanges.sort((a, b) => a.startH * 60 + a.startM - (b.startH * 60 + b.startM));

    for (const range of allowedHourRanges) {
      const slotStartNaive = createNaiveLocalIsoString(year, month, dateNum, range.startH, range.startM);
      const slotEndNaive = createNaiveLocalIsoString(year, month, dateNum, range.endH, range.endM);
      const padSH = String(range.startH).padStart(2, '0');
      const padSM = String(range.startM).padStart(2, '0');
      const padEH = String(range.endH).padStart(2, '0');
      const padEM = String(range.endM).padStart(2, '0');

      const slotStartMs = new Date(createSpainIsoString(year, month, dateNum, range.startH, range.startM)).getTime();
      const slotEndMs = new Date(createSpainIsoString(year, month, dateNum, range.endH, range.endM)).getTime();

      const overlappingEv = existingEventsList.find(
        (ev) => ev.startMs < slotEndMs && ev.endMs > slotStartMs
      );

      const defaultSummary = range.isNight
        ? `Bloque Noche (${padSH}:${padSM} - ${padEH}:${padEM})`
        : `Bloque Libre (${padSH}:${padSM} - ${padEH}:${padEM})`;

      let slotSummary = defaultSummary;
      let isTimeBlock = true;
      let isFishing = false;
      let isOccupied = false;

      if (overlappingEv) {
        if (overlappingEv.isFishing) {
          slotSummary = overlappingEv.summary;
          isFishing = true;
          isTimeBlock = false;
        } else if (overlappingEv.isStudy) {
          slotSummary = overlappingEv.summary;
          isTimeBlock = true;
        } else {
          slotSummary = defaultSummary;
          isTimeBlock = true;
          isOccupied = true;
        }
      }

      resultSlots.push({
        id: `virtual_${padSH}${padSM}_${dateStr}`,
        summary: slotSummary,
        start: slotStartNaive,
        end: slotEndNaive,
        isTimeBlock,
        isVirtual: true,
        isDefaultNightSlot: range.isNight || false,
        isFishing,
        isOccupied,
      });
    }
  }
  return resultSlots;
}

export function groupConsecutiveSlots(slots) {
  if (slots.length === 0) return [];
  const sorted = [...slots].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const groups = [];
  let currentGroup = { startIso: sorted[0].start, endIso: sorted[0].end, slotIds: [sorted[0].id] };

  for (let i = 1; i < sorted.length; i++) {
    const prevEndMs = new Date(currentGroup.endIso).getTime();
    const nextStartMs = new Date(sorted[i].start).getTime();
    const diffMinutes = Math.abs((nextStartMs - prevEndMs) / (1000 * 60));
    const sameDay = new Date(currentGroup.startIso).toDateString() === new Date(sorted[i].start).toDateString();

    if (sameDay && diffMinutes <= 5) {
      currentGroup.endIso = sorted[i].end;
      currentGroup.slotIds.push(sorted[i].id);
    } else {
      groups.push(currentGroup);
      currentGroup = { startIso: sorted[i].start, endIso: sorted[i].end, slotIds: [sorted[i].id] };
    }
  }
  groups.push(currentGroup);
  return groups;
}

export async function syncSlotGroupInstance(accessToken, group, examName) {
  const calendar = getGoogleCalendarClient(accessToken);
  const newSummary = `Estudio: ${examName}`;
  let startIso = group.startIso;
  let endIso = group.endIso;

  if (startIso && !startIso.includes('+') && !startIso.includes('Z')) {
    const [dPart, tPart] = startIso.split('T');
    const [year, month, day] = dPart.split('-').map(Number);
    const [h, m] = tPart.split(':').map(Number);
    startIso = createSpainIsoString(year, month - 1, day, h, m);
  }
  if (endIso && !endIso.includes('+') && !endIso.includes('Z')) {
    const [dPart, tPart] = endIso.split('T');
    const [year, month, day] = dPart.split('-').map(Number);
    const [h, m] = tPart.split(':').map(Number);
    endIso = createSpainIsoString(year, month - 1, day, h, m);
  }

  if (startIso && endIso) {
    try {
      const targetWindowStart = new Date(startIso).getTime();
      const targetWindowEnd = new Date(endIso).getTime();
      const existingInWindow = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date(targetWindowStart - 60 * 1000).toISOString(),
        timeMax: new Date(targetWindowEnd + 60 * 1000).toISOString(),
        singleEvents: true,
      });
      for (const ev of existingInWindow.data.items || []) {
        if (!ev.id || ev.summary?.startsWith('Estudio:')) continue;
        const evStartMs = new Date(ev.start?.dateTime).getTime();
        const evEndMs = new Date(ev.end?.dateTime).getTime();
        if (evStartMs < targetWindowEnd && evEndMs > targetWindowStart) {
          try {
            await calendar.events.delete({ calendarId: 'primary', eventId: ev.id });
          } catch (delErr) {
            console.warn(`No se pudo eliminar evento previo ${ev.id}:`, delErr);
          }
        }
      }
    } catch (cleanErr) {
      console.warn('Fallo en la limpieza previa de franja unificada:', cleanErr);
    }
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: newSummary,
      colorId: '9',
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
      start: { dateTime: startIso },
      end: { dateTime: endIso },
    },
  });

  if (startIso) await createOrEnsurePcPescaForDate(accessToken, startIso);
  return response.data;
}

export async function scheduleFishingDay(accessToken, dateStr, startTime, endTime) {
  const calendar = getGoogleCalendarClient(accessToken);
  const [year, month, day] = dateStr.split('-').map(Number);
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const fishingDate = new Date(year, month - 1, day);
  const dayOfWeek = fishingDate.getDay();

  if (dayOfWeek !== 6 && dayOfWeek !== 0) {
    throw new Error('La jornada de pesca solo se puede programar en Sábado o Domingo.');
  }

  const targetDate = new Date(fishingDate);
  if (dayOfWeek === 6) targetDate.setDate(targetDate.getDate() + 1);
  else targetDate.setDate(targetDate.getDate() - 1);

  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetDayNum = targetDate.getDate();

  const fishingStartIso = createSpainIsoString(year, month - 1, day, startH, startM);
  const fishingEndIso = createSpainIsoString(year, month - 1, day, endH, endM);
  const fishingStartMs = new Date(fishingStartIso).getTime();
  const fishingEndMs = new Date(fishingEndIso).getTime();

  const listResponse = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date(fishingStartMs - 60 * 1000).toISOString(),
    timeMax: new Date(fishingEndMs + 60 * 1000).toISOString(),
    singleEvents: true,
  });

  const items = listResponse.data.items || [];
  const deletedTaskKeywords = ['getupp', 'artefactos a mano'];
  const movedEventsList = [];
  const deletedEventsList = [];

  for (const ev of items) {
    if (!ev.id) continue;
    const summaryTrim = (ev.summary || '').trim();
    if (summaryTrim.toLowerCase().includes('jornada de pesca')) continue;

    const evStartStr = ev.start?.dateTime;
    const evEndStr = ev.end?.dateTime;
    if (!evStartStr || !evEndStr) continue;

    const evStartMs = new Date(evStartStr).getTime();
    const evEndMs = new Date(evEndStr).getTime();
    if (!(evStartMs < fishingEndMs && evEndMs > fishingStartMs)) continue;

    const summaryLower = summaryTrim.toLowerCase();

    if (isEmptyTimeBlock(summaryTrim)) {
      try { await calendar.events.delete({ calendarId: 'primary', eventId: ev.id }); } catch (e) {}
      continue;
    }

    const shouldDelete = deletedTaskKeywords.some((kw) => summaryLower.includes(kw));
    if (shouldDelete) {
      try {
        await calendar.events.delete({ calendarId: 'primary', eventId: ev.id });
        deletedEventsList.push(summaryTrim);
      } catch (e) {}
    } else {
      let evSH = 0, evSM = 0, evEH = 0, evEM = 0;
      if (evStartStr.includes('T')) { const [, t] = evStartStr.split('T'); [evSH, evSM] = t.split(':').map(Number); }
      else { const d = new Date(evStartStr); evSH = d.getHours(); evSM = d.getMinutes(); }
      if (evEndStr.includes('T')) { const [, t] = evEndStr.split('T'); [evEH, evEM] = t.split(':').map(Number); }
      else { const d = new Date(evEndStr); evEH = d.getHours(); evEM = d.getMinutes(); }

      const newStartIso = createSpainIsoString(targetYear, targetMonth, targetDayNum, evSH, evSM);
      const newEndIso = createSpainIsoString(targetYear, targetMonth, targetDayNum, evEH, evEM);

      try {
        await calendar.events.patch({
          calendarId: 'primary',
          eventId: ev.id,
          requestBody: { start: { dateTime: newStartIso }, end: { dateTime: newEndIso } },
        });
        movedEventsList.push(summaryTrim);
      } catch (e) {}
    }
  }

  const timedEvent = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: 'Jornada de Pesca',
      start: { dateTime: fishingStartIso },
      end: { dateTime: fishingEndIso },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
    },
  });

  const allDaySummary = `jornada de pesca ${parseInt(startH)}-${parseInt(endH)}`;
  const allDayEvent = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: allDaySummary,
      start: { date: dateStr },
      end: { date: dateStr },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
    },
  });

  await createOrEnsurePcPescaForDate(accessToken, fishingDate);

  return {
    timedEvent: timedEvent.data,
    allDayEvent: allDayEvent.data,
    movedCount: movedEventsList.length,
    deletedCount: deletedEventsList.length,
    movedEvents: movedEventsList,
    deletedEvents: deletedEventsList,
  };
}

export { getRequiredHours };
