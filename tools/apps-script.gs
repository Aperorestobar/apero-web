/**
 * Apero Restobar · Reservas web → Google Calendar → confirmación con QR (correo + WhatsApp)
 *
 * Qué hace:
 *  1. Cada reserva de elapero.cl llega como CORREO a la bandeja del restaurant (contacto@elapero.cl)
 *     con los botones CONFIRMAR y CANCELAR, y el cliente recibe un correo de "solicitud recibida".
 *  2. Al tocar CONFIRMAR en ese correo:
 *       - se crea el evento verde "CONFIRMADA" en Google Calendar,
 *       - el cliente recibe un correo con su QR,
 *       - se abre una pantalla con un botón para enviarle el QR por WhatsApp (un toque).
 *     CANCELAR le avisa al cliente (no se agrega nada al calendario).
 *  3. Al llegar, escaneas el QR del cliente y se abre su reserva en Google Calendar.
 *  4. Entrega a la página el menú del día leyendo el archivo "MENÚ PAGINA WEB APERO.xlsx"
 *     (hojas Hoja1 y Feriados). Cambias el menú en ese archivo y la web se actualiza sola.
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
var ARCHIVO_MENU_ID = '1BT9BTe0hiWYvpKKfWlGJYSoml524FWTd';  // "MENÚ PAGINA WEB APERO.xlsx" en Drive
var HOJA_MENU = 'Hoja1';            // hoja del menú semanal (si cambia de nombre, se usa la primera hoja)
var HOJA_FERIADOS = 'Feriados';     // hoja con la lista de feriados (Fecha | Feriado)
var PRECIO_SEMANA = 11900;      // lunes a viernes
var PRECIO_FINDE = 14900;       // sábado, domingo y feriados
var MENU_DESDE = 7 * 60;        // el menú del día se muestra desde las 7:00
var MENU_HASTA = 15 * 60 + 30;  // y se quita a las 15:30
// Feriados legales de Chile (fecha exacta). Para otro feriado, escribe algo en la fila FERIADO de la planilla.
var FERIADOS_CL = ['2026-10-12','2026-10-31','2026-11-01','2026-12-08','2026-12-25',
  '2027-01-01','2027-03-26','2027-03-27','2027-05-01','2027-05-21','2027-06-21','2027-06-28','2027-07-16','2027-08-15','2027-09-18','2027-09-19','2027-10-11','2027-10-31','2027-11-01','2027-12-08','2027-12-25'];
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

/* ---------- 1. Nueva reserva desde la web ----------
   La solicitud NO va al calendario: llega un correo a la bandeja de Apero con los botones
   CONFIRMAR y CANCELAR. Al confirmar se crea el evento en Google Calendar y el cliente recibe su QR. */
var CAMPOS = ['code', 'name', 'phone', 'email', 'date', 'time', 'people', 'lang', 'area', 'reason', 'notes'];
var ESTADO_PEND = 'pendiente', ESTADO_CONF = 'confirmada', ESTADO_CANC = 'cancelada';

function doPost(e) {
  try {
    var r = JSON.parse(e.postData.contents);
    if (r.tipo === 'pregunta') return json(guardarPregunta(r));
    var nombre = limpio(r.name, 80), telefono = limpio(r.phone, 30), correo = limpio(r.email, 120).toLowerCase();
    var fecha = limpio(r.date, 10), hora = limpio(r.time, 5), codigo = limpio(r.code, 24);
    var personas = parseInt(r.people, 10);
    var lang = /^(es|en|pt)$/.test(r.lang) ? r.lang : 'es';
    var area = /^(terraza|salon)$/.test(r.area) ? r.area : '';
    if (!nombre || !/^AP-[\w-]+$/.test(codigo) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora) || !(personas >= 1 && personas <= MAX_PERSONAS)) {
      return json({ ok: false, error: 'datos inválidos' });
    }
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) correo = '';
    var inicio = inicioDe(fecha, hora);
    if (inicio.getTime() < Date.now() - 3600000) return json({ ok: false, error: 'fecha pasada' });
    if (leerReserva(codigo)) return json({ ok: true, duplicado: true });
    if (estaBloqueado(fecha, hora)) return json({ ok: false, error: 'bloqueado' });

    var d = { code: codigo, name: nombre, phone: telefono, email: correo, date: fecha, time: hora, people: String(personas), lang: lang, area: area,
      reason: limpio(r.reason, 40), notes: limpio(r.notes, 500), estado: ESTADO_PEND, creada: new Date().toISOString() };
    guardarReserva(d);
    limpiarReservasViejas();

    // Correo a la bandeja del restaurant con los botones Confirmar / Cancelar
    var aviso = { to: correoRestaurant(), subject: 'Nueva reserva por confirmar: ' + nombre + ' · ' + fechaBonita(fecha, 'es-CL') + ' ' + hora + ' · ' + personas + ' pers.',
      name: 'Reservas web Apero', htmlBody: correoRestaurantHtml(d) };
    if (correo) aviso.replyTo = correo;
    MailApp.sendEmail(aviso);

    // Acuse de recibo al cliente
    if (correo) {
      var t = TXT[lang];
      MailApp.sendEmail({ to: correo, subject: t.recibidaAsunto, name: 'Apero Restobar', replyTo: correoRestaurant(),
        htmlBody: correoHtml(t, d, t.recibida, false) });
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ---------- 2. Confirmar (desde el correo) → crea el evento en Google Calendar ---------- */
function doGet(e) {
  var q = e.parameter || {};
  if (q.a === 'menu') return json(menuActual());
  if (q.a === 'bloqueos') return json({ bloqueos: bloqueos() });
  if (q.a === 'cancelar') return cancelar(q);
  if (q.a !== 'confirmar' || !q.id) return pagina('Enlace no válido', '<p>Este enlace de confirmación no es válido.</p>');

  var d, ev = null, porCodigo = /^AP-[\w-]+$/.test(q.id);
  if (porCodigo) {
    if (q.k !== firma('confirmar:' + q.id)) return pagina('Enlace no válido', '<p>Este enlace de confirmación no es válido.</p>');
    d = leerReserva(q.id);
    if (!d) return pagina('No encontrada', '<p>No encontramos esta reserva.</p>');
    if (d.estado === ESTADO_CANC) return pagina('Reserva cancelada', '<p>Esta reserva ya fue cancelada; no se puede confirmar.</p>');
    ev = eventoDe(d);
  } else {   // enlaces antiguos (evento creado al reservar)
    if (q.k !== firma(q.id)) return pagina('Enlace no válido', '<p>Este enlace de confirmación no es válido.</p>');
    ev = calendario().getEventById(q.id);
    if (!ev) return pagina('No encontrada', '<p>La reserva ya no existe en el calendario.</p>');
    if (ev.getTitle().indexOf('CANCELADA') === 0) return pagina('Reserva cancelada', '<p>Esta reserva ya fue cancelada; no se puede confirmar.</p>');
    d = {}; CAMPOS.forEach(function (k) { d[k] = ev.getTag(k) || ''; });
  }

  var t = TXT[d.lang] || TXT.es;
  var pase = paseUrl(d);
  var yaEstaba = porCodigo ? d.estado === ESTADO_CONF : ev.getTitle().indexOf('CONFIRMADA') === 0;
  var correoMsg = '', calMsg = '';

  if (!yaEstaba) {
    if (!ev) ev = crearEvento(d);
    ev.setTitle('CONFIRMADA · ' + d.name + ' · ' + d.people + ' pers.' + (LUGAR_CORTO[d.area] || ''));
    ev.setColor(CalendarApp.EventColor.GREEN);
    if (porCodigo) { d.estado = ESTADO_CONF; d.evento = ev.getId(); guardarReserva(d); }
    calMsg = 'Agregada a Google Calendar.';
    if (d.email) {
      var opts = { to: d.email, subject: t.confAsunto, name: 'Apero Restobar', replyTo: correoRestaurant(), htmlBody: correoHtml(t, d, t.conf, true) };
      var qr = qrBlob(d.code);
      if (qr) opts.inlineImages = { qr: qr };
      else opts.htmlBody = correoHtml(t, d, t.conf, false);
      MailApp.sendEmail(opts);
      correoMsg = 'Correo con QR enviado a <b>' + esc(d.email) + '</b>.';
    } else {
      correoMsg = 'El cliente no dejó correo: envíale el QR por WhatsApp.';
    }
  } else {
    if (!ev && porCodigo) { ev = crearEvento(d); ev.setTitle('CONFIRMADA · ' + d.name + ' · ' + d.people + ' pers.' + (LUGAR_CORTO[d.area] || '')); ev.setColor(CalendarApp.EventColor.GREEN); d.evento = ev.getId(); guardarReserva(d); calMsg = 'El evento no estaba en el calendario: se volvió a crear.'; }
    else calMsg = 'Ya está en Google Calendar.';
    correoMsg = 'Esta reserva ya estaba confirmada (no se reenvió el correo).';
  }

  var wa = 'https://wa.me/' + fonoWa(d.phone) + '?text=' + encodeURIComponent(t.wa(d.name, fechaBonita(d.date, t.loc), d.time, d.people, lugarTxt(d), pase));
  return pagina('Reserva confirmada',
    '<p class="ok">✔ ' + esc(d.name) + ' · ' + esc(fechaBonita(d.date, 'es-CL')) + ' · ' + esc(d.time) + ' · ' + esc(d.people) + ' pers. · ' + esc(LUGARES.es[d.area || '']) + '</p>' +
    '<p>' + calMsg + ' ' + correoMsg + '</p>' +
    '<a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener">Enviar QR por WhatsApp</a>' +
    '<p class="small">Se abre WhatsApp con el mensaje y el link del pase listos; solo toca enviar.</p>' +
    '<a class="lnk" href="' + esc(pase) + '" target="_blank" rel="noopener">Ver el pase del cliente</a>');
}

/* ---------- 2b. Cancelar (desde el correo o el evento) ---------- */
function cancelar(q) {
  var d, ev = null, porCodigo = /^AP-[\w-]+$/.test(q.id || '');
  if (!q.id || q.k !== firma('cancelar:' + q.id)) return pagina('Enlace no válido', '<p>Este enlace de cancelación no es válido.</p>');
  if (porCodigo) {
    d = leerReserva(q.id);
    if (!d) return pagina('No encontrada', '<p>No encontramos esta reserva.</p>');
    ev = eventoDe(d);
  } else {
    ev = calendario().getEventById(q.id);
    if (!ev) return pagina('No encontrada', '<p>La reserva ya no existe en el calendario.</p>');
    d = {}; CAMPOS.forEach(function (k) { d[k] = ev.getTag(k) || ''; });
  }
  var t = TXT[d.lang] || TXT.es;
  var yaEstaba = porCodigo ? d.estado === ESTADO_CANC : ev.getTitle().indexOf('CANCELADA') === 0;
  var msg = '';
  if (!yaEstaba) {
    if (ev) { ev.setTitle('CANCELADA · ' + d.name + ' · ' + d.people + ' pers.' + (LUGAR_CORTO[d.area] || '')); ev.setColor(CalendarApp.EventColor.RED); }
    if (porCodigo) { d.estado = ESTADO_CANC; guardarReserva(d); }
    if (d.email) {
      MailApp.sendEmail({ to: d.email, subject: t.cancAsunto, name: 'Apero Restobar', replyTo: correoRestaurant(), htmlBody: correoHtml(t, d, t.canc, false) });
      msg = 'Se envió el aviso de cancelación a <b>' + esc(d.email) + '</b>.';
    } else {
      msg = 'El cliente no dejó correo: avísale por WhatsApp.';
    }
  } else {
    msg = 'Esta reserva ya estaba cancelada (no se reenvió el correo).';
  }
  var wa = 'https://wa.me/' + fonoWa(d.phone) + '?text=' + encodeURIComponent(t.waCanc(d.name, fechaBonita(d.date, t.loc), d.time));
  return pagina('Reserva cancelada',
    '<p class="no">✖ ' + esc(d.name) + ' · ' + esc(fechaBonita(d.date, 'es-CL')) + ' · ' + esc(d.time) + ' · ' + esc(d.people) + ' pers.</p>' +
    '<p>' + msg + '</p>' +
    '<a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener">Avisar por WhatsApp</a>' +
    (ev ? '<p class="small">El evento queda en rojo en el calendario como registro.</p>' : '<p class="small">No se agregó nada al calendario.</p>'));
}

/* ---------- "Cerebro" del asistente: qué pregunta la gente (planilla privada en el Drive del restaurant) ---------- */
var TEMAS_ES = { reserve: 'Reservas', hours: 'Horarios', where: 'Ubicación', karaoke: 'Karaoke', events: 'Eventos', promo: 'Promociones / Happy Hour',
  lunch: 'Menú del día', meat: 'Carnes', fish: 'Pescados y mariscos', pasta: 'Pastas', salad: 'Ensaladas', dessert: 'Postres', veg: 'Vegetariano',
  share: 'Para compartir', burger: 'Hamburguesas / sándwiches', kids: 'Menú niños', starter: 'Entradas', chilean: 'Comida chilena', eat: 'Comida (general)',
  noalc: 'Sin alcohol', beer: 'Cervezas', gin: 'Gin', wine: 'Vinos', spirits: 'Destilados y shots', bottle: 'Botellas', cocktail: 'Tragos / coctelería',
  fruity: 'Tragos frutales', citrus: 'Tragos cítricos', bitter: 'Aperitivos amargos', otro: 'Otro' };
function guardarPregunta(r) {
  try {
    var q = limpio(r.q, 300);
    if (!q) return { ok: false };
    var cache = CacheService.getScriptCache(), k = 'pq_' + Utilities.formatDate(new Date(), 'America/Santiago', 'yyyyMMddHHmm');
    var n = Number(cache.get(k) || 0); if (n > 60) return { ok: false, error: 'limite' };   // anti-spam: máx. 60 por minuto
    cache.put(k, String(n + 1), 120);
    var temas = String(r.tema || 'otro').split(',').map(function (x) { return TEMAS_ES[x] || 'Otro'; }).join(', ');
    var lang = /^(es|en|pt)$/.test(r.lang) ? r.lang : 'es';
    var ahora = new Date();
    cerebro().getSheetByName('Preguntas').appendRow([Utilities.formatDate(ahora, 'America/Santiago', 'yyyy-MM-dd'), Utilities.formatDate(ahora, 'America/Santiago', 'HH:mm'),
      { es: 'Español', en: 'Inglés', pt: 'Portugués' }[lang], q, temas, String(temas.split(', ')[0])]);
    return { ok: true };
  } catch (err) { return { ok: false }; }
}
function cerebro() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('CEREBRO_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (ss) return ss;
  ss = SpreadsheetApp.create('Cerebro Asistente Apero (privado)');
  var sh = ss.getSheets()[0]; sh.setName('Preguntas');
  sh.appendRow(['Fecha', 'Hora', 'Idioma', 'Pregunta', 'Temas', 'Tema principal']);
  sh.setFrozenRows(1); sh.getRange('1:1').setFontWeight('bold').setBackground('#16130f').setFontColor('#e6c17a');
  sh.setColumnWidth(4, 420); sh.setColumnWidth(5, 220);
  var res = ss.insertSheet('Resumen', 0);
  res.getRange('A1').setValue('🧠 Cerebro del Asistente Apero — qué pregunta la gente en elapero.cl').setFontWeight('bold').setFontSize(14);
  res.getRange('A2').setValue('Se actualiza solo con cada pregunta. Solo tú (contacto@elapero.cl) puedes ver este archivo.');
  res.getRange('A4').setValue('Temas más consultados').setFontWeight('bold');
  res.getRange('A5').setFormula('=IFERROR(QUERY(Preguntas!A2:F,"select F, count(A) where F is not null group by F order by count(A) desc label F \'Tema\', count(A) \'Veces\'",0),"Aún no hay preguntas")');
  res.getRange('D4').setValue('Preguntas más repetidas').setFontWeight('bold');
  res.getRange('D5').setFormula('=IFERROR(QUERY(ARRAYFORMULA(IF(Preguntas!D2:D="",,LOWER(TRIM(Preguntas!D2:D)))),"select Col1, count(Col1) where Col1 is not null group by Col1 order by count(Col1) desc limit 30 label Col1 \'Pregunta\', count(Col1) \'Veces\'",0),"Aún no hay preguntas")');
  res.getRange('G4').setValue('Preguntas por día').setFontWeight('bold');
  res.getRange('G5').setFormula('=IFERROR(QUERY(Preguntas!A2:A,"select A, count(A) where A is not null group by A order by A desc limit 31 label A \'Fecha\', count(A) \'Preguntas\'",0),"Aún no hay preguntas")');
  res.getRange('J4').setValue('Por idioma').setFontWeight('bold');
  res.getRange('J5').setFormula('=IFERROR(QUERY(Preguntas!C2:C,"select C, count(C) where C is not null group by C order by count(C) desc label C \'Idioma\', count(C) \'Veces\'",0),"")');
  res.setColumnWidth(1, 220); res.setColumnWidth(4, 360);
  props.setProperty('CEREBRO_ID', ss.getId());
  return ss;
}
// Ejecutar a mano si quieres el enlace del Cerebro (aparece en el registro de ejecución)
function enlaceCerebro() { var u = cerebro().getUrl(); Logger.log(u); return u; }

/* ---------- Bloqueos: cerrar reservas desde Google Calendar ----------
   Crea un evento en el calendario del restaurant cuyo título empiece con BLOQUEO (o CERRADO / SIN RESERVAS).
   Mientras dure ese evento, la web no ofrece horas para reservar. Evento de "todo el día" = día completo cerrado. */
var RX_BLOQUEO = /^\s*(BLOQUEO|BLOQUEADO|CERRADO|SIN RESERVAS)/i;
function bloqueos() {
  var cache = CacheService.getScriptCache(), hit = cache.get('bloqueos');
  if (hit) return JSON.parse(hit);
  var out = [];
  try {
    var ini = new Date(Date.now() - 86400000), fin = new Date(Date.now() + 150 * 86400000);
    calendario().getEvents(ini, fin).forEach(function (ev) {
      if (!RX_BLOQUEO.test(ev.getTitle())) return;
      var todo = ev.isAllDayEvent(), tz = todo ? Session.getScriptTimeZone() : 'America/Santiago';
      var a = todo ? ev.getAllDayStartDate() : ev.getStartTime(), b = todo ? ev.getAllDayEndDate() : ev.getEndTime();
      var d1 = Utilities.formatDate(a, tz, 'yyyy-MM-dd'), d2 = Utilities.formatDate(new Date(b.getTime() - 60000), tz, 'yyyy-MM-dd');
      var h1 = todo ? '00:00' : Utilities.formatDate(a, tz, 'HH:mm'), h2 = todo ? '24:00' : Utilities.formatDate(b, tz, 'HH:mm');
      for (var x = new Date(d1 + 'T12:00:00Z'), n = 0; n < 60; n++, x = new Date(x.getTime() + 86400000)) {
        var dia = Utilities.formatDate(x, 'UTC', 'yyyy-MM-dd');
        if (dia > d2) break;
        var hasta = dia === d2 ? h2 : '24:00';
        out.push({ d: dia, desde: dia === d1 ? h1 : '00:00', hasta: hasta === '00:00' ? '24:00' : hasta });
      }
    });
  } catch (e) {}
  cache.put('bloqueos', JSON.stringify(out), 300);
  return out;
}
function estaBloqueado(fecha, hora) {
  var m = function (x) { var p = x.split(':'); return +p[0] * 60 + +p[1]; };
  return bloqueos().some(function (b) { return b.d === fecha && m(hora) >= m(b.desde) && m(hora) < m(b.hasta); });
}

/* ---------- reservas guardadas (propiedades del script) ---------- */
function guardarReserva(d) { PropertiesService.getScriptProperties().setProperty('R_' + d.code, JSON.stringify(d)); }
function leerReserva(code) { var v = PropertiesService.getScriptProperties().getProperty('R_' + code); return v ? JSON.parse(v) : null; }
function limpiarReservasViejas() {
  try {
    var props = PropertiesService.getScriptProperties(), todo = props.getProperties();
    var limite = Utilities.formatDate(new Date(Date.now() - 45 * 86400000), 'America/Santiago', 'yyyy-MM-dd');
    Object.keys(todo).forEach(function (k) { if (k.indexOf('R_') === 0) { try { if (JSON.parse(todo[k]).date < limite) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); } } });
  } catch (e) {}
}
function inicioDe(fecha, hora) { var p = fecha.split('-'), h = hora.split(':'); return new Date(+p[0], +p[1] - 1, +p[2], +h[0], +h[1]); }
function eventoDe(d) {
  var cal = calendario();
  if (d.evento) { try { var ev = cal.getEventById(d.evento); if (ev) return ev; } catch (e) {} }
  var ini = inicioDe(d.date, d.time), evs = cal.getEvents(ini, new Date(ini.getTime() + DURACION_MIN * 60000), { search: d.code });
  return evs.length ? evs[0] : null;
}
function crearEvento(d) {
  var ini = inicioDe(d.date, d.time);
  var ev = calendario().createEvent('CONFIRMADA · ' + d.name + ' · ' + d.people + ' pers.' + (LUGAR_CORTO[d.area] || ''), ini, new Date(ini.getTime() + DURACION_MIN * 60000), { location: 'Apero Restobar · ' + DIRECCION });
  ['code', 'name', 'phone', 'email', 'date', 'time', 'people', 'lang', 'area'].forEach(function (k) { ev.setTag(k, d[k] || ''); });
  ev.setDescription([
    'Código: ' + d.code,
    'Teléfono / WhatsApp: ' + d.phone,
    'Correo: ' + (d.email || '—'),
    'Personas: ' + d.people,
    'Lugar: ' + LUGARES.es[d.area || ''],
    'Motivo: ' + (d.reason || '—'),
    'Comentarios: ' + (d.notes || '—'),
    'Idioma: ' + d.lang,
    '',
    '❌ Para CANCELAR (avisa al cliente por correo y abre WhatsApp con el aviso):',
    linkAccion('cancelar', d.code),
    '',
    'Al llegar el cliente: escanea su QR y anota la mesa en el título, por ejemplo "MESA 12".'
  ].join('\n'));
  return ev;
}
function linkAccion(accion, code) { return URL_SCRIPT + '?a=' + accion + '&id=' + encodeURIComponent(code) + '&k=' + firma(accion + ':' + code); }
function correoRestaurant() { return Session.getEffectiveUser().getEmail(); }
function fonoWa(tel) { var f = String(tel || '').replace(/\D/g, ''); if (/^9\d{8}$/.test(f)) f = '56' + f; return f; }
function correoRestaurantHtml(d) {
  var fila = function (a, b) { return '<tr><td style="padding:7px 0;color:#6b6257;width:38%">' + a + '</td><td style="padding:7px 0;font-weight:bold">' + esc(b || '—') + '</td></tr>'; };
  var wa = 'https://wa.me/' + fonoWa(d.phone);
  return '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1d1a16">' +
    '<div style="background:#16130f;color:#e6c17a;padding:16px 20px;border-radius:10px 10px 0 0;font-size:13px;letter-spacing:2px">APERO RESTOBAR · NUEVA RESERVA WEB</div>' +
    '<div style="border:1px solid #ddd;border-top:0;border-radius:0 0 10px 10px;padding:18px 20px">' +
    '<p style="margin:0 0 12px;font-size:20px;font-weight:bold">' + esc(d.name) + '</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:15px">' +
    fila('Fecha', fechaBonita(d.date, 'es-CL')) + fila('Hora', d.time) + fila('Personas', d.people) + fila('Lugar', LUGARES.es[d.area || '']) +
    fila('Teléfono', d.phone) + fila('Correo', d.email) + fila('Motivo', d.reason) + fila('Comentarios', d.notes) + fila('Idioma', d.lang) + fila('Código', d.code) +
    '</table>' +
    '<p style="margin:20px 0 8px"><a href="' + esc(linkAccion('confirmar', d.code)) + '" style="display:inline-block;background:#1e8e3e;color:#fff;padding:13px 26px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:16px">✔ CONFIRMAR</a>' +
    '&nbsp;&nbsp;<a href="' + esc(linkAccion('cancelar', d.code)) + '" style="display:inline-block;background:#c5221f;color:#fff;padding:13px 22px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:16px">✖ CANCELAR</a></p>' +
    '<p style="margin:6px 0 0;font-size:13px;color:#6b6257">CONFIRMAR agrega la reserva a Google Calendar y le envía al cliente su correo con el código QR. ' +
    'CANCELAR le avisa al cliente por correo. En ambos casos se abre una página con el botón para avisarle también por WhatsApp.</p>' +
    (d.phone ? '<p style="margin:12px 0 0;font-size:13px"><a href="' + esc(wa) + '" style="color:#1e8e3e">Escribirle por WhatsApp</a>' + (d.email ? ' · o responde este correo para escribirle al cliente.' : '') + '</p>' : '') +
    '</div></div>';
}

/* ---------- 3. Menú del día desde "MENÚ PAGINA WEB APERO.xlsx" ---------- */
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
    var libro = leerHojaMenu();
    var filas = libro.menu;
    var hoy = Utilities.formatDate(new Date(), 'America/Santiago', 'yyyy-MM-dd');
    var fmt = function (d) { return d instanceof Date ? Utilities.formatDate(d, 'America/Santiago', 'yyyy-MM-dd') : ''; };
    // Feriados: lista fija de Chile + hoja "Feriados" del archivo
    var feriadosLista = FERIADOS_CL.slice();
    (libro.feriados || []).forEach(function (r) { var f = fmt(r[0]); if (f) feriadosLista.push(f); });
    // Fila de fechas de cada semana: la que dice FECHA (o la que va bajo LUNES, formato antiguo)
    var filasFecha = [];
    filas.forEach(function (r, i) {
      if (!(r[2] instanceof Date)) return;
      if (norm(r[1]) === 'FECHA' || (i > 0 && norm(filas[i - 1][2]) === 'LUNES')) filasFecha.push(i);
    });
    var best = -1;
    filasFecha.forEach(function (h) { var d = fmt(filas[h][2]); if (d && d <= hoy) best = h; });
    if (best >= 0) {
      var feriado = null, items = [];
      for (var i = best + 1; i < filas.length; i++) {
        if (filasFecha.indexOf(i) >= 0) break;
        var lab = norm(filas[i][1]);
        if (lab === 'PRECIO' || lab === 'DIA' || lab.indexOf('MENU SEMANAL') === 0) break;
        if (lab === 'FERIADO') feriado = filas[i];
        else if (ETIQUETAS[lab]) items.push([ETIQUETAS[lab], filas[i]]);
      }
      var dows = [1, 2, 3, 4, 5, 6, 0];
      out.week = fmt(filas[best][2]);
      for (var k = 0; k < 7; k++) {
        var col = 2 + k;
        var fechaD = filas[best][col];
        var fecha = fmt(fechaD);
        if (!fecha) continue;
        var dow = Number(Utilities.formatDate(fechaD, 'America/Santiago', 'u')) % 7;   // 0 = domingo, según la fecha real
        var feriadoHoja = feriado ? textoFeriado(feriado[col]) : false;
        var esFeriado = feriadoHoja || feriadosLista.indexOf(fecha) >= 0;
        var dia = {
          date: fecha,
          // Regla de precios: L-V $11.900 · sábado, domingo y feriado $14.900
          price: String((dow === 0 || dow === 6 || esFeriado) ? PRECIO_FINDE : PRECIO_SEMANA),
          feriado: esFeriado,
          feriadoHoja: feriadoHoja,
          items: items.filter(function (it) { return String(it[1][col] || '').trim(); })
                      .map(function (it) { var tx = String(it[1][col]).trim().slice(0, 600); return { k: it[0], text: tx, text_en: traducir(tx, 'en'), text_pt: traducir(tx, 'pt') }; })
        };
        if (dia.items.length || dia.feriado) out.days[String(dow)] = dia;
      }
    }
    CacheService.getScriptCache().put('menu', JSON.stringify(out), 1800);
  } catch (err) {
    out.error = 'menu no disponible';
  }
  return out;
}

// El archivo es .xlsx: se convierte una copia temporal para leerlo y se borra al tiro.
// Devuelve { menu: filas de la hoja del menú, feriados: filas de la hoja Feriados }.
function leerHojaMenu() {
  var leer = function (ss) {
    var hm = ss.getSheetByName(HOJA_MENU) || ss.getSheets()[0];
    var hf = ss.getSheetByName(HOJA_FERIADOS);
    return { menu: hm.getDataRange().getValues(), feriados: hf ? hf.getDataRange().getValues() : [] };
  };
  var f = DriveApp.getFileById(ARCHIVO_MENU_ID);
  if (f.getMimeType() === MimeType.GOOGLE_SHEETS) return leer(SpreadsheetApp.openById(ARCHIVO_MENU_ID));
  // Copia temporal convertida a Hoja de cálculo de Google (API de Drive vía UrlFetch: no requiere agregar servicios)
  var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + ARCHIVO_MENU_ID + '/copy?supportsAllDrives=true', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ name: 'tmp-menu-web (se borra sola)', mimeType: 'application/vnd.google-apps.spreadsheet' })
  });
  if (res.getResponseCode() !== 200) throw new Error('No se pudo leer el menú: ' + res.getContentText().slice(0, 200));
  var tmp = JSON.parse(res.getContentText());
  try {
    return leer(SpreadsheetApp.openById(tmp.id));
  } finally {
    DriveApp.getFileById(tmp.id).setTrashed(true);
  }
}

// La fila FERIADO trae una fórmula (BUSCARX a otra planilla). Al leerla desde Google puede venir
// un error, un 0, FALSE o una fecha: solo cuenta como feriado si trae un nombre de verdad (ej. "Día de la Raza").
function textoFeriado(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'number' || typeof v === 'boolean' || v instanceof Date) return false;
  var t = String(v).trim();
  if (!t || /^#/.test(t) || /^(0|false|true|n\/a|ref|error|loading)/i.test(t)) return false;
  return /[A-Za-zÁÉÍÓÚáéíóúÑñ]{3,}/.test(t);
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

// Traducción automática del menú (Google Translate incluido en Apps Script), guardada 6 horas para no repetirla.
function traducir(texto, idioma) {
  if (!texto) return '';
  try {
    var cache = CacheService.getScriptCache();
    var clave = 'tr_' + idioma + '_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, texto, Utilities.Charset.UTF_8));
    var hit = cache.get(clave);
    if (hit) return hit;
    var out = LanguageApp.translate(texto, 'es', idioma);
    if (out) cache.put(clave, out, 21600);
    return out || '';
  } catch (e) { return ''; }
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
