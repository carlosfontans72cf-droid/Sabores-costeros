import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, getDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, generarCodigoReserva, t, compartirWhatsApp, abrirGoogleMaps } from './utils.js';
import './session.js';

const userId = sessionStorage.getItem('userId');
if (!userId) window.location.href = '/index.html';

const urlParams = new URLSearchParams(window.location.search);
const partnerCodigo = urlParams.get('partner') || sessionStorage.getItem('lastPartner') || null;
if (partnerCodigo) sessionStorage.setItem('lastPartner', partnerCodigo);

async function loadRestaurantes() {
  const cont = document.getElementById('lista-restaurantes');
  if (!cont) return;

  try {
    const snap = await getDocs(collection(db, 'restaurantes'));
    const restaurantes = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.activo && data.aprobado) restaurantes.push({ id: d.id, ...data });
    });

    if (restaurantes.length === 0) {
      cont.innerHTML = `<p style="text-align:center;color:#666;">${t('no-restaurantes')}</p>`;
      return;
    }

    cont.innerHTML = '';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:20px;';

    restaurantes.forEach(r => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div style="height:150px; background:linear-gradient(135deg, #48CAE4, #0077B6); border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; font-size:3rem;">️</div>
        <h3 style="margin:15px 0 5px 0; color:#722F37;">${r.nombre}</h3>
        <p style="color:#666; font-size:0.9rem;">${r.tipoCocina || 'Cocina variada'}</p>
        <div style="margin-top:10px; display:flex; gap:10px; align-items:center;">
          <span style="color:#D4A574; font-weight:bold;">${r.rangoPrecio || '$$'}</span>
          <span style="color:#666; font-size:0.85rem;">📍 ${r.ciudad || 'Costa'}</span>
        </div>
        <p style="color:#666; font-size:0.85rem; margin-top:10px; font-style:italic;">"${r.descripcion || 'Sin descripción'}"</p>
        <div style="display:flex; gap:8px; margin-top:12px;">
          ${r.direccion ? `<button class="btn-maps" style="flex:1; padding:8px; font-size:0.85rem;" onclick="abrirMapa('${r.direccion.replace(/'/g, "\\'")}')">️ ${t('btn-como-llegar')}</button>` : ''}
          ${r.whatsapp ? `<button class="btn-whatsapp" style="flex:1; padding:8px; font-size:0.85rem;" onclick="abrirWhatsApp('${r.whatsapp.replace(/[^0-9]/g, '')}')">📱 WhatsApp</button>` : ''}
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:10px;" onclick="mostrarDetalleRestaurante('${r.id}', '${r.embajadorCodigo || ''}')">${t('btn-reservar')}</button>
      `;
      grid.appendChild(card);
    });
    cont.appendChild(grid);
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">${t('error-generico')}: ${err.message}</p>`;
  }
}

window.abrirMapa = function(direccion) {
  abrirGoogleMaps(direccion);
};

window.abrirWhatsApp = function(numero) {
  window.open(`https://wa.me/${numero}`, '_blank');
};

async function loadMisReservas() {
  const cont = document.getElementById('lista-mis-reservas');
  if (!cont) return;

  try {
    const q = query(collection(db, 'reservas'), where('usuarioId', '==', userId));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      cont.innerHTML = `<p style="text-align:center;color:#666;">${t('no-reservas')}</p>`;
      return;
    }

    cont.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const div = document.createElement('div');
      div.className = 'card';
      const estadoColor = data.estado === 'confirmada' ? '#FFC107' : data.estado === 'asistida' ? '#28A745' : '#DC3545';
      const estadoTexto = data.estado === 'confirmada' ? t('reserva-estado-confirmada') : data.estado === 'asistida' ? t('reserva-estado-asistida') : t('reserva-estado-cancelada');
      
      const restauranteAddr = data.direccionRestaurante || '';

      div.innerHTML = `
        <h4 style="color:#722F37;">${data.nombreRestaurante || 'Restaurante'}</h4>
        <p><strong></strong> ${data.fecha} a las ${data.hora}</p>
        <p><strong>👥</strong> ${data.personas} ${t('personas')}</p>
        <p><strong>🎫 Código:</strong> <span style="font-size:1.5rem; color:#023E8A; font-weight:bold;">${data.codigo}</span></p>
        <p><strong>Estado:</strong> <span style="color:${estadoColor}; font-weight:bold;">${estadoTexto}</span></p>
        ${data.estado === 'confirmada' ? `
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            ${restauranteAddr ? `<button class="btn-maps" style="flex:1; min-width:150px;" onclick="abrirMapa('${restauranteAddr.replace(/'/g, "\\'")}')">🗺️ ${t('btn-como-llegar')}</button>` : ''}
            <button class="btn-whatsapp" style="flex:1; min-width:150px;" onclick="compartirReservaWhatsApp('${data.codigo}', '${data.nombreRestaurante || 'Restaurante'}')">📱 ${t('btn-compartir-whatsapp')}</button>
          </div>
          <div style="background:#FFF3CD; padding:12px; border-radius:8px; margin-top:10px; border-left:4px solid #D4A574;">
            <p style="margin:0;"><strong> ${t('reserva-presentar-banner')}</strong></p>
            <p style="margin:5px 0 0 0; font-size:0.9rem;">🎉 ${t('reserva-sorteo-banner')}</p>
          </div>
        ` : ''}
      `;
      cont.appendChild(div);
    });
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">${t('error-generico')}: ${err.message}</p>`;
  }
}

window.compartirReservaWhatsApp = function(codigo, nombreRestaurante) {
  const msg = t('whatsapp-share-reserva').replace('{restaurante}', nombreRestaurante).replace('{codigo}', codigo);
  const url = 'https://sabores-costeros.vercel.app/';
  compartirWhatsApp(msg, url);
};

window.mostrarDetalleRestaurante = async (restauranteId, embajadorCodigo) => {
  const docSnap = await getDoc(doc(db, 'restaurantes', restauranteId));
  if (!docSnap.exists()) return showAlert('Restaurante no encontrado', 'danger');
  const r = docSnap.data();

  const direccionEncoded = r.direccion ? r.direccion.replace(/'/g, "\\'") : '';

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;';
  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:16px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;">
      <div style="height:200px; background:linear-gradient(135deg, #48CAE4, #0077B6); border-radius:12px; display:flex; align-items:center; justify-content:center; color:white; font-size:5rem;">🍽️</div>
      <h2 style="color:#722F37; margin:20px 0 10px 0;">${r.nombre}</h2>
      <p style="color:#666;">${r.tipoCocina || ''} · ${r.rangoPrecio || '$$'} · ${r.ciudad || ''}</p>
      <p style="margin:15px 0; color:#333;">${r.descripcion || 'Sin descripción'}</p>
      ${r.direccion ? `<p>📍 ${r.direccion}</p>` : ''}
      ${r.horarios ? `<p>🕐 ${JSON.stringify(r.horarios)}</p>` : ''}
      ${r.whatsapp ? `<p><a href="https://wa.me/${r.whatsapp.replace(/[^0-9]/g,'')}" target="_blank" style="color:#25D366; font-weight:bold;">📱 WhatsApp directo</a></p>` : ''}
      
      <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
        ${r.direccion ? `<button class="btn-maps" onclick="abrirMapaModal('${direccionEncoded}')">🗺️ ${t('btn-como-llegar')}</button>` : ''}
      </div>
      
      <div style="margin-top:20px; background:#F8F9FA; padding:20px; border-radius:12px;">
        <h3 style="color:#023E8A; margin-top:0;">📅 ${t('btn-reservar')}</h3>
        <div class="form-group">
          <label>${t('label-fecha')}</label>
          <input type="date" id="res-fecha" class="form-control">
        </div>
        <div class="form-group">
          <label>${t('label-hora')}</label>
          <input type="time" id="res-hora" class="form-control">
        </div>
        <div class="form-group">
          <label>${t('label-personas')}</label>
          <input type="number" id="res-personas" class="form-control" value="2" min="1" max="20">
        </div>
        <div id="res-error" style="color:red; min-height:20px;"></div>
        <button class="btn btn-success btn-block" id="btn-confirmar-reserva" style="font-size:1.1rem;">${t('btn-confirmar-reserva')}</button>
      </div>
      
      <button class="btn btn-block" style="margin-top:15px; background:#ddd;" onclick="this.closest('div[style*=fixed]').remove()">${t('btn-cerrar')}</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  window.abrirMapaModal = function(dir) {
    abrirGoogleMaps(dir);
  };

  document.getElementById('btn-confirmar-reserva').addEventListener('click', async () => {
    const fecha = document.getElementById('res-fecha').value;
    const hora = document.getElementById('res-hora').value;
    const personas = parseInt(document.getElementById('res-personas').value);
    const errDiv = document.getElementById('res-error');

    if (!fecha || !hora || !personas) {
      errDiv.textContent = t('error-empty-fields');
      return;
    }

    const codigo = generarCodigoReserva();
    try {
      await addDoc(collection(db, 'reservas'), {
        restauranteId,
        usuarioId: userId,
        nombreRestaurante: r.nombre,
        direccionRestaurante: r.direccion || '',
        embajadorCodigo: embajadorCodigo || r.embajadorCodigo || null,
        partnerCodigo: partnerCodigo || null,
        fecha, hora, personas,
        codigo,
        estado: 'confirmada',
        mesaConfirmada: false,
        createdAt: serverTimestamp()
      });

      modal.innerHTML = `
        <div style="background:white;padding:40px;border-radius:16px;max-width:500px;width:100%;text-align:center;">
          <div style="font-size:5rem; margin-bottom:20px;">🎉</div>
          <h2 style="color:#28A745;">${t('reserva-confirmada-title')}</h2>
          <div style="background:#E8F5E9; padding:20px; border-radius:12px; margin:20px 0;">
            <p style="font-size:0.9rem; color:#666;">${t('reserva-codigo-label')}</p>
            <p style="font-size:2.5rem; color:#023E8A; font-weight:bold; margin:10px 0;">${codigo}</p>
            <p style="color:#333;"><strong>${r.nombre}</strong></p>
            <p>📅 ${fecha} a las ${hora}</p>
            <p>👥 ${personas} ${t('personas')}</p>
          </div>
          <div style="background:#FFF3CD; padding:15px; border-radius:8px; border-left:4px solid #D4A574; margin:15px 0;">
            <p style="margin:0;"><strong>📱 ${t('reserva-presentar')}</strong></p>
            <p style="margin:5px 0 0 0; font-size:0.9rem;">🎉 ${t('reserva-sorteo-info')}</p>
          </div>
          <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:15px;">
            ${r.direccion ? `<button class="btn-maps" onclick="abrirGoogleMaps('${r.direccion.replace(/'/g, "\\'")}')">🗺️ ${t('btn-como-llegar')}</button>` : ''}
            <button class="btn-whatsapp" onclick="compartirReservaDesdeModal('${codigo}', '${r.nombre.replace(/'/g, "\\'")}')"> ${t('btn-compartir-whatsapp')}</button>
          </div>
          <button class="btn btn-primary btn-block" style="margin-top:15px;" onclick="location.reload()">${t('btn-entendido')}</button>
        </div>
      `;
    } catch (err) {
      errDiv.textContent = `${t('error-generico')}: ${err.message}`;
    }
  });
};

window.compartirReservaDesdeModal = function(codigo, nombreRestaurante) {
  const msg = t('whatsapp-share-reserva').replace('{restaurante}', nombreRestaurante).replace('{codigo}', codigo);
  const url = 'https://sabores-costeros.vercel.app/';
  compartirWhatsApp(msg, url);
};

async function loadSorteo() {
  const cont = document.getElementById('info-sorteo');
  if (!cont) return;
  try {
    const q = query(collection(db, 'reservas'), where('estado', '==', 'asistida'));
    const snap = await getDocs(q);
    cont.textContent = t('sorteo-participantes-count').replace('{count}', snap.size);
  } catch (err) {
    cont.textContent = t('sorteo-participantes');
  }
}

loadRestaurantes();
loadMisReservas();
loadSorteo();