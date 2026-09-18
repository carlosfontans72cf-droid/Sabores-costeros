import { db } from './firebase-config.js';
import {
  collection, getDocs, addDoc, updateDoc, doc, getDoc,
  query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, abrirGoogleMaps, contieneLenguajeOfensivo } from './utils.js';
import './session.js';

const userId = sessionStorage.getItem('userId');
if (!userId) window.location.href = '/index.html';

const urlParams = new URLSearchParams(window.location.search);
const partnerCodigo = urlParams.get('partner') || sessionStorage.getItem('lastPartner') || null;
if (partnerCodigo) sessionStorage.setItem('lastPartner', partnerCodigo);

// ---------- Utilidad anti-inyección ----------
// Todo lo que viene de Firestore pasa por acá antes de ir a innerHTML.
function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const PAGE_SIZE = 20;

async function loadRestaurantes() {
  const cont = document.getElementById('lista-restaurantes');
  if (!cont) return;

  cont.innerHTML = '<p style="text-align:center;color:#666;">Cargando restaurantes...</p>';

  try {
    // El filtro va en la query, no en el forEach: así el navegador nunca
    // recibe los restaurantes no aprobados/inactivos.
    const q = query(
      collection(db, 'restaurantes'),
      where('aprobado', '==', true),
      where('activo', '==', true),
      orderBy('nombre'),
      limit(PAGE_SIZE)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      cont.innerHTML = '<p style="text-align:center;color:#666;">Aún no hay restaurantes disponibles</p>';
      return;
    }

    cont.innerHTML = '';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:20px;';

    snap.forEach(d => {
      const r = { id: d.id, ...d.data() };

      const card = document.createElement('div');
      card.className = 'card';

      const fotoHtml = r.fotoUrl
        ? `<img src="${esc(r.fotoUrl)}" style="width:100%;height:180px;object-fit:cover;border-radius:8px;" alt="${esc(r.nombre)}">`
        : `<div style="height:180px; background:linear-gradient(135deg, #48CAE4, #0077B6); border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; font-size:3rem;">🍽️</div>`;

      card.innerHTML = `
        ${fotoHtml}
        <h3 style="margin:15px 0 5px 0; color:#722F37;">${esc(r.nombre)}</h3>
        <p style="color:#666; font-size:0.9rem;">${esc(r.tipoCocina || 'Cocina variada')}</p>
        <div style="margin-top:10px; display:flex; gap:10px; align-items:center;">
          <span style="color:#D4A574; font-weight:bold;">${esc(r.rangoPrecio || '$$')}</span>
          <span style="color:#666; font-size:0.85rem;">📍 ${esc(r.ciudad || 'Costa')}</span>
        </div>
        <p style="color:#666; font-size:0.85rem; margin-top:10px; font-style:italic;">"${esc(r.descripcion || 'Sin descripción')}"</p>
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
          <button class="btn btn-primary btn-ver-restaurante" style="flex:1; min-width:120px;" data-id="${esc(r.id)}">🍽️ Ver y Reservar</button>
          ${r.whatsapp ? `<a href="https://wa.me/${esc(r.whatsapp.replace(/[^0-9]/g, ''))}" target="_blank" class="btn btn-success" style="text-decoration:none;padding:10px 16px;">📱</a>` : ''}
        </div>
      `;
      grid.appendChild(card);
    });
    cont.appendChild(grid);

    // La ficha completa (galería, menú por categorías, horarios, reseñas)
    // ahora vive en su propia página, no en un modal: así se puede
    // compartir el link y queda indexable.
    cont.querySelectorAll('.btn-ver-restaurante').forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.href = `/pages/restaurante-detalle.html?id=${encodeURIComponent(btn.dataset.id)}`;
      });
    });
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">Error: ${esc(err.message)}</p>`;
  }
}

async function loadMisReservas() {
  const cont = document.getElementById('lista-mis-reservas');
  if (!cont) return;

  try {
    const q = query(collection(db, 'reservas'), where('usuarioId', '==', userId));
    const snap = await getDocs(q);

    if (snap.empty) {
      cont.innerHTML = '<p style="text-align:center;color:#666;">No tenés reservas activas</p>';
      return;
    }

    cont.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const div = document.createElement('div');
      div.className = 'card';
      const estadoColor = data.estado === 'confirmada' ? '#FFC107' : data.estado === 'asistida' ? '#28A745' : '#DC3545';
      const estadoTexto = data.estado === 'confirmada' ? 'Confirmada' : data.estado === 'asistida' ? 'Asistida ✅' : 'Cancelada';

      div.innerHTML = `
        <h4 style="color:#722F37;">${esc(data.nombreRestaurante || 'Restaurante')}</h4>
        <p><strong>📅</strong> ${esc(data.fecha)} a las ${esc(data.hora)}</p>
        <p><strong>👥</strong> ${esc(data.personas)} personas</p>
        <p><strong>🎫 Código:</strong> <span style="font-size:1.5rem; color:#023E8A; font-weight:bold;">${esc(data.codigo)}</span></p>
        <p><strong>Estado:</strong> <span style="color:${estadoColor}; font-weight:bold;">${estadoTexto}</span></p>
        ${data.estado === 'confirmada' ? `
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            ${data.direccionRestaurante ? `<button class="btn btn-primary btn-como-llegar" style="flex:1; min-width:150px;" data-direccion="${esc(data.direccionRestaurante)}">🗺️ Cómo llegar</button>` : ''}
            <button class="btn btn-success btn-compartir-reserva" style="flex:1; min-width:150px;" data-codigo="${esc(data.codigo)}" data-nombre="${esc(data.nombreRestaurante || 'Restaurante')}">📱 Compartir</button>
          </div>
          <div style="background:#FFF3CD; padding:12px; border-radius:8px; margin-top:10px; border-left:4px solid #D4A574;">
            <p style="margin:0;"><strong>📱 Presentá este código al llegar</strong></p>
            <p style="margin:5px 0 0 0; font-size:0.9rem;">🎉 Validalo para participar del sorteo semanal</p>
          </div>
        ` : ''}
        ${data.estado === 'asistida' && !data.resenaDejada ? `
          <button class="btn btn-primary btn-dejar-resena" style="margin-top:10px;width:100%;"
                  data-reserva-id="${esc(d.id)}" data-restaurante-id="${esc(data.restauranteId)}"
                  data-nombre="${esc(data.nombreRestaurante || 'Restaurante')}">⭐ Dejar reseña</button>
        ` : ''}
        ${data.estado === 'asistida' && data.resenaDejada ? `
          <p style="color:#28A745; font-weight:600; margin-top:10px;">✅ Ya dejaste tu reseña. ¡Gracias!</p>
        ` : ''}
      `;
      cont.appendChild(div);
    });

    cont.querySelectorAll('.btn-como-llegar').forEach(btn => {
      btn.addEventListener('click', () => abrirGoogleMaps(btn.dataset.direccion));
    });
    cont.querySelectorAll('.btn-compartir-reserva').forEach(btn => {
      btn.addEventListener('click', () => compartirReservaWhatsApp(btn.dataset.codigo, btn.dataset.nombre));
    });
    cont.querySelectorAll('.btn-dejar-resena').forEach(btn => {
      btn.addEventListener('click', () => abrirModalResena(btn.dataset.reservaId, btn.dataset.restauranteId, btn.dataset.nombre));
    });
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">Error: ${esc(err.message)}</p>`;
  }
}

function abrirModalResena(reservaId, restauranteId, nombreRestaurante) {
  let puntajeSeleccionado = 0;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:white;padding:28px;border-radius:16px;max-width:420px;width:100%;">
      <h3 style="color:#722F37;margin-top:0;">⭐ ¿Cómo fue tu experiencia en ${esc(nombreRestaurante)}?</h3>
      <div id="resena-estrellas" style="font-size:2.2rem; text-align:center; margin:16px 0; cursor:pointer; letter-spacing:6px;">
        ${[1, 2, 3, 4, 5].map(n => `<span data-valor="${n}" style="color:#ddd;">★</span>`).join('')}
      </div>
      <div class="form-group">
        <label>Comentario (opcional)</label>
        <textarea id="resena-comentario" class="form-control" rows="3" maxlength="500" placeholder="Contá cómo te fue..."></textarea>
      </div>
      <div id="resena-error" style="color:red; min-height:20px; font-size:0.9rem;"></div>
      <div style="display:flex; gap:10px; margin-top:10px;">
        <button class="btn btn-block" id="btn-cancelar-resena" style="background:#ddd;">Cancelar</button>
        <button class="btn btn-success btn-block" id="btn-enviar-resena">Enviar reseña</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const estrellas = modal.querySelectorAll('#resena-estrellas span');
  estrellas.forEach(estrella => {
    estrella.addEventListener('click', () => {
      puntajeSeleccionado = Number(estrella.dataset.valor);
      estrellas.forEach(e => {
        e.style.color = Number(e.dataset.valor) <= puntajeSeleccionado ? '#FFD700' : '#ddd';
      });
    });
  });

  modal.querySelector('#btn-cancelar-resena').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#btn-enviar-resena').addEventListener('click', async () => {
    const errDiv = modal.querySelector('#resena-error');
    if (puntajeSeleccionado < 1) {
      errDiv.textContent = 'Elegí de 1 a 5 estrellas';
      return;
    }
    const comentario = modal.querySelector('#resena-comentario').value.trim();

    if (contieneLenguajeOfensivo(comentario)) {
      errDiv.textContent = 'Tu comentario tiene lenguaje que no podemos publicar. Corregilo, por favor.';
      return;
    }

    const btn = modal.querySelector('#btn-enviar-resena');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      await addDoc(collection(db, 'resenas'), {
        restauranteId,
        reservaId,
        usuarioId: userId,
        nombreUsuario: sessionStorage.getItem('userName') || 'Cliente',
        puntaje: puntajeSeleccionado,
        comentario,
        oculta: false,
        createdAt: serverTimestamp()
      });
      // Marcamos la reserva para no ofrecer el botón de nuevo. Las reglas
      // solo permiten pasar resenaDejada de false a true, sin tocar nada más.
      await updateDoc(doc(db, 'reservas', reservaId), { resenaDejada: true });

      modal.remove();
      showAlert('✅ ¡Gracias por tu reseña!', 'success');
      loadMisReservas();
    } catch (err) {
      errDiv.textContent = `Error: ${err.message}`;
      btn.disabled = false;
      btn.textContent = 'Enviar reseña';
    }
  });
}

function compartirReservaWhatsApp(codigo, nombreRestaurante) {
  const msg = `¡Hice una reserva en ${nombreRestaurante}! 🍽️ Código: ${codigo}. Usá Sabores Costeros para descubrir los mejores restaurantes de la costa 🌊`;
  const url = 'https://sabores-costeros.vercel.app/';
  const texto = encodeURIComponent(msg + '\n' + url);
  window.open(`https://wa.me/?text=${texto}`, '_blank');
}


async function loadSorteo() {
  const cont = document.getElementById('info-sorteo');
  if (!cont) return;
  try {
    // Antes esto leía TODAS las reservas "asistida" del sistema, lo que
    // exponía datos de otros clientes bajo las reglas nuevas. Ahora lee
    // un contador público en publico/sorteo (ver nota al pie del archivo).
    const docSnap = await getDoc(doc(db, 'publico', 'sorteo'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      cont.textContent = `🎫 ${data.participantes || 0} reservas participaron esta semana`;
    } else {
      cont.textContent = '🎫 ¡Sé de los primeros en participar esta semana!';
    }
  } catch (err) {
    cont.textContent = '🎉 Validá tu código al llegar para participar';
  }
}

loadRestaurantes();
loadMisReservas();
loadSorteo();

// NOTA: el documento publico/sorteo no existe todavía. Hay que crearlo
// con una Cloud Function que sume 1 a "participantes" cada vez que un
// restaurante marca una reserva como "asistida" (ver confirmarAsistencia
// en restaurante.js). Mientras esa función no exista, este contador
// simplemente muestra el mensaje de bienvenida.