import { db } from './firebase-config.js';
import {
  doc, getDoc, collection, getDocs, addDoc, query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, generarCodigoReserva, abrirGoogleMaps } from './utils.js';

const userId = sessionStorage.getItem('userId');
if (!userId) window.location.href = '/index.html';

function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const params = new URLSearchParams(window.location.search);
const restauranteId = params.get('id');
const cont = document.getElementById('rd-contenido');

if (!restauranteId) {
  cont.innerHTML = '<p style="text-align:center;padding:60px 20px;color:#666;">Restaurante no especificado.</p>';
  throw new Error('Falta parámetro id');
}

// Etiquetas legibles para los servicios. El dueño guarda claves cortas
// (wifi, estacionamiento, etc.) en restaurante.servicios: string[].
const SERVICIOS_LABELS = {
  wifi: '📶 WiFi',
  estacionamiento: '🅿️ Estacionamiento',
  terraza: '🌤️ Terraza',
  petFriendly: '🐾 Pet friendly',
  vistaAlMar: '🌊 Vista al mar',
  apto_celiaco: '🌾 Apto celíaco',
  vegano: '🥦 Opciones veganas',
  accesible: '♿ Accesible',
  tarjetas: '💳 Acepta tarjetas',
  reservaGrupos: '👥 Grupos grandes',
  musicaEnVivo: '🎵 Música en vivo',
  aireLibre: '🍃 Aire libre'
};

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_LABEL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// horarios esperado en Firestore: { lunes: {abre:'12:00', cierra:'23:00', cerrado:false}, ... }
function calcularEstadoAbierto(horarios) {
  if (!horarios) return null;
  const ahora = new Date();
  const diaKey = DIAS[ahora.getDay()];
  const h = horarios[diaKey];
  if (!h || h.cerrado) return { abierto: false, texto: 'Cerrado hoy' };

  const [hA, mA] = (h.abre || '00:00').split(':').map(Number);
  const [hC, mC] = (h.cierra || '23:59').split(':').map(Number);
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const minutosApertura = hA * 60 + mA;
  const minutosCierre = hC * 60 + mC;

  const abierto = minutosAhora >= minutosApertura && minutosAhora <= minutosCierre;
  if (abierto) {
    const faltan = minutosCierre - minutosAhora;
    if (faltan <= 30) return { abierto: true, texto: `Abierto · cierra en ${faltan} min` };
    return { abierto: true, texto: `Abierto hasta las ${h.cierra}` };
  }
  return { abierto: false, texto: minutosAhora < minutosApertura ? `Cerrado · abre a las ${h.abre}` : 'Cerrado' };
}

function renderHorarios(horarios) {
  if (!horarios) return '';
  const hoyIdx = new Date().getDay();
  const filas = DIAS.map((dia, i) => {
    const h = horarios[dia];
    const texto = !h || h.cerrado ? 'Cerrado' : `${h.abre} - ${h.cierra}`;
    return `<div class="rd-horarios-fila ${i === hoyIdx ? 'hoy' : ''}">
      <span>${DIAS_LABEL[i]}</span><span>${esc(texto)}</span>
    </div>`;
  }).join('');
  return `<div class="rd-section"><h2>🕐 Horarios</h2><div class="rd-horarios">${filas}</div></div>`;
}

function renderChips(servicios) {
  if (!servicios || !servicios.length) return '';
  const chips = servicios
    .filter(s => SERVICIOS_LABELS[s])
    .map(s => `<span class="rd-chip">${SERVICIOS_LABELS[s]}</span>`)
    .join('');
  return chips ? `<div class="rd-chips">${chips}</div>` : '';
}

function renderGaleria(r) {
  const fotos = Array.isArray(r.fotos) && r.fotos.length ? r.fotos : (r.fotoUrl ? [r.fotoUrl] : []);
  if (fotos.length === 0) {
    return `<div class="rd-galeria"><div class="rd-galeria-placeholder">🍽️</div></div>`;
  }
  const thumbs = fotos.map((url, i) =>
    `<img src="${esc(url)}" data-idx="${i}" class="${i === 0 ? 'activa' : ''}" alt="Foto ${i + 1}">`
  ).join('');
  return `
    <div class="rd-galeria">
      <img src="${esc(fotos[0])}" class="rd-galeria-principal" id="rd-foto-principal" alt="${esc(r.nombre)}">
      ${fotos.length > 1 ? `<div class="rd-galeria-thumbs">${thumbs}</div>` : ''}
    </div>
  `;
}

function activarGaleria(fotos) {
  const principal = document.getElementById('rd-foto-principal');
  document.querySelectorAll('.rd-galeria-thumbs img').forEach(img => {
    img.addEventListener('click', () => {
      principal.src = fotos[Number(img.dataset.idx)];
      document.querySelectorAll('.rd-galeria-thumbs img').forEach(t => t.classList.remove('activa'));
      img.classList.add('activa');
    });
  });
}

async function renderMenu(restauranteId) {
  const menuQ = query(collection(db, 'menus'), where('restauranteId', '==', restauranteId), where('activo', '==', true));
  const snap = await getDocs(menuQ);
  if (snap.empty) return '';

  // Agrupamos por categoría. Los platos viejos no tienen "categoria",
  // así que caen en "Platos".
  const grupos = {};
  snap.forEach(d => {
    const md = d.data();
    const cat = md.categoria || 'Platos';
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(md);
  });

  const orden = ['Entradas', 'Principales', 'Platos', 'Postres', 'Bebidas'];
  const categorias = Object.keys(grupos).sort((a, b) => {
    const ia = orden.indexOf(a), ib = orden.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const bloques = categorias.map(cat => {
    const platos = grupos[cat].map(md => `
      <div class="rd-plato">
        ${md.fotoUrl ? `<img src="${esc(md.fotoUrl)}" alt="${esc(md.nombre)}">` : `<div class="rd-plato-foto-vacia">🍽️</div>`}
        <div class="rd-plato-info">
          <h4>${esc(md.nombre)}</h4>
          ${md.descripcion ? `<p>${esc(md.descripcion)}</p>` : ''}
        </div>
        <div class="rd-plato-precio">$${Number(md.precio || 0).toFixed(2)}</div>
      </div>
    `).join('');
    return `<div class="rd-menu-categoria"><h3>${esc(cat)}</h3>${platos}</div>`;
  }).join('');

  return `<div class="rd-section"><h2>📖 Menú</h2>${bloques}</div>`;
}

async function renderResenas(restauranteId) {
  const q = query(
    collection(db, 'resenas'),
    where('restauranteId', '==', restauranteId),
    where('oculta', '==', false),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  let snap;
  try {
    snap = await getDocs(q);
  } catch (err) {
    // Si la colección todavía no existe o falta un índice, no rompemos la página.
    return '';
  }
  if (snap.empty) {
    return `<div class="rd-section"><h2>⭐ Reseñas</h2><p style="color:#666;">Todavía no hay reseñas. ¡Sé el primero en dejar la tuya después de tu visita!</p></div>`;
  }

  let suma = 0;
  const cards = [];
  snap.forEach(d => {
    const data = d.data();
    suma += Number(data.puntaje || 0);
    const estrellas = '★'.repeat(Math.round(data.puntaje || 0)) + '☆'.repeat(5 - Math.round(data.puntaje || 0));
    cards.push(`
      <div class="rd-resena-card">
        <div class="rd-resena-header">
          <span class="rd-resena-nombre">${esc(data.nombreUsuario || 'Cliente')}</span>
          <span class="rd-estrellas">${estrellas}</span>
        </div>
        <p>${esc(data.comentario || '')}</p>
      </div>
    `);
  });
  const promedio = (suma / snap.size).toFixed(1);
  const estrellasProm = '★'.repeat(Math.round(promedio)) + '☆'.repeat(5 - Math.round(promedio));

  return `
    <div class="rd-section">
      <h2>⭐ Reseñas</h2>
      <div class="rd-resenas-resumen">
        <span class="rd-resenas-promedio">${promedio}</span>
        <div>
          <div class="rd-estrellas">${estrellasProm}</div>
          <div style="color:#666;font-size:0.85rem;">${snap.size} reseña${snap.size === 1 ? '' : 's'}</div>
        </div>
      </div>
      ${cards.join('')}
    </div>
  `;
}

async function cargar() {
  let r;
  try {
    const snap = await getDoc(doc(db, 'restaurantes', restauranteId));
    if (!snap.exists()) {
      cont.innerHTML = '<p style="text-align:center;padding:60px 20px;color:#666;">Restaurante no encontrado.</p>';
      return;
    }
    r = { id: snap.id, ...snap.data() };
  } catch (err) {
    cont.innerHTML = `<p style="text-align:center;padding:60px 20px;color:red;">Error cargando el restaurante: ${esc(err.message)}</p>`;
    return;
  }

  const estado = calcularEstadoAbierto(r.horarios);
  const fotos = Array.isArray(r.fotos) && r.fotos.length ? r.fotos : (r.fotoUrl ? [r.fotoUrl] : []);

  cont.innerHTML = `
    ${renderGaleria(r)}
    <div class="rd-header-info">
      <h1>${esc(r.nombre)}</h1>
      <div class="rd-meta">
        <span>${esc(r.tipoCocina || 'Cocina variada')}</span>
        <span>${esc(r.rangoPrecio || '$$')}</span>
        <span>📍 ${esc(r.ciudad || r.direccion || 'Costa')}</span>
        ${estado ? `<span class="${estado.abierto ? 'rd-estado-abierto' : 'rd-estado-cerrado'}">${esc(estado.texto)}</span>` : ''}
      </div>
      ${renderChips(r.servicios)}
      <p style="color:#333;">${esc(r.descripcion || 'Sin descripción')}</p>
      <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
        ${r.direccion ? `<button class="btn btn-primary" id="btn-como-llegar">🗺️ Cómo llegar</button>` : ''}
        ${r.whatsapp ? `<a href="https://wa.me/${esc(r.whatsapp.replace(/[^0-9]/g, ''))}" target="_blank" class="btn btn-success" style="text-decoration:none;">📱 WhatsApp</a>` : ''}
      </div>
    </div>

    ${renderHorarios(r.horarios)}
    <div id="rd-menu-slot" class="rd-section"><p style="color:#666;">Cargando menú...</p></div>
    <div id="rd-resenas-slot" class="rd-section"><p style="color:#666;">Cargando reseñas...</p></div>

    <div class="rd-reserva-box">
      <div class="rd-reserva-card">
        <h2 style="color:#023E8A;margin-top:0;">📅 Reservar Mesa</h2>
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" id="res-fecha" class="form-control">
        </div>
        <div class="form-group">
          <label>Hora</label>
          <input type="time" id="res-hora" class="form-control">
        </div>
        <div class="form-group">
          <label>Cantidad de personas</label>
          <input type="number" id="res-personas" class="form-control" value="2" min="1" max="20">
        </div>
        <div id="res-error" style="color:red; min-height:20px;"></div>
        <button class="btn btn-success btn-block" id="btn-confirmar-reserva" style="font-size:1.1rem;">Confirmar Reserva</button>
      </div>
    </div>
  `;

  if (fotos.length) activarGaleria(fotos);
  document.getElementById('btn-como-llegar')?.addEventListener('click', () => abrirGoogleMaps(r.direccion));

  renderMenu(restauranteId).then(html => {
    document.getElementById('rd-menu-slot').outerHTML = html || '';
  });
  renderResenas(restauranteId).then(html => {
    const slot = document.getElementById('rd-resenas-slot');
    if (slot) slot.outerHTML = html || '';
  });

  configurarReserva(r);
  configurarCtaFlotante();
}

function configurarCtaFlotante() {
  const cta = document.getElementById('rd-cta-flotante');
  const reservaCard = document.querySelector('.rd-reserva-box');
  if (!cta || !reservaCard) return;
  const obs = new IntersectionObserver(([entry]) => {
    cta.classList.toggle('visible', !entry.isIntersecting);
  });
  obs.observe(reservaCard);
  document.getElementById('btn-cta-reservar')?.addEventListener('click', () => {
    reservaCard.scrollIntoView({ behavior: 'smooth' });
  });
}

function configurarReserva(r) {
  const urlParams = new URLSearchParams(window.location.search);
  const partnerCodigo = urlParams.get('partner') || sessionStorage.getItem('lastPartner') || null;
  const embajadorCodigo = r.embajadorCodigo || null;

  const inputFecha = document.getElementById('res-fecha');
  const hoyISO = new Date().toISOString().split('T')[0];
  inputFecha.min = hoyISO;

  document.getElementById('btn-confirmar-reserva').addEventListener('click', async () => {
    const fecha = inputFecha.value;
    const hora = document.getElementById('res-hora').value;
    const personas = parseInt(document.getElementById('res-personas').value, 10);
    const errDiv = document.getElementById('res-error');
    errDiv.textContent = '';

    if (!fecha || !hora || !personas) { errDiv.textContent = 'Completá todos los campos'; return; }
    if (fecha < hoyISO) { errDiv.textContent = 'La fecha no puede ser anterior a hoy'; return; }
    if (personas < 1 || personas > 20) { errDiv.textContent = 'La cantidad de personas debe ser entre 1 y 20'; return; }

    const codigo = generarCodigoReserva();
    const btn = document.getElementById('btn-confirmar-reserva');
    btn.disabled = true;
    btn.textContent = 'Reservando...';

    try {
      await addDoc(collection(db, 'reservas'), {
        restauranteId,
        usuarioId: userId,
        nombreRestaurante: r.nombre,
        direccionRestaurante: r.direccion || '',
        embajadorCodigo: embajadorCodigo || null,
        partnerCodigo: partnerCodigo || null,
        fecha, hora, personas,
        codigo,
        estado: 'confirmada',
        mesaConfirmada: false,
        createdAt: serverTimestamp()
      });

      if (r.whatsapp) {
        const userName = sessionStorage.getItem('userName') || 'Un cliente';
        const waMsg = `🎉 *Nueva reserva en Sabores Costeros*\n\n👤 ${userName}\n📅 ${fecha}\n🕐 ${hora}\n👥 ${personas} personas\n🎫 Código: ${codigo}\n\n¡Gracias!`;
        window.open(`https://wa.me/${r.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(waMsg)}`, '_blank');
      }

      showAlert(`✅ Reserva confirmada. Tu código: ${codigo}`, 'success');
      setTimeout(() => { window.location.href = '/pages/cliente.html'; }, 1800);
    } catch (err) {
      errDiv.textContent = `Error: ${err.message}`;
      btn.disabled = false;
      btn.textContent = 'Confirmar Reserva';
    }
  });
}

cargar();