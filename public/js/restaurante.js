// Panel Restaurante - Sabores Costeros
import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, generarCodigoReserva } from './utils.js';

const userId = sessionStorage.getItem('userId');
const userRole = sessionStorage.getItem('userRole');

if (userRole !== 'restaurante') {
  alert('Acceso denegado');
  window.location.href = '/index.html';
}

document.getElementById('user-info').textContent = sessionStorage.getItem('userName') || 'Restaurante';

// ========== CARGAR DATOS DEL RESTAURANTE ==========
async function loadRestaurante() {
  try {
    const q = query(collection(db, 'restaurantes'), where('dueñoId', '==', userId));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      const data = snap.docs[0].data();
      const id = snap.docs[0].id;
      document.getElementById('restaurante-id').value = id;
      document.getElementById('res-nombre').value = data.nombre || '';
      document.getElementById('res-tipo').value = data.tipoCocina || '';
      document.getElementById('res-direccion').value = data.direccion || '';
      document.getElementById('res-telefono').value = data.telefono || '';
      document.getElementById('res-whatsapp').value = data.whatsapp || '';
      document.getElementById('res-descripcion').value = data.descripcion || '';
      document.getElementById('res-rango').value = data.rangoPrecio || '$$';
    }
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
}

// ========== GUARDAR PERFIL ==========
document.getElementById('btn-save-perfil')?.addEventListener('click', async () => {
  const id = document.getElementById('restaurante-id').value;
  const data = {
    nombre: document.getElementById('res-nombre').value.trim(),
    tipoCocina: document.getElementById('res-tipo').value,
    direccion: document.getElementById('res-direccion').value.trim(),
    telefono: document.getElementById('res-telefono').value.trim(),
    whatsapp: document.getElementById('res-whatsapp').value.trim(),
    descripcion: document.getElementById('res-descripcion').value.trim(),
    rangoPrecio: document.getElementById('res-rango').value,
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'restaurantes', id), data);
      showAlert('Perfil actualizado', 'success');
    } else {
      const docRef = await addDoc(collection(db, 'restaurantes'), {
        ...data,
        dueñoId: userId,
        embajadorCodigo: sessionStorage.getItem('userEmbajadorCodigo') || null,
        activo: true,
        aprobado: false,
        createdAt: serverTimestamp()
      });
      document.getElementById('restaurante-id').value = docRef.id;
      showAlert('Restaurante registrado (pendiente de aprobación)', 'success');
    }
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
});

// ========== RESERVAS RECIBIDAS ==========
async function loadReservas() {
  const cont = document.getElementById('lista-reservas');
  if (!cont) return;

  try {
    const qRest = query(collection(db, 'restaurantes'), where('dueñoId', '==', userId));
    const snapRest = await getDocs(qRest);
    if (snapRest.empty) {
      cont.innerHTML = '<p>Primero registrá tu restaurante en "Mi Perfil"</p>';
      return;
    }
    const restauranteId = snapRest.docs[0].id;

    const q = query(collection(db, 'reservas'), where('restauranteId', '==', restauranteId));
    const snap = await getDocs(q);

    if (snap.empty) {
      cont.innerHTML = '<p style="text-align:center;color:#666;">No hay reservas</p>';
      return;
    }

    cont.innerHTML = '';
    let totalPendiente = 0;
    snap.forEach(d => {
      const data = d.data();
      const div = document.createElement('div');
      div.className = 'card';
      const estadoColor = data.estado === 'confirmada' ? '#FFC107' : data.estado === 'asistida' ? '#28A745' : '#666';
      div.innerHTML = `
        <h4>🎫 ${data.codigo}</h4>
        <p>📅 ${data.fecha} a las ${data.hora}</p>
        <p>👥 ${data.personas} personas</p>
        <p>Estado: <strong style="color:${estadoColor}">${data.estado}</strong></p>
        ${data.estado === 'confirmada' ? `
          <div style="background:#E8F5E9; padding:12px; border-radius:8px; margin:10px 0;">
            <p style="margin:0;"><strong>💰 Cobro: $${(data.personas * 2).toFixed(2)} USD</strong> (${data.personas} x $2)</p>
            <p style="margin:5px 0 0 0; font-size:0.85rem; color:#666;">Comisiones automáticas: $0.50 partner + $0.50 embajador + $1 fundador</p>
          </div>
          <button class="btn btn-success" onclick="confirmarAsistencia('${d.id}', '${data.codigo}', ${data.personas}, '${data.embajadorCodigo || ''}', '${data.partnerCodigo || ''}')">
            ✅ Confirmar Asistencia
          </button>
        ` : ''}
      `;
      cont.appendChild(div);
      if (data.estado === 'asistida') totalPendiente += data.personas * 2;
    });

    if (totalPendiente > 0) {
      const totalDiv = document.createElement('div');
      totalDiv.className = 'card';
      totalDiv.style.cssText = 'background:#FFF3CD; border-left:4px solid #FFD700;';
      totalDiv.innerHTML = `<h3 style="color:#722F37;">💰 Total a pagar este mes: $${totalPendiente.toFixed(2)} USD</h3>`;
      cont.insertBefore(totalDiv, cont.firstChild);
    }
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

window.confirmarAsistencia = async (reservaId, codigo, personas, embajadorCodigo, partnerCodigo) => {
  if (!confirm(`¿Confirmar asistencia del código ${codigo} (${personas} personas)?\n\nSe cobrarán $${(personas * 2).toFixed(2)} USD a tu restaurante.`)) return;
  try {
    await updateDoc(doc(db, 'reservas', reservaId), {
      estado: 'asistida',
      mesaConfirmada: true,
      confirmadoAt: serverTimestamp(),
      comisionEmbajador: embajadorCodigo ? 0.50 * personas : 0,
      comisionPartner: partnerCodigo ? 0.50 * personas : 0,
      comisionFundador: 1.00 * personas
    });
    await addDoc(collection(db, 'pagos'), {
      reservaId,
      codigo,
      personas,
      monto: personas * 2,
      embajadorCodigo: embajadorCodigo || null,
      partnerCodigo: partnerCodigo || null,
      estado: 'pendiente',
      createdAt: serverTimestamp()
    });
    showAlert(`✅ Asistencia confirmada. Cobro: $${(personas * 2).toFixed(2)} USD`, 'success');
    loadReservas();
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  }
};

loadRestaurante();
loadReservas();
