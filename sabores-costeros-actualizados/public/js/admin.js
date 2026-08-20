// Panel Admin/Fundador - Sabores Costeros
import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, query, where, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showAlert, t } from './utils.js';
import './session.js';

const userRole = sessionStorage.getItem('userRole');
if (userRole !== 'fundador' && userRole !== 'admin') {
  alert(t('acceso-denegado'));
  window.location.href = '/index.html';
}

document.getElementById('user-info').textContent = sessionStorage.getItem('userName') || t('nav-user-loading');

// Datos del admin para re-login
let adminPassword = '';

// Pedir contraseña del admin al cargar el panel
function pedirPasswordAdmin() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
      <div style="background:white;padding:30px;border-radius:16px;max-width:400px;width:100%;">
        <h3 style="color:#023E8A;margin-top:0;">🔑 Verificación de Seguridad</h3>
        <p style="color:#666;">Ingresá tu contraseña para poder crear usuarios</p>
        <div class="form-group">
          <label>Contraseña de administrador</label>
          <input type="password" id="admin-pass-input" class="form-control" placeholder="Tu contraseña">
        </div>
        <div id="admin-pass-error" style="color:red;min-height:20px;"></div>
        <button class="btn btn-primary btn-block" id="btn-confirmar-pass">Confirmar</button>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-confirmar-pass').addEventListener('click', () => {
      const pass = document.getElementById('admin-pass-input').value;
      if (!pass) {
        document.getElementById('admin-pass-error').textContent = 'Ingresá tu contraseña';
        return;
      }
      adminPassword = pass;
      modal.remove();
      resolve(true);
    });

    document.getElementById('admin-pass-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-confirmar-pass').click();
      }
    });
  });
}

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
    return showAlert(t('error-empty-fields'), 'warning');
  }

  if (password.length < 6) {
    return showAlert(t('error-weak-password'), 'warning');
  }

  // Verificar que tenemos la contraseña del admin
  if (!adminPassword) {
    await pedirPasswordAdmin();
  }

  // Guardar email del admin para re-login
  const adminEmail = sessionStorage.getItem('userEmail');

  try {
    // Paso 1: Crear usuario via REST API
    const apiKey = "AIzaSyDJVKFY4fmQ5XGh1W1SsBg0KNlboTd0ceg";
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password,
          returnSecureToken: true
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      if (data.error.message === 'EMAIL_EXISTS') {
        return showAlert(t('error-email-exists'), 'danger');
      }
      throw new Error(data.error.message);
    }

    const uid = data.localId;

    // Paso 2: El usuario nuevo quedó logueado. Cerrar su sesión.
    const { auth } = await import('./firebase-config.js');
    await auth.signOut();

    // Paso 3: Re-loguear al admin
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

    // Paso 4: Guardar datos en Firestore (ahora como admin)
    await setDoc(doc(db, 'usuarios', uid), {
      uid,
      nombre,
      apellido,
      email,
      role,
      codigo,
      activo: true,
      aprobado: true,
      esAdminCreado: true,
      createdAt: serverTimestamp()
    });

    // Limpiar formulario
    document.getElementById('new-nombre').value = '';
    document.getElementById('new-apellido').value = '';
    document.getElementById('new-email').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('new-codigo').value = '';

    showAlert(`✅ ${role.toUpperCase()} creado: ${nombre} (${codigo})`, 'success');
    loadUsuarios();
  } catch (err) {
    if (err.message && err.message.includes('EMAIL_EXISTS')) {
      showAlert(t('error-email-exists'), 'danger');
    } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
      showAlert('Contraseña de admin incorrecta. Volvé a ingresarla.', 'danger');
      adminPassword = '';
      await pedirPasswordAdmin();
    } else {
      showAlert(`${t('error-generico')}: ${err.message}`, 'danger');
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
      cont.innerHTML = `<p style="color:#666;">${t('no-aprobaciones')}</p>`;
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
          <button class="btn btn-success" onclick="aprobarRestaurante('${d.id}')">${t('btn-aprobar')}</button>
          <button class="btn btn-danger" onclick="rechazarRestaurante('${d.id}')">${t('btn-rechazar')}</button>
        </div>
      `;
      cont.appendChild(div);
    });
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">${t('error-generico')}: ${err.message}</p>`;
  }
}

window.aprobarRestaurante = async (id) => {
  if (!confirm(t('btn-aprobar') + '?')) return;
  try {
    await updateDoc(doc(db, 'restaurantes', id), { aprobado: true });
    showAlert(t('restaurante-aprobado'), 'success');
    loadAprobaciones();
  } catch (err) { showAlert(`${t('error-generico')}: ${err.message}`, 'danger'); }
};

window.rechazarRestaurante = async (id) => {
  if (!confirm(t('btn-rechazar') + '?')) return;
  try {
    await deleteDoc(doc(db, 'restaurantes', id));
    showAlert(t('restaurante-rechazado'), 'warning');
    loadAprobaciones();
  } catch (err) { showAlert(`${t('error-generico')}: ${err.message}`, 'danger'); }
};

// ========== USUARIOS ==========
async function loadUsuarios() {
  const cont = document.getElementById('lista-usuarios');
  if (!cont) return;

  try {
    const snap = await getDocs(collection(db, 'usuarios'));
    if (snap.empty) {
      cont.innerHTML = `<p style="color:#666;">${t('no-usuarios')}</p>`;
      return;
    }

    cont.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const div = document.createElement('div');
      div.className = 'card';
      const rolColor = data.role === 'fundador' ? '#023E8A' : data.role === 'admin' ? '#0077B6' : data.role === 'partner' ? '#722F37' : data.role === 'embajador' ? '#009C3B' : '#666';
      const rolTexto = data.role ? data.role.charAt(0).toUpperCase() + data.role.slice(1) : 'Sin rol';
      
      // Botón WhatsApp solo para partners y embajadores
      let btnWhatsApp = '';
      if ((data.role === 'partner' || data.role === 'embajador') && data.codigo) {
        const url = `https://sabores-costeros.vercel.app/?partner=${data.codigo}`;
        const idioma = sessionStorage.getItem('idioma') || 'es';
        const mensajes = {
          es: `¡Sumate a Sabores Costeros! 🌊🍽️ Usá mi código *${data.codigo}* al registrarte. Descubrí los mejores restaurantes de la costa y participá por cenas gratis para 4 personas. Entrá acá: ${url}`,
          pt: `Junte-se ao Sabores Costeros! 🌊🍽️ Use meu código *${data.codigo}* ao se cadastrar. Descubra os melhores restaurantes da costa e participe de jantares grátis para 4 pessoas. Entre aqui: ${url}`,
          en: `Join Sabores Costeros! 🌊️ Use my code *${data.codigo}* when signing up. Discover the best coastal restaurants and win free dinners for 4. Enter here: ${url}`
        };
        const msg = encodeURIComponent(mensajes[idioma] || mensajes.es);
        btnWhatsApp = `<a href="https://wa.me/?text=${msg}" target="_blank" class="btn btn-success" style="text-decoration:none;font-size:0.85rem;padding:6px 12px;">📱 Enviar código por WhatsApp</a>`;
      }
      
      div.innerHTML = `
        <h4>${data.nombre} ${data.apellido || ''}</h4>
        <p>${data.email}</p>
        <p>Rol: <strong style="color:${rolColor}; text-transform:capitalize;">${rolTexto}</strong> ${data.activo ? '✅' : ''}</p>
        ${data.codigo ? `<p>Código: <strong>${data.codigo}</strong></p>` : ''}
        <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
          ${btnWhatsApp}
          <button class="btn ${data.activo ? 'btn-warning' : 'btn-success'}" style="font-size:0.85rem;padding:6px 12px;" onclick="toggleUsuario('${d.id}', ${!data.activo})">
            ${data.activo ? 'Desactivar' : 'Activar'}
          </button>
          ${data.role !== 'fundador' ? `<button class="btn btn-danger" style="font-size:0.85rem;padding:6px 12px;" onclick="eliminarUsuario('${d.id}', '${data.nombre.replace(/'/g, "\\'")}')">🗑️ Eliminar</button>` : ''}
        </div>
      `;
      cont.appendChild(div);
    });
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">${t('error-generico')}: ${err.message}</p>`;
  }
}

window.eliminarUsuario = async (id, nombre) => {
  if (!confirm(`¿Eliminar a ${nombre}?\n\nEsta acción no se puede deshacer.`)) return;
  if (!confirm(`¿Estás SEGURO? Se borrará el usuario de la base de datos.`)) return;
  
  try {
    await deleteDoc(doc(db, 'usuarios', id));
    showAlert(`Usuario ${nombre} eliminado`, 'success');
    loadUsuarios();
  } catch (err) {
    showAlert(`${t('error-generico')}: ${err.message}`, 'danger');
  }
};

window.toggleUsuario = async (id, nuevoEstado) => {
  try {
    await updateDoc(doc(db, 'usuarios', id), { activo: nuevoEstado });
    showAlert(nuevoEstado ? t('user-activado') : t('user-desactivado'), 'info');
    loadUsuarios();
  } catch (err) { showAlert(`${t('error-generico')}: ${err.message}`, 'danger'); }
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
      cont.innerHTML = `<p style="color:#666;">${t('no-pagos')}</p>`;
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
        <p> ${personas} ${t('personas')}</p>
        <p>💰 Total: <strong>$${monto.toFixed(2)} USD</strong></p>
        ${data.embajadorCodigo ? `<p>🌟 Embajador: <strong>${data.embajadorCodigo}</strong> - $${comisionEmbajador.toFixed(2)}</p>` : ''}
        ${data.partnerCodigo ? `<p>🤝 Partner: <strong>${data.partnerCodigo}</strong> - $${comisionPartner.toFixed(2)}</p>` : ''}
        <p> Fundador: <strong>$${(comisionFundador || personas).toFixed(2)}</strong></p>
      `;
      cont.appendChild(div);
    });

    const resumenDiv = document.createElement('div');
    resumenDiv.className = 'card';
    resumenDiv.style.cssText = 'background:#E8F5E9; border-left:4px solid #28A745;';
    resumenDiv.innerHTML = `
      <h3 style="color:#28A745;">📊 ${t('resumen-comisiones')}</h3>
      <p><strong>${t('total-recaudado')}:</strong> $${(totalFundador + totalEmbajador + totalPartner).toFixed(2)} USD</p>
      <p><strong>${t('total-fundador')}:</strong> $${totalFundador.toFixed(2)} USD</p>
      <p><strong>${t('total-embajadores')}:</strong> $${totalEmbajador.toFixed(2)} USD</p>
      <p><strong>${t('total-partners')}:</strong> $${totalPartner.toFixed(2)} USD</p>
    `;
    cont.insertBefore(resumenDiv, cont.firstChild);
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">${t('error-generico')}: ${err.message}</p>`;
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
        <p><strong>🎫 ${data.codigo}</strong> - ${data.nombreRestaurante || 'Restaurante'}</p>
        <p> ${data.personas} ${t('personas')} · 📅 ${data.fecha}</p>
      `;
      cont.appendChild(div);
    });
    const infoDiv = document.createElement('div');
    infoDiv.className = 'card';
    infoDiv.style.cssText = 'background:#FFF9C4; border-left:4px solid #FFD700;';
    infoDiv.innerHTML = `<h3 style="color:#722F37;"> Total participantes esta semana: ${total}</h3><p>Sorteo: todos los sábados</p>`;
    cont.insertBefore(infoDiv, cont.firstChild);
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">${t('error-generico')}: ${err.message}</p>`;
  }
}

// ========== CONFIGURACIÓN DE COMISIONES ==========
async function loadConfig() {
  try {
    const docSnap = await getDocs(collection(db, 'configuracion'));
    if (!docSnap.empty) {
      docSnap.forEach(d => {
        if (d.id === 'comisiones') {
          const config = d.data();
          document.getElementById('config-total').value = config.total || 2.00;
          document.getElementById('config-fundador').value = config.fundador || 1.00;
          document.getElementById('config-embajador').value = config.embajador || 0.50;
          document.getElementById('config-partner').value = config.partner || 0.50;
        }
      });
    }
    updateResumen();
  } catch (err) {
    console.error('Error loading config:', err);
  }
}

function updateResumen() {
  const total = parseFloat(document.getElementById('config-total').value) || 0;
  const fundador = parseFloat(document.getElementById('config-fundador').value) || 0;
  const embajador = parseFloat(document.getElementById('config-embajador').value) || 0;
  const partner = parseFloat(document.getElementById('config-partner').value) || 0;
  const suma = fundador + embajador + partner;

  document.getElementById('resumen-total').textContent = `$${total.toFixed(2)} USD`;
  document.getElementById('resumen-fundador').textContent = `$${fundador.toFixed(2)} USD`;
  document.getElementById('resumen-embajador').textContent = `$${embajador.toFixed(2)} USD`;
  document.getElementById('resumen-partner').textContent = `$${partner.toFixed(2)} USD`;

  const warning = document.getElementById('resumen-warning');
  if (Math.abs(suma - total) > 0.01) {
    warning.style.display = 'block';
    warning.textContent = `⚠️ La suma ($${suma.toFixed(2)}) no coincide con el total ($${total.toFixed(2)})`;
  } else {
    warning.style.display = 'none';
  }
}

document.getElementById('config-total')?.addEventListener('input', updateResumen);
document.getElementById('config-fundador')?.addEventListener('input', updateResumen);
document.getElementById('config-embajador')?.addEventListener('input', updateResumen);
document.getElementById('config-partner')?.addEventListener('input', updateResumen);

document.getElementById('btn-guardar-config')?.addEventListener('click', async () => {
  const total = parseFloat(document.getElementById('config-total').value) || 0;
  const fundador = parseFloat(document.getElementById('config-fundador').value) || 0;
  const embajador = parseFloat(document.getElementById('config-embajador').value) || 0;
  const partner = parseFloat(document.getElementById('config-partner').value) || 0;
  const suma = fundador + embajador + partner;

  if (Math.abs(suma - total) > 0.01) {
    return showAlert(`La suma de comisiones ($${suma.toFixed(2)}) no coincide con el total ($${total.toFixed(2)})`, 'warning');
  }

  try {
    await setDoc(doc(db, 'configuracion', 'comisiones'), {
      total,
      fundador,
      embajador,
      partner,
      updatedAt: serverTimestamp()
    });
    showAlert(t('config-saved'), 'success');
  } catch (err) {
    showAlert(`${t('error-generico')}: ${err.message}`, 'danger');
  }
});

// ========== INICIALIZACIÓN ==========
loadAprobaciones();
loadUsuarios();
loadPagos();
loadSorteo();
loadConfig();
