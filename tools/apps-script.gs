/**
 * Apero Restobar · Reservas web → Google Calendar → confirmación con QR (correo + WhatsApp)
 *
 * Qué hace:
 *  1. Cada reserva de elapero.cl crea un evento amarillo "POR CONFIRMAR" en el calendario del restaurant
 *     y le manda al cliente un correo de "solicitud recibida".
 *  2. Dentro del evento hay un enlace "CONFIRMAR". Al tocarlo:
 *       - el evento pasa a verde "CONFIRMADA",
 *       - el cliente recibe un correo con su QR,
 *       - se abre una pantalla con un botón para enviarle el QR por WhatsApp (un toque).
 *  3. Al llegar, escaneas el QR del cliente y se abre su reserva en Google Calendar.
 *  4. Entrega a la página el menú del día leyendo SOLO la hoja "MENU 2026" del archivo
 *     "Carta 2026 Apero.xlsx". Cambias el menú en tu archivo como siempre y la web se actualiza sola.
 *  Todo es gratis: usa la cuenta de Google del restaurant (Calendar + Gmail + Drive).
 *
 * Instalación (una sola vez, con la cuenta de Google del restaurant):
 *   1. https://script.google.com → Nuevo proyecto → pega este archivo completo.
 *   2. Configuración del proyecto (engranaje) → Zona horaria: (GMT-03:00) Santiago.
 *   3. Implementar → Nueva implementación → tipo "Aplicación web".
 *        Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario.
 *   4. Elige la función "instalarActualizacionMenu" arriba y toca Ejecutar (una vez).
 *      Autoriza los permisos (Calendar, Gmail, Drive, conexión externa para generar el QR).
 *   5. Copia la URL que termina en /exec, pégala abajo en URL_SCRIPT, guarda y
 *      vuelve a implementar (Implementar → Administrar implementaciones → editar → Versión nueva).
 *   6. Pásale esa misma URL a Claude para conectarla a la página.
 */

var URL_SCRIPT = 'https://script.google.com/macros/s/AKfycbzI5_2JbKOKBo-TqGVfANK-3kv-a8ssMPG1VxyTEbplUcTHMpSBBZ7ZcbVxMA9PkuEEKg/exec';          // ← pega aquí la URL /exec de esta implementación (paso 5)
var CALENDAR_ID = '';         // vacío = calendario principal; o el ID de un calendario "Reservas Apero"
var ARCHIVO_MENU_ID = '131_aUGtoXRIAwe8SW0S6V5WGBqQlcnjO';  // "Carta 2026 Apero.xlsx" en Drive
var HOJA_MENU = 'MENU 2026';                                   // solo se lee esta hoja
var PRECIO_SEMANA = 11900;      // lunes a viernes
var PRECIO_FINDE = 14900;       // sábado, domingo y feriados
var MENU_DESDE = 7 * 60;        // el menú del día se muestra desde las 7:00
var MENU_HASTA = 15 * 60 + 30;  // y se quita a las 15:30
var CAL_FERIADOS = 'es.cl#holiday@group.v.calendar.google.com';   // feriados de Chile (Google)
var SECRETO = '__SECRETO__';  // clave interna de los enlaces de confirmación; no la compartas
var SITIO = 'https://elapero.cl';
var DURACION_MIN = 120;
var MAX_PERSONAS = 10;
var WHATSAPP_RESTAURANT = '+56 9 6360 7900';
var DIRECCION = 'Av. Presidente Riesco 5330, local 101B, Las Condes';
var INSTAGRAM = 'https://www.instagram.com/apero_restobar';
var LUGARES = {
  es: { terraza: 'Terraza exterior', salon: 'Salón interior', '': 'Sin preferencia' },
  en: { terraza: 'Outdoor terrace', salon: 'Indoor dining room', '': 'No preference' },
  pt: { terraza: 'Terraço externo', salon: 'Salão interno', '': 'Sem preferência' }
};
var LUGAR_CORTO = { terraza: ' · TERRAZA', salon: ' · SALÓN', '': '' };

var TXT = {
  es: {
    recibidaAsunto: 'Recibimos tu solicitud de reserva · Apero Restobar',
    recibida: 'Recibimos tu solicitud de reserva. Te enviaremos la confirmación con tu código QR en breve.',
    confAsunto: 'Reserva CONFIRMADA · Apero Restobar',
    conf: 'Tu reserva está confirmada. Muestra este código QR al llegar: lo escaneamos para encontrar tu reserva y asignarte la mesa.',
    fecha: 'Fecha', hora: 'Hora', personas: 'Personas', codigo: 'Código', lugar: 'Lugar', pase: 'Ver mi pase',
    ig: '¡Síguenos en Instagram! Promociones, karaoke y novedades en @apero_restobar', igBtn: 'Seguir a @apero_restobar',
    cancAsunto: 'Reserva cancelada · Apero Restobar',
    canc: 'Tu reserva fue cancelada. Si quieres agendar otra fecha, escríbenos por WhatsApp al ' + '+56 9 6360 7900' + ' o reserva en elapero.cl. ¡Esperamos verte pronto!',
    waCanc: function (n, f, h) { return 'Hola ' + n + ', te escribimos de Apero Restobar: tu reserva del ' + f + ' a las ' + h + ' fue CANCELADA. Si quieres reagendar, responde este mensaje o reserva en https://elapero.cl. ¡Esperamos verte pronto!'; },
    wa: function (n, f, h, p, l, pase) { return 'Hola ' + n + ', tu reserva en Apero Restobar está CONFIRMADA para el ' + f + ' a las ' + h + ' (' + p + ' personas · ' + l + '). Este es tu pase con el código QR, muéstralo al llegar: ' + pase + '\n\n¡Síguenos en Instagram para enterarte de promociones y noches de karaoke! ' + INSTAGRAM; },
    loc: 'es-CL'
  },
  en: {
    recibidaAsunto: 'We received your booking request · Apero Restobar',
    recibida: 'We received your booking request. We will send you the confirmation with your QR code shortly.',
    confAsunto: 'Booking CONFIRMED · Apero Restobar',
    conf: 'Your booking is confirmed. Show this QR code when you arrive: we scan it to find your booking and seat you.',
    fecha: 'Date', hora: 'Time', personas: 'Guests', codigo: 'Code', lugar: 'Seating', pase: 'View my pass',
    ig: 'Follow us on Instagram! Deals, karaoke nights and news at @apero_restobar', igBtn: 'Follow @apero_restobar',
    cancAsunto: 'Booking cancelled · Apero Restobar',
    canc: 'Your booking has been cancelled. To book another date, message us on WhatsApp at +56 9 6360 7900 or book at elapero.cl. We hope to see you soon!',
    waCanc: function (n, f, h) { return 'Hi ' + n + ', this is Apero Restobar: your booking for ' + f + ' at ' + h + ' has been CANCELLED. To rebook, reply to this message or book at https://elapero.cl. We hope to see you soon!'; },
    wa: function (n, f, h, p, l, pase) { return 'Hi ' + n + ', your booking at Apero Restobar is CONFIRMED for ' + f + ' at ' + h + ' (' + p + ' guests · ' + l + '). Here is your pass with the QR code, show it when you arrive: ' + pase + '\n\nFollow us on Instagram for deals and karaoke nights! ' + INSTAGRAM; },
    loc: 'en-GB'
  },
  pt: {
    recibidaAsunto: 'Recebemos seu pedido de reserva · Apero Restobar',
    recibida: 'Recebemos seu pedido de reserva. Enviaremos a confirmação com seu QR code em breve.',
    confAsunto: 'Reserva CONFIRMADA · Apero Restobar',
    conf: 'Sua reserva está confirmada. Mostre este QR code ao chegar: escaneamos para encontrar sua reserva e indicar sua mesa.',
    fecha: 'Data', hora: 'Horário', personas: 'Pessoas', codigo: 'Código', lugar: 'Local', pase: 'Ver meu passe',
    ig: 'Siga-nos no Instagram! Promoções, karaokê e novidades em @apero_restobar', igBtn: 'Seguir @apero_restobar',
    cancAsunto: 'Reserva cancelada · Apero Restobar',
    canc: 'Sua reserva foi cancelada. Para agendar outra data, fale conosco pelo WhatsApp +56 9 6360 7900 ou reserve em elapero.cl. Esperamos ver você em breve!',
    waCanc: function (n, f, h) { return 'Olá ' + n + ', aqui é o Apero Restobar: sua reserva de ' + f + ' às ' + h + ' foi CANCELADA. Para reagendar, responda esta mensagem ou reserve em https://elapero.cl. Esperamos ver você em breve!'; },
    wa: function (n, f, h, p, l, pase) { return 'Olá ' + n + ', sua reserva no Apero Restobar está CONFIRMADA para ' + f + ' às ' + h + ' (' + p + ' pessoas · ' + l + '). Este é seu passe com o QR code, mostre ao chegar: ' + pase + '\n\nSiga-nos no Instagram para promoções e noites de karaokê! ' + INSTAGRAM; },
    loc: 'pt-BR'
  }
};

/* ---------- 1. Nueva reserva desde la web ---------- */
function doPost(e) {
  try {
    var r = JSON.parse(e.postData.contents);
    var nombre = limpio(r.name, 80), telefono = limpio(r.phone, 30), correo = limpio(r.email, 120).toLowerCase();
    var fecha = limpio(r.date, 10), hora = limpio(r.time, 5), codigo = limpio(r.code, 24);
    var personas = parseInt(r.people, 10);
    var lang = /^(es|en|pt)$/.test(r.lang) ? r.lang : 'es';
    var area = /^(terraza|salon)$/.test(r.area) ? r.area : '';
    if (!nombre || !/^AP-[\w-]+$/.test(codigo) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora) || !(personas >= 1 && personas <= MAX_PERSONAS)) {
      return json({ ok: false, error: 'datos inválidos' });
    }
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) correo = '';

    var p = fecha.split('-'), h = hora.split(':');
    var inicio = new Date(+p[0], +p[1] - 1, +p[2], +h[0], +h[1]);
    var fin = new Date(inicio.getTime() + DURACION_MIN * 60000);
    if (inicio.getTime() < Date.now() - 3600000) return json({ ok: false, error: 'fecha pasada' });

    var cal = calendario();
    if (cal.getEvents(inicio, fin, { search: codigo }).length) return json({ ok: true, duplicado: true });

    var ev = cal.createEvent('POR CONFIRMAR · ' + nombre + ' · ' + personas + ' pers.' + LUGAR_CORTO[area], inicio, fin, { location: 'Apero Restobar · ' + DIRECCION });
    ev.setColor(CalendarApp.EventColor.YELLOW);
    var datos = { code: codigo, name: nombre, phone: telefono, email: correo, date: fecha, time: hora, people: String(personas), lang: lang, area: area };
    Object.keys(datos).forEach(function (k) { ev.setTag(k, datos[k]); });

    var link = URL_SCRIPT ? URL_SCRIPT + '?a=confirmar&id=' + encodeURIComponent(ev.getId()) + '&k=' + firma(ev.getId()) : '(falta configurar URL_SCRIPT)';
    var linkCancelar = URL_SCRIPT ? URL_SCRIPT + '?a=cancelar&id=' + encodeURIComponent(ev.getId()) + '&k=' + firma('cancelar:' + ev.getId()) : '';
    ev.setDescription([
      'Código: ' + codigo,
      'Teléfono / WhatsApp: ' + telefono,
      'Correo: ' + (correo || '—'),
      'Personas: ' + personas,
      'Lugar: ' + LUGARES.es[area],
      'Motivo: ' + limpio(r.reason, 40),
      'Comentarios: ' + (limpio(r.notes, 500) || '—'),
      'Idioma: ' + lang,
      '',
      '✅ CONFIRMAR (pasa a verde, envía el correo con QR y abre WhatsApp con el QR listo):',
      link,
      '',
      '❌ CANCELAR (pasa a rojo, avisa al cliente por correo y abre WhatsApp con el aviso):',
      linkCancelar,
      '',
      'Al llegar el cliente: escanea su QR y anota la mesa en el título, por ejemplo "MESA 12".'
    ].join('\n'));

    if (correo) {
      var t = TXT[lang];
      MailApp.sendEmail({ to: correo, subject: t.recibidaAsunto, name: 'Apero Restobar', replyTo: Session.getEffectiveUser().getEmail(),
        htmlBody: correoHtml(t, datos, t.recibida, false) });
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ---------- 2. Confirmar desde el enlace del evento ---------- */
function doGet(e) {
  var q = e.parameter || {};
  if (q.a === 'menu') return json(menuActual());
  if (q.a === 'cancelar') return cancelar(q);
  if (q.a !== 'confirmar' || !q.id || q.k !== firma(q.id)) return pagina('Enlace no válido', '<p>Este enlace de confirmación no es válido.</p>');
  var ev = calendario().getEventById(q.id);
  if (!ev) return pagina('No encontrada', '<p>La reserva ya no existe en el calendario.</p>');

  var d = {}; ['code', 'name', 'phone', 'email', 'date', 'time', 'people', 'lang', 'area'].forEach(function (k) { d[k] = ev.getTag(k) || ''; });
  var t = TXT[d.lang] || TXT.es;
  var pase = paseUrl(d);
  if (ev.getTitle().indexOf('CANCELADA') === 0) return pagina('Reserva cancelada', '<p>Esta reserva ya fue cancelada; no se puede confirmar.</p>');
  var yaEstaba = ev.getTitle().indexOf('CONFIRMADA') === 0;
  var correoMsg = '';

  if (!yaEstaba) {
    ev.setTitle('CONFIRMADA · ' + d.name + ' · ' + d.people + ' pers.' + (LUGAR_CORTO[d.area] || ''));
    ev.setColor(CalendarApp.EventColor.GREEN);
    if (d.email) {
      var opts = { to: d.email, subject: t.confAsunto, name: 'Apero Restobar', replyTo: Session.getEffectiveUser().getEmail(), htmlBody: correoHtml(t, d, t.conf, true) };
      var qr = qrBlob(d.code);
      if (qr) opts.inlineImages = { qr: qr };
      else opts.htmlBody = correoHtml(t, d, t.conf, false);
      MailApp.sendEmail(opts);
      correoMsg = 'Correo con QR enviado a <b>' + esc(d.email) + '</b>.';
    } else {
      correoMsg = 'El cliente no dejó correo: envíale el QR por WhatsApp.';
    }
  } else {
    correoMsg = 'Esta reserva ya estaba confirmada (no se reenvió el correo).';
  }

  var fono = d.phone.replace(/\D/g, '');
  if (/^9\d{8}$/.test(fono)) fono = '56' + fono;
  var wa = 'https://wa.me/' + fono + '?text=' + encodeURIComponent(t.wa(d.name, fechaBonita(d.date, t.loc), d.time, d.people, lugarTxt(d), pase));

  return pagina('Reserva confirmada',
    '<p class="ok">✔ ' + esc(d.name) + ' · ' + esc(fechaBonita(d.date, 'es-CL')) + ' · ' + esc(d.time) + ' · ' + esc(d.people) + ' pers. · ' + esc(LUGARES.es[d.area || '']) + '</p>' +
    '<p>' + correoMsg + '</p>' +
    '<a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener">Enviar QR por WhatsApp</a>' +
    '<p class="small">Se abre WhatsApp con el mensaje y el link del pase listos; solo toca enviar.</p>' +
    '<a class="lnk" href="' + esc(pase) + '" target="_blank" rel="noopener">Ver el pase del cliente</a>');
}

/* ---------- 2b. Cancelar desde el enlace del evento ---------- */
function cancelar(q) {
  if (!q.id || q.k !== firma('cancelar:' + q.id)) return pagina('Enlace no válido', '<p>Este enlace de cancelación no es válido.</p>');
  var ev = calendario().getEventById(q.id);
  if (!ev) return pagina('No encontrada', '<p>La reserva ya no existe en el calendario.</p>');
  var d = {}; ['code', 'name', 'phone', 'email', 'date', 'time', 'people', 'lang', 'area'].forEach(function (k) { d[k] = ev.getTag(k) || ''; });
  var t = TXT[d.lang] || TXT.es;
  var msg = '';
  if (ev.getTitle().indexOf('CANCELADA') !== 0) {
    ev.setTitle('CANCELADA · ' + d.name + ' · ' + d.people + ' pers.' + (LUGAR_CORTO[d.area] || ''));
    ev.setColor(CalendarApp.EventColor.RED);
    if (d.email) {
      MailApp.sendEmail({ to: d.email, subject: t.cancAsunto, name: 'Apero Restobar', replyTo: Session.getEffectiveUser().getEmail(), htmlBody: correoHtml(t, d, t.canc, false) });
      msg = 'Se envió el aviso de cancelación a <b>' + esc(d.email) + '</b>.';
    } else {
      msg = 'El cliente no dejó correo: avísale por WhatsApp.';
    }
  } else {
    msg = 'Esta reserva ya estaba cancelada (no se reenvió el correo).';
  }
  var fono = d.phone.replace(/\D/g, '');
  if (/^9\d{8}$/.test(fono)) fono = '56' + fono;
  var wa = 'https://wa.me/' + fono + '?text=' + encodeURIComponent(t.waCanc(d.name, fechaBonita(d.date, t.loc), d.time));
  return pagina('Reserva cancelada',
    '<p class="no">✖ ' + esc(d.name) + ' · ' + esc(fechaBonita(d.date, 'es-CL')) + ' · ' + esc(d.time) + ' · ' + esc(d.people) + ' pers.</p>' +
    '<p>' + msg + '</p>' +
    '<a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener">Avisar por WhatsApp</a>' +
    '<p class="small">El evento queda en rojo en el calendario como registro. Si prefieres, puedes borrarlo.</p>');
}

/* ---------- 3. Menú del día desde "Carta 2026 Apero.xlsx" → hoja MENU 2026 ---------- */
// Lee la semana que corresponde a hoy (la tabla cuyo lunes es el más reciente <= hoy).
// Filas que se publican: ENTRADA, MENÚ 1/2/3 RESTAURANT, MENÚ 4 LIGHT, POSTRE DEL DÍA; precio y FERIADO por día.
var ETIQUETAS = { 'ENTRADA': 'entrada', 'MENU 1 RESTAURANT': 'm1', 'MENU 2 RESTAURANT': 'm2', 'MENU 3 RESTAURANT': 'm3', 'MENU 4 LIGHT': 'm4', 'POSTRE DEL DIA': 'postre' };

// La web recibe SOLO el menú de hoy (la competencia no puede ver los días siguientes).
function menuActual() {
  var hit = CacheService.getScriptCache().get('menu');
  var semana = hit ? JSON.parse(hit) : refrescarMenu();
  var ahora = new Date();
  var hoy = Utilities.formatDate(ahora, 'America/Santiago', 'yyyy-MM-dd');
  var dow = String(Number(Utilities.formatDate(ahora, 'America/Santiago', 'u')) % 7);  // 0 = domingo
  var min = Number(Utilities.formatDate(ahora, 'America/Santiago', 'H')) * 60 + Number(Utilities.formatDate(ahora, 'America/Santiago', 'm'));
  var out = { today: hoy, days: {} };
  // Horario de publicación: de 7:00 a 15:30 (hora de Chile). Fuera de ese horario no se entrega el menú.
  if (min < MENU_DESDE || min >= MENU_HASTA) { out.closed = true; return out; }
  var dia = semana.days && semana.days[dow];
  if (dia && dia.date === hoy) out.days[dow] = dia;
  return out;
}

function refrescarMenu() {
  var out = { week: '', days: {}, updated: new Date().toISOString() };
  try {
    var filas = leerHojaMenu();
    var hoy = Utilities.formatDate(new Date(), 'America/Santiago', 'yyyy-MM-dd');
    var fmt = function (d) { return d instanceof Date ? Utilities.formatDate(d, 'America/Santiago', 'yyyy-MM-dd') : ''; };
    var heads = [];
    filas.forEach(function (r, i) { if (norm(r[2]) === 'LUNES') heads.push(i); });
    var best = -1;
    heads.forEach(function (h) { var d = fmt((filas[h + 1] || [])[2]); if (d && d <= hoy) best = h; });
    if (best >= 0) {
      var sig = heads.filter(function (h) { return h > best; });
      var fin = sig.length ? sig[0] - 2 : filas.length;
      var precios = norm(filas[best - 1] && filas[best - 1][1]) === 'PRECIO' ? filas[best - 1] : null;
      var feriado = null, items = [];
      for (var i = best + 2; i < fin; i++) {
        var lab = norm(filas[i][1]);
        if (lab === 'FERIADO') feriado = filas[i];
        else if (ETIQUETAS[lab]) items.push([ETIQUETAS[lab], filas[i]]);
      }
      var dows = [1, 2, 3, 4, 5, 6, 0];
      out.week = fmt(filas[best + 1][2]);
      var feriadosChile = feriadosDeLaSemana(filas[best + 1][2]);
      for (var k = 0; k < 7; k++) {
        var col = 2 + k;
        var fecha = fmt(filas[best + 1][col]);
        var esFeriado = !!(feriado && String(feriado[col] || '').trim()) || feriadosChile.indexOf(fecha) >= 0;
        var dia = {
          date: fecha,
          // Regla de precios: L-V $11.900 · sábado, domingo y feriado $14.900
          price: String((k >= 5 || esFeriado) ? PRECIO_FINDE : PRECIO_SEMANA),
          feriado: esFeriado,
          items: items.filter(function (it) { return String(it[1][col] || '').trim(); })
                      .map(function (it) { return { k: it[0], text: String(it[1][col]).trim().slice(0, 600) }; })
        };
        if (dia.items.length || dia.feriado) out.days[String(dows[k])] = dia;
      }
    }
    CacheService.getScriptCache().put('menu', JSON.stringify(out), 1800);
  } catch (err) {
    out.error = 'menu no disponible';
  }
  return out;
}

// El archivo es .xlsx: se convierte una copia temporal para leerlo y se borra al tiro.
function leerHojaMenu() {
  var f = DriveApp.getFileById(ARCHIVO_MENU_ID);
  if (f.getMimeType() === MimeType.GOOGLE_SHEETS) return SpreadsheetApp.openById(ARCHIVO_MENU_ID).getSheetByName(HOJA_MENU).getDataRange().getValues();
  // Copia temporal convertida a Hoja de cálculo de Google (API de Drive vía UrlFetch: no requiere agregar servicios)
  var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + ARCHIVO_MENU_ID + '/copy?supportsAllDrives=true', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ name: 'tmp-menu-web (se borra sola)', mimeType: 'application/vnd.google-apps.spreadsheet' })
  });
  if (res.getResponseCode() !== 200) throw new Error('No se pudo leer el menú: ' + res.getContentText().slice(0, 200));
  var tmp = JSON.parse(res.getContentText());
  try {
    return SpreadsheetApp.openById(tmp.id).getSheetByName(HOJA_MENU).getDataRange().getValues();
  } finally {
    DriveApp.getFileById(tmp.id).setTrashed(true);
  }
}

// Fechas (AAAA-MM-DD) de feriados de Chile en la semana que parte en `lunes`, según el calendario público de Google.
function feriadosDeLaSemana(lunes) {
  try {
    if (!(lunes instanceof Date)) return [];
    var cal = CalendarApp.getCalendarById(CAL_FERIADOS) || CalendarApp.subscribeToCalendar(CAL_FERIADOS, { hidden: true });
    var ini = new Date(lunes.getTime()), fin = new Date(lunes.getTime() + 7 * 86400000);
    return cal.getEvents(ini, fin).map(function (ev) { return Utilities.formatDate(ev.getAllDayStartDate ? ev.getAllDayStartDate() : ev.getStartTime(), 'America/Santiago', 'yyyy-MM-dd'); });
  } catch (e) { return []; }
}

// Ejecutar UNA vez. Publica el menú del día todos los días a las 7:00,
// y además revisa cambios cada 10 minutos (si corriges algo en la planilla durante el día).
function instalarActualizacionMenu() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'refrescarMenu') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('refrescarMenu').timeBased().atHour(7).nearMinute(0).everyDays(1).inTimezone('America/Santiago').create();
  ScriptApp.newTrigger('refrescarMenu').timeBased().everyMinutes(10).create();
  refrescarMenu();
}

function norm(s) { return String(s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

/* ---------- utilidades ---------- */
function calendario() { return CALENDAR_ID ? CalendarApp.getCalendarById(CALENDAR_ID) : CalendarApp.getDefaultCalendar(); }
function limpio(v, max) { return String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function firma(id) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(id, SECRETO)).replace(/[^A-Za-z0-9]/g, '').slice(0, 22);   // solo letras y números: el enlace nunca termina en guion
}
function lugarTxt(d) { var L = LUGARES[d.lang] || LUGARES.es; return L[d.area || ''] || L['']; }
function paseUrl(d) {
  return SITIO + '/reserva.html?c=' + encodeURIComponent(d.code) + '&n=' + encodeURIComponent(d.name) + '&d=' + d.date +
    '&t=' + encodeURIComponent(d.time) + '&p=' + d.people + '&l=' + (d.lang || 'es') + (d.area ? '&a=' + d.area : '');
}
function fechaBonita(iso, loc) {
  var p = iso.split('-');
  var f = new Date(+p[0], +p[1] - 1, +p[2], 12);
  var dias = { 'es-CL': ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], 'en-GB': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], 'pt-BR': ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] };
  return (dias[loc] || dias['es-CL'])[f.getDay()] + ' ' + p[2] + '/' + p[1] + '/' + p[0];
}
// QR que abre la reserva en el Google Calendar del restaurant (generado gratis con quickchart.io)
function qrBlob(code) {
  try {
    var destino = 'https://calendar.google.com/calendar/r/search?q=' + encodeURIComponent(code);
    var r = UrlFetchApp.fetch('https://quickchart.io/qr?size=320&margin=2&ecLevel=M&text=' + encodeURIComponent(destino), { muteHttpExceptions: true });
    return r.getResponseCode() === 200 ? r.getBlob().setName('qr-' + code + '.png') : null;
  } catch (e) { return null; }
}
function correoHtml(t, d, mensaje, conQr) {
  var fila = function (a, b) { return '<tr><td style="padding:6px 0;color:#a99c86">' + a + '</td><td style="padding:6px 0;text-align:right;font-weight:600">' + esc(b) + '</td></tr>'; };
  return '<div style="background:#0d0b09;padding:24px 12px;font-family:Arial,sans-serif">' +
    '<div style="max-width:420px;margin:0 auto;background:#16130f;border:1px solid #c9973f;border-radius:12px;color:#ece3d2;overflow:hidden">' +
    '<div style="padding:18px 22px;border-bottom:1px dashed #c9973f"><div style="font-size:11px;letter-spacing:3px;color:#c9973f">APERO RESTOBAR</div>' +
    '<div style="font-size:20px;font-weight:bold;margin-top:4px">' + esc(d.name) + '</div></div>' +
    '<div style="padding:18px 22px"><p style="margin:0 0 14px;line-height:1.5">' + mensaje + '</p>' +
    (conQr ? '<div style="text-align:center;margin:10px 0 16px"><img src="cid:qr" width="220" height="220" alt="QR" style="background:#fff;padding:10px;border-radius:8px"></div>' : '') +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
    fila(t.codigo, d.code) + fila(t.fecha, fechaBonita(d.date, t.loc)) + fila(t.hora, d.time) + fila(t.personas, d.people) + fila(t.lugar, lugarTxt(d)) + '</table>' +
    (conQr || mensaje === t.conf ? '<p style="text-align:center;margin:18px 0 0"><a href="' + esc(paseUrl(d)) + '" style="display:inline-block;background:#c9973f;color:#1a1206;padding:11px 22px;border-radius:999px;text-decoration:none;font-weight:bold">' + t.pase + '</a></p>' : '') +
    '<div style="margin:20px 0 0;padding:14px;border:1px solid #3a2f1f;border-radius:10px;text-align:center"><p style="margin:0 0 10px;font-size:14px;line-height:1.4">' + t.ig + '</p>' +
    '<a href="' + INSTAGRAM + '" style="display:inline-block;background:linear-gradient(45deg,#f58529,#dd2a7b,#8134af);color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:bold">' + t.igBtn + '</a></div>' +
    '</div><div style="padding:12px 22px;border-top:1px solid #3a2f1f;font-size:12px;color:#a99c86;text-align:center">' + DIRECCION + '<br>WhatsApp ' + WHATSAPP_RESTAURANT + '</div></div></div>';
}
function pagina(titulo, cuerpo) {
  var html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_top"><style>' +
    'body{margin:0;background:#0d0b09;color:#ece3d2;font:16px/1.5 Arial,sans-serif}main{max-width:440px;margin:0 auto;padding:28px 18px;display:grid;gap:14px}' +
    'h1{font:bold 1.6rem Georgia,serif;margin:0}p{margin:0}.ok{color:#8fd4a8;font-weight:bold}.no{color:#f08b7f;font-weight:bold}.small{color:#a99c86;font-size:.85rem}' +
    '.btn{display:block;text-align:center;background:#25d366;color:#05210f;padding:15px;border-radius:999px;font-weight:bold;text-decoration:none;font-size:1.05rem}.lnk{color:#e6c17a}' +
    '</style></head><body><main><h1>' + esc(titulo) + '</h1>' + cuerpo + '</main></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(titulo + ' · Apero').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
