const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

/**
 * Se dispara cada vez que una reserva cambia. Nos interesa el momento
 * exacto en que pasa a "asistida" (el restaurante confirmó que la
 * mesa vino), porque de ahí salen dos cosas que hoy el cliente
 * calculaba solo (y por lo tanto podía falsificar):
 *
 *  1. El contador público del sorteo semanal (publico/sorteo).
 *  2. El registro de comisión en la colección "pagos", usando la
 *     configuración real (configuracion/comisiones) y no un 0.50
 *     hardcodeado como hacían embajador.js y partner.js.
 */
exports.onReservaAsistida = onDocumentUpdated('reservas/{reservaId}', async (event) => {
  const antes = event.data.before.data();
  const despues = event.data.after.data();

  const pasoAAsistida = antes.estado !== 'asistida' && despues.estado === 'asistida';
  if (!pasoAAsistida) return;

  const personas = Number(despues.personas || 0);
  if (personas <= 0) return;

  // 1) Contador público del sorteo. No expone ningún dato de la
  //    reserva, solo un número total.
  const sorteoRef = db.doc('publico/sorteo');
  await sorteoRef.set(
    { participantes: FieldValue.increment(1) },
    { merge: true }
  );

  // 2) Comisión, calculada server-side con la configuración vigente.
  const configSnap = await db.doc('configuracion/comisiones').get();
  const config = configSnap.exists ? configSnap.data() : {
    total: 2.00, fundador: 1.00, embajador: 0.50, partner: 0.50
  };

  const comisionEmbajador = despues.embajadorCodigo ? (personas * (config.embajador || 0)) : 0;
  const comisionPartner = despues.partnerCodigo ? (personas * (config.partner || 0)) : 0;
  const comisionFundador = personas * (config.fundador || 0);
  const comisionTotal = personas * (config.total || 0);

  await db.collection('pagos').add({
    reservaId: event.params.reservaId,
    restauranteId: despues.restauranteId,
    embajadorCodigo: despues.embajadorCodigo || null,
    partnerCodigo: despues.partnerCodigo || null,
    codigo: despues.codigo,
    personas,
    comisionTotal,
    comisionFundador,
    comisionEmbajador,
    comisionPartner,
    estado: 'pendiente',
    createdAt: FieldValue.serverTimestamp()
  });
});

/**
 * Todos los domingos a las 00:05 (hora de Montevideo) reinicia el
 * contador del sorteo, así cada sábado se sortea entre los
 * participantes de esa semana y no de todo el historial.
 * Ajustá el cron si el sorteo se corre otro día.
 */
exports.resetSorteoSemanal = onSchedule(
  { schedule: '5 0 * * 0', timeZone: 'America/Montevideo' },
  async () => {
    await db.doc('publico/sorteo').set({ participantes: 0 }, { merge: true });
  }
);

/**
 * Filtro de lenguaje ofensivo, del lado del servidor.
 *
 * cliente.js ya avisa en el navegador si el comentario tiene una mala
 * palabra, pero ese chequeo se puede saltear (deshabilitando JS, o
 * llamando a Firestore directo). Esta función es la que de verdad
 * decide qué se ve públicamente: corre con el Admin SDK, así que las
 * reglas de Firestore no la afectan, y puede ocultar la reseña aunque
 * el navegador la haya dejado pasar.
 *
 * Mantené esta lista igual a PALABRAS_OFENSIVAS en public/js/utils.js
 * (o al menos con las mismas palabras clave) para que el aviso del
 * navegador y el ocultamiento real coincidan.
 */
const PALABRAS_OFENSIVAS = [
  'puta', 'puto', 'putas', 'putos', 'hijoputa', 'hdp',
  'mierda', 'concha de tu madre', 'ctm',
  'pendejo', 'pendeja', 'gilipollas', 'imbecil', 'imbécil',
  'idiota', 'estupido', 'estúpido', 'estupida', 'estúpida',
  'carajo', 'verga', 'pelotudo', 'pelotuda',
  'forro', 'forra', 'garcha', 'boludazo',
  'maricon', 'maricón', 'trolo',
  'zorra', 'perra', 'guarra', 'guarro',
  'negro de mierda', 'sudaca de mierda',
  'fuck', 'fucking', 'shit', 'bitch', 'asshole'
];

function normalizarTexto(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/[^a-z0-9\s]/g, ' ');
}

function contieneLenguajeOfensivo(texto) {
  const normalizado = normalizarTexto(texto);
  return PALABRAS_OFENSIVAS.some(palabra => normalizado.includes(normalizarTexto(palabra)));
}

exports.moderarResena = onDocumentCreated('resenas/{resenaId}', async (event) => {
  const data = event.data.data();
  if (!data) return;

  if (contieneLenguajeOfensivo(data.comentario)) {
    await event.data.ref.update({
      oculta: true,
      motivoOculta: 'lenguaje_ofensivo',
      moderadaAt: FieldValue.serverTimestamp()
    });
  }
});