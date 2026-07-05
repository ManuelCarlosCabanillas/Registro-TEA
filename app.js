(function () {
  'use strict';

  var STORE_KEY = 'appTEA.v1';
  var DATA_VERSION = 15;

  // ===== Config Supabase (claves públicas de cliente) =====
  var SUPABASE_URL = 'https://ntsgnvfmvlokujmddyjj.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50c2dudmZtdmxva3VqbWRkeWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMDkxMjIsImV4cCI6MjA5ODc4NTEyMn0.5SBvapEbuTgOh64RN-krs3ubBlMRTPmq1aXJqn5hkFE';

  var MOMENTS = [
    { key: 'Mañana', em: '🌅', cls: 'm-manana' },
    { key: 'Mediodía', em: '☀️', cls: 'm-mediodia' },
    { key: 'Tarde', em: '🌇', cls: 'm-tarde' },
    { key: 'Noche', em: '🌙', cls: 'm-noche' }
  ];
  function momentFromTime(t) { if (!t) return null; var h = +t.split(':')[0]; return h < 13 ? 'Mañana' : h < 16 ? 'Mediodía' : h < 20 ? 'Tarde' : 'Noche'; }
  function nowMoment() { var h = new Date().getHours(); return h < 13 ? 'Mañana' : h < 16 ? 'Mediodía' : h < 20 ? 'Tarde' : 'Noche'; }
  function momentEm(m) { var f = MOMENTS.find(function (x) { return x.key === m; }); return f ? f.em : '•'; }
  function momentOf(e) { return e.moment || momentFromTime(e.time) || 'Tarde'; }
  // Etiqueta fina de la tarde: '1ª tarde' (antes de la siesta) / '2ª tarde' (después).
  // Derivada automáticamente de la siesta del día; para otros momentos devuelve el momento.
  // (Helper para las Fases 1-2; no se pide nunca al usuario.)
  function tardeLabel(e) {
    if (momentOf(e) !== 'Tarde') return momentOf(e);
    var nap = data.entries.find(function (x) { return x.type === 'nap' && x.date === e.date && (x.start || x.end); });
    if (!nap) return 'Tarde';
    var ref = toMin(nap.end || nap.start), evMin = e.time ? toMin(e.time) : null;
    if (evMin == null || ref == null) return 'Tarde';
    return evMin < toMin(nap.start || nap.end) ? '1ª tarde' : '2ª tarde';
  }

  var ZONES = [
    { val: 'Calma', em: '🙂', cls: 'z-green', color: '#639922' },
    { val: 'Nervioso', em: '😬', cls: 'z-amber', color: '#EF9F27' },
    { val: 'Bajo', em: '😔', cls: 'z-blue', color: '#378ADD' },
    { val: 'Desbordado', em: '😣', cls: 'z-red', color: '#E24B4A' }
  ];
  var LAT = ['<15 min', '15–30 min', '30–60 min', '>60 min'];
  var QUAL = [{ v: 1, e: '😖' }, { v: 2, e: '😕' }, { v: 3, e: '😐' }, { v: 4, e: '🙂' }, { v: 5, e: '😄' }];
  var WAKES = ['0', '1', '2', '3+'];
  var AIDS = ['Melatonina', 'Colecho', 'Ruido blanco', 'Luz tenue', 'Cuento', 'Chupete', 'Bibe', 'Masaje', 'Presión'];
  // ----- Sueño 360º (Fase 1) -----
  var DESPERTAR_COMO = ['Solo', 'Le despierto', 'Llorando'];
  var DESPERTAR_ESTADO = ['Bien', 'Alegre', 'Cansado', 'Lloro', 'Reactivo'];
  var ACUESTO_FACIL = ['Fácil', 'Difícil', 'Se reactiva'];
  var DONDE_DORMIR = ['Cama', 'Sofá', 'Carro', 'Otro'];
  var QUIEN_DORMIR = ['Solo', 'Acompañado'];
  var CALIDAD_TEXTO = [{ v: 'Buena', c: 4 }, { v: '≈ Buena', c: 3 }, { v: 'Movida', c: 2 }, { v: 'Mala', c: 1 }];
  var NOCHE_EVENTOS = ['Calambres', 'Palpitaciones', 'Se despierta y vuelve', 'Se sienta', 'Mucho movimiento', 'Respiración / nariz', 'Llanto', 'Sudor', 'Otro'];
  var NAP_ACUESTO = ['Fácil', 'Difícil', 'Tumbado sin dormir'];
  var NAP_DESPERTAR = ['Solo', 'Le despierto', 'No hay manera'];
  // ----- Observaciones de estado (Fase 2). Taxonomía del cuidador, editable (obsCustom). -----
  var OBS_GROUPS = [
    { g: 'Cuerpo', items: ['Puntillas', 'Desequilibrio', 'Se cae', 'Loqui / como pelota', 'No para', 'Saltos', 'Trepar / fuerza', 'Espectáculo', 'Tenso'] },
    { g: 'Voz / habla', items: ['Gritos', 'Sube el tono', 'Habla mal', 'Habla bien', 'Habla acelerado', 'Se queda callado', 'Bloqueo'] },
    { g: 'Energía', items: ['Cansado', 'Bostezos', 'Se tumba', 'Fatiga tranquila', 'Chupete / bibe', 'Se reactiva', 'Se dispara'] },
    { g: 'Emoción', items: ['Lloro', 'Aguanta el lloro', 'Alegre', 'Nervioso', 'Emoción', 'Miedo / susto'] },
    { g: 'Sensorial', items: ['Molesta ruido', 'Pide tapones', 'Molesta luz', 'Se tapa oídos'] },
    { g: 'En positivo', items: ['Tranquilo bien', 'Alegre bien', 'TODO BIEN', 'Colabora', 'Con ganas', 'Juega solo tranquilo', 'Habla muy bien'] }
  ];
  function obsSenalesFlat() { var a = []; OBS_GROUPS.forEach(function (grp) { a = a.concat(grp.items); }); a = a.concat((data.child && data.child.obsCustom) || []); return a; }
  var OBS_VALENCIA = [{ v: 'Bien', em: '🙂', cls: 'val-good' }, { v: 'Regular', em: '😐', cls: 'val-mid' }, { v: 'Difícil', em: '😣', cls: 'val-bad' }];
  // ----- Cuerpo y salud (Fase 3) -----
  var SALUD_SUBTIPOS = [
    { k: 'Deposición', em: '💩' }, { k: 'Pipí', em: '💧' }, { k: 'Calambres', em: '⚡' },
    { k: 'Palpitaciones', em: '💓' }, { k: 'Dolor', em: '🤕' }, { k: 'Mocos / enfermedad', em: '🤧' },
    { k: 'Medicación', em: '💊' }, { k: 'Otro', em: '➕' }
  ];
  var DEPOSICION_DETALLE = ['Normal', 'Dura', 'Blanda', 'Diarrea'];
  function saludEm(sub) { var f = SALUD_SUBTIPOS.find(function (x) { return x.k === sub; }); return f ? f.em : '🩺'; }
  var MEAL_ACCEPT = [{ v: 'Comió bien', l: '✓ Comió bien' }, { v: 'Con dificultad', l: '~ Con dificultad' }, { v: 'Lo rechazó', l: '✕ Lo rechazó' }];

  var ACT_TYPES = ['Juego con mamá', 'Juego con papá', 'Juego con otro adulto', 'Juego con otros niños', 'Juego solo', 'Paseo', 'Deporte', 'Parque', 'Piscina', 'Excursión / monte', 'Estudio / deberes', 'Colegio', 'Terapia', 'Médico', 'Pantalla', 'Llamada / vídeo', 'Música', 'Lectura / cuento', 'Manualidades', 'Comida en familia', 'Rutina de dormir', 'Visita / familia', 'Supermercado', 'Otra'];
  var ACT_LUGAR = ['Casa', 'Calle', 'Cole', 'Casa de otros', 'Aire libre', 'Coche', 'Otro'];
  var ACT_DURACION = ['<15 min', '15–30 min', '30–60 min', '1–2 h', '>2 h'];
  var ACT_COMPANIA = ['Otro adulto', 'Otros niños', 'Solo'];   // genéricos; los nombres salen del directorio (Fase 4)
  var ACT_TERMINO = ['Bien', 'Regular', 'Con desajuste'];
  // ----- Personas, transiciones y rutinas (Fase 4) -----
  var PERSONA_TIPOS = ['Familia', 'Terapeuta', 'Amigo', 'Profe', 'Otro'];
  var SEED_PERSONAS = [
    { nombre: 'Mamá', tipo: 'Familia' }, { nombre: 'Papá', tipo: 'Familia' }, { nombre: 'Abuela', tipo: 'Familia' }, { nombre: 'Abuelo', tipo: 'Familia' },
    { nombre: 'María', tipo: 'Terapeuta' }, { nombre: 'Rocío', tipo: 'Terapeuta' }, { nombre: 'Logopeda', tipo: 'Terapeuta' }, { nombre: 'Aitor', tipo: 'Amigo' }
  ];
  function personas() { return (data.child && data.child.personas) || []; }
  function personaNames() { return personas().map(function (p) { return p.nombre; }); }
  function personaTipo(nombre) { var f = personas().find(function (p) { return p.nombre === nombre; }); return f ? f.tipo : null; }
  function companiaOpts() { return personaNames().concat(ACT_COMPANIA); }   // nombres + genéricos
  var ACT_SALIDA = ['Bien', 'Con ganas', 'Cuesta', 'Lloro'];
  var ACT_VUELTA = ['Bien', 'Gritos', 'Loqui', 'Se duerme'];
  var ACT_ENTRADA = ['Bien', 'Reactivo', 'Loco'];
  var TRANS_DEF = [{ k: 'salida', l: 'Salida', em: '🚪', opts: ACT_SALIDA }, { k: 'vuelta', l: 'Vuelta (coche)', em: '🚗', opts: ACT_VUELTA }, { k: 'entrada', l: 'Entrada a casa', em: '🏠', opts: ACT_ENTRADA }];
  var TRANS_BAD = ['Cuesta', 'Lloro', 'Gritos', 'Loqui', 'Reactivo', 'Loco'];   // los demás (Bien, Con ganas, Se duerme) no se marcan
  function transBad(v) { return TRANS_BAD.indexOf(v) !== -1; }
  var RUTINA_TIPOS = [
    { k: 'Ducha', em: '🚿' }, { k: 'Bañera', em: '🛁' }, { k: 'Dientes', em: '🪥' },
    { k: 'Pelo', em: '💇' }, { k: 'Uñas', em: '✂️' }, { k: 'Vestirse', em: '👕' }
  ];
  var RUTINA_VAL = [{ v: 'Bien', em: '🙂' }, { v: 'Relaja', em: '😌' }, { v: 'Regular', em: '😐' }, { v: 'Reactivo', em: '😣' }];
  function rutinaEm(k) { var f = RUTINA_TIPOS.find(function (x) { return x.k === k; }); return f ? f.em : '🧴'; }

  var AMBIENTE = ['Ruidoso', 'Mucha luz', 'Mucha gente', 'Sitio nuevo', 'Cambios de plan', 'Transición difícil', 'Calor / frío', 'Tranquilo'];
  var SENALES = ['Se tapa oídos', 'Se tapa ojos', 'Entrecierra ojos', 'Muy inquieto', 'Habla acelerado', 'Se queda callado', 'Se pega a ti', 'Se queja de tripa', 'Se queja de cabeza', 'Busca apretar / presión', 'Busca moverse / saltar', 'Evita que le toquen'];
  var ESTRATEGIAS = ['Abrazo / presión', 'Sándwich / presión profunda', 'Masaje', 'Brazos 360 / volar', 'Flexiones / trepar', 'Carro', 'Cascos / silencio', 'Tapones', 'Rincón tranquilo', 'Bajar luz', 'Moverse / saltar', 'Peso / manta', 'Bañera', 'Música', 'Chupete / bibe', 'Objeto / mordedor', 'Respiración', 'Dejarle solo', 'Descanso'];
  var AYUDARON = ['Sí', 'Un poco', 'No'];

  var SENSES = [
    { key: 'Vista', em: '👁️', ej: 'luz, pantallas, brillo' },
    { key: 'Oído', em: '👂', ej: 'ruidos, sonidos fuertes' },
    { key: 'Tacto', em: '✋', ej: 'texturas, ropa, etiquetas' },
    { key: 'Olfato', em: '👃', ej: 'olores' },
    { key: 'Gusto', em: '👅', ej: 'sabores, comida' },
    { key: 'Movimiento', em: '🌀', ej: 'vestibular: equilibrio, giros' },
    { key: 'Presión', em: '💪', ej: 'propiocepción: fuerza, choques' },
    { key: 'Interocepción', em: '🫀', ej: 'hambre, baño, dolor interno' }
  ];
  var PERFIL_OPTS = [{ v: 'Hiper', l: 'Hiper (evita)' }, { v: 'Hipo', l: 'Hipo (no nota)' }, { v: 'Busca', l: 'Busca' }, { v: 'Normal', l: 'Normal' }];

  var FOOD = {
    aceptacion: ['Comió bien', 'Con dificultad', 'Lo rechazó'],
    cantidad: ['Todo', 'La mitad', 'Un poco', 'Nada'],
    sensorial: ['Textura', 'Olor', 'Temperatura', 'Mezcla', 'Color']
  };
  var SEED_FOODS = ['Pan', 'Arroz', 'Pasta', 'Pollo', 'Ternera', 'Pescado', 'Huevo', 'Patata', 'Plátano', 'Manzana', 'Yogur', 'Leche', 'Queso', 'Galletas', 'Zumo', 'Agua', 'Cereales', 'Tomate', 'Zanahoria'];

  var DYS = {
    tipos: ['Rabieta', 'Crisis / desbordamiento', 'Bloqueo (se apaga)', 'Bucle / perseveración', 'Stimming intenso', 'Huida / evitación', 'Agresión / autoagresión', 'Llanto / ansiedad', 'Otro'],
    antecedentes: ['Cambio de rutina', 'Transición', 'Ruido', 'Se le pidió algo', 'Se le quitó algo', 'Hambre', 'Sueño / cansancio', 'Sed', 'Sobreestimulación', 'Fin de pantalla', 'Aglomeración', 'No se sabe', 'Otro'],
    senales: ['Inquietud', 'Se tapa oídos', 'Se tapa ojos', 'Entrecierra ojos', 'Habla acelerado', 'Se queda callado', 'Se pega a ti', 'Se queja de tripa', 'Se queja de cabeza', 'Quiere irse', 'Tensión corporal', 'Sube el tono', 'Otro'],
    sensorial: ['Oído (ruido)', 'Vista (luz)', 'Tacto (texturas / ropa)', 'Olfato (olores)', 'Gusto (comida)', 'Movimiento (vestibular)', 'Presión (propiocepción)', 'Interocepción (hambre / dolor)', 'Gente / aglomeración'],
    duracion: ['<5 min', '5–15 min', '15–30 min', '>30 min'],
    ayudo: ['Espacio / retirarse', 'Abrazo / presión', 'Silencio / cascos', 'Bajar luz', 'Moverse / saltar', 'Peso / manta', 'Respiración', 'Objeto favorito', 'Agua / comida', 'Tiempo', 'Nada aún'],
    recuperacion: ['<5 min', '5–15 min', '15–30 min', '>30 min']
  };
  var DYS_MULTI = { tipos: 1, antecedentes: 1, senales: 1, sensorial: 1, ayudo: 1 };

  // ===== Capa de persistencia (repositorio con driver intercambiable) =====
  // La UI nunca toca localStorage/Supabase directamente: todo pasa por Store.
  // Hoy el driver es local (offline). En Fase 1 se inyecta un supabaseDriver
  // que implementa la misma interfaz (loadAll/saveAll/putEntry/removeEntry/subscribe)
  // para sincronización en la nube, sin tocar la UI.
  function defaultData() { return { version: DATA_VERSION, child: { name: 'Leo', perfil: {} }, entries: [], bank: SEED_FOODS.slice(), docs: [] }; }
  function migrate(d) {
    if (!d.child) d.child = { name: 'Leo', perfil: {} };
    if (!d.bank) d.bank = SEED_FOODS.slice();
    if (!d.child.perfil) d.child.perfil = {};
    if (!d.docs) d.docs = [];
    if (!d.entries) d.entries = [];
    // v13 (Fase 1 — Sueño 360º): asegurar arrays nuevos en las entradas de sueño.
    if ((d.version || 0) < 13) {
      d.entries.forEach(function (e) {
        if (e.type === 'sleep') { if (!e.eventosNoche) e.eventosNoche = []; if (!e.despertarEstado) e.despertarEstado = []; }
      });
    }
    // v14 (Fase 2 — Observaciones): normalizar los campos de lista a arrays limpios
    // (robusto ante importaciones/serializaciones raras). Arrays de texto → solo strings;
    // arrays de objetos (eventosNoche, alimentos) → solo objetos.
    if ((d.version || 0) < 14) {
      var STR_ARR = { obs: ['senales'], sleep: ['despertarEstado', 'ayudas'], dys: ['tipos', 'antecedentes', 'senales', 'sensorial', 'ayudo'], act: ['compania', 'ambiente', 'senales', 'estrategias'] };
      var OBJ_ARR = { sleep: ['eventosNoche'], meal: ['alimentos'] };
      function toArr(v) { return v == null ? [] : (Array.isArray(v) ? v : (typeof v === 'object' ? [] : [v])); }
      d.entries.forEach(function (e) {
        var s = STR_ARR[e.type]; if (s) s.forEach(function (k) { e[k] = toArr(e[k]).filter(function (x) { return typeof x === 'string' && x; }); });
        var o = OBJ_ARR[e.type]; if (o) o.forEach(function (k) { var v = e[k]; if (v == null) return; e[k] = (Array.isArray(v) ? v : [v]).filter(function (x) { return x && typeof x === 'object'; }); });
      });
    }
    // v15 (Fase 4 — Personas, transiciones, rutinas): directorio de personas y
    // renombrar la actividad "Compras" a "Supermercado".
    if ((d.version || 0) < 15) {
      if (!d.child.personas || !d.child.personas.length) d.child.personas = SEED_PERSONAS.slice();
      d.entries.forEach(function (e) { if (e.type === 'act' && e.tipo === 'Compras') e.tipo = 'Supermercado'; });
    }
    if (!d.child.personas) d.child.personas = SEED_PERSONAS.slice();
    d.version = DATA_VERSION;
    return d;
  }
  // Copia de seguridad automática una sola vez por versión, ANTES de migrar.
  // Excluye 'docs' (los ficheros pesados) para no agotar el cupo de localStorage;
  // lo valioso —entradas y perfil— sí se guarda. Red de seguridad para futuras fases.
  function maybeBackup(d) {
    try {
      var v = (d && d.version) || 0;
      if (v >= DATA_VERSION) return;
      var key = 'appTEA.backup.v' + v;
      if (localStorage.getItem(key)) return;
      var copy = {}; for (var k in d) { if (k !== 'docs') copy[k] = d[k]; }
      copy._backupOf = v; copy._backupAt = Date.now();
      localStorage.setItem(key, JSON.stringify(copy));
    } catch (e) {}
  }
  var localDriver = {
    loadAll: function () { try { var d = JSON.parse(localStorage.getItem(STORE_KEY)); if (d && d.entries) return d; } catch (e) {} return null; },
    saveAll: function (st) { try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (e) {} },
    putEntry: function () {}, removeEntry: function () {}, subscribe: function () {}
  };
  var Store = {
    driver: localDriver, state: null, remoteCb: null,
    init: function () {
      var loaded = this.driver.loadAll();
      var needsMigration = loaded && ((loaded.version || 0) < DATA_VERSION);
      if (loaded) maybeBackup(loaded);
      this.state = migrate(loaded || defaultData());
      if (needsMigration) { try { this.driver.saveAll(this.state); } catch (e) {} }   // hacer duradera la migración (sin tocar la nube)
      return this.state;
    },
    setDriver: function (d) { this.driver = d; if (this.remoteCb && d.subscribe) d.subscribe(this.remoteCb); },
    persist: function () { this.driver.saveAll(this.state); if (typeof Cloud !== 'undefined' && Cloud.connected) Cloud.pushDebounced(); },
    putEntry: function (e) { this.driver.putEntry(e); this.driver.saveAll(this.state); },
    removeEntry: function (id) { this.driver.removeEntry(id); this.driver.saveAll(this.state); },
    onRemoteChange: function (cb) { this.remoteCb = cb; }
  };
  var data = Store.init();
  function save() { Store.persist(); }

  var selectedDate = todayKey();
  var resumenPeriod = 'dia';
  var histView = 'mes', histAnchor = todayKey(), histSelected = todayKey();
  var openId = null, openFood = null, openMeal = null, openAct = null, openNap = null, openObs = null, openSalud = null, openRutina = null, dysFromAct = false;
  var timelineOpen = false;

  function pad(n) { return ('0' + n).slice(-2); }
  function todayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowTime() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function uid() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function toMin(t) { if (!t) return null; var p = t.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function durStr(s, e, overnight) {
    var d = durMin(s, e, overnight); if (d == null) return '';
    return fmtDur(d);
  }
  function durMin(s, e, overnight) {
    var a = toMin(s), b = toMin(e); if (a == null || b == null) return null;
    var d = b - a; if (d < 0) d += 1440; if (!overnight && d > 720) return null; return d;
  }
  function fmtDur(min) { if (min == null) return ''; var h = Math.floor(min / 60), m = min % 60; return (h ? h + 'h ' : '') + (m ? m + 'm' : (h ? '' : '0m')); }
  // Total de sueño del día = noche (dormido→despertar) + siestas. Núcleo de la Fase 1.
  function totalSleepMin(date) {
    var t = 0, any = false;
    var s = data.entries.find(function (e) { return e.type === 'sleep' && e.date === date; });
    if (s) { var n = durMin(s.bed, s.wake, true); if (n != null) { t += n; any = true; } }
    data.entries.filter(function (e) { return e.type === 'nap' && e.date === date; }).forEach(function (nap) {
      var d = durMin(nap.start, nap.end, false); if (d != null) { t += d; any = true; }
    });
    return any ? t : null;
  }

  function addEntry(type, fields) {
    var e = { id: uid(), type: type, date: selectedDate, time: '', moment: nowMoment(), created: Date.now() };
    for (var k in fields) e[k] = fields[k];
    data.entries.push(e); Store.putEntry(e); return e;
  }
  function byId(id) { return data.entries.find(function (e) { return e.id === id; }); }
  function todayOf(type) { var t = selectedDate; return data.entries.filter(function (e) { return e.type === type && e.date === t; }); }
  function findToday(type) { var t = selectedDate; return data.entries.find(function (e) { return e.type === type && e.date === t; }); }
  function removeEntry(id) {
    data.entries = data.entries.filter(function (e) { return e.id !== id && e.linkedEventId !== id; });
    Store.removeEntry(id);
  }
  function toggleArr(arr, val) { var i = arr.indexOf(val); if (i === -1) arr.push(val); else arr.splice(i, 1); return arr; }

  function chip(label, selected, onClick, extraClass) {
    var b = document.createElement('button');
    b.className = 'chip' + (selected ? ' sel' : '') + (extraClass ? ' ' + extraClass : '');
    b.innerHTML = label; b.addEventListener('click', onClick); return b;
  }
  function fill(el, nodes) { el.innerHTML = ''; nodes.forEach(function (n) { el.appendChild(n); }); }
  var $ = function (id) { return document.getElementById(id); };

  function multiGroup(containerId, opts, entry, key, after) {
    fill($(containerId), opts.map(function (v) {
      var sel = entry[key] && entry[key].indexOf(v) !== -1;
      return chip(v, sel, function () { if (!entry[key]) entry[key] = []; toggleArr(entry[key], v); save(); multiGroup(containerId, opts, entry, key, after); if (after) after(); });
    }));
  }
  function singleGroup(containerId, opts, entry, key, after, faces) {
    fill($(containerId), opts.map(function (o) {
      var v = (typeof o === 'object') ? o.v : o, lab = (typeof o === 'object') ? (o.l || o.e || o.v) : o;
      return chip(lab, entry[key] === v, function () { entry[key] = (entry[key] === v ? null : v); save(); singleGroup(containerId, opts, entry, key, after, faces); if (after) after(); }, faces ? 'face' : null);
    }));
  }
  function momentPicker(timeId, momentId, entry, after) {
    $(timeId).value = entry.time || '';
    fill($(momentId), MOMENTS.map(function (m) {
      return chip(m.em + ' ' + m.key, entry.moment === m.key, function () { entry.moment = m.key; save(); momentPicker(timeId, momentId, entry, after); if (after) after(); });
    }));
  }
  function whenLabel(e) { return '<span class="m">' + momentEm(momentOf(e)) + '</span>' + (e.time || momentOf(e).toLowerCase()); }

  // ---------- header ----------
  function renderHeader() {
    var d = new Date();
    $('dateLabel').textContent = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    $('childName').textContent = data.child.name;
    $('childAvatar').textContent = (data.child.name || '?').charAt(0).toUpperCase();
  }

  // ---------- sleep 360º (noche, inline) ----------
  function upsertSleep() { return findToday('sleep') || addEntry('sleep', { moment: 'Noche', ayudas: [], eventosNoche: [], despertarEstado: [] }); }
  function renderSleep() {
    var s = findToday('sleep');
    var tot = totalSleepMin(selectedDate);
    $('sleepTotal').textContent = tot != null ? 'Total ' + fmtDur(tot) : '';
    // Despertar
    $('sleepWake').value = (s && s.wake) || '';
    $('sleepDur').textContent = s ? durStr(s.bed, s.wake, true) : '';
    fill($('wakeHowChips'), DESPERTAR_COMO.map(function (v) { return chip(v, s && s.despertarComo === v, function () { setSleep('despertarComo', v); }); }));
    renderSleepMulti('wakeStateChips', DESPERTAR_ESTADO, 'despertarEstado');
    // Noche
    $('sleepSofa').value = (s && s.acuestoSofa) || '';
    $('sleepBed').value = (s && s.bed) || '';
    fill($('facilChips'), ACUESTO_FACIL.map(function (v) { return chip(v, s && s.facilidad === v, function () { setSleep('facilidad', v); }); }));
    fill($('dondeChips'), DONDE_DORMIR.map(function (v) { return chip(v, s && s.donde === v, function () { setSleep('donde', v); }); }));
    fill($('qualChips'), QUAL.map(function (q) { return chip(q.e, s && s.calidad === q.v, function () { setSleep('calidad', q.v); }, 'face'); }));
    fill($('qualTextChips'), CALIDAD_TEXTO.map(function (o) { return chip(o.v, s && s.calidadTexto === o.v, function () { setSleepCalidadTexto(o); }); }));
    renderNocheEvents(s);
    fill($('quienChips'), QUIEN_DORMIR.map(function (v) { return chip(v, s && s.quien === v, function () { setSleep('quien', v); }); }));
    fill($('aidChips'), AIDS.map(function (v) {
      var sel = s && s.ayudas && s.ayudas.indexOf(v) !== -1;
      return chip(v, sel, function () { var e = upsertSleep(); if (!e.ayudas) e.ayudas = []; toggleArr(e.ayudas, v); save(); renderSleep(); });
    }));
    $('sleepNota').value = (s && s.nota) || '';
  }
  function renderSleepMulti(containerId, opts, key) {
    var s = findToday('sleep');
    fill($(containerId), opts.map(function (v) {
      var sel = s && s[key] && s[key].indexOf(v) !== -1;
      return chip(v, sel, function () { var e = upsertSleep(); if (!e[key]) e[key] = []; toggleArr(e[key], v); save(); renderSleep(); });
    }));
  }
  function setSleep(field, val) { var e = upsertSleep(); e[field] = (e[field] === val ? null : val); save(); renderSleep(); }
  function setSleepCalidadTexto(o) { var e = upsertSleep(); if (e.calidadTexto === o.v) { e.calidadTexto = null; } else { e.calidadTexto = o.v; e.calidad = o.c; } save(); renderSleep(); }
  function addNocheEvent(tipo) { var e = upsertSleep(); if (!e.eventosNoche) e.eventosNoche = []; e.eventosNoche.push({ tipo: tipo, hora: '' }); save(); renderSleep(); }
  function renderNocheEvents(s) {
    fill($('nocheEventChips'), NOCHE_EVENTOS.map(function (v) { return chip('＋ ' + v, false, function () { addNocheEvent(v); }, 'chip-add'); }));
    var el = $('nocheEventList'); el.innerHTML = '';
    var evs = (s && s.eventosNoche) || [];
    evs.forEach(function (ev, i) {
      var row = document.createElement('div'); row.className = 'noche-ev';
      var lbl = document.createElement('span'); lbl.className = 'ne-t'; lbl.textContent = ev.tipo; row.appendChild(lbl);
      var tm = document.createElement('input'); tm.type = 'time'; tm.value = ev.hora || ''; tm.className = 'ne-time'; tm.setAttribute('aria-label', 'Hora');
      tm.addEventListener('change', function () { var e = upsertSleep(); if (e.eventosNoche[i]) { e.eventosNoche[i].hora = this.value; save(); } });
      var x = document.createElement('button'); x.className = 'ne-x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Quitar');
      x.addEventListener('click', function () { var e = upsertSleep(); e.eventosNoche.splice(i, 1); save(); renderSleep(); });
      row.appendChild(tm); row.appendChild(x); el.appendChild(row);
    });
  }
  function setSleep(field, val) { var e = upsertSleep(); e[field] = (e[field] === val ? null : val); save(); renderSleep(); }

  // ---------- generic event list ----------
  function eventRow(e, summary, onTap) {
    var row = document.createElement('div');
    row.className = 'event-row tap' + (e.type === 'dys' ? ' dys' : '');
    row.innerHTML = '<div class="ev-when">' + whenLabel(e) + '</div><div class="ev-body"><div class="ev-title">' + summary.title + '</div>' + (summary.sub ? '<div class="ev-sub ' + (summary.warn ? 'warn' : '') + '">' + summary.sub + '</div>' : '') + '</div>';
    row.addEventListener('click', function (ev) { if (ev.target.classList.contains('ev-del')) return; onTap(); });
    var del = document.createElement('button'); del.className = 'ev-del'; del.textContent = '✕'; del.setAttribute('aria-label', 'Eliminar');
    del.addEventListener('click', function (ev) { ev.stopPropagation(); removeEntry(e.id); renderHoy(); });
    row.appendChild(del);
    return row;
  }
  function renderList(containerId, items, summaryFn, onTap, emptyMsg) {
    var el = $(containerId);
    if (!items.length) { el.innerHTML = '<div class="list-empty">' + emptyMsg + '</div>'; return; }
    el.innerHTML = '';
    items.sort(function (a, b) { return (a.time || '99') < (b.time || '99') ? -1 : 1; });
    items.forEach(function (e) { el.appendChild(eventRow(e, summaryFn(e), function () { onTap(e); })); });
  }

  // ---------- summaries ----------
  function napSummary(e) {
    var p = []; var d = durStr(e.start, e.end, false); if (d) p.push(d);
    if (e.calidad) p.push('calidad ' + e.calidad + '/5');
    if (e.acuesto) p.push('se acostó ' + e.acuesto.toLowerCase());
    if (e.despertar) p.push('despertó ' + e.despertar.toLowerCase());
    if (e.nota) p.push(e.nota);
    return { title: e.fallida ? 'Siesta fallida' : 'Siesta', sub: p.join(' · ') };
  }
  function mealSummary(e) {
    var foods = (e.alimentos || []).map(function (f) { return (f.nuevo ? '★' : '') + f.nombre; });
    var sub = foods.length ? foods.join(', ') : 'sin alimentos'; if (e.aceptacion) sub += ' · ' + e.aceptacion.toLowerCase();
    return { title: e.nombre || 'Comida', sub: sub };
  }
  function actSummary(e) {
    var s = [];
    var quien = (e.compania || []).filter(function (c) { return c !== 'Solo'; });
    if (quien.length) s.push('con ' + quien.join(', '));
    if (e.lugar) s.push(e.lugar.toLowerCase());
    if (e.duracion) s.push(e.duracion);
    if (e.primeraVez) s.push('1ª vez');
    if (e.intentoFallido) s.push('no consiguió ir');
    var tr = e.transiciones || {}, badTr = TRANS_DEF.filter(function (t) { return transBad(tr[t.k]); });
    badTr.forEach(function (t) { s.push(t.em + ' ' + t.l.split(' ')[0].toLowerCase() + ': ' + tr[t.k].toLowerCase()); });
    if (e.zona) s.push('ánimo ' + e.zona.toLowerCase());
    if (e.termino) s.push('terminó ' + e.termino.toLowerCase());
    var nd = data.entries.filter(function (x) { return x.type === 'dys' && x.linkedEventId === e.id; }).length;
    if (nd) s.push('⚡ ' + nd + ' desajuste' + (nd > 1 ? 's' : ''));
    if (e.nota) s.push(e.nota);
    return { title: e.tipo || 'Actividad', sub: s.join(' · '), warn: nd > 0 || e.intentoFallido || badTr.length > 0 };
  }
  function rutinaSummary(e) {
    var s = [];
    if (e.valoracion) s.push(e.valoracion.toLowerCase());
    if (e.nota) s.push(e.nota);
    return { title: rutinaEm(e.tipo) + ' ' + (e.tipo || 'Rutina'), sub: s.join(' · '), warn: e.valoracion === 'Reactivo' };
  }
  function dysSummary(e) {
    var s = [];
    if (e.intensidad) s.push('intensidad ' + e.intensidad + '/5');
    if (e.linkedEventId) { var a = byId(e.linkedEventId); if (a) s.push('en ' + (a.tipo || 'actividad')); }
    if (!e.completo) s.push('sin completar');
    return { title: (e.tipos && e.tipos.length) ? e.tipos.join(', ') : 'Desajuste', sub: s.join(' · '), warn: !e.completo };
  }
  function obsSummary(e) {
    var titl = (e.senales && e.senales.length) ? e.senales.join(', ') : (e.valencia || 'Observación');
    var s = [];
    if (e.valencia && e.senales && e.senales.length) s.push(e.valencia.toLowerCase());
    if (e.contexto) s.push(e.contexto);
    if (e.nota) s.push(e.nota);
    return { title: titl, sub: s.join(' · '), warn: e.valencia === 'Difícil' };
  }
  function saludSummary(e) {
    var s = [];
    if (e.detalle) s.push(e.detalle.toLowerCase());
    if (e.nota) s.push(e.nota);
    return { title: saludEm(e.subtipo) + ' ' + (e.subtipo || 'Salud'), sub: s.join(' · '), warn: ['Calambres', 'Palpitaciones', 'Dolor'].indexOf(e.subtipo) !== -1 };
  }

  // ---------- Anotar: navegación de día ----------
  function addDays(dateStr, n) { return todayKey(new Date(new Date(dateStr + 'T00:00:00').getTime() + n * 86400000)); }
  function renderDateNav() {
    var isToday = selectedDate === todayKey();
    var d = new Date(selectedDate + 'T12:00:00');
    $('dayLabel').textContent = isToday ? 'Hoy · ' + d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    $('dayNext').disabled = isToday;
    $('hotBtn').hidden = !isToday;
    $('hotHint').hidden = !isToday;
  }
  function goDay(n) { var nd = addDays(selectedDate, n); if (nd > todayKey()) return; selectedDate = nd; renderDateNav(); renderHoy(); }

  // ---------- Anotar lists ----------
  function renderHoy() {
    renderDateNav();
    renderAnotarAlert();
    renderSleep();
    renderList('napList', todayOf('nap'), napSummary, function (e) { openNapSheet(e.id); }, 'Sin siestas hoy.');
    renderList('mealList', todayOf('meal'), mealSummary, function (e) { openMealSheet(e.id); }, 'Sin comidas registradas.');
    renderList('activityList', todayOf('act'), actSummary, function (e) { openActSheet(e.id); }, 'Sin actividades registradas.');
    renderList('dysList', todayOf('dys').filter(function (e) { return !e.linkedEventId; }), dysSummary, function (e) { openDys(e.id, false); }, 'Sin desajustes sueltos hoy.');
    renderObs();
    renderSalud();
    renderRutina();
    renderTimeline();
  }

  // ---------- nap sheet ----------
  function openNapSheet(id) {
    openNap = id; var n = byId(id);
    $('napStart').value = n.start || ''; $('napEnd').value = n.end || '';
    $('napDur').textContent = durStr(n.start, n.end, false);
    $('napFallida').checked = !!n.fallida;
    singleGroup('napAcuesto', NAP_ACUESTO, n, 'acuesto');
    singleGroup('napDespertar', NAP_DESPERTAR, n, 'despertar');
    singleGroup('napQual', QUAL, n, 'calidad', null, true);
    $('napNota').value = n.nota || '';
    $('napBackdrop').hidden = false;
  }
  function napIsEmpty(n) { return n && !n.start && !n.end && !n.calidad && !n.fallida && !n.acuesto && !n.despertar && !n.nota; }
  function closeNap() { var n = byId(openNap); if (napIsEmpty(n)) removeEntry(openNap); $('napBackdrop').hidden = true; openNap = null; renderHoy(); }

  // ---------- meal sheet ----------
  function openMealSheet(id) {
    openMeal = id; var m = byId(id); if (!m.alimentos) m.alimentos = [];
    $('mealName').value = m.nombre || '';
    momentPicker('mealTime', 'mealMoment', m);
    renderFoodChips();
    singleGroup('mealAcceptChips', MEAL_ACCEPT, m, 'aceptacion');
    $('mealBackdrop').hidden = false;
  }
  function closeMeal() { var m = byId(openMeal); if (m && !m.nombre && (!m.alimentos || !m.alimentos.length) && !m.aceptacion) removeEntry(openMeal); $('mealBackdrop').hidden = true; openMeal = null; renderHoy(); }
  function renderBank() { fill($('foodbank'), data.bank.slice().sort().map(function (n) { var o = document.createElement('option'); o.value = n; return o; })); }
  function addFood(name) {
    name = (name || '').trim(); if (!name) return; var m = byId(openMeal); if (!m) return; if (!m.alimentos) m.alimentos = [];
    if (!m.alimentos.some(function (f) { return f.nombre.toLowerCase() === name.toLowerCase(); })) m.alimentos.push({ nombre: name });
    if (!data.bank.some(function (b) { return b.toLowerCase() === name.toLowerCase(); })) data.bank.push(name);
    save(); renderFoodChips(); renderBank();
  }
  function foodClass(f) { if (f.aceptacion === 'Lo rechazó' || f.cantidad === 'Nada') return 'rej'; if (f.aceptacion === 'Comió bien') return 'done'; return ''; }
  function renderFoodChips() {
    var m = byId(openMeal); var foods = (m && m.alimentos) || []; var wrap = $('foodChips');
    if (!foods.length) { wrap.innerHTML = '<div class="food-empty">Aún sin alimentos.</div>'; return; }
    wrap.innerHTML = '';
    foods.forEach(function (f) {
      var tag = document.createElement('span'); tag.className = 'food-tag ' + foodClass(f);
      var label = document.createElement('span'); label.textContent = (f.nuevo ? '★ ' : '') + f.nombre; label.style.cursor = 'pointer';
      label.addEventListener('click', function () { openFoodSheet(f.nombre); });
      var x = document.createElement('button'); x.className = 'fx'; x.textContent = '✕';
      x.addEventListener('click', function (ev) { ev.stopPropagation(); m.alimentos = m.alimentos.filter(function (o) { return o.nombre !== f.nombre; }); save(); renderFoodChips(); });
      tag.appendChild(label); tag.appendChild(x); wrap.appendChild(tag);
    });
  }
  function openFoodSheet(nombre) {
    var m = byId(openMeal); if (!m) return; var f = m.alimentos.find(function (x) { return x.nombre === nombre; }); if (!f) return;
    openFood = nombre;
    $('foodTitle').textContent = f.nombre; $('foodSub').textContent = (m.nombre || 'Comida');
    singleGroup('fg-aceptacion', FOOD.aceptacion, f, 'aceptacion');
    singleGroup('fg-cantidad', FOOD.cantidad, f, 'cantidad');
    multiGroup('fg-sensorial', FOOD.sensorial, f, 'sensorial');
    $('foodNew').checked = !!f.nuevo; $('foodNota').value = f.nota || '';
    $('foodBackdrop').hidden = false;
  }
  function currentFood() { var m = byId(openMeal); if (!m || !openFood) return null; return m.alimentos.find(function (x) { return x.nombre === openFood; }); }
  function closeFood() { $('foodBackdrop').hidden = true; openFood = null; renderFoodChips(); }

  // ---------- activity sheet ----------
  function openActSheet(id) {
    openAct = id; var a = byId(id);
    singleGroup('actTypeChips', ACT_TYPES, a, 'tipo');
    momentPicker('actTime', 'actMoment', a);
    singleGroup('actLugar', ACT_LUGAR, a, 'lugar');
    singleGroup('actDuracion', ACT_DURACION, a, 'duracion');
    renderActCompania(a, id);
    renderActTrans(a, id);
    $('actPrimeraVez').checked = !!a.primeraVez;
    $('actIntentoFallido').checked = !!a.intentoFallido;
    $('actNota').value = a.nota || '';
    fill($('actZona'), ZONES.map(function (z) {
      var b = document.createElement('button'); b.className = 'zone-chip ' + z.cls + (a.zona === z.val ? ' sel' : '');
      b.innerHTML = '<span class="em">' + z.em + '</span>' + z.val;
      b.addEventListener('click', function () { a.zona = (a.zona === z.val ? null : z.val); save(); openActSheet(id); }); return b;
    }));
    multiGroup('ambChips', AMBIENTE, a, 'ambiente');
    multiGroup('senalChips', SENALES, a, 'senales');
    multiGroup('estChips', ESTRATEGIAS, a, 'estrategias');
    singleGroup('ayudaronChips', AYUDARON, a, 'ayudaron');
    singleGroup('actTermino', ACT_TERMINO, a, 'termino');
    renderActDys();
    $('activityBackdrop').hidden = false;
  }
  function renderActCompania(a, id) {
    if (!a.compania) a.compania = [];
    var nodes = companiaOpts().map(function (v) {
      var sel = a.compania.indexOf(v) !== -1;
      var tp = personaTipo(v);
      return chip(v + (tp ? ' <span class="chip-tag">' + tp.charAt(0) + '</span>' : ''), sel, function () { toggleArr(a.compania, v); save(); renderActCompania(a, id); });
    });
    nodes.push(chip('＋ persona', false, function () { addPersonaInline(a, id); }, 'chip-add'));
    fill($('actCompania'), nodes);
  }
  function addPersonaInline(a, id) {
    var nombre = (prompt('Nombre de la persona (p. ej. María, Aitor, abuela):') || '').trim();
    if (!nombre) return;
    if (!data.child.personas) data.child.personas = [];
    if (!personaNames().some(function (n) { return n.toLowerCase() === nombre.toLowerCase(); })) data.child.personas.push({ nombre: nombre, tipo: 'Otro' });
    if (a.compania.indexOf(nombre) === -1) a.compania.push(nombre);
    save(); renderActCompania(a, id);
  }
  function renderActTrans(a, id) {
    if (!a.transiciones) a.transiciones = {};
    var wrap = $('actTrans'); wrap.innerHTML = '';
    TRANS_DEF.forEach(function (t) {
      var row = document.createElement('div'); row.className = 'trans-row';
      row.innerHTML = '<div class="trans-lbl">' + t.em + ' ' + t.l + '</div>';
      var chips = document.createElement('div'); chips.className = 'chips';
      t.opts.forEach(function (v) {
        chips.appendChild(chip(v, a.transiciones[t.k] === v, function () { a.transiciones[t.k] = (a.transiciones[t.k] === v ? null : v); save(); renderActTrans(a, id); }, transBad(v) ? 'chip-warn' : null));
      });
      row.appendChild(chips); wrap.appendChild(row);
    });
  }
  function renderActDys() {
    var linked = data.entries.filter(function (e) { return e.type === 'dys' && e.linkedEventId === openAct; });
    var el = $('actDysList');
    if (!linked.length) { el.innerHTML = '<div class="list-empty">Ninguno.</div>'; return; }
    el.innerHTML = '';
    linked.forEach(function (e) { el.appendChild(eventRow(e, dysSummary(e), function () { openDys(e.id, true); })); });
  }
  function closeAct() {
    var a = byId(openAct);
    var hasLinked = data.entries.some(function (e) { return e.type === 'dys' && e.linkedEventId === openAct; });
    var hasTrans = a && a.transiciones && Object.keys(a.transiciones).some(function (k) { return a.transiciones[k]; });
    var hasQuien = a && a.compania && a.compania.length;
    if (a && !a.tipo && !a.nota && !a.zona && !hasLinked && !hasTrans && !hasQuien && !a.primeraVez && !a.intentoFallido) removeEntry(openAct);
    $('activityBackdrop').hidden = true; openAct = null; renderHoy();
  }

  // ---------- dys sheet ----------
  function chipG(groupId, key, entry) {
    var opts = DYS[key], multi = DYS_MULTI[key];
    fill($(groupId), opts.map(function (v) {
      var sel = multi ? (entry[key] && entry[key].indexOf(v) !== -1) : (entry[key] === v);
      return chip(v, sel, function () { if (multi) { if (!entry[key]) entry[key] = []; toggleArr(entry[key], v); } else { entry[key] = (entry[key] === v ? null : v); } save(); chipG(groupId, key, entry); });
    }));
  }
  function openDys(id, fromAct) {
    openId = id; dysFromAct = !!fromAct; var e = byId(id); if (!e.tipos) e.tipos = [];
    var linked = e.linkedEventId ? byId(e.linkedEventId) : null;
    $('sheetLinked').hidden = !linked;
    if (linked) $('sheetLinked').textContent = '🔗 Vinculado a: ' + (linked.tipo || 'actividad');
    $('sheetTime').textContent = momentEm(momentOf(e)) + ' ' + (e.time || momentOf(e).toLowerCase());
    momentPicker('dysTime', 'dysMoment', e, function () { $('sheetTime').textContent = momentEm(momentOf(e)) + ' ' + (e.time || momentOf(e).toLowerCase()); });
    chipG('g-tipos', 'tipos', e);
    singleGroup('g-intensidad', [1, 2, 3, 4, 5], e, 'intensidad', null, true);
    chipG('g-antecedentes', 'antecedentes', e); chipG('g-senales', 'senales', e);
    chipG('g-sensorial', 'sensorial', e); chipG('g-duracion', 'duracion', e);
    chipG('g-ayudo', 'ayudo', e); chipG('g-recuperacion', 'recuperacion', e);
    $('sheetNota').value = e.nota || '';
    $('sheetBackdrop').hidden = false;
  }
  function closeDys() {
    $('sheetBackdrop').hidden = true; var wasAct = dysFromAct; openId = null; dysFromAct = false;
    if (wasAct && openAct) { renderActDys(); } else { renderHoy(); }
  }

  // ---------- observación de estado (obs) ----------
  function openObsSheet(id) {
    openObs = id; var e = byId(id); if (!e.senales) e.senales = [];
    $('obsTime').textContent = momentEm(momentOf(e)) + ' ' + (e.time || momentOf(e).toLowerCase());
    momentPicker('obsTimeInput', 'obsMoment', e, function () { $('obsTime').textContent = momentEm(momentOf(e)) + ' ' + (e.time || momentOf(e).toLowerCase()); });
    fill($('obsValencia'), OBS_VALENCIA.map(function (o) { return chip(o.em + ' ' + o.v, e.valencia === o.v, function () { e.valencia = (e.valencia === o.v ? null : o.v); save(); openObsSheet(id); }, o.cls); }));
    renderObsSenales(e);
    $('obsContexto').value = e.contexto || '';
    $('obsNota').value = e.nota || '';
    $('obsBackdrop').hidden = false;
  }
  function renderObsSenales(e) {
    var host = $('obsSenales'); host.innerHTML = ''; if (!e.senales) e.senales = [];
    var custom = (data.child.obsCustom || []);
    OBS_GROUPS.concat(custom.length ? [{ g: 'Personalizadas', items: custom }] : []).forEach(function (grp) {
      var lab = document.createElement('div'); lab.className = 'obs-grp'; lab.textContent = grp.g; host.appendChild(lab);
      var box = document.createElement('div'); box.className = 'chips';
      grp.items.forEach(function (v) { box.appendChild(chip(v, e.senales.indexOf(v) !== -1, function () { toggleArr(e.senales, v); save(); renderObsSenales(e); })); });
      host.appendChild(box);
    });
  }
  function addObsCustom(name) {
    name = (name || '').trim(); if (!name) return;
    if (!data.child.obsCustom) data.child.obsCustom = [];
    var flatLow = obsSenalesFlat().map(function (x) { return x.toLowerCase(); });
    if (flatLow.indexOf(name.toLowerCase()) === -1) data.child.obsCustom.push(name);
    var e = byId(openObs); if (e) { if (!e.senales) e.senales = []; if (e.senales.indexOf(name) === -1) e.senales.push(name); }
    save(); if (byId(openObs)) renderObsSenales(byId(openObs));
  }
  function obsIsEmpty(e) { return e && (!e.senales || !e.senales.length) && !e.valencia && !e.contexto && !e.nota; }
  function closeObs() { var e = byId(openObs); if (obsIsEmpty(e)) removeEntry(openObs); $('obsBackdrop').hidden = true; openObs = null; renderHoy(); }
  function renderObs() { renderList('obsList', todayOf('obs'), obsSummary, function (e) { openObsSheet(e.id); }, 'Sin observaciones hoy.'); }

  // ---------- línea del día (timeline) ----------
  function renderTimeline() {
    var ents = data.entries.filter(function (e) { return e.date === selectedDate; });
    var card = $('timelineCard');
    if (ents.length < 2) { card.hidden = true; return; }
    card.hidden = false;
    $('timelineToggle').textContent = timelineOpen ? 'ocultar' : 'ver';
    $('timelineToggle').setAttribute('aria-expanded', timelineOpen ? 'true' : 'false');
    var list = $('timelineList'); list.hidden = !timelineOpen;
    if (!timelineOpen) { list.innerHTML = ''; return; }
    ents.sort(function (a, b) { return minOfDay(a) - minOfDay(b); });
    list.innerHTML = ents.map(resItemLine).join('');
  }

  // ---------- cuerpo y salud (Fase 3) ----------
  function quickSalud(subtipo) {
    var e = addEntry('salud', { subtipo: subtipo, time: nowTime(), moment: nowMoment() });
    save(); renderHoy(); toast(saludEm(subtipo) + ' ' + subtipo + ' · ' + e.time);
  }
  function renderSalud() { renderList('saludList', todayOf('salud'), saludSummary, function (e) { openSaludSheet(e.id); }, 'Sin registros de salud hoy.'); }
  function openSaludSheet(id) {
    openSalud = id; var e = byId(id);
    $('saludTime').textContent = momentEm(momentOf(e)) + ' ' + (e.time || momentOf(e).toLowerCase());
    fill($('saludTipo'), SALUD_SUBTIPOS.map(function (o) { return chip(o.em + ' ' + o.k, e.subtipo === o.k, function () { e.subtipo = o.k; e.detalle = null; save(); openSaludSheet(id); }); }));
    momentPicker('saludTimeInput', 'saludMoment', e, function () { $('saludTime').textContent = momentEm(momentOf(e)) + ' ' + (e.time || momentOf(e).toLowerCase()); });
    renderSaludDetalle(e);
    $('saludNota').value = e.nota || '';
    $('saludBackdrop').hidden = false;
  }
  function renderSaludDetalle(e) {
    var wrap = $('saludDetalleWrap'), chipsEl = $('saludDetalle'), textEl = $('saludDetalleText');
    if (e.subtipo === 'Deposición') {
      wrap.hidden = false; $('saludDetalleLabel').textContent = '¿Cómo fue?'; textEl.hidden = true;
      fill(chipsEl, DEPOSICION_DETALLE.map(function (v) { return chip(v, e.detalle === v, function () { e.detalle = (e.detalle === v ? null : v); save(); renderSaludDetalle(e); }); }));
    } else if (e.subtipo === 'Medicación' || e.subtipo === 'Otro') {
      wrap.hidden = false; $('saludDetalleLabel').textContent = (e.subtipo === 'Medicación' ? 'Qué / dosis' : 'Detalle'); chipsEl.innerHTML = ''; textEl.hidden = false; textEl.value = e.detalle || '';
    } else { wrap.hidden = true; }
  }
  function saludIsEmpty(e) { return e && !e.subtipo; }
  function closeSalud() { var e = byId(openSalud); if (saludIsEmpty(e)) removeEntry(openSalud); $('saludBackdrop').hidden = true; openSalud = null; renderHoy(); }

  // ---------- rutinas diarias (Fase 4) ----------
  function quickRutina(tipo) {
    var e = addEntry('rutina', { tipo: tipo, time: nowTime(), moment: nowMoment() });
    save(); renderHoy(); openRutinaSheet(e.id);
  }
  function renderRutina() { renderList('rutinaList', todayOf('rutina'), rutinaSummary, function (e) { openRutinaSheet(e.id); }, 'Sin rutinas registradas hoy.'); }
  function openRutinaSheet(id) {
    openRutina = id; var e = byId(id);
    $('rutinaTitle').textContent = rutinaEm(e.tipo) + ' ' + (e.tipo || 'Rutina');
    fill($('rutinaTipo'), RUTINA_TIPOS.map(function (o) { return chip(o.em + ' ' + o.k, e.tipo === o.k, function () { e.tipo = o.k; save(); openRutinaSheet(id); }); }));
    fill($('rutinaVal'), RUTINA_VAL.map(function (o) { return chip(o.em + ' ' + o.v, e.valoracion === o.v, function () { e.valoracion = (e.valoracion === o.v ? null : o.v); save(); openRutinaSheet(id); }, o.v === 'Reactivo' ? 'chip-warn' : (o.v === 'Relaja' ? 'chip-good' : null)); }));
    momentPicker('rutinaTimeInput', 'rutinaMoment', e);
    $('rutinaNota').value = e.nota || '';
    $('rutinaBackdrop').hidden = false;
  }
  function closeRutina() { var e = byId(openRutina); if (e && !e.tipo && !e.valoracion && !e.nota) removeEntry(openRutina); $('rutinaBackdrop').hidden = true; openRutina = null; renderHoy(); }

  // ---------- perfil ----------
  function renderPerfilSheet() {
    var perfil = data.child.perfil || (data.child.perfil = {});
    var body = $('perfilBody'); body.innerHTML = '';
    SENSES.forEach(function (sn) {
      var row = document.createElement('div'); row.className = 'sense-row';
      row.innerHTML = '<div class="sense-name">' + sn.em + ' ' + sn.key + ' <span class="ej">' + sn.ej + '</span></div>';
      var chips = document.createElement('div'); chips.className = 'chips';
      PERFIL_OPTS.forEach(function (o) { chips.appendChild(chip(o.l, perfil[sn.key] === o.v, function () { perfil[sn.key] = (perfil[sn.key] === o.v ? null : o.v); save(); renderPerfilSheet(); })); });
      row.appendChild(chips); body.appendChild(row);
    });
    renderPersonasEditor(body);
  }
  function renderPersonasEditor(body) {
    if (!data.child.personas) data.child.personas = SEED_PERSONAS.slice();
    var div = document.createElement('div'); div.className = 'section-div'; div.textContent = 'Personas de su día'; body.appendChild(div);
    var hint = document.createElement('p'); hint.className = 'hint2'; hint.style.margin = '0 0 8px'; hint.textContent = 'Quién aparece en sus actividades (terapeutas, amigos, familia). Los usas al elegir “con quién”.'; body.appendChild(hint);
    var list = document.createElement('div'); list.className = 'persona-list';
    personas().forEach(function (p, i) {
      var r = document.createElement('div'); r.className = 'persona-row';
      var name = document.createElement('span'); name.className = 'persona-name'; name.textContent = p.nombre; r.appendChild(name);
      var chips = document.createElement('div'); chips.className = 'chips persona-tipos';
      PERSONA_TIPOS.forEach(function (t) { chips.appendChild(chip(t, p.tipo === t, function () { p.tipo = t; save(); renderPerfilSheet(); })); });
      r.appendChild(chips);
      var x = document.createElement('button'); x.className = 'fx'; x.textContent = '✕'; x.title = 'Quitar';
      x.addEventListener('click', function () { data.child.personas.splice(i, 1); save(); renderPerfilSheet(); });
      r.appendChild(x); list.appendChild(r);
    });
    body.appendChild(list);
    var add = document.createElement('div'); add.className = 'food-input'; add.style.marginTop = '8px';
    add.innerHTML = '<input type="text" id="personaInput" placeholder="Añadir persona… (nombre)" autocomplete="off" /><button class="btn-add" id="personaAdd">Añadir</button>';
    body.appendChild(add);
    function addP() { var v = ($('personaInput').value || '').trim(); if (!v) return; if (!personaNames().some(function (n) { return n.toLowerCase() === v.toLowerCase(); })) data.child.personas.push({ nombre: v, tipo: 'Otro' }); save(); renderPerfilSheet(); }
    $('personaAdd').addEventListener('click', addP);
    $('personaInput').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); addP(); } });
  }
  function openPerfil() { renderPerfilSheet(); $('perfilBackdrop').hidden = false; }
  function closePerfil() { $('perfilBackdrop').hidden = true; if (!$('view-resumen').hidden) renderResumen(); }

  // ---------- resumen ----------
  function zoneColor(z) { var f = ZONES.find(function (x) { return x.val === z; }); return f ? f.color : '#B4B2A9'; }
  function resItemLine(e) {
    var title, sub;
    if (e.type === 'nap') { var n = napSummary(e); title = '😴 ' + n.title; sub = n.sub; }
    else if (e.type === 'meal') { var m = mealSummary(e); title = '🍽️ ' + m.title; sub = m.sub; }
    else if (e.type === 'act') { var a = actSummary(e); title = '🚶 ' + a.title; sub = a.sub; }
    else if (e.type === 'dys') { var d = dysSummary(e); title = '⚡ ' + d.title; sub = d.sub; }
    else if (e.type === 'sleep') { var p = []; var dr = durStr(e.bed, e.wake, true); if (dr) p.push(dr); if (e.calidad) p.push('calidad ' + e.calidad + '/5'); var ne = (e.eventosNoche || []).length; if (ne) p.push(ne + ' evento' + (ne > 1 ? 's' : '') + ' noche'); title = '🌙 Sueño de anoche'; sub = p.join(' · ') || 'sin datos'; }
    else if (e.type === 'obs') { var o = obsSummary(e); title = '📝 ' + o.title; sub = o.sub; }
    else if (e.type === 'salud') { var h = saludSummary(e); title = h.title; sub = h.sub; }
    else if (e.type === 'rutina') { var ru = rutinaSummary(e); title = ru.title; sub = ru.sub; }
    var when = e.time ? e.time + ' ' : '';
    var warn = (e.type === 'dys') || (e.type === 'obs' && e.valencia === 'Difícil') || (e.type === 'rutina' && e.valoracion === 'Reactivo') || (e.type === 'act' && (e.intentoFallido || data.entries.some(function (x) { return x.type === 'dys' && x.linkedEventId === e.id; })));
    return '<div class="res-line"><span class="k">' + when + '</span><span class="' + (warn ? 'res-warn' : '') + '">' + title + (sub ? ' · <span style="color:var(--muted)">' + sub + '</span>' : '') + '</span></div>';
  }
  function perfilCardHtml() {
    var perfil = data.child.perfil || {};
    var hiper = SENSES.filter(function (s) { return perfil[s.key] === 'Hiper'; });
    var busca = SENSES.filter(function (s) { return perfil[s.key] === 'Busca'; });
    var pills = hiper.map(function (s) { return '<span class="perfil-pill">' + s.em + ' ' + s.key + '</span>'; }).join('') + busca.map(function (s) { return '<span class="perfil-pill busca">' + s.em + ' ' + s.key + ' busca</span>'; }).join('');
    return '<div class="perfil-card"><div class="ph"><b>Perfil sensorial de ' + data.child.name + '</b><button class="btn-ghost" id="perfilEdit">Editar</button></div><div class="perfil-tags">' + (pills || '<span class="perfil-empty">Sin definir. Toca “Editar”.</span>') + '</div></div>';
  }
  function lastNDates(n) { var arr = [], t = new Date(); for (var k = n - 1; k >= 0; k--) arr.push(todayKey(new Date(t.getTime() - k * 86400000))); return arr; }
  function shortDay(ds) { return new Date(ds + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }); }

  function dayResumen() {
    var t = selectedDate, ents = data.entries.filter(function (e) { return e.date === t; }), d = new Date(t + 'T12:00:00');
    var html = '<div class="res-date">' + (t === todayKey() ? 'Hoy · ' : '') + d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) + '</div>';
    var sleep = ents.find(function (e) { return e.type === 'sleep'; });
    var tot = totalSleepMin(t);
    var sleepVal = (tot != null ? fmtDur(tot) : '—') + (sleep && sleep.calidad ? ' · ' + sleep.calidad + '/5' : '');
    var nMeals = ents.filter(function (e) { return e.type === 'meal'; }).length, nAct = ents.filter(function (e) { return e.type === 'act'; }).length, nDys = ents.filter(function (e) { return e.type === 'dys'; }).length, nObs = ents.filter(function (e) { return e.type === 'obs'; }).length;
    html += '<div class="res-top">' +
      '<div class="res-stat"><div class="lbl">🌙 Sueño</div><div class="val">' + sleepVal + '</div></div>' +
      '<div class="res-stat"><div class="lbl">🍽️ Comidas</div><div class="val">' + nMeals + '</div></div>' +
      '<div class="res-stat"><div class="lbl">🚶 Actividades</div><div class="val">' + nAct + '</div></div>' +
      '<div class="res-stat"><div class="lbl">📝 Estado</div><div class="val">' + nObs + '</div></div>' +
      '<div class="res-stat"><div class="lbl">⚡ Desajustes</div><div class="val ' + (nDys ? 'res-warn' : '') + '">' + nDys + '</div></div></div>';
    MOMENTS.forEach(function (m) {
      var evs = ents.filter(function (e) { return momentOf(e) === m.key; }).sort(function (a, b) { return (a.time || '99') < (b.time || '99') ? -1 : 1; });
      html += '<div class="res-moment-head ' + m.cls + '"><span class="em">' + m.em + '</span>' + m.key + '</div>';
      html += evs.length ? evs.map(resItemLine).join('') : '<div class="res-empty">Sin registros.</div>';
    });
    return html;
  }
  function periodResumen(n) {
    var dates = lastNDates(n), setd = {}; dates.forEach(function (d) { setd[d] = 1; });
    var ents = data.entries.filter(function (e) { return setd[e.date]; });
    var dys = ents.filter(function (e) { return e.type === 'dys'; });
    var daysWithData = dates.filter(function (d) { return ents.some(function (e) { return e.date === d; }); }).length;
    var sleeps = ents.filter(function (e) { return e.type === 'sleep' && e.calidad; });
    var avgSleep = sleeps.length ? sleeps.reduce(function (s, e) { return s + e.calidad; }, 0) / sleeps.length : 0;
    var nAct = ents.filter(function (e) { return e.type === 'act'; }).length;
    var html = '<div class="res-date">Últimos ' + n + ' días · ' + daysWithData + ' con registro</div>';
    html += '<div class="kpis">' +
      '<div class="kpi"><div class="n warn">' + dys.length + '</div><div class="l">desajustes</div></div>' +
      '<div class="kpi"><div class="n">' + (dys.length / Math.max(daysWithData, 1)).toFixed(1) + '</div><div class="l">media / día</div></div>' +
      '<div class="kpi"><div class="n">' + (avgSleep ? avgSleep.toFixed(1) + '/5' : '—') + '</div><div class="l">sueño medio</div></div>' +
      '<div class="kpi"><div class="n">' + nAct + '</div><div class="l">actividades</div></div></div>';
    var perDay = dates.map(function (d) { return { k: shortDay(d), v: dys.filter(function (e) { return e.date === d; }).length }; });
    html += '<div class="an-h">Desajustes por día</div><div class="card-an">' + (n <= 10 ? barList(perDay, true) : sparkVals(perDay.map(function (x) { return x.v; }))) + '</div>';
    var byMoment = MOMENTS.map(function (m) { return { k: m.key, v: dys.filter(function (e) { return momentOf(e) === m.key; }).length }; });
    html += '<div class="an-h">Desajustes por momento</div><div class="card-an">' + barList(byMoment, true) + '</div>';
    html += '<div class="an-h">Disparadores más frecuentes</div><div class="card-an">' + barList(topN(countBy(dys, function (e) { return e.antecedentes; }), 5), true) + '</div>';
    if (!dys.length) html += '<div class="note-box">Sin desajustes en el periodo. 🎉</div>';
    return html;
  }
  function renderResumen() {
    var wrap = $('resumen');
    var sel = '<div class="period-sel">' + [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']].map(function (p) { return '<button data-p="' + p[0] + '" class="' + (resumenPeriod === p[0] ? 'sel' : '') + '">' + p[1] + '</button>'; }).join('') + '</div>';
    var body = resumenPeriod === 'dia' ? dayResumen() : periodResumen(resumenPeriod === 'semana' ? 7 : 30);
    wrap.innerHTML = perfilCardHtml() + sel + body;
    var pe = $('perfilEdit'); if (pe) pe.addEventListener('click', openPerfil);
    wrap.querySelectorAll('.period-sel button').forEach(function (b) { b.addEventListener('click', function () { resumenPeriod = b.dataset.p; renderResumen(); }); });
  }

  // ---------- history ----------
  function dayState(ds) {
    var ents = data.entries.filter(function (e) { return e.date === ds; });
    if (!ents.length) return { s: 's-none', label: 'sin datos' };
    var dys = ents.filter(function (e) { return e.type === 'dys'; });
    var maxInt = Math.max.apply(null, dys.map(function (e) { return e.intensidad || 0; }).concat([0]));
    if (dys.length >= 3 || maxInt >= 5) return { s: 's-bad', label: 'día difícil' };
    if (dys.length >= 1) return { s: 's-mid', label: 'regular' };
    return { s: 's-good', label: 'buen día' };
  }
  function weekStartOf(ds) { var d = new Date(ds + 'T12:00:00'), wd = (d.getDay() + 6) % 7; return addDays(ds, -wd); }
  function monthGridHtml() {
    var d = new Date(histAnchor + 'T12:00:00'), year = d.getFullYear(), month = d.getMonth();
    var startWd = (new Date(year, month, 1).getDay() + 6) % 7, dim = new Date(year, month + 1, 0).getDate();
    var html = '<div class="cal-grid">' + ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (w) { return '<div class="cal-wd">' + w + '</div>'; }).join('');
    for (var i = 0; i < startWd; i++) html += '<div class="cal-cell empty"></div>';
    for (var day = 1; day <= dim; day++) {
      var ds = year + '-' + pad(month + 1) + '-' + pad(day), st = dayState(ds);
      html += '<button class="cal-cell ' + st.s + (ds === histSelected ? ' sel' : '') + (ds === todayKey() ? ' today' : '') + '" data-date="' + ds + '">' + day + '</button>';
    }
    return html + '</div>';
  }
  function weekStripHtml() {
    var start = weekStartOf(histAnchor), wd = ['L', 'M', 'X', 'J', 'V', 'S', 'D'], html = '<div class="week-strip">';
    for (var i = 0; i < 7; i++) { var ds = addDays(start, i), st = dayState(ds), dn = new Date(ds + 'T12:00:00').getDate(); html += '<button class="week-cell ' + st.s + (ds === histSelected ? ' sel' : '') + '" data-date="' + ds + '"><span class="wd">' + wd[i] + '</span>' + dn + '</button>'; }
    return html + '</div>';
  }
  function yearGridHtml() {
    var year = new Date(histAnchor + 'T12:00:00').getFullYear();
    var startWd = (new Date(year, 0, 1).getDay() + 6) % 7;
    var html = '<div class="year-wrap"><div class="year-grid">';
    for (var i = 0; i < startWd; i++) html += '<div class="year-cell" style="visibility:hidden"></div>';
    for (var day = new Date(year, 0, 1); day.getFullYear() === year; day.setDate(day.getDate() + 1)) {
      var ds = day.getFullYear() + '-' + pad(day.getMonth() + 1) + '-' + pad(day.getDate()), st = dayState(ds);
      html += '<button class="year-cell ' + st.s + (ds === histSelected ? ' sel' : '') + '" data-date="' + ds + '" title="' + ds + '"></button>';
    }
    return html + '</div></div>';
  }
  function periodSummary(dates) {
    var g = 0, m = 0, b = 0, streak = 0, best = 0;
    dates.forEach(function (ds) { var s = dayState(ds).s; if (s === 's-good') { g++; streak++; if (streak > best) best = streak; } else { if (s === 's-mid') m++; else if (s === 's-bad') b++; if (s !== 's-none') streak = 0; } });
    return '<div class="per-summary"><span><b>' + g + '</b> buenos</span><span><b>' + m + '</b> regulares</span><span><b>' + b + '</b> difíciles</span><span>mejor racha <b>' + best + '</b></span></div>';
  }
  function legendHtml() {
    return '<div class="legend"><span><i class="s-good"></i>buen día</span><span><i class="s-mid"></i>regular</span><span><i class="s-bad"></i>difícil</span><span><i class="s-none"></i>sin datos</span></div>';
  }
  function dayDetailHtml(ds) {
    var ents = data.entries.filter(function (e) { return e.date === ds; }), d = new Date(ds + 'T12:00:00'), st = dayState(ds);
    var html = '<div class="day-detail"><div class="dd-head"><div><h3>' + d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) + '</h3><span class="dd-state ' + st.s + '">' + st.label + '</span></div><button class="btn-ghost" id="editDay">✏️ Editar este día</button></div>';
    if (!ents.length) return html + '<div class="list-empty">Sin registros este día.</div></div>';
    MOMENTS.forEach(function (m) {
      var evs = ents.filter(function (e) { return momentOf(e) === m.key; }).sort(function (a, b) { return (a.time || '99') < (b.time || '99') ? -1 : 1; });
      if (!evs.length) return;
      html += '<div class="res-moment-head ' + m.cls + '"><span class="em">' + m.em + '</span>' + m.key + '</div>' + evs.map(resItemLine).join('');
    });
    return html + '</div>';
  }
  function renderHistory() {
    var wrap = $('historyList');
    var d = new Date(histAnchor + 'T12:00:00'), title, prevStep, nextStep, grid = '', dates = [];
    if (histView === 'mes') {
      title = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      prevStep = function () { histAnchor = todayKey(new Date(d.getFullYear(), d.getMonth() - 1, 15)); };
      nextStep = function () { histAnchor = todayKey(new Date(d.getFullYear(), d.getMonth() + 1, 15)); };
      grid = monthGridHtml();
      var dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); for (var i = 1; i <= dim; i++) dates.push(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(i));
    } else if (histView === 'anio') {
      title = '' + d.getFullYear();
      prevStep = function () { histAnchor = todayKey(new Date(d.getFullYear() - 1, 6, 1)); };
      nextStep = function () { histAnchor = todayKey(new Date(d.getFullYear() + 1, 6, 1)); };
      grid = yearGridHtml();
      for (var dd = new Date(d.getFullYear(), 0, 1); dd.getFullYear() === d.getFullYear(); dd.setDate(dd.getDate() + 1)) dates.push(dd.getFullYear() + '-' + pad(dd.getMonth() + 1) + '-' + pad(dd.getDate()));
    } else if (histView === 'semana') {
      var ws = weekStartOf(histAnchor), we = addDays(ws, 6);
      title = new Date(ws + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ' – ' + new Date(we + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      prevStep = function () { histAnchor = addDays(histAnchor, -7); };
      nextStep = function () { histAnchor = addDays(histAnchor, 7); };
      grid = weekStripHtml();
      for (var j = 0; j < 7; j++) dates.push(addDays(ws, j));
    } else {
      title = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      prevStep = function () { histAnchor = addDays(histAnchor, -1); histSelected = histAnchor; };
      nextStep = function () { histAnchor = addDays(histAnchor, 1); histSelected = histAnchor; };
    }
    var sel = '<div class="period-sel">' + [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['anio', 'Año']].map(function (p) { return '<button data-p="' + p[0] + '" class="' + (histView === p[0] ? 'sel' : '') + '">' + p[1] + '</button>'; }).join('') + '</div>';
    var nav = '<div class="hist-nav"><button id="hPrev">‹</button><span class="t">' + title + '</span><button id="hNext">›</button></div>';
    var summary = (histView !== 'dia') ? periodSummary(dates) + legendHtml() : '';
    wrap.innerHTML = sel + nav + grid + summary + dayDetailHtml(histSelected);

    wrap.querySelectorAll('.period-sel button').forEach(function (b) { b.addEventListener('click', function () { histView = b.dataset.p; histAnchor = histSelected; renderHistory(); }); });
    $('hPrev').addEventListener('click', function () { prevStep(); renderHistory(); });
    $('hNext').addEventListener('click', function () { nextStep(); renderHistory(); });
    wrap.querySelectorAll('[data-date]').forEach(function (c) { c.addEventListener('click', function () { histSelected = c.dataset.date; renderHistory(); }); });
    var ed = $('editDay'); if (ed) ed.addEventListener('click', function () { selectedDate = histSelected; switchView('hoy'); window.scrollTo(0, 0); });
  }

  // ---------- análisis: helpers ----------
  function countBy(items, keyFn) { var m = {}; items.forEach(function (it) { (keyFn(it) || []).forEach(function (k) { if (k) m[k] = (m[k] || 0) + 1; }); }); return m; }
  function topN(mapObj, n) { return Object.keys(mapObj).map(function (k) { return { k: k, v: mapObj[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, n); }
  function barList(items, warn) {
    if (!items.length) return '<div class="list-empty">Sin datos.</div>';
    var max = Math.max.apply(null, items.map(function (i) { return i.v; }).concat([1]));
    return items.map(function (i) { return '<div class="bar-row"><span class="lbl">' + i.k + '</span><span class="bar-track"><span class="bar-fill ' + (warn ? 'warn' : '') + '" style="width:' + Math.round(i.v / max * 100) + '%"></span></span><span class="val">' + i.v + '</span></div>'; }).join('');
  }
  function sleepQualityByDate() { var m = {}; data.entries.forEach(function (e) { if (e.type === 'sleep' && e.calidad) m[e.date] = e.calidad; }); return m; }
  function calambresByDate() {
    var m = {};
    data.entries.forEach(function (e) {
      if (e.type === 'sleep' && e.eventosNoche) {
        var n = e.eventosNoche.filter(function (ev) { return ev.tipo === 'Calambres'; }).length;
        if (n) m[e.date] = (m[e.date] || 0) + n;
      }
    });
    return m;
  }
  function sleepAnalysisHtml() {
    var dates = lastNDates(14);
    var totals = dates.map(function (d) { var t = totalSleepMin(d); return t != null ? Math.round(t / 6) / 10 : 0; }); // horas, 1 decimal
    var vals = dates.map(totalSleepMin).filter(function (t) { return t != null; });
    var avg = vals.length ? Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) : 0;
    var cal = calambresByDate(), nightsCal = Object.keys(cal).length;
    var nNights = data.entries.filter(function (e) { return e.type === 'sleep'; }).length;
    var html = '<div class="an-h">🌙 Sueño</div>';
    html += '<div class="kpis">' +
      '<div class="kpi"><div class="n">' + (avg ? fmtDur(avg) : '—') + '</div><div class="l">sueño total medio</div></div>' +
      '<div class="kpi"><div class="n' + (nightsCal ? ' warn' : '') + '">' + nightsCal + '</div><div class="l">noches con calambres</div></div>' +
      '<div class="kpi"><div class="n">' + nNights + '</div><div class="l">noches registradas</div></div>' +
      '</div>';
    if (vals.length) html += '<div class="an-h">Total de sueño — 14 días (horas)</div><div class="card-an">' + sparkVals(totals) + '</div>';
    return html;
  }
  function obsAnalysisHtml() {
    var obs = data.entries.filter(function (e) { return e.type === 'obs'; });
    if (obs.length < 3) return '';
    var html = '<div class="an-h">📝 Señales de estado</div>';
    html += '<div class="card-an">' + barList(topN(countBy(obs, function (e) { return e.senales; }), 8), false) + '</div>';
    // precursores: señales observadas el mismo día ANTES de un desajuste
    var pre = {}, dys = data.entries.filter(function (e) { return e.type === 'dys'; });
    dys.forEach(function (d) {
      var dmin = minOfDay(d);
      obs.filter(function (o) { return o.date === d.date && minOfDay(o) < dmin; }).forEach(function (o) {
        (o.senales || []).forEach(function (s) { if (s) pre[s] = (pre[s] || 0) + 1; });
      });
    });
    var preTop = topN(pre, 6);
    if (preTop.length) html += '<div class="an-h">Señales que suelen preceder a un desajuste</div><div class="card-an">' + barList(preTop, true) + '</div>';
    return html;
  }
  function fmtHora(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  function saludAnalysisHtml() {
    var salud = data.entries.filter(function (e) { return e.type === 'salud'; });
    if (salud.length < 3) return '';
    var nDays = Object.keys(data.entries.reduce(function (m, e) { m[e.date] = 1; return m; }, {})).length;
    var depos = salud.filter(function (e) { return e.subtipo === 'Deposición'; });
    var diasConDepo = Object.keys(depos.reduce(function (m, e) { m[e.date] = 1; return m; }, {})).length;
    var mins = depos.filter(function (e) { return e.time; }).map(function (e) { return toMin(e.time); });
    var horaMedia = mins.length ? fmtHora(Math.round(mins.reduce(function (a, b) { return a + b; }, 0) / mins.length)) : '—';
    var calDiurnos = salud.filter(function (e) { return e.subtipo === 'Calambres'; }).length, calNoct = 0;
    data.entries.forEach(function (e) { if (e.type === 'sleep' && e.eventosNoche) calNoct += e.eventosNoche.filter(function (x) { return x.tipo === 'Calambres'; }).length; });
    var html = '<div class="an-h">🩺 Cuerpo y salud</div>';
    html += '<div class="kpis">' +
      '<div class="kpi"><div class="n">' + diasConDepo + '/' + nDays + '</div><div class="l">días con deposición</div></div>' +
      '<div class="kpi"><div class="n">' + horaMedia + '</div><div class="l">hora media POPO</div></div>' +
      '<div class="kpi"><div class="n' + ((calDiurnos + calNoct) ? ' warn' : '') + '">' + (calDiurnos + calNoct) + '</div><div class="l">calambres (día+noche)</div></div>' +
      '</div>';
    html += '<div class="an-h">Registros de salud</div><div class="card-an">' + barList(topN(salud.reduce(function (m, e) { if (e.subtipo) m[e.subtipo] = (m[e.subtipo] || 0) + 1; return m; }, {}), 8), false) + '</div>';
    return html;
  }
  function actAnalysisHtml() {
    var acts = data.entries.filter(function (e) { return e.type === 'act'; });
    var rutinas = data.entries.filter(function (e) { return e.type === 'rutina'; });
    if (acts.length < 3 && rutinas.length < 3) return '';
    var html = '<div class="an-h">🚶 Personas, transiciones y rutinas</div>';
    // Días con cada persona
    var personaDays = {};
    acts.forEach(function (a) { (a.compania || []).forEach(function (c) { if (c === 'Solo') return; if (!personaDays[c]) personaDays[c] = {}; personaDays[c][a.date] = 1; }); });
    var personaBars = Object.keys(personaDays).map(function (n) { return { k: n, v: Object.keys(personaDays[n]).length }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
    if (personaBars.length) html += '<div class="an-sub">Días con cada persona</div><div class="card-an">' + barList(personaBars, false) + '</div>';
    // Transiciones problemáticas (≠ Bien)
    var transProblem = {};
    acts.forEach(function (a) { var tr = a.transiciones || {}; TRANS_DEF.forEach(function (t) { var v = tr[t.k]; if (transBad(v)) { var lab = t.em + ' ' + t.l.split(' ')[0] + ': ' + v; transProblem[lab] = (transProblem[lab] || 0) + 1; } }); });
    var transBars = topN(transProblem, 8);
    if (transBars.length) html += '<div class="an-sub">Transiciones difíciles</div><div class="card-an">' + barList(transBars, true) + '</div>';
    var ff = acts.filter(function (a) { return a.intentoFallido; }).length;
    if (ff) html += '<p class="an-note">🚫 ' + ff + ' día(s) no consiguió ir a una actividad prevista.</p>';
    // Efecto de las rutinas (relaja vs reactiva)
    if (rutinas.length >= 3) {
      var rows = RUTINA_TIPOS.map(function (rt) {
        var rs = rutinas.filter(function (e) { return e.tipo === rt.k && e.valoracion; });
        if (!rs.length) return '';
        var cnt = {}; rs.forEach(function (e) { cnt[e.valoracion] = (cnt[e.valoracion] || 0) + 1; });
        var parts = RUTINA_VAL.filter(function (v) { return cnt[v.v]; }).map(function (v) { return v.em + ' ' + cnt[v.v]; });
        return '<div class="bar-row"><span class="lbl">' + rt.em + ' ' + rt.k + '</span><span class="rut-mix">' + parts.join(' · ') + '</span></div>';
      }).filter(Boolean).join('');
      if (rows) html += '<div class="an-sub">Cómo van las rutinas</div><div class="card-an">' + rows + '</div>';
    }
    return html;
  }
  function dysByDate() { var m = {}; data.entries.forEach(function (e) { if (e.type === 'dys') m[e.date] = (m[e.date] || 0) + 1; }); return m; }
  function sleepEffect() {
    var sq = sleepQualityByDate(), dd = dysByDate(), bad = [], good = [];
    Object.keys(sq).forEach(function (dt) { var c = dd[dt] || 0; if (sq[dt] <= 2) bad.push(c); else if (sq[dt] >= 4) good.push(c); });
    function avg(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : 0; }
    if (!bad.length || !good.length) return null;
    return { bad: avg(bad), good: avg(good), nbad: bad.length, ngood: good.length };
  }
  function sparkVals(vals) {
    var max = Math.max.apply(null, vals.concat([1])), W = 300, H = 44, step = W / Math.max(vals.length - 1, 1);
    var pts = vals.map(function (v, i) { return Math.round(i * step) + ',' + Math.round(H - 4 - (v / max) * (H - 8)); }).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><polyline points="' + pts + '" fill="none" stroke="#C0492F" stroke-width="2"/></svg>';
  }
  function sparkline() {
    var today = new Date(), vals = [];
    for (var k = 13; k >= 0; k--) { var dt = todayKey(new Date(today.getTime() - k * 86400000)); vals.push(data.entries.filter(function (e) { return e.type === 'dys' && e.date === dt; }).length); }
    return sparkVals(vals);
  }

  // ---------- análisis: temporal (causas retardadas + acumulado) ----------
  var TAU_FAST = 300 / Math.LN2, TAU_SLOW = 1800 / Math.LN2;
  function minOfDay(e) { if (e.time) { var p = e.time.split(':'); return (+p[0]) * 60 + (+p[1]); } var m = momentOf(e); return m === 'Mañana' ? 600 : m === 'Mediodía' ? 840 : m === 'Tarde' ? 1020 : 1260; }
  function absMin(e) { return Math.round(new Date(e.date + 'T00:00:00').getTime() / 60000) + minOfDay(e); }
  function stimLoad(e) {
    if (e.type === 'sleep') { return (e.calidad && e.calidad <= 2) ? (3 - e.calidad) * 1.5 : 0; }
    if (e.type !== 'act') return 0;
    var w = 0, amb = e.ambiente || [];
    if (amb.indexOf('Ruidoso') !== -1) w += 2;
    if (amb.indexOf('Mucha gente') !== -1) w += 2;
    if (amb.indexOf('Mucha luz') !== -1) w += 1;
    if (amb.indexOf('Sitio nuevo') !== -1) w += 1;
    if (amb.indexOf('Cambios de plan') !== -1 || amb.indexOf('Transición difícil') !== -1) w += 1;
    if (e.tipo === 'Pantalla' || e.tipo === 'Compras' || e.tipo === 'Colegio') w += 2;
    if (e.tipo === 'Parque' || e.tipo === 'Deporte' || e.tipo === 'Terapia') w += 1;
    if (e.duracion === '1–2 h') w += 0.5; if (e.duracion === '>2 h') w += 1;
    return w;
  }
  function stimList() { var arr = []; data.entries.forEach(function (e) { var w = stimLoad(e); if (w > 0) arr.push({ t: absMin(e), w: w }); }); return arr; }
  function loadBefore(T, stim, tau, inclusive) { var s = 0; stim.forEach(function (x) { var dt = T - x.t; if ((inclusive ? dt >= 0 : dt > 0) && dt < 4320) s += x.w * Math.exp(-dt / tau); }); return s; }
  function combinedLoad(T, stim, inclusive) { return loadBefore(T, stim, TAU_FAST, inclusive) + 0.6 * loadBefore(T, stim, TAU_SLOW, inclusive); }
  function windowStim(T, lo, hi, stim) { var s = 0; stim.forEach(function (x) { var dt = T - x.t; if (dt >= lo && dt < hi) s += x.w; }); return s; }
  function prevDateStr(ds) { return todayKey(new Date(new Date(ds + 'T00:00:00').getTime() - 86400000)); }
  function renderTemporal(dys) {
    var stim = stimList();
    if (!stim.length || dys.length < 3) return '';
    var allT = data.entries.map(absMin);
    var maxT = Math.max.apply(null, allT), minT = maxT - 3 * 1440;
    var W = 600, H = 92, maxL = 0.01, pts = [], T;
    for (T = minT; T <= maxT; T += 30) { var L = combinedLoad(T, stim, true); pts.push([T, L]); if (L > maxL) maxL = L; }
    function X(t) { return (t - minT) / (maxT - minT) * W; }
    function Y(l) { return H - 4 - (l / maxL) * (H - 12); }
    var line = pts.map(function (p) { return X(p[0]).toFixed(0) + ',' + Y(p[1]).toFixed(0); }).join(' ');
    var area = '0,' + H + ' ' + line + ' ' + W + ',' + H;
    var dysT = dys.map(absMin).filter(function (t) { return t >= minT; });
    var dots = dysT.map(function (t) { return '<circle cx="' + X(t).toFixed(0) + '" cy="' + Y(combinedLoad(t, stim, true)).toFixed(0) + '" r="3.5" fill="#C0492F"/>'; }).join('');
    var sep = ''; for (var dd = 1; dd <= 3; dd++) { var xx = X(maxT - dd * 1440).toFixed(0); sep += '<line x1="' + xx + '" y1="0" x2="' + xx + '" y2="' + H + '" stroke="#E7E5DF" stroke-width="1"/>'; }
    var svg = '<svg class="load-curve" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + sep + '<polyline points="' + area + '" fill="rgba(192,73,47,0.10)" stroke="none"/><polyline points="' + line + '" fill="none" stroke="#C0492F" stroke-width="1.5"/>' + dots + '</svg>';

    var ctrlT = data.entries.filter(function (a) { return a.type === 'act' && !actHasDys(a); }).map(absMin);
    function avgLoad(times) { return times.length ? times.reduce(function (s, t) { return s + combinedLoad(t, stim, false); }, 0) / times.length : 0; }
    var lDys = avgLoad(dys.map(absMin)), lCtrl = avgLoad(ctrlT);

    var wins = [{ n: 'Últimas 3 h', lo: 1, hi: 180 }, { n: 'Hoy antes', lo: 180, hi: 720 }, { n: 'Ayer', lo: 720, hi: 2160 }, { n: 'Anteayer', lo: 2160, hi: 3600 }];
    function avgWin(times, lo, hi) { return times.length ? times.reduce(function (s, t) { return s + windowStim(t, lo, hi, stim); }, 0) / times.length : 0; }
    var lagRows = wins.map(function (w) { var a = avgWin(dys.map(absMin), w.lo, w.hi), b = avgWin(ctrlT, w.lo, w.hi); return { k: w.n, v: b > 0 ? a / b : (a > 0 ? 2 : 1) }; });
    var maxr = Math.max.apply(null, lagRows.map(function (x) { return x.v; }).concat([1.2]));
    var lagBars = lagRows.map(function (x) { return '<div class="bar-row"><span class="lbl">' + x.k + '</span><span class="bar-track"><span class="bar-fill ' + (x.v >= 1.15 ? 'warn' : '') + '" style="width:' + Math.round(Math.min(x.v, maxr) / maxr * 100) + '%"></span></span><span class="val">' + x.v.toFixed(1) + '×</span></div>'; }).join('');

    var html = '<div class="an-h">⏳ Causas en el tiempo — acumulado y retardado</div>';
    html += '<div class="card-an"><div class="an-lead" style="margin:0 0 6px">Carga sensorial acumulada (últimos 3 días) · los puntos rojos son desajustes</div>' + svg + '</div>';
    html += '<div class="two-col" style="margin-top:10px"><div class="kpi"><div class="n warn">' + lDys.toFixed(1) + '</div><div class="l">carga media antes de un desajuste</div></div><div class="kpi"><div class="n">' + lCtrl.toFixed(1) + '</div><div class="l">carga media en momentos tranquilos</div></div></div>';
    html += '<div class="an-h">Estímulo antes de un desajuste vs lo normal, por franja</div><div class="card-an">' + lagBars + '</div>';
    html += '<div class="note-box">Cada barra compara el estímulo en esa franja <b>antes de un desajuste</b> frente a un momento tranquilo. >1 sugiere que esa franja (incluso <b>ayer</b> o <b>anteayer</b>) contribuye. Es el efecto acumulado con decaimiento temporal — el “vaso que se llena”.</div>';
    return html;
  }

  // ---------- análisis: regresión (logística) ----------
  function logreg(X, y, iters, lr, l2) {
    var n = X.length, d = X[0].length, w = new Array(d).fill(0), b = 0, it, i, j;
    for (it = 0; it < iters; it++) {
      var gw = new Array(d).fill(0), gb = 0;
      for (i = 0; i < n; i++) {
        var z = b; for (j = 0; j < d; j++) z += w[j] * X[i][j];
        var p = 1 / (1 + Math.exp(-z)), err = p - y[i];
        for (j = 0; j < d; j++) gw[j] += err * X[i][j];
        gb += err;
      }
      for (j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
      b -= lr * (gb / n);
    }
    return { w: w, b: b };
  }
  function actHasDys(a) { return data.entries.some(function (e) { return e.type === 'dys' && e.linkedEventId === a.id; }) || a.termino === 'Con desajuste'; }
  function actFeatures(a, ctx) {
    var m = momentOf(a), s = ctx.sq[a.date], T = absMin(a), sAyer = ctx.sq[prevDateStr(a.date)];
    return {
      'Estímulo de este momento': stimLoad(a),            // inmediato
      'Carga acumulada (previa)': combinedLoad(T, ctx.stim, false), // acumulado
      'Tarde o noche': (m === 'Tarde' || m === 'Noche') ? 1 : 0,
      'Fuera de casa': (a.lugar && a.lugar !== 'Casa') ? 1 : 0,
      'Mal sueño anoche': (s && s <= 2) ? 1 : 0,          // retardo ~12 h
      'Mal sueño ayer (retardo)': (sAyer && sAyer <= 2) ? 1 : 0     // retardo ~36 h
    };
  }
  function runRegression() {
    var ctx = { sq: sleepQualityByDate(), stim: stimList() };
    var acts = data.entries.filter(function (e) { return e.type === 'act'; });
    if (acts.length < 8) return { ok: false, n: acts.length };
    var names = Object.keys(actFeatures(acts[0], ctx)), X = [], y = [];
    acts.forEach(function (a) { var f = actFeatures(a, ctx); X.push(names.map(function (k) { return f[k]; })); y.push(actHasDys(a) ? 1 : 0); });
    var pos = y.reduce(function (s, v) { return s + v; }, 0);
    if (pos < 3 || pos > y.length - 3) return { ok: false, n: acts.length, pos: pos, few: true };
    var d = names.length, n = X.length, mean = new Array(d).fill(0), std = new Array(d).fill(0), i, j;
    for (j = 0; j < d; j++) { for (i = 0; i < n; i++) mean[j] += X[i][j]; mean[j] /= n; }
    for (j = 0; j < d; j++) { var ss = 0; for (i = 0; i < n; i++) { var v = X[i][j] - mean[j]; ss += v * v; } std[j] = Math.sqrt(ss / n) || 1; }
    var Xs = X.map(function (row) { return row.map(function (v, jj) { return (v - mean[jj]) / std[jj]; }); });
    var m = logreg(Xs, y, 800, 0.3, 0.03);
    var factors = names.map(function (k, jj) { return { name: k, w: m.w[jj] }; }).sort(function (a, b) { return Math.abs(b.w) - Math.abs(a.w); });
    return { ok: true, n: acts.length, pos: pos, factors: factors };
  }

  function aiNarrative(dys) {
    var byM = countBy(dys, function (e) { return [momentOf(e)]; });
    var peak = topN(byM, 1)[0];
    var ante = topN(countBy(dys, function (e) { return e.antecedentes; }), 1)[0];
    var se = sleepEffect();
    var parts = [];
    if (peak) parts.push('Los desajustes se concentran sobre todo por la <b>' + peak.k.toLowerCase() + '</b>');
    if (ante) parts.push('y el desencadenante más frecuente es <b>' + ante.k.toLowerCase() + '</b>');
    var txt = parts.join(' ') + '.';
    if (se && se.bad > se.good + 0.3) txt += ' Tras noches de <b>sueño malo</b> hay más desajustes (' + se.bad.toFixed(1) + ' vs ' + se.good.toFixed(1) + ' de media al día).';
    var stim = stimList();
    if (stim.length) {
      var ctrlT = data.entries.filter(function (a) { return a.type === 'act' && !actHasDys(a); }).map(absMin);
      function al(times) { return times.length ? times.reduce(function (s, t) { return s + combinedLoad(t, stim, false); }, 0) / times.length : 0; }
      var ld = al(dys.map(absMin)), lc = al(ctrlT);
      if (ld > lc * 1.2) txt += ' Y no siempre es cosa del momento: los desajustes suelen llegar <b>tras acumular estímulos</b> (carga previa ' + ld.toFixed(1) + ' vs ' + lc.toFixed(1) + ' en calma).';
    }
    return '<div class="ai-box"><div class="ai-h">🤖 Lectura rápida — con IA será automática y más rica</div><p>' + txt + '</p></div>';
  }

  // ---------- predicción / alertas ----------
  function loadStats() {
    var stim = stimList(); if (!stim.length) return null;
    var dys = data.entries.filter(function (e) { return e.type === 'dys'; });
    var ctrl = data.entries.filter(function (a) { return a.type === 'act' && !actHasDys(a); });
    function al(t) { return t.length ? t.reduce(function (s, e) { return s + combinedLoad(absMin(e), stim, false); }, 0) / t.length : 0; }
    return { lDys: al(dys), lCtrl: al(ctrl) };
  }
  function computeTodayRisk() {
    var today = todayKey();
    var allDys = data.entries.filter(function (e) { return e.type === 'dys'; });
    var histDates = {}; data.entries.forEach(function (e) { histDates[e.date] = 1; });
    if (allDys.length < 4 || Object.keys(histDates).length < 3) return { ok: false };
    var perfil = data.child.perfil || {};
    var momentCounts = MOMENTS.map(function (m) { return allDys.filter(function (e) { return momentOf(e) === m.key; }).length; });
    var peakIdx = momentCounts.indexOf(Math.max.apply(null, momentCounts)), peakMoment = MOMENTS[peakIdx].key;
    var sleepToday = data.entries.find(function (e) { return e.type === 'sleep' && e.date === today; });
    var sleepAnoche = sleepToday ? sleepToday.calidad : null;
    var yest = addDays(today, -1), sleepY = data.entries.find(function (e) { return e.type === 'sleep' && e.date === yest; });
    var sleepAyer = sleepY ? sleepY.calidad : null;
    var stim = stimList(), curLoad = combinedLoad(absMin({ date: today, time: nowTime() }), stim, true), ls = loadStats();
    var loadThr = ls ? (ls.lDys + ls.lCtrl) / 2 : 999;
    var perfilHiper = SENSES.filter(function (s) { return perfil[s.key] === 'Hiper'; });

    var score = 0.3, drivers = [];
    if (sleepAnoche && sleepAnoche <= 2) { score += 0.25; drivers.push('Durmió mal anoche (' + sleepAnoche + '/5)'); }
    else if (sleepAnoche && sleepAnoche >= 4) score -= 0.1;
    if (sleepAyer && sleepAyer <= 2) { score += 0.1; drivers.push('Anteanoche también durmió mal'); }
    if (curLoad >= loadThr && curLoad > 0) { score += 0.2; drivers.push('La carga sensorial de hoy ya va alta'); }
    if (perfilHiper.length >= 2) { score += 0.1; drivers.push('Perfil hipersensible (' + perfilHiper.map(function (s) { return s.key.toLowerCase(); }).slice(0, 3).join(', ') + ')'); }
    drivers.push('Históricamente, la ' + peakMoment.toLowerCase() + ' es su franja más sensible');
    score = Math.max(0, Math.min(1, score));
    var level = score >= 0.6 ? 'alto' : score >= 0.35 ? 'medio' : 'bajo';

    var maxM = Math.max.apply(null, momentCounts) || 1;
    var byMoment = MOMENTS.map(function (m, i) { var rel = momentCounts[i] / maxM, lv = (score >= 0.5 && rel >= 0.7) ? 'alto' : (rel >= 0.5 || score >= 0.6) ? 'medio' : 'bajo'; return { m: m.key, lv: lv }; });

    var tips = [];
    if (sleepAnoche && sleepAnoche <= 2) tips.push('Día más tranquilo: menos planes exigentes y más pausas, sobre todo por la ' + peakMoment.toLowerCase() + '.');
    if (curLoad >= loadThr && curLoad > 0) tips.push('Programa un rato de calma (rincón tranquilo, presión profunda) antes de la ' + peakMoment.toLowerCase() + '.');
    if (perfil['Oído'] === 'Hiper') tips.push('Ten a mano cascos o auriculares por si hay sitios ruidosos.');
    if (perfil['Tacto'] === 'Hiper') tips.push('Ropa cómoda sin etiquetas; avisa antes de tocarle.');
    if (!tips.length) tips.push('Anticipa las transiciones con un aviso y ten a mano su objeto de calma.');
    return { ok: true, level: level, score: score, drivers: drivers, byMoment: byMoment, tips: tips, peakMoment: peakMoment };
  }
  function predictionHtml() {
    var r = computeTodayRisk();
    if (!r.ok) return '<div class="note-box">Necesito unos días de registro para estimar el riesgo. Genera datos de ejemplo o sigue registrando.</div>';
    var cls = r.level === 'alto' ? 'risk-alto' : r.level === 'medio' ? 'risk-medio' : 'risk-bajo';
    var html = '<div class="pred-card ' + cls + '"><div class="pred-h">🔮 Predicción de hoy — riesgo ' + r.level + '</div>';
    html += '<div class="pred-moments">' + r.byMoment.map(function (x) { return '<span class="pm pm-' + x.lv + '">' + momentEm(x.m) + ' ' + x.m + ' <b>' + x.lv + '</b></span>'; }).join('') + '</div>';
    html += '<div class="pred-sub">Por qué</div><ul class="pred-list">' + r.drivers.map(function (d) { return '<li>' + d + '</li>'; }).join('') + '</ul>';
    html += '<div class="pred-sub">Sugerencias</div><ul class="pred-list">' + r.tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
    html += '<div class="pred-note">Estimación orientativa a partir de tus patrones — no es diagnóstico. Con IA/backend será más precisa (predicción por horas e intervalos de confianza).</div></div>';
    return html;
  }
  function renderAnotarAlert() {
    var el = $('anotarAlert');
    if (selectedDate !== todayKey()) { el.hidden = true; return; }
    var r = computeTodayRisk();
    if (!r.ok || r.level === 'bajo') { el.hidden = true; return; }
    el.hidden = false;
    el.className = 'anotar-alert ' + (r.level === 'alto' ? 'risk-alto' : 'risk-medio');
    el.innerHTML = '<b>' + (r.level === 'alto' ? '⚠️ Riesgo alto hoy' : 'Riesgo moderado hoy') + '</b> · ' + r.drivers[0] + '. ' + r.tips[0] + ' <span class="aa-more">Ver en Análisis ›</span>';
    el.onclick = function () { switchView('analisis'); window.scrollTo(0, 0); };
  }

  // ---------- análisis: render ----------
  function renderAnalisis() {
    var wrap = $('analisis');
    var dys = data.entries.filter(function (e) { return e.type === 'dys'; });
    var nDays = Object.keys(data.entries.reduce(function (m, e) { m[e.date] = 1; return m; }, {})).length;
    var html = '<div class="demo-bar"><button class="btn-ghost" id="genDemo">Generar 14 días de ejemplo</button><button class="btn-ghost danger" id="clrAll">Borrar todo</button></div>';
    html += '<p class="an-lead">Datos sobre <b>' + nDays + '</b> día(s) · <b>' + dys.length + '</b> desajustes en total.</p>';

    html += aiSectionHtml();

    if (dys.length < 3) {
      html += '<div class="note-box">Aún hay pocos datos para analizar. Pulsa <b>“Generar 14 días de ejemplo”</b> para ver cómo funcionaría con datos reales de varias semanas.</div>';
      wrap.innerHTML = html; wireAnalisisBtns(); return;
    }

    html += predictionHtml();
    html += aiNarrative(dys);

    // KPIs
    var se = sleepEffect();
    var actsTotal = data.entries.filter(function (e) { return e.type === 'act'; }).length;
    var actsDys = data.entries.filter(function (e) { return e.type === 'act' && actHasDys(e); }).length;
    html += '<div class="an-h">De un vistazo</div><div class="kpis">' +
      '<div class="kpi"><div class="n warn">' + (dys.length / Math.max(nDays, 1)).toFixed(1) + '</div><div class="l">desajustes / día</div></div>' +
      '<div class="kpi"><div class="n">' + Math.round(actsDys / Math.max(actsTotal, 1) * 100) + '%</div><div class="l">actividades con desajuste</div></div>' +
      (se ? '<div class="kpi"><div class="n warn">' + se.bad.toFixed(1) + '</div><div class="l">tras mal sueño</div></div><div class="kpi"><div class="n">' + se.good.toFixed(1) + '</div><div class="l">tras buen sueño</div></div>' : '') +
      '</div>';

    // tendencia
    html += '<div class="an-h">Tendencia (14 días)</div><div class="card-an">' + sparkline() + '</div>';

    // sueño (Fase 1)
    html += sleepAnalysisHtml();

    // observaciones de estado (Fase 2)
    html += obsAnalysisHtml();

    // cuerpo y salud (Fase 3)
    html += saludAnalysisHtml();

    // personas, transiciones y rutinas (Fase 4)
    html += actAnalysisHtml();

    // por momento
    var byMoment = MOMENTS.map(function (m) { return { k: m.key, v: dys.filter(function (e) { return momentOf(e) === m.key; }).length }; });
    html += '<div class="an-h">Desajustes por momento del día</div><div class="card-an">' + barList(byMoment, true) + '</div>';

    // por actividad
    var byAct = {};
    dys.forEach(function (e) { if (e.linkedEventId) { var a = byId(e.linkedEventId); if (a && a.tipo) byAct[a.tipo] = (byAct[a.tipo] || 0) + 1; } });
    html += '<div class="an-h">Desajustes por actividad</div><div class="card-an">' + barList(topN(byAct, 6), true) + '</div>';

    // disparadores
    html += '<div class="an-h">Disparadores más frecuentes</div><div class="card-an">' + barList(topN(countBy(dys, function (e) { return e.antecedentes; }), 6), true) + '</div>';

    // qué ayuda
    html += '<div class="an-h">Qué ayudó más</div><div class="card-an">' + barList(topN(countBy(dys, function (e) { return e.ayudo; }), 6), false) + '</div>';

    // señales
    html += '<div class="an-h">Señales tempranas más vistas</div><div class="card-an">' + barList(topN(countBy(dys, function (e) { return e.senales; }), 6), false) + '</div>';

    // temporal (acumulado + retardado)
    html += renderTemporal(dys);

    // regresión
    html += '<div class="an-h">📈 Análisis profundo — factores de riesgo (regresión)</div>';
    var reg = runRegression();
    if (!reg.ok) {
      html += '<div class="note-box">Necesito más variedad de actividades con y sin desajuste para el modelo (' + (reg.n || 0) + ' actividades). Genera datos de ejemplo o sigue registrando.</div>';
    } else {
      var maxw = Math.max.apply(null, reg.factors.map(function (f) { return Math.abs(f.w); }).concat([0.1]));
      var rows = reg.factors.slice(0, 8).map(function (f) {
        var w = Math.round(Math.abs(f.w) / maxw * 100), pos = f.w >= 0, strong = Math.abs(f.w) >= 0.35 * maxw;
        var cls = strong ? (pos ? 'pos' : 'neg') : 'neu', lab = strong ? (pos ? '▲ riesgo' : '▼ protege') : '≈ poco claro';
        return '<div class="factor"><span class="fname">' + f.name + '</span><span class="ftrack"><span class="fb ' + cls + '" style="width:' + w + '%"></span><span class="fv">' + lab + '</span></span></div>';
      }).join('');
      html += '<div class="card-an">' + rows + '</div>';
      html += '<div class="note-box">Modelo de <b>regresión logística</b> sobre ' + reg.n + ' actividades (' + reg.pos + ' con desajuste), combinando las 3 temporalidades: <b>inmediato</b> (estímulo del momento), <b>acumulado</b> (carga previa que se disipa) y <b>retardado</b> (sueño de anoche y de ayer). <b>▲ rojo</b> sube el riesgo; <b>▼ verde</b> lo baja. Orientativo, no diagnóstico — mejora con semanas de datos reales. Con IA/backend se añadirán intervalos de confianza y predicción del día siguiente.</div>';
    }

    wrap.innerHTML = html; wireAnalisisBtns();
  }
  function wireAnalisisBtns() {
    var g = $('genDemo'); if (g) g.addEventListener('click', function () { genDemo(); });
    var c = $('clrAll'); if (c) c.addEventListener('click', function () { if (confirm('¿Borrar TODOS los registros?')) { data.entries = []; save(); renderAnalisis(); } });
    wireAISection();
  }

  // ---------- generador de datos de ejemplo ----------
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function genDemo() {
    var today = new Date(), prevSleep = null;
    var risky = ['Pantalla', 'Compras', 'Parque'], calm = ['Juego con mamá', 'Juego con papá', 'Lectura / cuento', 'Música', 'Juego solo', 'Manualidades'];
    for (var k = 13; k >= 0; k--) {
      var dt = new Date(today.getTime() - k * 86400000), dateStr = todayKey(dt), base = Date.now() - k * 86400000;
      var sq = pick([1, 2, 2, 3, 3, 3, 4, 4, 4, 5]);
      data.entries.push({ id: uid(), type: 'sleep', date: dateStr, time: '07:' + pad(rint(0, 55)), moment: 'Noche', created: base, bed: '22:' + pad(rint(0, 55)), wake: '07:' + pad(rint(0, 55)), calidad: sq, latencia: sq <= 2 ? '30–60 min' : '<15 min', ayudas: [] });
      ['Desayuno', 'Comida', 'Merienda', 'Cena'].forEach(function (nm, idx) {
        var hr = [8, 14, 17, 20][idx], tm = pad(hr) + ':00';
        data.entries.push({ id: uid(), type: 'meal', date: dateStr, time: tm, moment: momentFromTime(tm), created: base + idx + 1, nombre: nm, alimentos: [{ nombre: pick(['Pan', 'Arroz', 'Pollo', 'Fruta', 'Yogur', 'Pasta', 'Tortilla']) }], aceptacion: pick(['Comió bien', 'Comió bien', 'Con dificultad']) });
      });
      var lagRisk = (prevSleep && prevSleep <= 2) ? 0.15 : 0;   // efecto RETARDADO: mal sueño de ayer
      var cum = (sq <= 2) ? 3 : 0;                              // arranca con más carga si durmió mal
      var hrs = [rint(10, 11), rint(13, 16), rint(18, 20)];     // en orden temporal
      for (var a = 0; a < 3; a++) {
        var hr2 = hrs[a], tm2 = pad(hr2) + ':00', mo = momentFromTime(tm2);
        var isRisk = Math.random() < 0.5, tipo = isRisk ? pick(risky) : pick(calm), amb = [];
        if (isRisk && Math.random() < 0.6) amb.push('Ruidoso');
        if (isRisk && Math.random() < 0.5) amb.push('Mucha gente');
        if (!isRisk && Math.random() < 0.4) amb.push('Tranquilo');
        var lugar = isRisk ? pick(['Calle', 'Casa de otros']) : 'Casa';
        var risk = 0.04 + lagRisk;
        if (sq <= 2) risk += 0.18;
        if (amb.indexOf('Ruidoso') !== -1) risk += 0.13;
        if (amb.indexOf('Mucha gente') !== -1) risk += 0.13;
        if (tipo === 'Pantalla') risk += 0.10;
        if (tipo === 'Compras') risk += 0.13;
        if (mo === 'Tarde' || mo === 'Noche') risk += 0.05;
        risk += Math.min(0.35, cum * 0.05);                    // ACUMULADO: cuanto más estímulo llevaba el día
        var hasDys = Math.random() < risk, actId = uid();
        var w = 0; if (amb.indexOf('Ruidoso') !== -1) w += 2; if (amb.indexOf('Mucha gente') !== -1) w += 2; if (tipo === 'Pantalla' || tipo === 'Compras') w += 2; if (tipo === 'Parque') w += 1;
        data.entries.push({ id: actId, type: 'act', date: dateStr, time: tm2, moment: mo, created: base + 10 + a, tipo: tipo, lugar: lugar, duracion: pick(['15–30 min', '30–60 min', '1–2 h']), compania: [], ambiente: amb, senales: [], estrategias: [], zona: hasDys ? pick(['Nervioso', 'Desbordado']) : pick(['Calma', 'Calma', 'Nervioso']), termino: hasDys ? 'Con desajuste' : 'Bien' });
        cum += w;                                              // acumula DESPUÉS de esta actividad
        if (hasDys) {
          data.entries.push({ id: uid(), type: 'dys', date: dateStr, time: pad(hr2) + ':' + pad(rint(5, 55)), moment: mo, created: base + 20 + a, linkedEventId: actId, tipos: [pick(['Rabieta', 'Crisis / desbordamiento', 'Llanto / ansiedad', 'Bucle / perseveración'])], intensidad: rint(2, 5), antecedentes: [pick(['Transición', 'Ruido', 'Fin de pantalla', 'Sobreestimulación', 'Se le pidió algo'])], senales: [pick(['Se tapa oídos', 'Muy inquieto', 'Se queja de tripa', 'Habla acelerado'])], sensorial: [], ayudo: [pick(['Abrazo / presión', 'Silencio / cascos', 'Espacio / retirarse', 'Bajar luz'])], completo: true });
        }
      }
      prevSleep = sq;
    }
    save(); renderAnalisis();
  }

  // ---------- documentos ----------
  function dataUrlToBlob(u) { var parts = u.split(','), mime = parts[0].match(/:(.*?);/)[1], bin = atob(parts[1]), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: mime }); }
  function renderDocs() {
    var el = $('docList'), docs = data.docs || [];
    if (!docs.length) { el.innerHTML = '<div class="list-empty">Sin documentos todavía.</div>'; return; }
    el.innerHTML = '';
    docs.forEach(function (dc) {
      var row = document.createElement('div'); row.className = 'doc-row';
      row.innerHTML = '<span class="doc-ico">' + ((dc.mime || '').indexOf('pdf') !== -1 ? '📄' : '🖼️') + '</span><div class="doc-body"><div class="doc-name">' + dc.name + '</div><div class="doc-meta">' + dc.date + ' · ' + dc.tipo + '</div></div>';
      var op = document.createElement('button'); op.className = 'doc-act'; op.textContent = '↗'; op.setAttribute('aria-label', 'Abrir');
      op.addEventListener('click', function () { try { window.open(URL.createObjectURL(dataUrlToBlob(dc.dataUrl)), '_blank'); } catch (e) {} });
      var dl = document.createElement('button'); dl.className = 'doc-act'; dl.textContent = '✕'; dl.setAttribute('aria-label', 'Eliminar');
      dl.addEventListener('click', function () { data.docs = data.docs.filter(function (x) { return x.id !== dc.id; }); save(); renderDocs(); });
      row.appendChild(op); row.appendChild(dl); el.appendChild(row);
    });
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'registro-tea-' + todayKey() + '.json'; a.click(); URL.revokeObjectURL(url);
  }

  var toastT;
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.hidden = false; requestAnimationFrame(function () { t.classList.add('show'); }); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.hidden = true; }, 250); }, 1600); }

  var TITLES = { hoy: 'Hoy', resumen: 'Resumen', analisis: 'Análisis', historial: 'Historial' };
  function switchView(v) {
    $('view-hoy').hidden = v !== 'hoy'; $('view-resumen').hidden = v !== 'resumen'; $('view-analisis').hidden = v !== 'analisis'; $('view-historial').hidden = v !== 'historial';
    $('viewTitle').textContent = TITLES[v];
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === v); });
    if (v === 'resumen') { renderResumen(); renderDocs(); } else if (v === 'analisis') renderAnalisis(); else if (v === 'historial') renderHistory(); else renderHoy();
  }

  // ===== Sincronización en la nube (Supabase, modelo código de familia) =====
  function applyRemote(nd) {
    nd = migrate(nd);
    Store.state.entries = nd.entries || [];
    Store.state.child = nd.child || Store.state.child;
    Store.state.bank = nd.bank || Store.state.bank;
    Store.state.docs = nd.docs || [];
    Store.state.version = nd.version;
    localDriver.saveAll(Store.state);
  }
  function rerenderActive() { var t = document.querySelector('.tab.active'); if (t) switchView(t.dataset.view); }
  function setSyncStatus(state, code, err) {
    var el = $('syncStatus'); if (el) {
      if (state === 'conectado') el.innerHTML = '☁️ Conectado · familia <b>' + code + '</b>';
      else if (state === 'conectando') el.textContent = 'Conectando…';
      else if (state === 'error') el.innerHTML = '<span class="tag-warn">No se pudo conectar' + (err ? ': ' + err : '') + '</span>';
      else el.textContent = 'Solo en este dispositivo (sin conectar).';
    }
    var db = $('syncDisconnect'); if (db) db.hidden = (state !== 'conectado');
  }
  function renderSync() {
    var f = null; try { f = localStorage.getItem('appTEA.family'); } catch (e) {}
    if ($('familyCode') && f && !$('familyCode').value) $('familyCode').value = f;
    setSyncStatus(Cloud.connected ? 'conectado' : 'local', Cloud.code);
  }
  var Cloud = {
    client: null, code: null, timer: null, lastUpdated: null, pushT: null, connected: false,
    ensureClient: function () {
      var self = this;
      if (self.client) return Promise.resolve(self.client);
      return import('https://esm.sh/@supabase/supabase-js@2').then(function (mod) { self.client = mod.createClient(SUPABASE_URL, SUPABASE_KEY); return self.client; });
    },
    connect: function (code) {
      var self = this; setSyncStatus('conectando');
      return self.ensureClient().then(function () {
        self.code = code;
        return self.client.rpc('get_household', { p_code: code });
      }).then(function (res) {
        if (res.error) throw res.error;
        var row = (res.data && res.data[0]) || null;
        if (row && row.data && row.data.entries) { applyRemote(row.data); self.lastUpdated = row.updated_at; }
        else { return self.push(); }
      }).then(function () {
        self.connected = true;
        try { localStorage.setItem('appTEA.family', code); } catch (e) {}
        self.startPoll(); rerenderActive(); setSyncStatus('conectado', code);
      }).catch(function (e) { self.connected = false; setSyncStatus('error', null, (e && e.message) || ('' + e)); });
    },
    disconnect: function () { if (this.timer) { clearInterval(this.timer); this.timer = null; } this.connected = false; try { localStorage.removeItem('appTEA.family'); } catch (e) {} setSyncStatus('local'); },
    push: function () {
      var self = this; if (!self.client || !self.code) return Promise.resolve();
      return self.client.rpc('save_household', { p_code: self.code, p_data: Store.state }).then(function (res) { if (!res.error && res.data) self.lastUpdated = res.data; });
    },
    pushDebounced: function () { var self = this; clearTimeout(self.pushT); self.pushT = setTimeout(function () { self.push(); }, 700); },
    startPoll: function () {
      var self = this; if (self.timer) clearInterval(self.timer);
      self.timer = setInterval(function () {
        self.client.rpc('get_household', { p_code: self.code }).then(function (res) {
          var row = res.data && res.data[0];
          if (row && row.updated_at !== self.lastUpdated) {
            self.lastUpdated = row.updated_at;
            if (row.data && row.data.entries) { applyRemote(row.data); rerenderActive(); }
          }
        }).catch(function () {});
      }, 5000);
    }
  };

  // ===================== IA (voz, análisis, chat) =====================
  var AI_ENDPOINT = '/.netlify/functions/ai';

  async function aiCall(task, payload) {
    var body = Object.assign({ task: task }, payload || {});
    var r;
    try {
      r = await fetch(AI_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    } catch (e) {
      throw new Error('No pude conectar con la IA. ¿La app está en Netlify y con conexión?');
    }
    var j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j || !j.ok) {
      var msg = (j && j.error) ? j.error : ('Error ' + r.status + '. ¿Está configurada la clave de Claude en Netlify?');
      throw new Error(msg);
    }
    return j;
  }

  // ---- Resumen compacto de datos para análisis / chat ----
  function compactEntry(e) {
    if (e.type === 'sleep') { var tt = totalSleepMin(e.date); return { tipo: 'sueño', calidad: e.calidad || null, durmio: e.bed || null, desperto: e.wake || null, total_sueno_min: tt, se_durmio: e.facilidad || null, donde: e.donde || null, desperto_como: e.despertarComo || null, eventos_noche: (e.eventosNoche || []).map(function (x) { return x.tipo + (x.hora ? ' ' + x.hora : ''); }) }; }
    if (e.type === 'nap') return { tipo: 'siesta', momento: momentOf(e), inicio: e.start || null, fin: e.end || null, calidad: e.calidad || null, fallida: !!e.fallida };
    if (e.type === 'obs') return { tipo: 'observacion', momento: momentOf(e), hora: e.time || null, senales: e.senales || [], valencia: e.valencia || null, contexto: e.contexto || null };
    if (e.type === 'salud') return { tipo: 'salud', subtipo: e.subtipo || null, momento: momentOf(e), hora: e.time || null, detalle: e.detalle || null };
    if (e.type === 'meal') return { tipo: 'comida', nombre: e.nombre || 'comida', momento: momentOf(e), aceptacion: e.aceptacion || null, alimentos: (e.alimentos || []).map(function (f) { return f.nombre; }) };
    if (e.type === 'act') { var tr = e.transiciones || {}; return { tipo: 'actividad', actividad: e.tipo || null, momento: momentOf(e), lugar: e.lugar || null, con_quien: (e.compania || []).filter(function (c) { return c !== 'Solo'; }), termino: e.termino || null, primera_vez: !!e.primeraVez, intento_fallido: !!e.intentoFallido, transiciones: { salida: tr.salida || null, vuelta: tr.vuelta || null, entrada: tr.entrada || null }, con_desajuste: actHasDys(e) }; }
    if (e.type === 'rutina') return { tipo: 'rutina', rutina: e.tipo || null, momento: momentOf(e), hora: e.time || null, valoracion: e.valoracion || null };
    if (e.type === 'dys') { var a = e.linkedEventId ? byId(e.linkedEventId) : null; return { tipo: 'desajuste', desregulacion: e.tipos || [], momento: momentOf(e), intensidad: e.intensidad || null, antes: e.antecedentes || [], senales: e.senales || [], ayudo: e.ayudo || [], durante_actividad: a ? (a.tipo || null) : null }; }
    return null;
  }
  function buildAISummary() {
    var dys = data.entries.filter(function (e) { return e.type === 'dys'; });
    var acts = data.entries.filter(function (e) { return e.type === 'act'; });
    var dates = Object.keys(data.entries.reduce(function (m, e) { m[e.date] = 1; return m; }, {})).sort();
    var nDays = dates.length;
    var byMoment = {}; MOMENTS.forEach(function (m) { byMoment[m.key] = dys.filter(function (e) { return momentOf(e) === m.key; }).length; });
    var byAct = {}; dys.forEach(function (e) { if (e.linkedEventId) { var a = byId(e.linkedEventId); if (a && a.tipo) byAct[a.tipo] = (byAct[a.tipo] || 0) + 1; } });
    var reg = runRegression();
    var recientes = dates.slice(-10).map(function (dt) {
      var ents = data.entries.filter(function (e) { return e.date === dt; });
      return { fecha: dt, eventos: ents.map(compactEntry).filter(Boolean) };
    });
    return {
      nino: data.child.name,
      perfil_sensorial: data.child.perfil || {},
      dias_registrados: nDays,
      total_desajustes: dys.length,
      total_actividades: acts.length,
      desajustes_por_dia: nDays ? +(dys.length / nDays).toFixed(2) : 0,
      desajustes_por_momento: byMoment,
      disparadores_top: topN(countBy(dys, function (e) { return e.antecedentes; }), 8),
      que_ayuda_top: topN(countBy(dys, function (e) { return e.ayudo; }), 8),
      senales_top: topN(countBy(dys, function (e) { return e.senales; }), 8),
      tipos_desajuste_top: topN(countBy(dys, function (e) { return e.tipos; }), 8),
      desajustes_por_actividad: topN(byAct, 8),
      efecto_sueno: sleepEffect(),
      factores_regresion: reg.ok ? reg.factors.slice(0, 8).map(function (f) { return { factor: f.name, peso: +f.w.toFixed(2) }; }) : null,
      dias_recientes: recientes
    };
  }

  // ---- Markdown ligero (negritas, encabezados, listas) ----
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function mdLite(text) {
    var lines = String(text || '').split(/\n/), out = [], inUl = false;
    function closeUl() { if (inUl) { out.push('</ul>'); inUl = false; } }
    lines.forEach(function (ln) {
      var t = ln.trim();
      if (!t) { closeUl(); return; }
      var h = t.match(/^#{1,6}\s+(.*)$/);
      if (h) { closeUl(); out.push('<h4>' + inline(h[1]) + '</h4>'); return; }
      var li = t.match(/^[-*]\s+(.*)$/);
      if (li) { if (!inUl) { out.push('<ul>'); inUl = true; } out.push('<li>' + inline(li[1]) + '</li>'); return; }
      closeUl(); out.push('<p>' + inline(t) + '</p>');
    });
    closeUl();
    return out.join('');
    function inline(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); }
  }

  // ---- Estado persistente del panel de IA en Análisis ----
  var aiAnalyzeOut = '';       // HTML del último análisis
  var aiAnalyzeBusy = false;
  var aiChatLog = [];          // {role:'user'|'assistant', text}
  var aiChatBusy = false;

  function aiSectionHtml() {
    var chat = aiChatLog.map(function (m) {
      return '<div class="chat-msg ' + m.role + '">' + (m.role === 'assistant' ? mdLite(m.text) : esc(m.text)) + '</div>';
    }).join('') || '<div class="chat-empty">Pregunta sobre patrones, sueño, disparadores… Responde solo con tus datos.</div>';
    return '' +
      '<div class="ai-card">' +
        '<div class="an-h" style="margin-top:0">🧠 Análisis con IA</div>' +
        '<button class="btn-primary btn-block" id="aiAnalyzeBtn"' + (aiAnalyzeBusy ? ' disabled' : '') + '>' + (aiAnalyzeBusy ? 'Analizando…' : '✨ Generar conclusiones (Sonnet)') + '</button>' +
        '<div id="aiAnalyzeOut" class="ai-out">' + (aiAnalyzeOut || '') + '</div>' +
      '</div>' +
      '<div class="ai-card">' +
        '<div class="an-h" style="margin-top:0">💬 Pregunta a tus datos</div>' +
        '<div class="chat-log" id="aiChatLog">' + chat + '</div>' +
        '<div class="chat-input"><input type="text" id="aiChatInput" placeholder="¿Qué dispara más los desajustes?" ' + (aiChatBusy ? 'disabled' : '') + ' /><button class="chat-send" id="aiChatSend"' + (aiChatBusy ? ' disabled' : '') + '>➤</button></div>' +
      '</div>' +
      '<p class="hint2" style="margin:2px 2px 14px">La IA analiza tus datos en un servidor seguro (API de Claude). Orientativo — no sustituye a un profesional.</p>';
  }
  function wireAISection() {
    var ab = $('aiAnalyzeBtn'); if (ab) ab.addEventListener('click', runAIAnalyze);
    var ci = $('aiChatInput'), cs = $('aiChatSend');
    if (cs) cs.addEventListener('click', sendChat);
    if (ci) ci.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); sendChat(); } });
    var log = $('aiChatLog'); if (log) log.scrollTop = log.scrollHeight;
  }
  async function runAIAnalyze() {
    if (aiAnalyzeBusy) return;
    if (data.entries.length < 3) { aiAnalyzeOut = '<div class="note-box">Aún hay muy pocos datos. Registra algún día (o genera datos de ejemplo) y vuelve a intentarlo.</div>'; renderAnalisis(); return; }
    aiAnalyzeBusy = true; aiAnalyzeOut = '<div class="ai-loading">Pensando con los datos…</div>'; renderAnalisis();
    try {
      var res = await aiCall('analyze', { summary: buildAISummary() });
      aiAnalyzeOut = '<div class="ai-answer">' + mdLite(res.text) + '</div>';
    } catch (e) {
      aiAnalyzeOut = '<div class="note-box err">⚠️ ' + esc(e.message) + '</div>';
    }
    aiAnalyzeBusy = false; renderAnalisis();
  }
  async function sendChat() {
    if (aiChatBusy) return;
    var inp = $('aiChatInput'); var q = inp ? inp.value.trim() : '';
    if (!q) return;
    aiChatLog.push({ role: 'user', text: q });
    aiChatBusy = true; renderAnalisis();
    try {
      var hist = aiChatLog.slice(0, -1).map(function (m) { return { role: m.role, content: m.text }; });
      var res = await aiCall('chat', { question: q, summary: buildAISummary(), history: hist });
      aiChatLog.push({ role: 'assistant', text: res.text });
    } catch (e) {
      aiChatLog.push({ role: 'assistant', text: '⚠️ ' + e.message });
    }
    aiChatBusy = false; renderAnalisis();
  }

  // ---- Anotar por voz (graba en la app -> sube -> transcribe Groq -> extrae eventos) ----
  function recSupported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); }
  var mediaRec = null, mediaStream = null, audioChunks = [], recording = false, recTimer = null, recSecs = 0, voiceEvents = [];

  function openVoice() {
    voiceEvents = [];
    $('voiceText').value = '';
    $('voicePreview').innerHTML = '';
    $('voiceSave').disabled = true;
    $('voiceInterpret').disabled = false;
    $('voiceDate').textContent = (selectedDate === todayKey() ? 'Para hoy' : 'Para el ' + new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
    if (!recSupported()) { $('micBtn').disabled = true; }
    else { $('micBtn').disabled = false; }
    setMic(false);
    $('voiceBackdrop').hidden = false;
  }
  function closeVoice() { stopRec(true); $('voiceBackdrop').hidden = true; }
  function fmtSecs(s) { return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function setMic(on) {
    var b = $('micBtn'); if (!b) return;
    b.classList.toggle('rec', on);
    var ico = b.querySelector('.mic-ico'); if (ico) ico.textContent = on ? '⏹' : '🎤';
    if (!on) $('micStatus').textContent = recSupported() ? 'Toca para grabar y cuenta el día' : 'Tu navegador no permite grabar. Escribe abajo 👇';
  }
  function pickMime() {
    var c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < c.length; i++) { try { if (MediaRecorder.isTypeSupported(c[i])) return c[i]; } catch (e) {} }
    return '';
  }
  async function startRec() {
    if (!recSupported() || recording) return;
    try { mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { $('micStatus').textContent = 'Permiso de micro denegado. Escribe abajo 👇'; return; }
    var mt = pickMime();
    try { mediaRec = mt ? new MediaRecorder(mediaStream, { mimeType: mt, audioBitsPerSecond: 32000 }) : new MediaRecorder(mediaStream); }
    catch (e) { try { mediaRec = new MediaRecorder(mediaStream); } catch (e2) { stopStream(); $('micStatus').textContent = 'No se pudo grabar. Escribe abajo 👇'; return; } }
    audioChunks = [];
    mediaRec.ondataavailable = function (ev) { if (ev.data && ev.data.size) audioChunks.push(ev.data); };
    mediaRec.onstop = function () {
      stopStream();
      var blob = new Blob(audioChunks, { type: (mediaRec && mediaRec.mimeType) || mt || 'audio/webm' });
      if (blob.size < 1200) { setMic(false); $('micStatus').textContent = 'No se grabó audio. Inténtalo otra vez.'; return; }
      transcribeBlob(blob);
    };
    try { mediaRec.start(); } catch (e) { stopStream(); $('micStatus').textContent = 'No se pudo grabar. Escribe abajo 👇'; return; }
    recording = true; recSecs = 0; setMic(true);
    $('micStatus').textContent = '● Grabando 0:00 — toca para parar';
    recTimer = setInterval(function () { recSecs++; if (recording) $('micStatus').textContent = '● Grabando ' + fmtSecs(recSecs) + ' — toca para parar'; }, 1000);
  }
  function stopStream() { if (mediaStream) { try { mediaStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} mediaStream = null; } }
  function stopRec(silent) {
    if (recTimer) { clearInterval(recTimer); recTimer = null; }
    if (mediaRec && recording) {
      recording = false; setMic(false);
      if (silent) { try { mediaRec.onstop = function () { stopStream(); }; } catch (e) {} }   // al cerrar la hoja: parar sin transcribir
      try { mediaRec.stop(); } catch (e) { stopStream(); }
    } else { recording = false; setMic(false); stopStream(); }
  }
  function toggleRec() { if (recording) stopRec(); else startRec(); }

  function blobToB64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result); var i = s.indexOf(','); resolve(i !== -1 ? s.slice(i + 1) : s); };
      r.onerror = function () { reject(new Error('No pude leer el audio')); };
      r.readAsDataURL(blob);
    });
  }
  async function transcribeBlob(blob) {
    if (blob.size > 4.5 * 1024 * 1024) { $('micStatus').textContent = 'Audio demasiado largo. Graba tramos más cortos (≈15 min máx).'; return; }
    $('micStatus').textContent = '⏳ Subiendo y transcribiendo…'; $('micBtn').disabled = true;
    try {
      var b64 = await blobToB64(blob);
      var res = await aiCall('transcribe', { audio: b64, mime: blob.type });
      var txt = (res.text || '').trim();
      if (!txt) { $('micStatus').textContent = 'No se entendió el audio. Prueba de nuevo o escribe.'; return; }
      var prev = $('voiceText').value.trim();
      $('voiceText').value = prev ? (prev + ' ' + txt) : txt;
      $('micStatus').textContent = '✓ Transcrito. Revisa y corrige el texto, luego pulsa ✨ Interpretar';
      var ta = $('voiceText'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    } catch (e) {
      $('micStatus').textContent = '⚠️ ' + e.message;
    } finally { $('micBtn').disabled = false; }
  }

  function voiceLabel(ev) {
    if (ev.type === 'meal') return '🍽️ ' + (ev.nombre || 'Comida') + (ev.aceptacion ? ' · ' + ev.aceptacion.toLowerCase() : '') + ((ev.alimentos && ev.alimentos.length) ? ' (' + ev.alimentos.join(', ') + ')' : '');
    if (ev.type === 'act') { var q = (ev.compania || []).filter(function (c) { return c !== 'Solo'; }); var tr = ev.transiciones || {}; var extra = []; if (ev.primeraVez) extra.push('1ª vez'); if (ev.intentoFallido) extra.push('no fue'); TRANS_DEF.forEach(function (t) { if (transBad(tr[t.k])) extra.push(t.l.split(' ')[0].toLowerCase() + ' ' + tr[t.k].toLowerCase()); }); return '🚶 ' + (ev.tipo || 'Actividad') + (q.length ? ' · con ' + q.join(', ') : '') + (ev.lugar ? ' · ' + ev.lugar.toLowerCase() : '') + (ev.termino ? ' · terminó ' + ev.termino.toLowerCase() : '') + (extra.length ? ' · ' + extra.join(' · ') : ''); }
    if (ev.type === 'rutina') return (ev.tipo ? rutinaEm(ev.tipo) + ' ' + ev.tipo : '🧴 Rutina') + (ev.valoracion ? ' · ' + ev.valoracion.toLowerCase() : '');
    if (ev.type === 'dys') return '⚡ ' + ((ev.tipos && ev.tipos.length) ? ev.tipos.join(', ') : 'Desajuste') + ((ev.antecedentes && ev.antecedentes.length) ? ' · tras ' + ev.antecedentes.join(', ').toLowerCase() : '');
    if (ev.type === 'obs') return '📝 ' + ((ev.senales && ev.senales.length) ? ev.senales.join(', ') : (ev.valencia || 'Estado')) + (ev.contexto ? ' · ' + ev.contexto : '');
    if (ev.type === 'salud') return (ev.subtipo ? saludEm(ev.subtipo) + ' ' + ev.subtipo : '🩺 Salud') + (ev.detalle ? ' · ' + ev.detalle : '');
    if (ev.type === 'nap') return '😴 ' + (ev.fallida ? 'Siesta fallida' : 'Siesta') + (ev.start ? ' · ' + ev.start + '→' + (ev.end || '?') : '') + (ev.calidad ? ' · calidad ' + ev.calidad + '/5' : '') + (ev.nota ? ' · ' + ev.nota : '');
    if (ev.type === 'sleep') {
      var sp = [];
      if (ev.bed || ev.wake) sp.push((ev.bed || '?') + '→' + (ev.wake || '?'));
      if (ev.calidad) sp.push('calidad ' + ev.calidad + '/5');
      if (ev.facilidad) sp.push('se durmió ' + String(ev.facilidad).toLowerCase());
      var ne = Array.isArray(ev.eventosNoche) ? ev.eventosNoche.length : 0;
      if (ne) sp.push(ne + ' evento' + (ne > 1 ? 's' : '') + ' noche');
      return '🌙 Sueño' + (sp.length ? ' · ' + sp.join(' · ') : '');
    }
    return ev.type;
  }
  function renderVoicePreview() {
    var el = $('voicePreview');
    if (!voiceEvents.length) { el.innerHTML = '<div class="note-box">No detecté eventos claros. Prueba a dar más detalle o escríbelo a mano.</div>'; $('voiceSave').disabled = true; return; }
    var html = '<div class="field-label" style="margin-top:14px">Eventos detectados — revisa y confirma</div>';
    html += voiceEvents.map(function (ev, i) {
      var mo = ev.moment ? momentEm(ev.moment) + ' ' + ev.moment : '';
      return '<label class="vp-row"><input type="checkbox" data-i="' + i + '" checked /><span class="vp-body"><span class="vp-t">' + esc(voiceLabel(ev)) + '</span>' + (mo ? '<span class="vp-m">' + mo + (ev.time ? ' · ' + ev.time : '') + '</span>' : '') + '</span></label>';
    }).join('');
    el.innerHTML = html;
    $('voiceSave').disabled = false;
  }
  async function interpretVoice() {
    var txt = $('voiceText').value.trim();
    if (!txt) { toast('Escribe o dicta algo primero'); return; }
    stopRec();
    var btn = $('voiceInterpret'); btn.disabled = true; var prev = btn.textContent; btn.textContent = 'Interpretando…';
    $('voicePreview').innerHTML = '<div class="ai-loading">La IA está leyendo lo que contaste…</div>';
    try {
      var res = await aiCall('parse', {
        transcript: txt,
        moment: nowMoment(),
        today: selectedDate,
        vocab: {
          mealAcept: MEAL_ACCEPT.map(function (m) { return m.v; }),
          actTypes: ACT_TYPES, actTermino: ACT_TERMINO,
          personas: personaNames(), actSalida: ACT_SALIDA, actVuelta: ACT_VUELTA, actEntrada: ACT_ENTRADA,
          rutinaTipos: RUTINA_TIPOS.map(function (o) { return o.k; }), rutinaVal: RUTINA_VAL.map(function (o) { return o.v; }),
          dysTipos: DYS.tipos, dysAnt: DYS.antecedentes, dysSenales: DYS.senales, dysAyudo: DYS.ayudo,
          napAcuesto: NAP_ACUESTO, napDespertar: NAP_DESPERTAR,
          calidadTexto: CALIDAD_TEXTO.map(function (o) { return o.v; }), acuestoFacil: ACUESTO_FACIL,
          dondeDormir: DONDE_DORMIR, despertarComo: DESPERTAR_COMO, despertarEstado: DESPERTAR_ESTADO,
          nocheEventos: NOCHE_EVENTOS,
          obsSenales: obsSenalesFlat(), obsValencia: OBS_VALENCIA.map(function (o) { return o.v; }),
          saludSubtipos: SALUD_SUBTIPOS.map(function (o) { return o.k; })
        }
      });
      voiceEvents = (res.eventos || []).filter(function (e) { return e && ['meal', 'act', 'dys', 'obs', 'salud', 'rutina', 'nap', 'sleep'].indexOf(e.type) !== -1; });
      renderVoicePreview();
    } catch (e) {
      $('voicePreview').innerHTML = '<div class="note-box err">⚠️ ' + esc(e.message) + '</div>';
      $('voiceSave').disabled = true;
    }
    btn.disabled = false; btn.textContent = prev;
  }
  function saveVoiceEvents() {
    var checks = $('voicePreview').querySelectorAll('input[type=checkbox]');
    var n = 0;
    checks.forEach(function (c) {
      if (!c.checked) return;
      var ev = voiceEvents[+c.dataset.i]; if (!ev) return;
      addEntry(ev.type, mapVoiceEvent(ev)); n++;
    });
    if (!n) { toast('Marca al menos un evento'); return; }
    save(); closeVoice(); renderHoy();
    toast(n === 1 ? '1 evento guardado' : n + ' eventos guardados');
  }
  // Encaja un valor devuelto por la IA al valor exacto del catálogo (tildes, "/ ", "( )")
  function normBase(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function normTxt(s) { return normBase(s).replace(/[\/(].*$/, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }   // solo el núcleo (antes de "/" o "(")
  function normFull(s) { return normBase(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }                          // texto completo
  function snapOne(val, list) {
    if (!val) return val;
    var nv = normTxt(val);
    for (var i = 0; i < list.length; i++) { if (list[i] === val) return list[i]; }                 // exacto
    for (i = 0; i < list.length; i++) { if (normTxt(list[i]) === nv) return list[i]; }             // sin tildes / núcleo igual
    for (i = 0; i < list.length; i++) {                                                             // contención (incluye sinónimos tras "/")
      var core = normTxt(list[i]), full = normFull(list[i]);
      if (nv.length > 3 && (full.indexOf(nv) !== -1 || nv.indexOf(core) !== -1)) return list[i];
    }
    return val;                                                                                     // no encaja: se conserva tal cual
  }
  function snapArr(x, list) { return arrOf(x).map(function (v) { return snapOne(v, list); }); }
  function arrOf(x) { return Array.isArray(x) ? x.map(String) : (x ? [String(x)] : []); }

  function mapVoiceEvent(ev) {
    var base = { time: ev.time || '', moment: ev.moment || momentFromTime(ev.time) || nowMoment() };
    if (ev.nota) base.nota = ev.nota;
    if (ev.type === 'meal') { base.nombre = ev.nombre || 'Comida'; base.alimentos = (ev.alimentos || []).map(function (nm) { return { nombre: String(nm) }; }); if (ev.aceptacion) base.aceptacion = snapOne(ev.aceptacion, MEAL_ACCEPT.map(function (m) { return m.v; })); }
    else if (ev.type === 'act') {
      base.tipo = ev.tipo ? snapOne(ev.tipo, ACT_TYPES) : 'Otra';
      if (ev.lugar) base.lugar = snapOne(ev.lugar, ACT_LUGAR);
      if (ev.termino) base.termino = snapOne(ev.termino, ACT_TERMINO);
      base.compania = snapArr(ev.compania || ev.conQuien, companiaOpts());
      var tr = ev.transiciones || {}; base.transiciones = {};
      if (tr.salida) base.transiciones.salida = snapOne(tr.salida, ACT_SALIDA);
      if (tr.vuelta) base.transiciones.vuelta = snapOne(tr.vuelta, ACT_VUELTA);
      if (tr.entrada) base.transiciones.entrada = snapOne(tr.entrada, ACT_ENTRADA);
      if (ev.primeraVez) base.primeraVez = true;
      if (ev.intentoFallido) base.intentoFallido = true;
      base.ambiente = []; base.senales = []; base.estrategias = [];
    }
    else if (ev.type === 'rutina') { base.tipo = ev.tipo ? snapOne(ev.tipo, RUTINA_TIPOS.map(function (o) { return o.k; })) : 'Ducha'; if (ev.valoracion) base.valoracion = snapOne(ev.valoracion, RUTINA_VAL.map(function (o) { return o.v; })); }
    else if (ev.type === 'dys') { base.tipos = snapArr(ev.tipos, DYS.tipos); base.antecedentes = snapArr(ev.antecedentes, DYS.antecedentes); base.senales = snapArr(ev.senales, DYS.senales); base.sensorial = snapArr(ev.sensorial, DYS.sensorial); base.ayudo = snapArr(ev.ayudo, DYS.ayudo); if (ev.intensidad) base.intensidad = +ev.intensidad; base.completo = true; }
    else if (ev.type === 'obs') { base.senales = snapArr(ev.senales, obsSenalesFlat()); if (ev.valencia) base.valencia = snapOne(ev.valencia, OBS_VALENCIA.map(function (o) { return o.v; })); if (ev.contexto) base.contexto = String(ev.contexto); }
    else if (ev.type === 'salud') { base.subtipo = ev.subtipo ? snapOne(ev.subtipo, SALUD_SUBTIPOS.map(function (o) { return o.k; })) : 'Otro'; if (ev.detalle) base.detalle = snapOne(String(ev.detalle), DEPOSICION_DETALLE); }
    else if (ev.type === 'nap') {
      if (ev.start) base.start = ev.start; if (ev.end) base.end = ev.end; if (ev.calidad) base.calidad = +ev.calidad;
      if (ev.acuesto) base.acuesto = snapOne(ev.acuesto, NAP_ACUESTO);
      if (ev.despertar) base.despertar = snapOne(ev.despertar, NAP_DESPERTAR);
      if (ev.fallida) base.fallida = true;
      base.moment = ev.moment || momentFromTime(ev.start) || 'Tarde';
    }
    else if (ev.type === 'sleep') {
      if (ev.bed) base.bed = ev.bed; if (ev.acuestoSofa) base.acuestoSofa = ev.acuestoSofa; if (ev.wake) base.wake = ev.wake;
      if (ev.calidad) base.calidad = +ev.calidad;
      if (ev.calidadTexto) { base.calidadTexto = snapOne(ev.calidadTexto, CALIDAD_TEXTO.map(function (o) { return o.v; })); if (!base.calidad) { var cm = CALIDAD_TEXTO.find(function (o) { return o.v === base.calidadTexto; }); if (cm) base.calidad = cm.c; } }
      if (ev.facilidad) base.facilidad = snapOne(ev.facilidad, ACUESTO_FACIL);
      if (ev.donde) base.donde = snapOne(ev.donde, DONDE_DORMIR);
      if (ev.despertarComo) base.despertarComo = snapOne(ev.despertarComo, DESPERTAR_COMO);
      base.despertarEstado = snapArr(ev.despertarEstado, DESPERTAR_ESTADO);
      base.eventosNoche = (Array.isArray(ev.eventosNoche) ? ev.eventosNoche : []).map(function (x) {
        var tipo = (typeof x === 'string') ? x : (x && x.tipo);
        return { tipo: snapOne(String(tipo || 'Otro'), NOCHE_EVENTOS), hora: (x && x.hora) || '' };
      }).filter(function (x) { return x.tipo; });
      base.moment = 'Noche'; base.ayudas = [];
    }
    return base;
  }

  function init() {
    renderHeader(); renderBank(); renderHoy();

    $('hotBtn').addEventListener('click', function () {
      var e = addEntry('dys', { time: nowTime(), moment: nowMoment(), tipos: [], antecedentes: [], senales: [], sensorial: [], ayudo: [], completo: false });
      $('hotHint').innerHTML = '<span class="tag-warn">✓ Marcado a las ' + e.time + '. Completa el detalle cuando estéis tranquilos.</span>';
      openDys(e.id, false);
    });
    $('addDys').addEventListener('click', function () { var e = addEntry('dys', { moment: nowMoment(), tipos: [], antecedentes: [], senales: [], sensorial: [], ayudo: [], completo: false }); openDys(e.id, false); });
    $('addNap').addEventListener('click', function () { var e = addEntry('nap', { moment: 'Tarde' }); openNapSheet(e.id); });
    $('addMeal').addEventListener('click', function () { var e = addEntry('meal', { nombre: '', alimentos: [] }); openMealSheet(e.id); });
    $('addActivity').addEventListener('click', function () { var e = addEntry('act', { compania: [], ambiente: [], senales: [], estrategias: [] }); openActSheet(e.id); });
    $('addObs').addEventListener('click', function () { var e = addEntry('obs', { time: nowTime(), moment: nowMoment(), senales: [] }); openObsSheet(e.id); });

    // observación de estado (obs)
    $('obsTimeInput').addEventListener('change', function () { var e = byId(openObs); if (e) { e.time = this.value; if (this.value) e.moment = momentFromTime(this.value); save(); momentPicker('obsTimeInput', 'obsMoment', e); $('obsTime').textContent = momentEm(momentOf(e)) + ' ' + (e.time || momentOf(e).toLowerCase()); } });
    $('obsContexto').addEventListener('input', function () { var e = byId(openObs); if (e) { e.contexto = this.value; save(); } });
    $('obsNota').addEventListener('input', function () { var e = byId(openObs); if (e) { e.nota = this.value; save(); } });
    $('obsCustomAdd').addEventListener('click', function () { addObsCustom($('obsCustomInput').value); $('obsCustomInput').value = ''; $('obsCustomInput').focus(); });
    $('obsCustomInput').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); addObsCustom(this.value); this.value = ''; } });
    $('obsClose').addEventListener('click', closeObs);
    $('obsSave').addEventListener('click', function () { toast('Guardado'); closeObs(); });
    $('obsDelete').addEventListener('click', function () { if (openObs) { removeEntry(openObs); closeObs(); } });
    $('obsBackdrop').addEventListener('click', function (ev) { if (ev.target === this) closeObs(); });
    $('timelineToggle').addEventListener('click', function () { timelineOpen = !timelineOpen; renderTimeline(); });

    // cuerpo y salud (Fase 3)
    $('qPopo').addEventListener('click', function () { quickSalud('Deposición'); });
    $('qCalambre').addEventListener('click', function () { quickSalud('Calambres'); });
    $('qMedic').addEventListener('click', function () { var e = addEntry('salud', { subtipo: 'Medicación', time: nowTime(), moment: nowMoment() }); openSaludSheet(e.id); });
    $('qOtroSalud').addEventListener('click', function () { var e = addEntry('salud', { time: nowTime(), moment: nowMoment() }); openSaludSheet(e.id); });
    $('saludTimeInput').addEventListener('change', function () { var e = byId(openSalud); if (e) { e.time = this.value; if (this.value) e.moment = momentFromTime(this.value); save(); momentPicker('saludTimeInput', 'saludMoment', e); $('saludTime').textContent = momentEm(momentOf(e)) + ' ' + (e.time || momentOf(e).toLowerCase()); } });
    $('saludDetalleText').addEventListener('input', function () { var e = byId(openSalud); if (e) { e.detalle = this.value; save(); } });
    $('saludNota').addEventListener('input', function () { var e = byId(openSalud); if (e) { e.nota = this.value; save(); } });
    $('saludClose').addEventListener('click', closeSalud);
    $('saludSave').addEventListener('click', function () { toast('Guardado'); closeSalud(); });
    $('saludDelete').addEventListener('click', function () { if (openSalud) { removeEntry(openSalud); closeSalud(); } });
    $('saludBackdrop').addEventListener('click', function (ev) { if (ev.target === this) closeSalud(); });

    // rutinas diarias (Fase 4)
    document.querySelectorAll('[data-rutina]').forEach(function (btn) { btn.addEventListener('click', function () { quickRutina(this.getAttribute('data-rutina')); }); });
    $('rutinaTimeInput').addEventListener('change', function () { var e = byId(openRutina); if (e) { e.time = this.value; if (this.value) e.moment = momentFromTime(this.value); save(); momentPicker('rutinaTimeInput', 'rutinaMoment', e); } });
    $('rutinaNota').addEventListener('input', function () { var e = byId(openRutina); if (e) { e.nota = this.value; save(); } });
    $('rutinaClose').addEventListener('click', closeRutina);
    $('rutinaSave').addEventListener('click', function () { toast('Guardado'); closeRutina(); });
    $('rutinaDelete').addEventListener('click', function () { if (openRutina) { removeEntry(openRutina); closeRutina(); } });
    $('rutinaBackdrop').addEventListener('click', function (ev) { if (ev.target === this) closeRutina(); });

    // anotar por voz
    $('voiceBtn').addEventListener('click', openVoice);
    $('micBtn').addEventListener('click', toggleRec);
    $('voiceInterpret').addEventListener('click', interpretVoice);
    $('voiceSave').addEventListener('click', saveVoiceEvents);
    $('voiceClose').addEventListener('click', closeVoice);
    $('voiceCancel').addEventListener('click', closeVoice);
    $('voiceBackdrop').addEventListener('click', function (ev) { if (ev.target === this) closeVoice(); });

    document.querySelectorAll('.more-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () { var el = $(btn.dataset.target); var open = !el.hidden; el.hidden = open; btn.textContent = (open ? '＋ más detalle' : '－ menos detalle'); });
    });

    $('sleepSofa').addEventListener('change', function () { var e = upsertSleep(); e.acuestoSofa = this.value; save(); renderSleep(); });
    $('sleepBed').addEventListener('change', function () { var e = upsertSleep(); e.bed = this.value; save(); renderSleep(); });
    $('sleepWake').addEventListener('change', function () { var e = upsertSleep(); e.wake = this.value; save(); renderSleep(); });
    $('sleepNota').addEventListener('input', function () { var e = upsertSleep(); e.nota = this.value; save(); });

    $('childChip').addEventListener('click', function () { var n = prompt('Nombre del peque:', data.child.name); if (n && n.trim()) { data.child.name = n.trim(); save(); renderHeader(); } });

    // navegación de día
    $('dayPrev').addEventListener('click', function () { goDay(-1); });
    $('dayNext').addEventListener('click', function () { goDay(1); });
    $('dayLabel').addEventListener('click', function () { var p = $('datePicker'); p.value = selectedDate; p.max = todayKey(); if (p.showPicker) { try { p.showPicker(); } catch (e) { p.click(); } } else p.click(); });
    $('datePicker').addEventListener('change', function () { if (this.value && this.value <= todayKey()) { selectedDate = this.value; renderDateNav(); renderHoy(); } });

    // nap sheet
    $('napStart').addEventListener('change', function () { var n = byId(openNap); if (n) { n.start = this.value; save(); $('napDur').textContent = durStr(n.start, n.end, false); } });
    $('napEnd').addEventListener('change', function () { var n = byId(openNap); if (n) { n.end = this.value; save(); $('napDur').textContent = durStr(n.start, n.end, false); } });
    $('napFallida').addEventListener('change', function () { var n = byId(openNap); if (n) { n.fallida = this.checked; save(); } });
    $('napNota').addEventListener('input', function () { var n = byId(openNap); if (n) { n.nota = this.value; save(); } });
    $('napClose').addEventListener('click', closeNap);
    $('napSave').addEventListener('click', function () { toast('Guardado'); closeNap(); });
    $('napDelete').addEventListener('click', function () { removeEntry(openNap); $('napBackdrop').hidden = true; openNap = null; renderHoy(); });
    $('napBackdrop').addEventListener('click', function (ev) { if (ev.target === this) closeNap(); });

    // meal sheet
    $('mealName').addEventListener('input', function () { var m = byId(openMeal); if (m) { m.nombre = this.value; save(); } });
    $('mealTime').addEventListener('change', function () { var m = byId(openMeal); if (m) { m.time = this.value; if (this.value) m.moment = momentFromTime(this.value); save(); momentPicker('mealTime', 'mealMoment', m); } });
    $('foodAdd').addEventListener('click', function () { addFood($('foodInput').value); $('foodInput').value = ''; $('foodInput').focus(); });
    $('foodInput').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); addFood($('foodInput').value); $('foodInput').value = ''; } });
    $('mealClose').addEventListener('click', closeMeal);
    $('mealSave').addEventListener('click', function () { toast('Guardado'); closeMeal(); });
    $('mealDelete').addEventListener('click', function () { removeEntry(openMeal); $('mealBackdrop').hidden = true; openMeal = null; renderHoy(); });
    $('mealBackdrop').addEventListener('click', function (ev) { if (ev.target === this) closeMeal(); });

    // food sheet
    $('foodClose').addEventListener('click', closeFood);
    $('foodBackdrop').addEventListener('click', function (ev) { if (ev.target === this) closeFood(); });
    $('foodNew').addEventListener('change', function () { var f = currentFood(); if (f) { f.nuevo = this.checked; save(); } });
    $('foodNota').addEventListener('input', function () { var f = currentFood(); if (f) { f.nota = this.value; save(); } });
    $('foodSave').addEventListener('click', function () { toast('Guardado'); closeFood(); });
    $('foodDelete').addEventListener('click', function () { var m = byId(openMeal); if (m && openFood) { m.alimentos = m.alimentos.filter(function (o) { return o.nombre !== openFood; }); save(); } closeFood(); });

    // activity sheet
    $('actTime').addEventListener('change', function () { var a = byId(openAct); if (a) { a.time = this.value; if (this.value) a.moment = momentFromTime(this.value); save(); momentPicker('actTime', 'actMoment', a); } });
    $('actNota').addEventListener('input', function () { var a = byId(openAct); if (a) { a.nota = this.value; save(); } });
    $('actClose').addEventListener('click', closeAct);
    $('actSave').addEventListener('click', function () { toast('Guardado'); closeAct(); });
    $('actDelete').addEventListener('click', function () { removeEntry(openAct); $('activityBackdrop').hidden = true; openAct = null; renderHoy(); });
    $('activityBackdrop').addEventListener('click', function (ev) { if (ev.target === this) closeAct(); });
    $('addActDys').addEventListener('click', function () { var a = byId(openAct); var e = addEntry('dys', { time: a.time, moment: a.moment, linkedEventId: openAct, tipos: [], antecedentes: [], senales: [], sensorial: [], ayudo: [], completo: false }); openDys(e.id, true); });
    $('actPrimeraVez').addEventListener('change', function () { var a = byId(openAct); if (a) { a.primeraVez = this.checked; save(); } });
    $('actIntentoFallido').addEventListener('change', function () { var a = byId(openAct); if (a) { a.intentoFallido = this.checked; save(); } });

    // dys sheet
    $('dysTime').addEventListener('change', function () { var e = byId(openId); if (e) { e.time = this.value; if (this.value) e.moment = momentFromTime(this.value); save(); momentPicker('dysTime', 'dysMoment', e); $('sheetTime').textContent = momentEm(momentOf(e)) + ' ' + (e.time || momentOf(e).toLowerCase()); } });
    $('sheetClose').addEventListener('click', closeDys);
    $('sheetBackdrop').addEventListener('click', function (ev) { if (ev.target === this) closeDys(); });
    $('sheetNota').addEventListener('input', function () { var e = byId(openId); if (e) { e.nota = this.value; save(); } });
    $('sheetSave').addEventListener('click', function () { var e = byId(openId); if (e) { e.completo = true; save(); } toast('Guardado'); closeDys(); });
    $('sheetDelete').addEventListener('click', function () { if (openId && confirm('¿Eliminar este desajuste?')) { removeEntry(openId); closeDys(); } });

    // perfil
    $('perfilClose').addEventListener('click', closePerfil);
    $('perfilSave').addEventListener('click', closePerfil);
    $('perfilBackdrop').addEventListener('click', function (ev) { if (ev.target === this) closePerfil(); });

    // documentos
    $('docAdd').addEventListener('click', function () { $('docInput').click(); });
    $('docInput').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      if (f.size > 2 * 1024 * 1024) { alert('Para el prototipo el archivo debe pesar menos de 2 MB.'); this.value = ''; return; }
      var r = new FileReader();
      r.onload = function () { if (!data.docs) data.docs = []; var tipo = prompt('Tipo (Informe, Análisis, Prescripción, Otro):', 'Informe') || 'Documento'; data.docs.push({ id: uid(), name: f.name, mime: f.type, tipo: tipo, date: todayKey(), dataUrl: r.result }); save(); renderDocs(); };
      r.readAsDataURL(f); this.value = '';
    });

    document.querySelectorAll('.tab').forEach(function (t) { t.addEventListener('click', function () { switchView(t.dataset.view); }); });
    $('exportBtn').addEventListener('click', exportData);
    $('clearBtn').addEventListener('click', function () { if (confirm('¿Borrar TODOS los registros?')) { data.entries = []; data.docs = []; save(); renderHistory(); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
