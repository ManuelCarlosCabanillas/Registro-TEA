// Netlify Function: proxy seguro a la API de Claude (Anthropic).
// La clave vive SOLO aquí, como variable de entorno ANTHROPIC_API_KEY en Netlify.
// El navegador nunca la ve. Llama a /.netlify/functions/ai con { task, ... }.
//
// Modelos: Sonnet para el análisis (razonamiento), Haiku para lo sencillo (voz y chat).

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_SONNET = 'claude-sonnet-5';
const MODEL_HAIKU = 'claude-haiku-4-5';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function ok(obj) { return { statusCode: 200, headers: CORS, body: JSON.stringify(obj) }; }
function err(code, msg) { return { statusCode: code, headers: CORS, body: JSON.stringify({ ok: false, error: msg }) }; }

// Llamada base a Claude
async function callClaude(model, system, messages, maxTokens, disableThinking) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { _err: 'no_key' };

  const body = { model: model, max_tokens: maxTokens, system: system, messages: messages };
  // Sonnet 5 activa "adaptive thinking" por defecto; lo desactivamos para
  // que la respuesta sea rápida y quepa en el tiempo de la función.
  if (disableThinking) body.thinking = { type: 'disabled' };

  const r = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  const j = await r.json();
  if (!r.ok) {
    const m = (j && j.error && j.error.message) ? j.error.message : ('HTTP ' + r.status);
    return { _err: 'api', _detail: m, _status: r.status };
  }
  if (j.stop_reason === 'refusal') return { _err: 'refusal' };
  const text = (j.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
  return { text: text };
}

// Extrae un objeto JSON de un texto (quita ```json ... ``` y busca el primer {...})
function extractJson(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf('{'), last = t.lastIndexOf('}');
  if (first === -1 || last === -1) return null;
  try { return JSON.parse(t.slice(first, last + 1)); } catch (e) { return null; }
}

// ---------- TAREA: parse (voz -> eventos) ----------
async function taskParse(p) {
  const v = p.vocab || {};
  const sys =
    'Eres un asistente que convierte lo que un cuidador cuenta (por voz) sobre el día de su hijo/a ' +
    'en eventos estructurados para una app de registro de neurodivergencia (TEA leve / hipersensibilidad sensorial).\n\n' +
    'Devuelve SOLO un objeto JSON válido, sin ningún texto antes o después, con esta forma exacta:\n' +
    '{ "eventos": [ { "type": "...", ...campos... } ], "resumen": "una frase" }\n\n' +
    'Cada evento tiene "type" que es uno de: "meal" (comida), "act" (actividad/juego/paseo/pantalla…), ' +
    '"dys" (desajuste/rabieta/crisis/bloqueo/desregulación), "obs" (observación de estado suelta), "salud" (cuerpo/salud: caca/POPO, pipí, calambres, palpitaciones, dolor, mocos, medicación), "rutina" (rutina de higiene/cuidado: ducha, bañera, dientes, pelo, uñas, vestirse), "nap" (SIESTA diurna), "sleep" (SOLO el sueño nocturno de anoche), "day" (valoración GLOBAL del día — solo si el relato la dice explícitamente: "al final TODO BIEN", "un día difícil").\n' +
    'IMPORTANTE: si mencionan una siesta o dormir de día, usa "nap", nunca "sleep". "sleep" es exclusivamente el sueño de la noche.\n' +
    'IMPORTANTE (obs vs dys): usa "obs" para notas de ESTADO sueltas y frecuentes (cómo está en un momento: señales del cuerpo o del humor — puntillas, cansado, gritos puntuales, tranquilo, habla mal, con ganas…). Usa "dys" SOLO para EPISODIOS COMPLETOS de desregulación (una rabieta, crisis o bloqueo con desencadenante y desenlace). Si dudas y no hay un episodio claro de crisis, usa "obs". Un mismo relato puede generar varias "obs" encadenadas en distintos momentos.\n' +
    'Campos comunes opcionales: "time" (hora "HH:MM" 24h si la dicen), "moment" ("Mañana" | "Mediodía" | "Tarde" | "Noche"), "nota" (texto libre con detalles que no encajen).\n' +
    'Campos por tipo:\n' +
    '  meal: "nombre" (Desayuno/Comida/Merienda/Cena o lo que digan), "alimentos" (lista de textos), "aceptacion" (uno de: ' + (v.mealAcept || ['Comió bien', 'Con dificultad', 'Lo rechazó']).join(' / ') + '), ' +
    '"lugar" (dónde comió, uno de: ' + (v.mealLugar || ['Mesa', 'Suelo', 'Sofá', 'Coche', 'Parque', 'Bar', 'Otro']).join(' / ') + '), "tele" (true si comió con la tele/pantalla puesta), ' +
    '"comoEstuvo" (cómo estuvo durante la comida, uno de: ' + (v.mealComo || ['Tranquilo', 'Jugando', 'Activado', 'Loco']).join(' / ') + '), "tomaExtra" (true si es una toma suelta fuera de horario: chuches, helado, un vaso de leche a las 23:00…). Ej.: "merendó en el sofá con la tele, muy activado" → meal lugar Sofá tele true comoEstuvo Activado; "le di un helado a media tarde" → meal tomaExtra true alimentos ["helado"].\n' +
    '  act: "tipo" (preferible uno de: ' + (v.actTypes || []).join(' / ') + '), "lugar", "termino" (uno de: ' + (v.actTermino || ['Bien', 'Regular', 'Con desajuste']).join(' / ') + '), ' +
    '"compania" (lista con QUIÉN estuvo — nombres de personas si los dicen, preferible de: ' + (v.personas || []).join(' / ') + '; o genéricos "Otro adulto"/"Otros niños"/"Solo"), ' +
    '"transiciones" (objeto opcional {"salida","vuelta","entrada"} sobre cómo fueron los momentos de transición: "salida" al ir uno de ' + (v.actSalida || ['Bien', 'Con ganas', 'Cuesta', 'Lloro']).join(' / ') + '; "vuelta" en el coche al volver uno de ' + (v.actVuelta || ['Bien', 'Gritos', 'Loqui', 'Se duerme']).join(' / ') + '; "entrada" al llegar a casa uno de ' + (v.actEntrada || ['Bien', 'Reactivo', 'Loco']).join(' / ') + '), ' +
    '"primeraVez" (true si es la primera vez que hace algo), "intentoFallido" (true si se intentó ir pero NO consiguió, p. ej. "no quiso entrar al cole"). Ej.: "fue a terapia con María, en el coche de vuelta gritando" → act tipo Terapia, compania ["María"], transiciones {vuelta:"Gritos"}.\n' +
    '  dys: "tipos" (lista, preferible de: ' + (v.dysTipos || []).join(' / ') + '), "antecedentes" (lista, qué pasó antes, preferible de: ' + (v.dysAnt || []).join(' / ') + '), ' +
    '"senales" (lista, preferible de: ' + (v.dysSenales || []).join(' / ') + '), "ayudo" (lista, qué ayudó, preferible de: ' + (v.dysAyudo || []).join(' / ') + '), "intensidad" (número 1-5).\n' +
    '  obs: "senales" (lista de señales de estado, preferible de: ' + (v.obsSenales || []).join(' / ') + '), "valencia" (cómo está en general, uno de: ' + (v.obsValencia || ['Bien', 'Regular', 'Difícil']).join(' / ') + '), "contexto" (dónde / con quién, texto), "nota".\n' +
    '  salud: "subtipo" (uno de: ' + (v.saludSubtipos || ['Deposición', 'Pipí', 'Calambres', 'Palpitaciones', 'Dolor', 'Mocos / enfermedad', 'Medicación', 'Otro']).join(' / ') + '), "detalle" (para Deposición: Normal/Dura/Blanda/Diarrea; para Medicación: nombre o dosis), "nota". Ej.: "hizo caca a las 13:30" → salud subtipo Deposición time 13:30; "calambres en la cena" → salud subtipo Calambres.\n' +
    '  rutina: "tipo" (uno de: ' + (v.rutinaTipos || ['Ducha', 'Bañera', 'Dientes', 'Pelo', 'Uñas', 'Vestirse']).join(' / ') + '), "valoracion" (cómo fue, uno de: ' + (v.rutinaVal || ['Bien', 'Relaja', 'Regular', 'Reactivo']).join(' / ') + '). Ej.: "la ducha le relajó" → rutina tipo Ducha valoracion Relaja; "se puso reactivo al cortarle las uñas" → rutina tipo Uñas valoracion Reactivo.\n' +
    '  day: "valoracion" (uno de: ' + (v.dayVal || ['TODO BIEN', 'Bien', 'Regular', 'Difícil']).join(' / ') + '), "nota" (una frase de resumen si la dicen). MÁXIMO un evento "day" por relato, al final de la lista. Ej.: "en general un día muy bueno" → day valoracion Bien; "al final del día, todo bien" → day valoracion TODO BIEN.\n' +
    '  nap: "start" (hora inicio "HH:MM" si la dicen), "end" (hora fin "HH:MM"), "calidad" (número 1-5), "acuesto" (cómo se acostó, uno de: ' + (v.napAcuesto || ['Fácil', 'Difícil', 'Tumbado sin dormir']).join(' / ') + '), "despertar" (cómo despertó, uno de: ' + (v.napDespertar || ['Solo', 'Le despierto', 'No hay manera']).join(' / ') + '), "fallida" (true si casi se duerme pero no llega a dormir). Si solo dicen la duración (ej. "3 horas") sin horas concretas, deja start/end vacíos y pon la duración en "nota".\n' +
    '  sleep (SOLO sueño nocturno): "bed" (hora en que se durmió "HH:MM"), "acuestoSofa" (hora en que se tumbó antes de dormirse), "wake" (hora en que se despertó por la mañana), "calidad" (número 1-5), "calidadTexto" (uno de: ' + (v.calidadTexto || ['Buena', '≈ Buena', 'Movida', 'Mala']).join(' / ') + '), "facilidad" (cómo se durmió, uno de: ' + (v.acuestoFacil || ['Fácil', 'Difícil', 'Se reactiva']).join(' / ') + '), "donde" (uno de: ' + (v.dondeDormir || ['Cama', 'Sofá', 'Carro', 'Otro']).join(' / ') + '), "despertarComo" (uno de: ' + (v.despertarComo || ['Solo', 'Le despierto', 'Llorando']).join(' / ') + '), "despertarEstado" (lista, uno o varios de: ' + (v.despertarEstado || ['Bien', 'Alegre', 'Cansado', 'Lloro', 'Reactivo']).join(' / ') + '), "eventosNoche" (lista de objetos {"tipo","hora"} — cosas que pasaron durante la noche; "tipo" uno de: ' + (v.nocheEventos || ['Calambres', 'Palpitaciones', 'Se despierta y vuelve', 'Se sienta', 'Mucho movimiento', 'Respiración / nariz', 'Llanto', 'Sudor', 'Otro']).join(' / ') + ', y "hora" "HH:MM" si la dicen — ej. calambres a las 2:00).\n\n' +
    'MUY IMPORTANTE: en los campos con lista de opciones (aceptacion, lugar, comoEstuvo, termino, tipos, antecedentes, senales, ayudo, compania, transiciones, valoracion), ' +
    'copia el valor EXACTO de la lista dada — mismas palabras, tildes y mayúsculas, sin reformular ni cambiar el tiempo verbal (ej. "Se tapa oídos", no "se tapó los oídos"; "Abrazo / presión", no "abrazo"). ' +
    'Si nada de la lista encaja, no inventes una opción: pon ese detalle en "nota".\n' +
    'Reglas: crea SOLO eventos que el texto mencione explícitamente. No inventes datos. ' +
    'Si un desajuste ocurrió durante una actividad concreta, crea ambos eventos (act y dys) con el mismo "moment". ' +
    'HORAS RELATIVAS: si dicen una referencia en vez de una hora ("al despertar" → Mañana; "después de comer" / "antes de la siesta" → Mediodía; "después de la siesta" / "al volver del parque" → Tarde; "antes de cenar" / "antes de dormir" → Noche), rellena "moment" con esa franja y deja "time" vacío. Si dicen una hora concreta, ponla en "time". ' +
    'Un relato largo de un día entero puede generar MUCHOS eventos: devuélvelos ORDENADOS cronológicamente (por hora o por momento Mañana→Mediodía→Tarde→Noche). ' +
    'Usa el vocabulario permitido cuando encaje; si no, usa "nota". Momento por defecto si no lo dicen: "' + (p.moment || 'Tarde') + '".';

  const res = await callClaude(MODEL_HAIKU, sys, [{ role: 'user', content: String(p.transcript || '') }], 2000, false);
  if (res._err) return res;
  const parsed = extractJson(res.text);
  if (!parsed || !Array.isArray(parsed.eventos)) return { _err: 'parse', _detail: res.text };
  return { ok: true, eventos: parsed.eventos, resumen: parsed.resumen || '' };
}

// ---------- TAREA: analyze (conclusiones v2) ----------
async function taskAnalyze(p) {
  const sys =
    'Eres un analista de datos que ayuda a madres y padres de un niño/a con hipersensibilidad sensorial (TEA leve). ' +
    'Te doy datos agregados de su registro diario. La clave es el array "dias": una fila por día con valoración global, ' +
    'sueño total (min), calidad de la noche, calambres (noche y día), actividad física, desajustes, contadores de señales ' +
    '(habla_mal/habla_bien como termómetro del día, puntillas_desequilibrio, gritos, loqui_no_para, molestia_oido, en_positivo), ' +
    'comidas en sofá/suelo, deposiciones, transiciones difíciles, personas y rutinas. CRUZA LOS DÍAS ENTRE SÍ e investiga estas hipótesis ' +
    '(afirma solo lo que los números respalden, y da los números):\n' +
    '1) Calambres (noche+día) ↔ actividad física de ese día o del anterior (piscina, deporte, monte).\n' +
    '2) "Habla mal" ↔ carga del día (muchas salidas/actividades, transiciones difíciles) — el habla como termómetro.\n' +
    '3) Señales precursoras: usa "senales_previas_a_desajuste_3h" (qué se vio en las 3h antes de los desajustes).\n' +
    '4) Sueño total de una noche ↔ cómo fue el día SIGUIENTE (valoración, desajustes).\n' +
    '5) Comidas en sofá/suelo ↔ días peores (¿síntoma del día, más que causa?).\n' +
    '6) Transiciones (vuelta en coche, entrada a casa) y rutinas (¿la ducha relaja o activa?).\n' +
    '7) Personas: ¿los días con según qué persona van mejor/peor?\n\n' +
    'Escribe en español, cálido y accionable, para padres (sin jerga clínica). Estructura:\n' +
    '### Lo que más destaca\n### Patrones que veo en tus datos\n### Qué parece ayudar\n### Para probar esta semana\n\n' +
    'En "Patrones": solo los 3-5 hallazgos MÁS sólidos, cada uno con sus números (p. ej. "los 4 días con piscina hubo calambres esa noche, frente a 2 de los otros 26"). ' +
    'Si una hipótesis no se sostiene con estos datos, no la menciones o dilo en una línea. Sé prudente: correlaciones, no diagnóstico. ' +
    'No inventes nada que no esté en los datos. Máximo unas 330 palabras. Usa **negritas** para lo clave y listas con "- ".';
  const user = 'Estos son los datos del registro (JSON):\n\n' + JSON.stringify(p.summary);
  const res = await callClaude(MODEL_SONNET, sys, [{ role: 'user', content: user }], 1600, true);
  if (res._err) return res;
  return { ok: true, text: res.text };
}

// ---------- TAREA: monthly (el mes en 10 puntos) ----------
async function taskMonthly(p) {
  const sys =
    'Eres un analista que escribe el INFORME MENSUAL del registro diario de un niño con hipersensibilidad sensorial (TEA leve), ' +
    'para sus padres y para llevar a sus terapeutas. Te doy una fila por día ("dias") con: valoración global, sueño total, calidad de ' +
    'la noche, calambres, actividad física, desajustes, señales (habla, puntillas, gritos, oído…), comidas, deposiciones, transiciones, personas y rutinas.\n' +
    'Devuelve SOLO un objeto JSON válido, sin texto antes ni después:\n' +
    '{ "titulo": "una frase que resuma el mes", "puntos": ["punto 1", … exactamente 10 puntos], "sugerencias": ["…", 3 sugerencias] }\n' +
    'Cada punto: 1-2 frases, con números concretos del mes (días, conteos, horas). Cubre: cómo fue el mes en general (días buenos/difíciles), ' +
    'el sueño (total, acuesto, eventos nocturnos), los calambres y su relación con la actividad física, el habla como termómetro, las señales ' +
    'precursoras, las transiciones, las comidas, las rutinas, las personas, y algo que los padres quizá NO hayan visto (la correlación menos obvia que los datos respalden). ' +
    'Español cálido y claro, sin jerga clínica, sin diagnóstico. Usa **negritas** para lo clave. No inventes: si algo no está en los datos, no lo digas.';
  const user = 'Datos del mes (JSON):\n\n' + JSON.stringify(p.summary);
  const res = await callClaude(MODEL_SONNET, sys, [{ role: 'user', content: user }], 1800, true);
  if (res._err) return res;
  const j = extractJson(res.text);
  if (!j || !Array.isArray(j.puntos) || !j.puntos.length) return { _err: 'parse', _detail: res.text };
  return { ok: true, titulo: j.titulo || '', puntos: j.puntos, sugerencias: Array.isArray(j.sugerencias) ? j.sugerencias : [] };
}

// ---------- TAREA: chat (conversar con los datos) ----------
async function taskChat(p) {
  const sys =
    'Eres un asistente que responde preguntas de una madre/padre sobre los datos de registro diario de su hijo/a ' +
    '(niño/a con hipersensibilidad sensorial / TEA leve). Respondes SOLO con base en los datos que te doy. ' +
    'Si los datos no bastan para responder, dilo con claridad en vez de inventar. Español claro, breve y cálido. ' +
    'No hagas diagnósticos. Puedes citar números concretos de los datos.';
  const history = Array.isArray(p.history) ? p.history.slice(-8) : [];
  const messages = history.concat([{
    role: 'user',
    content: 'DATOS (JSON):\n' + JSON.stringify(p.summary) + '\n\nPREGUNTA: ' + String(p.question || '')
  }]);
  const res = await callClaude(MODEL_HAIKU, sys, messages, 800, false);
  if (res._err) return res;
  return { ok: true, text: res.text };
}

// ---------- TAREA: transcribe (audio -> texto, Groq Whisper) ----------
async function taskTranscribe(p) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { _err: 'no_key_groq' };
  const b64 = p.audio || '';
  if (!b64) return { _err: 'parse', _detail: 'audio vacío' };
  let buf;
  try { buf = Buffer.from(b64, 'base64'); } catch (e) { return { _err: 'parse', _detail: 'audio inválido' }; }

  const mime = p.mime || 'audio/webm';
  const name = mime.indexOf('mp4') !== -1 ? 'audio.mp4' : (mime.indexOf('ogg') !== -1 ? 'audio.ogg' : (mime.indexOf('mpeg') !== -1 ? 'audio.mp3' : 'audio.webm'));
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime }), name);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'es');
  form.append('response_format', 'json');

  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + key }, body: form
  });
  const j = await r.json().catch(function () { return null; });
  if (!r.ok) { return { _err: 'api', _detail: (j && j.error && j.error.message) ? j.error.message : ('HTTP ' + r.status), _status: r.status }; }
  return { ok: true, text: (j && j.text) ? j.text.trim() : '' };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return err(405, 'Método no permitido');

  let p;
  try { p = JSON.parse(event.body || '{}'); } catch (e) { return err(400, 'JSON inválido'); }

  let res;
  try {
    if (p.task === 'parse') res = await taskParse(p);
    else if (p.task === 'analyze') res = await taskAnalyze(p);
    else if (p.task === 'monthly') res = await taskMonthly(p);
    else if (p.task === 'chat') res = await taskChat(p);
    else if (p.task === 'transcribe') res = await taskTranscribe(p);
    else return err(400, 'Tarea desconocida');
  } catch (e) {
    return err(500, 'Error interno: ' + (e && e.message ? e.message : e));
  }

  if (res._err === 'no_key') return err(503, 'La IA no está configurada todavía (falta la clave ANTHROPIC_API_KEY en Netlify).');
  if (res._err === 'no_key_groq') return err(503, 'La transcripción de voz no está configurada todavía (falta la clave GROQ_API_KEY en Netlify).');
  if (res._err === 'refusal') return err(422, 'Claude no pudo procesar esta petición.');
  if (res._err === 'api') return err(502, 'Error de la API de Claude: ' + (res._detail || ''));
  if (res._err === 'parse') return err(502, 'No pude interpretar la respuesta. Intenta reformular.');
  if (res._err) return err(500, 'Error inesperado.');

  return ok(res);
};
