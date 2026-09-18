import { db, storage } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, updateDoc, query, where, serverTimestamp, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { showAlert, t } from './utils.js';
import './session.js';

const userId = sessionStorage.getItem('userId');
const userRole = sessionStorage.getItem('userRole');

if (userRole !== 'restaurante') {
  alert('Acceso denegado');
  window.location.href = '/index.html';
}

document.getElementById('user-info').textContent = sessionStorage.getItem('userName') || 'Restaurante';

const urlParams = new URLSearchParams(window.location.search);
const partnerCodigoURL = urlParams.get('partner') || sessionStorage.getItem('lastPartner') || null;
const embajadorCodigoURL = urlParams.get('embajador') || sessionStorage.getItem('lastEmbajador') || null;
if (partnerCodigoURL) sessionStorage.setItem('lastPartner', partnerCodigoURL);
if (embajadorCodigoURL) sessionStorage.setItem('lastEmbajador', embajadorCodigoURL);

let userPartnerCodigo = partnerCodigoURL || null;
let userEmbajadorCodigo = embajadorCodigoURL || sessionStorage.getItem('userEmbajadorCodigo') || null;
let restauranteIdActual = '';

// ========== COMPRIMIR IMAGEN ==========
function comprimirImagen(file, maxWidth = 800, calidad = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Error al comprimir'));
        }, 'image/jpeg', calidad);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function cargarReferidosDelUsuario() {
  try {
    const userDoc = await getDoc(doc(db, 'usuarios', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.partnerReferido && !userPartnerCodigo) userPartnerCodigo = userData.partnerReferido;
      if (userData.embajadorReferido && !userEmbajadorCodigo) userEmbajadorCodigo = userData.embajadorReferido;
    }
  } catch (err) { console.error('Error cargando referidos:', err); }
}

let comisiones = { total: 2.00, fundador: 1.00, embajador: 0.50, partner: 0.50 };

async function loadComisionesConfig() {
  try {
    const docSnap = await getDocs(collection(db, 'configuracion'));
    if (!docSnap.empty) {
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
  } catch (err) { console.error('Error cargando comisiones:', err); }
}

async function loadRestaurante() {
  try {
    const q = query(collection(db, 'restaurantes'), where('dueñoId', '==', userId));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      const data = snap.docs[0].data();
      restauranteIdActual = snap.docs[0].id;
      document.getElementById('restaurante-id').value = restauranteIdActual;
      document.getElementById('res-nombre').value = data.nombre || '';
      document.getElementById('res-tipo').value = data.tipoCocina || '';
      document.getElementById('res-direccion').value = data.direccion || '';
      document.getElementById('res-telefono').value = data.telefono || '';
      document.getElementById('res-whatsapp').value = data.whatsapp || '';
      document.getElementById('res-descripcion').value = data.descripcion || '';
      document.getElementById('res-rango').value = data.rangoPrecio || '$$';
      
      if (data.fotoUrl) {
        const container = document.getElementById('foto-container');
        container.innerHTML = `<img src="${data.fotoUrl}" class="foto-preview" alt="Foto del restaurante">`;
      }

      // Servicios ya guardados
      (data.servicios || []).forEach(valor => {
        const check = document.querySelector(`#servicios-checks input[value="${valor}"]`);
        if (check) check.checked = true;
      });

      renderHorariosForm(data.horarios || {});
      renderGaleriaPreview(data.fotos || (data.fotoUrl ? [data.fotoUrl] : []));
    } else {
      renderHorariosForm({});
      renderGaleriaPreview([]);
    }
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
}

// ========== SERVICIOS ==========
document.getElementById('btn-guardar-servicios')?.addEventListener('click', async () => {
  if (!restauranteIdActual) return showAlert('Primero guardá el perfil', 'warning');
  const servicios = Array.from(document.querySelectorAll('#servicios-checks input:checked')).map(c => c.value);
  try {
    await updateDoc(doc(db, 'restaurantes', restauranteIdActual), { servicios });
    showAlert('✅ Servicios guardados', 'success');
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
});

// ========== HORARIOS ==========
const DIAS_HORARIO = [
  ['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'],
  ['jueves', 'Jueves'], ['viernes', 'Viernes'], ['sabado', 'Sábado'], ['domingo', 'Domingo']
];

function renderHorariosForm(horariosActuales) {
  const cont = document.getElementById('horarios-form');
  if (!cont) return;
  cont.innerHTML = DIAS_HORARIO.map(([key, label]) => {
    const h = horariosActuales[key] || { abre: '12:00', cierra: '23:00', cerrado: false };
    return `
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <span style="width:90px; font-weight:600;">${label}</span>
        <label style="display:flex; align-items:center; gap:4px; font-size:0.85rem;">
          <input type="checkbox" class="horario-cerrado" data-dia="${key}" ${h.cerrado ? 'checked' : ''}> Cerrado
        </label>
        <input type="time" class="form-control horario-abre" data-dia="${key}" value="${h.abre || '12:00'}" style="width:120px;" ${h.cerrado ? 'disabled' : ''}>
        <span>a</span>
        <input type="time" class="form-control horario-cierra" data-dia="${key}" value="${h.cierra || '23:00'}" style="width:120px;" ${h.cerrado ? 'disabled' : ''}>
      </div>
    `;
  }).join('');

  cont.querySelectorAll('.horario-cerrado').forEach(chk => {
    chk.addEventListener('change', () => {
      const dia = chk.dataset.dia;
      cont.querySelector(`.horario-abre[data-dia="${dia}"]`).disabled = chk.checked;
      cont.querySelector(`.horario-cierra[data-dia="${dia}"]`).disabled = chk.checked;
    });
  });
}

document.getElementById('btn-guardar-horarios')?.addEventListener('click', async () => {
  if (!restauranteIdActual) return showAlert('Primero guardá el perfil', 'warning');
  const horarios = {};
  DIAS_HORARIO.forEach(([key]) => {
    const cerrado = document.querySelector(`.horario-cerrado[data-dia="${key}"]`)?.checked || false;
    const abre = document.querySelector(`.horario-abre[data-dia="${key}"]`)?.value || '12:00';
    const cierra = document.querySelector(`.horario-cierra[data-dia="${key}"]`)?.value || '23:00';
    horarios[key] = { cerrado, abre, cierra };
  });
  try {
    await updateDoc(doc(db, 'restaurantes', restauranteIdActual), { horarios });
    showAlert('✅ Horarios guardados', 'success');
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
});

// ========== GALERÍA DE FOTOS ==========
function renderGaleriaPreview(fotos) {
  const cont = document.getElementById('galeria-preview');
  if (!cont) return;
  if (!fotos.length) {
    cont.innerHTML = '<p style="color:#666;font-size:0.9rem;">Todavía no subiste fotos.</p>';
    return;
  }
  cont.innerHTML = fotos.map((url, i) => `
    <div style="position:relative;">
      <img src="${url}" style="width:100px;height:80px;object-fit:cover;border-radius:8px;" alt="Foto ${i + 1}">
      ${i === 0 ? '<span style="position:absolute;bottom:2px;left:2px;background:#FFD700;color:#1a1a2e;font-size:0.65rem;padding:2px 6px;border-radius:4px;font-weight:700;">Portada</span>' : ''}
    </div>
  `).join('');
}

document.getElementById('btn-subir-galeria')?.addEventListener('click', async () => {
  const input = document.getElementById('galeria-input');
  const files = Array.from(input.files || []);
  if (!files.length) return showAlert('Seleccioná al menos una imagen', 'warning');
  if (!restauranteIdActual) return showAlert('Primero guardá el perfil', 'warning');

  const btn = document.getElementById('btn-subir-galeria');
  btn.disabled = true;

  try {
    const restDoc = await getDoc(doc(db, 'restaurantes', restauranteIdActual));
    const fotosActuales = (restDoc.exists() && restDoc.data().fotos) || [];
    const nuevasUrls = [];

    for (let i = 0; i < files.length; i++) {
      btn.textContent = `⏳ Subiendo ${i + 1}/${files.length}...`;
      const blob = await comprimirImagen(files[i], 1000, 0.75);
      const fileName = `restaurantes/${userId}/galeria-${Date.now()}-${i}.jpg`;
      const storageRef = ref(storage, fileName);
      const snap = await uploadBytes(storageRef, blob);
      nuevasUrls.push(await getDownloadURL(snap.ref));
    }

    const fotos = [...fotosActuales, ...nuevasUrls];
    const updateData = { fotos };
    if (!fotosActuales.length && !restDoc.data()?.fotoUrl) updateData.fotoUrl = fotos[0];
    await updateDoc(doc(db, 'restaurantes', restauranteIdActual), updateData);

    renderGaleriaPreview(fotos);
    input.value = '';
    showAlert('✅ Fotos agregadas', 'success');
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = '📤 Agregar fotos';
  }
});

// ========== SUBIR FOTO DE PERFIL ==========
document.getElementById('btn-subir-foto')?.addEventListener('click', async () => {
  const fileInput = document.getElementById('foto-input');
  const file = fileInput.files[0];
  
  if (!file) return showAlert('Seleccioná una imagen primero', 'warning');
  if (!restauranteIdActual) return showAlert('Primero guardá el perfil', 'warning');
  
  const btn = document.getElementById('btn-subir-foto');
  btn.disabled = true;
  btn.textContent = ' Comprimiendo...';
  
  try {
    const blobComprimido = await comprimirImagen(file, 800, 0.7);
    showAlert('✅ Imagen comprimida, subiendo...', 'info');
    
    const ext = 'jpg';
    const fileName = `restaurantes/${userId}/foto.${ext}`;
    const storageRef = ref(storage, fileName);
    const snapshot = await uploadBytes(storageRef, blobComprimido);
    const fotoUrl = await getDownloadURL(snapshot.ref);
    
    await updateDoc(doc(db, 'restaurantes', restauranteIdActual), { fotoUrl });
    
    const container = document.getElementById('foto-container');
    container.innerHTML = `<img src="${fotoUrl}" class="foto-preview" alt="Foto del restaurante">`;
    
    showAlert('✅ Foto actualizada', 'success');
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = '📤 Subir foto';
  }
});

// ========== GUARDAR PERFIL ==========
document.getElementById('btn-save-perfil')?.addEventListener('click', async () => {
  const nombre = document.getElementById('res-nombre').value.trim();
  const direccion = document.getElementById('res-direccion').value.trim();
  
  if (!nombre) return showAlert('El nombre del restaurante es obligatorio', 'warning');
  if (!direccion) return showAlert('La dirección es obligatoria', 'warning');
  
  const data = {
    nombre,
    tipoCocina: document.getElementById('res-tipo').value,
    direccion,
    telefono: document.getElementById('res-telefono').value.trim(),
    whatsapp: document.getElementById('res-whatsapp').value.trim(),
    descripcion: document.getElementById('res-descripcion').value.trim(),
    rangoPrecio: document.getElementById('res-rango').value,
    updatedAt: serverTimestamp()
  };

  try {
    if (restauranteIdActual) {
      await updateDoc(doc(db, 'restaurantes', restauranteIdActual), data);
      showAlert('✅ Perfil actualizado', 'success');
    } else {
      const docRef = await addDoc(collection(db, 'restaurantes'), {
        ...data,
        dueñoId: userId,
        dueñoEmail: sessionStorage.getItem('userEmail') || '',
        embajadorCodigo: userEmbajadorCodigo || null,
        partnerCodigo: userPartnerCodigo || null,
        activo: true,
        aprobado: false,
        createdAt: serverTimestamp()
      });
      restauranteIdActual = docRef.id;
      document.getElementById('restaurante-id').value = restauranteIdActual;
      showAlert('✅ Restaurante registrado (pendiente de aprobación)', 'success');
    }
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
});

// ========== MENÚ: AGREGAR PLATO ==========
document.getElementById('btn-agregar-plato')?.addEventListener('click', async () => {
  const nombre = document.getElementById('plato-nombre').value.trim();
  const precio = parseFloat(document.getElementById('plato-precio').value);
  const categoria = document.getElementById('plato-categoria')?.value || 'Principales';
  const descripcion = document.getElementById('plato-descripcion').value.trim();
  const fotoInput = document.getElementById('plato-foto');
  const fotoFile = fotoInput.files[0];
  
  if (!nombre || !precio) return showAlert('Nombre y precio son obligatorios', 'warning');
  if (!restauranteIdActual) return showAlert('Primero guardá el perfil', 'warning');
  
  const btn = document.getElementById('btn-agregar-plato');
  btn.disabled = true;
  btn.textContent = '⏳ Procesando...';
  
  try {
    let fotoUrl = null;
    
    if (fotoFile) {
      btn.textContent = '⏳ Comprimiendo foto...';
      const blobComprimido = await comprimirImagen(fotoFile, 600, 0.7);
      
      const ext = 'jpg';
      const fileName = `platos/${userId}/${Date.now()}.${ext}`;
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, blobComprimido);
      fotoUrl = await getDownloadURL(snapshot.ref);
    }
    
    await addDoc(collection(db, 'menus'), {
      restauranteId: restauranteIdActual,
      nombre,
      categoria,
      descripcion: descripcion || '',
      precio,
      fotoUrl,
      activo: true,
      createdAt: serverTimestamp()
    });
    
    document.getElementById('plato-nombre').value = '';
    document.getElementById('plato-precio').value = '';
    document.getElementById('plato-descripcion').value = '';
    document.getElementById('plato-foto').value = '';
    
    showAlert('✅ Plato agregado', 'success');
    loadMenu();
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = '➕ Agregar plato';
  }
});

// ========== MENÚ: CARGAR PLATOS ==========
async function loadMenu() {
  const cont = document.getElementById('lista-platos');
  if (!cont) return;
  
  if (!restauranteIdActual) {
    cont.innerHTML = '<p style="color:#666;">Primero guardá el perfil del restaurante</p>';
    return;
  }
  
  try {
    const q = query(collection(db, 'menus'), where('restauranteId', '==', restauranteIdActual));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      cont.innerHTML = '<p style="color:#666;">Aún no tenés platos cargados. ¡Agregá el primero!</p>';
      return;
    }
    
    cont.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const div = document.createElement('div');
      div.className = 'plato-card';
      div.innerHTML = `
        ${data.fotoUrl 
          ? `<img src="${data.fotoUrl}" class="plato-foto" alt="${data.nombre}">`
          : `<div class="plato-foto" style="display:flex;align-items:center;justify-content:center;background:#48CAE4;color:white;font-size:2rem;">🍽️</div>`
        }
        <div class="plato-info">
          <h4 style="margin:0;color:#722F37;">${data.nombre}</h4>
          ${data.descripcion ? `<p style="margin:5px 0;color:#666;font-size:0.9rem;">${data.descripcion}</p>` : ''}
          <p class="plato-precio" style="margin:5px 0 0 0;">$${data.precio.toFixed(2)} USD</p>
        </div>
        <button class="btn-eliminar-plato" onclick="eliminarPlato('${d.id}', '${data.nombre.replace(/'/g, "\\'")}')">🗑️</button>
      `;
      cont.appendChild(div);
    });
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

window.eliminarPlato = async (id, nombre) => {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;
  try {
    await deleteDoc(doc(db, 'menus', id));
    showAlert('Plato eliminado', 'success');
    loadMenu();
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
};

// ========== RESERVAS ==========
async function loadReservas() {
  const cont = document.getElementById('lista-reservas');
  if (!cont) return;

  if (!restauranteIdActual) {
    cont.innerHTML = '<p>Primero registrá tu restaurante en "Mi Perfil"</p>';
    return;
  }

  try {
    const q = query(collection(db, 'reservas'), where('restauranteId', '==', restauranteIdActual));
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
      const comisionTotal = data.personas * comisiones.total;
      div.innerHTML = `
        <h4>🎫 ${data.codigo}</h4>
        <p>📅 ${data.fecha} a las ${data.hora}</p>
        <p>👥 ${data.personas} personas</p>
        <p>Estado: <strong style="color:${estadoColor}">${data.estado}</strong></p>
        ${data.estado === 'confirmada' ? `
          <div style="background:#E8F5E9; padding:12px; border-radius:8px; margin:10px 0;">
            <p style="margin:0;"><strong>💰 Cobro: $${comisionTotal.toFixed(2)} USD (${data.personas} x $${comisiones.total.toFixed(2)})</strong></p>
          </div>
          <button class="btn btn-success" onclick="confirmarAsistencia('${d.id}', '${data.codigo}', ${data.personas}, '${data.embajadorCodigo || ''}', '${data.partnerCodigo || ''}')">
            ✅ Confirmar Asistencia
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
      totalDiv.innerHTML = `<h3 style="color:#722F37;">💰 Total a pagar este mes: $${totalPendiente.toFixed(2)} USD</h3>`;
      cont.insertBefore(totalDiv, cont.firstChild);
    }
  } catch (err) { cont.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`; }
}

window.confirmarAsistencia = async (reservaId, codigo, personas) => {
  const comisionTotal = (personas * comisiones.total).toFixed(2);
  if (!confirm(`¿Confirmar asistencia del código ${codigo} (${personas} personas)?\n\nSe cobrarán $${comisionTotal} USD.`)) return;

  try {
    // Solo cambiamos el estado de la reserva. La Cloud Function
    // "onReservaAsistida" detecta este cambio y es la que crea el
    // registro en "pagos" con la comisión calculada server-side.
    // Si este código también escribiera en "pagos", cada asistencia
    // generaría el cobro DOS veces.
    await updateDoc(doc(db, 'reservas', reservaId), {
      estado: 'asistida',
      mesaConfirmada: true,
      confirmadoAt: serverTimestamp()
    });
    showAlert(`✅ Asistencia confirmada. Cobro: $${comisionTotal} USD`, 'success');
    loadReservas();
  } catch (err) { showAlert(`Error: ${err.message}`, 'danger'); }
};

// ========== RESEÑAS ==========
function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function loadResenas() {
  const cont = document.getElementById('lista-resenas-dueno');
  const resumen = document.getElementById('resenas-resumen');
  if (!cont) return;

  if (!restauranteIdActual) {
    cont.innerHTML = '<p style="color:#666;">Primero registrá tu restaurante en "Mi Perfil"</p>';
    resumen.innerHTML = '';
    return;
  }

  try {
    // Esta query trae también las ocultas: las reglas de Firestore le dan
    // ese permiso extra al dueño del restaurante. Al público, en cambio,
    // solo le llegan las que tienen oculta:false (ver restaurante-detalle.js).
    const q = query(collection(db, 'resenas'), where('restauranteId', '==', restauranteIdActual));
    const snap = await getDocs(q);

    if (snap.empty) {
      resumen.innerHTML = '<p style="margin:0;">Todavía no tenés reseñas.</p>';
      cont.innerHTML = '';
      return;
    }

    const resenas = [];
    snap.forEach(d => resenas.push({ id: d.id, ...d.data() }));
    resenas.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    const visibles = resenas.filter(r => !r.oculta);
    const ocultas = resenas.filter(r => r.oculta);
    const promedio = visibles.length
      ? (visibles.reduce((s, r) => s + Number(r.puntaje || 0), 0) / visibles.length).toFixed(1)
      : '—';

    resumen.innerHTML = `
      <p style="margin:0;"><strong>⭐ Promedio público:</strong> ${promedio} (${visibles.length} reseña${visibles.length === 1 ? '' : 's'} visible${visibles.length === 1 ? '' : 's'})</p>
      ${ocultas.length ? `<p style="margin:6px 0 0 0; color:#DC3545;"><strong>🚫 ${ocultas.length} reseña${ocultas.length === 1 ? '' : 's'} oculta${ocultas.length === 1 ? '' : 's'}</strong> por lenguaje ofensivo — no las ve el público, pero podés leerlas abajo.</p>` : ''}
    `;

    cont.innerHTML = resenas.map(r => {
      const estrellas = '★'.repeat(Math.round(r.puntaje || 0)) + '☆'.repeat(5 - Math.round(r.puntaje || 0));
      const fecha = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('es-UY') : '';
      return `
        <div class="card" style="${r.oculta ? 'background:#FFF3F3; border-left:4px solid #DC3545;' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <strong>${esc(r.nombreUsuario || 'Cliente')}</strong>
            <span style="color:#FFD700;">${estrellas}</span>
          </div>
          ${r.oculta ? '<p style="color:#DC3545; font-weight:600; font-size:0.85rem; margin:0 0 6px 0;">🚫 Oculta al público por lenguaje ofensivo</p>' : ''}
          <p style="color:#555; margin:0;">${esc(r.comentario || '(sin comentario)')}</p>
          ${fecha ? `<p style="color:#999; font-size:0.8rem; margin:8px 0 0 0;">${fecha}</p>` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">Error: ${esc(err.message)}</p>`;
  }
}

// ========== INICIALIZACIÓN ==========
cargarReferidosDelUsuario().then(() => {
  loadComisionesConfig();
  loadRestaurante().then(() => {
    loadMenu();
    loadReservas();
    loadResenas();
  });
});