// Panel Admin/Fundador - Sabores Costeros
import { auth, db } from './firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showAlert } from './utils.js';

const userRole = sessionStorage.getItem('userRole');
if (userRole !== 'fundador' && userRole !== 'admin') {
  alert('Acceso denegado');
  window.location.href = '/index.html';
}

document.getElementById('user-info').textContent = sessionStorage.getItem('userName') || 'Admin';

// ========== TABS ==========
window.showTab = (tabName) => {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');
  event.target.classList.add('active');
};

window.logout = () => { sessionStorage.clear(); window.location.href = '/index.html'; };

// ========== CREAR USUARIO ==========
document.getElementById('btn-crear-usuario')?.addEventListener('click', async () => {
  const nombre = document.getElementById('new-nombre').value.trim();
  const apellido = document.getElementById('new-apellido').value.trim();
  const email = document.getElementById('new-email').value.trim();
  const password = document.getElementById('new-password').value;
  const role = document.getElementById('new-role').value;
  const codigo = document.getElementById('new-codigo').value.trim();

  if (!nombre || !email || !password || !codigo) {
    return showAlert('Completá nombre, email, contraseña y código', 'warning');
  }

  if (password.length < 6) {
    return showAlert('La contraseña debe tener mínimo 6 caracteres', 'warning');
  }

  try {
    // Crear usuario en Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Guardar datos en Firestore
    await addDoc(collection(db, 'usuarios'), {
      uid,
      nombre,
      apellido,
      email,
      password: '',
      role,
      codigo,
      activo: true,
      aprobado: true,
      esAdminCreado: true,
      createdAt: serverTimestamp()
    });
    document.getElementById('new-nombre').value = '';
    document.getElementById('new-apellido').value = '';
    document.getElementById('new-email').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('new-codigo').value = '';
    showAlert(`${role} creado: ${nombre} (${codigo})`, 'success');
    loadUsuarios();
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      showAlert('Email ya registrado en Authentication', 'danger');
    } else if (err.code === 'auth/weak-password') {
      showAlert('Contraseña muy débil (mínimo 6 caracteres)', 'danger');
    } else {
      showAlert(`Error: ${err.message}`, 'danger');
    }
  }
});

// ========== APROBACIONES ==========
async function loadAprobaciones() {
  const cont = document.getElementById('lista-aprobaciones');
  if (!cont) return;

  try {
    const q = query(collection(db, 'restaurantes'), where('aprobado', '==', false));
    const snap = await getDocs(q);

    if (snap.empty) {
      cont.innerHTML = '<p style="color:#666;">No hay aprobaciones pendientes</p>';
      return;
    }

    cont.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <h4 style="color:#722F37;">${data.nombre}</h4>
        <p>${data.tipoCocina || ''} · ${data.direccion || ''}</p>
        <p>Dueño: ${data.email || 'N/A'}</p>
        ${data.embajadorCodigo ? `<p>Embajador: <strong>${data.embajadorCodigo}</strong></p>` : ''}
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button class="btn btn-success" onclick="aprobarRestaurante('${d.id}')">✅ Aprobar</button>
          <button class="btn btn-danger" onclick="rechazarRestaurante('${d.id}')">❌ Rechazar</button>
        </div>
      `;
      cont.appendChild(div);
    });
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

window.aprobarRestaurante = async (id) => {
  if (!confirm('¿Aprobar este restaurante?')) return;
  try {
    await updateDoc(doc(db, 'restaurantes', id), { aprobado: true });
    showAlert('Restaurante aprobado', 'success');
    loadAprobaciones();
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
};

window.rechazarRestaurante = async (id) => {
  if (!confirm('¿Rechazar este restaurante?')) return;
  try {
    await deleteDoc(doc(db, 'restaurantes', id));
    showAlert('Restaurante rechazado', 'warning');
    loadAprobaciones();
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
};

// ========== USUARIOS ==========
async function loadUsuarios() {
  const cont = document.getElementById('lista-usuarios');
  if (!cont) return;

  try {
    const snap = await getDocs(collection(db, 'usuarios'));
    if (snap.empty) {
      cont.innerHTML = '<p style="color:#666;">Sin usuarios</p>';
      return;
    }

    cont.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const div = document.createElement('div');
      div.className = 'card';
      const rolColor = data.role === 'fundador' ? '#023E8A' : data.role === 'admin' ? '#0077B6' : data.role === 'partner' ? '#722F37' : data.role === 'embajador' ? '#009C3B' : '#666';
      div.innerHTML = `
        <h4>${data.nombre} ${data.apellido || ''}</h4>
        <p>${data.email}</p>
        <p>Rol: <strong style="color:${rolColor}; text-transform:capitalize;">${data.role}</strong> ${data.activo ? '✅' : '❌'}</p>
        ${data.codigo ? `<p>Código: <strong>${data.codigo}</strong></p>` : ''}
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button class="btn ${data.activo ? 'btn-warning' : 'btn-success'}" onclick="toggleUsuario('${d.id}', ${!data.activo})">
            ${data.activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      `;
      cont.appendChild(div);
    });
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

window.toggleUsuario = async (id, nuevoEstado) => {
  try {
    await updateDoc(doc(db, 'usuarios', id), { activo: nuevoEstado });
    showAlert(nuevoEstado ? 'Usuario activado' : 'Usuario desactivado', 'info');
    loadUsuarios();
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
};

// ========== PAGOS Y COMISIONES ==========
async function loadPagos() {
  const cont = document.getElementById('lista-pagos');
  if (!cont) return;

  try {
    const snap = await getDocs(collection(db, 'pagos'));
    let totalFundador = 0;
    let totalEmbajador = 0;
    let totalPartner = 0;

    if (snap.empty) {
      cont.innerHTML = '<p style="color:#666;">Sin pagos registrados</p>';
      return;
    }

    cont.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const monto = Number(data.monto) || 0;
      const personas = Number(data.personas) || 0;
      const comisionFundador = Number(data.comisionFundador) || 0;
      const comisionEmbajador = Number(data.comisionEmbajador) || 0;
      const comisionPartner = Number(data.comisionPartner) || 0;
      totalFundador += comisionFundador || (personas * 1);
      totalEmbajador += comisionEmbajador || 0;
      totalPartner += comisionPartner || 0;
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <h4>🎫 ${data.codigo}</h4>
        <p>Personas: ${personas}</p>
        <p>Monto total: <strong>$${monto.toFixed(2)} USD</strong></p>
        ${data.embajadorCodigo ? `<p>Embajador: <strong>${data.embajadorCodigo}</strong> - $${comisionEmbajador.toFixed(2)}</p>` : ''}
        ${data.partnerCodigo ? `<p>Partner: <strong>${data.partnerCodigo}</strong> - $${comisionPartner.toFixed(2)}</p>` : ''}
        <p>Fundador: <strong>$${(comisionFundador || personas).toFixed(2)}</strong></p>
      `;
      cont.appendChild(div);
    });

    const resumenDiv = document.createElement('div');
    resumenDiv.className = 'card';
    resumenDiv.style.cssText = 'background:#E8F5E9; border-left:4px solid #28A745;';
    resumenDiv.innerHTML = `
      <h3 style="color:#28A745;"> Resumen de Comisiones</h3>
      <p><strong>💰 Total recaudado:</strong> $${(totalFundador + totalEmbajador + totalPartner).toFixed(2)} USD</p>
      <p><strong>👑 Fundador (vos):</strong> $${totalFundador.toFixed(2)} USD</p>
      <p><strong> Embajadores:</strong> $${totalEmbajador.toFixed(2)} USD</p>
      <p><strong>🤝 Partners:</strong> $${totalPartner.toFixed(2)} USD</p>
    `;
    cont.insertBefore(resumenDiv, cont.firstChild);
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

// ========== SORTEO SEMANAL ==========
async function loadSorteo() {
  const cont = document.getElementById('lista-sorteo');
  if (!cont) return;
  try {
    const q = query(collection(db, 'reservas'), where('estado', '==', 'asistida'));
    const snap = await getDocs(q);
    let total = 0;
    cont.innerHTML = '';
    snap.forEach(d => {
      total++;
      const data = d.data();
      const div = document.createElement('div');
      div.className = 'card';
      div.style.cssText = 'background:#FFF9C4; border-left:4px solid #FFD700;';
      div.innerHTML = `
        <p><strong> 🎫 ${data.codigo}</strong> - ${data.nombreRestaurante || 'Restaurante'}</p>
        <p> ${data.personas} personas · 📅 ${data.fecha}</p>
      `;
      cont.appendChild(div);
    });
    const infoDiv = document.createElement('div');
    infoDiv.className = 'card';
    infoDiv.style.cssText = 'background:#FFF9C4; border-left:4px solid #FFD700;';
    infoDiv.innerHTML = `<h3 style="color:#722F37;">🎉 Total participantes esta semana: ${total}</h3><p>Sorteo: todos los sábados</p>`;
    cont.insertBefore(infoDiv, cont.firstChild);
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

// ========== INICIALIZACIÓN ==========
loadAprobaciones();
loadUsuarios();
loadPagos();
loadSorteo();
