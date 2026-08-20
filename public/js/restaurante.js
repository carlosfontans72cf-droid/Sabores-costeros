// Panel Restaurante - Sabores Costeros
import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, generarCodigoReserva, t } from './utils.js';

const userId = sessionStorage.getItem('userId');
const userRole = sessionStorage.getItem('userRole');

if (userRole !== 'restaurante') {
  alert(t('acceso-denegado'));
  window.location.href = '/index.html';
}

document.getElementById('user-info').textContent = sessionStorage.getItem('userName') || 'Restaurante';

// ========== COMISIONES (cargadas desde config) ==========
let comisiones = {
  total: 2.00,
  fundador: 1.00,
  embajador: 0.50,
  partner: 0.50
};

async function loadComisionesConfig() {
  try {
    const docSnap = await getDocs(collection(db, 'configuracion'));
    if (!docSnap.empty) {
      // Buscar el documento de comisiones
      docSnap.forEach(d => {
        if (d.id === 'comisiones') {
          const config = d.data();
          comisiones = {
            total: config.total || 2.00,
            fundador: config.fundador || 1.00,
            embajador: config.embajador || 0.50,
            partner: config.partner || 0.50
          };
        }
      });
    }
  } catch (err) {
    console.error('Error cargando comisiones:', err);
  }
}

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
    showAlert(`${t('error-generico')}: ${err.message}`, 'danger');
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
      showAlert(t('perfil-actualizado'), 'success');
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
      showAlert(t('restaurante-registrado'), 'success');
    }
  } catch (err) {
    showAlert(`${t('error-generico')}: ${err.message}`, 'danger');
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
      cont.innerHTML = `<p>${t('registro-primero')}</p>`;
      return;
    }
    const restauranteId = snapRest.docs[0].id;

    const q = query(collection(db, 'reservas'), where('restauranteId', '==', restauranteId));
    const snap = await getDocs(q);

    if (snap.empty) {
      cont.innerHTML = `<p style="text-align:center;color:#666;">${t('sin-reservas')}</p>`;
      return;
    }

    cont.innerHTML = '';
    let totalPendiente = 0;
    snap.forEach(d => {
      const data = d.data();
      const div = document.createElement('div');
      div.className = 'card';
      const estadoColor = data.estado === 'confirmada' ? '#FFC107' : data.estado === 'asistida' ? '#28A745' : '#666';
      const comisionTotal = data.personas * comisiones.total;
      div.innerHTML = `
        <h4>🎫 ${data.codigo}</h4>
        <p>📅 ${data.fecha} a las ${data.hora}</p>
        <p>👥 ${data.personas} ${t('personas')}</p>
        <p>Estado: <strong style="color:${estadoColor}">${data.estado}</strong></p>
        ${data.estado === 'confirmada' ? `
          <div style="background:#E8F5E9; padding:12px; border-radius:8px; margin:10px 0;">
            <p style="margin:0;"><strong>💰 ${t('cobro-info').replace('${amount}', comisionTotal.toFixed(2)).replace('${personas}', data.personas)}</strong></p>
            <p style="margin:5px 0 0 0; font-size:0.85rem; color:#666;">${t('comision-info').replace('$0.50', '$' + comisiones.embajador.toFixed(2)).replace('$0.50 partner', '$' + comisiones.partner.toFixed(2) + ' partner').replace('$1', '$' + comisiones.fundador.toFixed(2))}</p>
          </div>
          <button class="btn btn-success" onclick="confirmarAsistencia('${d.id}', '${data.codigo}', ${data.personas}, '${data.embajadorCodigo || ''}', '${data.partnerCodigo || ''}')">
            ✅ ${t('btn-confirmar-asistencia')}
          </button>
        ` : ''}
      `;
      cont.appendChild(div);
      if (data.estado === 'asistida') totalPendiente += data.personas * comisiones.total;
    });

    if (totalPendiente > 0) {
      const totalDiv = document.createElement('div');
      totalDiv.className = 'card';
      totalDiv.style.cssText = 'background:#FFF3CD; border-left:4px solid #FFD700;';
      totalDiv.innerHTML = `<h3 style="color:#722F37;">💰 ${t('total-pagar')}: $${totalPendiente.toFixed(2)} USD</h3>`;
      cont.insertBefore(totalDiv, cont.firstChild);
    }
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">${t('error-generico')}: ${err.message}</p>`;
  }
}

window.confirmarAsistencia = async (reservaId, codigo, personas, embajadorCodigo, partnerCodigo) => {
  const comisionTotal = (personas * comisiones.total).toFixed(2);
  const pregunta = t('confirmar-asistencia-pregunta')
    .replace('{codigo}', codigo)
    .replace('{personas}', personas)
    .replace('${amount}', comisionTotal);
  
  if (!confirm(pregunta)) return;
  
  try {
    await updateDoc(doc(db, 'reservas', reservaId), {
      estado: 'asistida',
      mesaConfirmada: true,
      confirmadoAt: serverTimestamp(),
      comisionEmbajador: embajadorCodigo ? comisiones.embajador * personas : 0,
      comisionPartner: partnerCodigo ? comisiones.partner * personas : 0,
      comisionFundador: comisiones.fundador * personas
    });
    await addDoc(collection(db, 'pagos'), {
      reservaId,
      codigo,
      personas,
      monto: personas * comisiones.total,
      embajadorCodigo: embajadorCodigo || null,
      partnerCodigo: partnerCodigo || null,
      estado: 'pendiente',
      createdAt: serverTimestamp()
    });
    const msg = t('asistencia-confirmada').replace('${amount}', comisionTotal);
    showAlert(msg, 'success');
    loadReservas();
  } catch (err) {
    showAlert(`${t('error-generico')}: ${err.message}`, 'danger');
  }
};

// ========== INICIALIZACIÓN ==========
loadComisionesConfig().then(() => {
  loadRestaurante();
  loadReservas();
});
