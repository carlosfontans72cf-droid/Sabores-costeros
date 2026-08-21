import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, getDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, generarCodigoReserva, t, abrirGoogleMaps } from './utils.js';
import './session.js';

const userId = sessionStorage.getItem('userId');
if (!userId) window.location.href = '/index.html';

const urlParams = new URLSearchParams(window.location.search);
const partnerCodigo = urlParams.get('partner') || sessionStorage.getItem('lastPartner') || null;
if (partnerCodigo) sessionStorage.setItem('lastPartner', partnerCodigo);

// ========== CARGAR RESTAURANTES ==========
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
      cont.innerHTML = '<p style="text-align:center;color:#666;">Aún no hay restaurantes disponibles</p>';
      return;
    }

    cont.innerHTML = '';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:20px;';

    for (const r of restaurantes) {
      const card = document.createElement('div');
      card.className = 'card';
      
      const fotoHtml = r.fotoUrl 
        ? `<img src="${r.fotoUrl}" style="width:100%;height:180px;object-fit:cover;border-radius:8px;">`
        : `<div style="height:180px; background:linear-gradient(135deg, #48CAE4, #0077B6); border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; font-size:3rem;">🍽️</div>`;
      
      card.innerHTML = `
        ${fotoHtml}
        <h3 style="margin:15px 0 5px 0; color:#722F37;">${r.nombre}</h3>
        <p style="color:#666; font-size:0.9rem;">${r.tipoCocina || 'Cocina variada'}</p>
        <div style="margin-top:10px; display:flex; gap:10px; align-items:center;">
          <span style="color:#D4A574; font-weight:bold;">${r.rangoPrecio || '$$'}</span>
          <span style="color:#666; font-size:0.85rem;">📍 ${r.ciudad || 'Costa'}</span>
        </div>
        <p style="color:#666; font-size:0.85rem; margin-top:10px; font-style:italic;">"${r.descripcion || 'Sin descripción'}"</p>
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
          <button class="btn btn-primary" style="flex:1; min-width:120px;" onclick="mostrarDetalleRestaurante('${r.id}', '${r.embajadorCodigo || ''}')">🍽️ Ver y Reservar</button>
          ${r.whatsapp ? `<a href="https://wa.me/${r.whatsapp.replace(/[^0-9]/g,'')}" target="_blank" class="btn btn-success" style="text-decoration:none;padding:10px 16px;">📱</a>` : ''}
        </div>
      `;
      grid.appendChild(card);
    }
    cont.appendChild(grid);
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

// ========== MIS RESERVAS ==========
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
        <h4 style="color:#722F37;">${data.nombreRestaurante || 'Restaurante'}</h4>
        <p><strong></strong> ${data.fecha} a las ${data.hora}</p>
        <p><strong>👥</strong> ${data.personas} personas</p>
        <p><strong> Código:</strong> <span style="font-size:1.5rem; color:#023E8A; font-weight:bold;">${data.codigo}</span></p>
        <p><strong>Estado:</strong> <span style="color:${estadoColor}; font-weight:bold;">${estadoTexto}</span></p>
        ${data.estado === 'confirmada' ? `
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            ${data.direccionRestaurante ? `<button class="btn btn-primary" style="flex:1; min-width:150px;" onclick="abrirGoogleMaps('${data.direccionRestaurante.replace(/'/g, "\\'")}')">🗺️ Cómo llegar</button>` : ''}
            <button class="btn btn-success" style="flex:1; min-width:150px;" onclick="compartirReservaWhatsApp('${data.codigo}', '${(data.nombreRestaurante || 'Restaurante').replace(/'/g, "\\'")}')">📱 Compartir</button>
          </div>
          <div style="background:#FFF3CD; padding:12px; border-radius:8px; margin-top:10px; border-left:4px solid #D4A574;">
            <p style="margin:0;"><strong>📱 Presentá este código al llegar</strong></p>
            <p style="margin:5px 0 0 0; font-size:0.9rem;">🎉 Validalo para participar del sorteo semanal</p>
          </div>
        ` : ''}
      `;
      cont.appendChild(div);
    });
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

window.compartirReservaWhatsApp = function(codigo, nombreRestaurante) {
  const msg = `¡Hice una reserva en ${nombreRestaurante}! ️ Código: ${codigo}. Usá Sabores Costeros para descubrir los mejores restaurantes de la costa `;
  const url = 'https://sabores-costeros.vercel.app/';
  const texto = encodeURIComponent(msg + '\n' + url);
  window.open(`https://wa.me/?text=${texto}`, '_blank');
};

// ========== DETALLE RESTAURANTE + MENÚ ==========
window.mostrarDetalleRestaurante = async (restauranteId, embajadorCodigo) => {
  const docSnap = await getDoc(doc(db, 'restaurantes', restauranteId));
  if (!docSnap.exists()) return showAlert('Restaurante no encontrado', 'danger');
  const r = docSnap.data();

  // Cargar menú del restaurante
  let menuHtml = '';
  try {
    const menuQ = query(collection(db, 'menus'), where('restauranteId', '==', restauranteId));
    const menuSnap = await getDocs(menuQ);
    
    if (!menuSnap.empty) {
      menuHtml = '<h3 style="color:#023E8A; margin:20px 0 10px 0;">📖 Menú</h3><div style="display:grid; gap:10px;">';
      menuSnap.forEach(m => {
        const md = m.data();
        const fotoMenu = md.fotoUrl 
          ? `<img src="${md.fotoUrl}" style="width:70px;height:70px;border-radius:8px;object-fit:cover;">`
          : `<div style="width:70px;height:70px;border-radius:8px;background:#48CAE4;display:flex;align-items:center;justify-content:center;color:white;font-size:1.5rem;">🍽️</div>`;
        
        menuHtml += `
          <div style="display:flex; gap:12px; padding:10px; background:#F8F9FA; border-radius:8px; align-items:center;">
            ${fotoMenu}
            <div style="flex:1;">
              <h4 style="margin:0;color:#722F37;">${md.nombre}</h4>
              ${md.descripcion ? `<p style="margin:3px 0;color:#666;font-size:0.85rem;">${md.descripcion}</p>` : ''}
            </div>
            <p style="margin:0;font-weight:bold;color:#009C3B;font-size:1.1rem;">$${md.precio.toFixed(2)}</p>
          </div>
        `;
      });
      menuHtml += '</div>';
    }
  } catch (err) { console.error('Error cargando menú:', err); }

  const direccionEncoded = r.direccion ? r.direccion.replace(/'/g, "\\'") : '';

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;';
  
  const fotoHeader = r.fotoUrl 
    ? `<img src="${r.fotoUrl}" style="width:100%;height:200px;object-fit:cover;border-radius:12px;">`
    : `<div style="height:200px; background:linear-gradient(135deg, #48CAE4, #0077B6); border-radius:12px; display:flex; align-items:center; justify-content:center; color:white; font-size:5rem;">️</div>`;
  
  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:16px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;">
      ${fotoHeader}
      <h2 style="color:#722F37; margin:20px 0 10px 0;">${r.nombre}</h2>
      <p style="color:#666;">${r.tipoCocina || ''} · ${r.rangoPrecio || '$$'} · ${r.ciudad || ''}</p>
      <p style="margin:15px 0; color:#333;">${r.descripcion || 'Sin descripción'}</p>
      ${r.direccion ? `<p>📍 ${r.direccion}</p>` : ''}
      ${r.whatsapp ? `<p><a href="https://wa.me/${r.whatsapp.replace(/[^0-9]/g,'')}" target="_blank" style="color:#25D366; font-weight:bold;"> WhatsApp directo</a></p>` : ''}
      <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
        ${r.direccion ? `<button class="btn btn-primary" onclick="abrirGoogleMaps('${direccionEncoded}')">️ Cómo llegar</button>` : ''}
      </div>
      ${menuHtml}
      
      <div style="margin-top:20px; background:#F8F9FA; padding:20px; border-radius:12px;">
        <h3 style="color:#023E8A; margin-top:0;">📅 Reservar Mesa</h3>
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
      
      <button class="btn btn-block" style="margin-top:15px; background:#ddd;" onclick="this.closest('div[style*=fixed]').remove()">Cerrar</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  document.getElementById('btn-confirmar-reserva').addEventListener('click', async () => {
    const fecha = document.getElementById('res-fecha').value;
    const hora = document.getElementById('res-hora').value;
    const personas = parseInt(document.getElementById('res-personas').value);
    const errDiv = document.getElementById('res-error');

    if (!fecha || !hora || !personas) {
      errDiv.textContent = 'Completá todos los campos';
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

      // WhatsApp automático al restaurante
      if (r.whatsapp) {
        const userName = sessionStorage.getItem('userName') || 'Un cliente';
        const waMsg = `️ *Nueva reserva en Sabores Costeros*\n\n👤 ${userName}\n📅 ${fecha}\n ${hora}\n👥 ${personas} personas\n🎫 Código: ${codigo}\n\n¡Gracias!`;
        const waUrl = `https://wa.me/${r.whatsapp.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(waMsg)}`;
        window.open(waUrl, '_blank');
      }

      modal.innerHTML = `
        <div style="background:white;padding:40px;border-radius:16px;max-width:500px;width:100%;text-align:center;">
          <div style="font-size:5rem; margin-bottom:20px;">🎉</div>
          <h2 style="color:#28A745;">¡Reserva Confirmada!</h2>
          <div style="background:#E8F5E9; padding:20px; border-radius:12px; margin:20px 0;">
            <p style="font-size:0.9rem; color:#666;">Tu código de reserva:</p>
            <p style="font-size:2.5rem; color:#023E8A; font-weight:bold; margin:10px 0;">${codigo}</p>
            <p style="color:#333;"><strong>${r.nombre}</strong></p>
            <p>📅 ${fecha} a las ${hora}</p>
            <p>👥 ${personas} personas</p>
          </div>
          <div style="background:#FFF3CD; padding:15px; border-radius:8px; border-left:4px solid #D4A574; margin:15px 0;">
            <p style="margin:0;"><strong>📱 Presentá este código al llegar</strong></p>
            <p style="margin:5px 0 0 0; font-size:0.9rem;">🎉 Validalo al llegar y participá del sorteo semanal</p>
          </div>
          ${r.direccion ? `<button class="btn btn-primary btn-block" style="margin-bottom:10px;" onclick="abrirGoogleMaps('${direccionEncoded}')">🗺️ Cómo llegar</button>` : ''}
          <button class="btn btn-success btn-block" style="margin-bottom:10px;" onclick="compartirReservaWhatsApp('${codigo}', '${r.nombre.replace(/'/g, "\\'")}')">📱 Compartir reserva</button>
          <button class="btn btn-block" style="background:#ddd;" onclick="location.reload()">Entendido</button>
        </div>
      `;
    } catch (err) {
      errDiv.textContent = `Error: ${err.message}`;
    }
  });
};

// ========== SORTEO SEMANAL ==========
async function loadSorteo() {
  const cont = document.getElementById('info-sorteo');
  if (!cont) return;
  try {
    const q = query(collection(db, 'reservas'), where('estado', '==', 'asistida'));
    const snap = await getDocs(q);
    cont.textContent = `🎫 ${snap.size} reservas participaron esta semana`;
  } catch (err) {
    cont.textContent = 'Error cargando info';
  }
}

// ========== INICIALIZACIÓN ==========
loadRestaurantes();
loadMisReservas();
loadSorteo();