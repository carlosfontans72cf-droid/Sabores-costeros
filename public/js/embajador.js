// Panel Embajador - Sabores Costeros
import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { t, applyTranslations } from './utils.js';

const userId = sessionStorage.getItem('userId');
const miCodigo = sessionStorage.getItem('userCodigo');
if (!miCodigo) window.location.href = '/index.html';

document.getElementById('user-info').textContent = sessionStorage.getItem('userName') || 'Embajador';
document.getElementById('mi-codigo').textContent = miCodigo;

async function loadStats() {
  try {
    const qRest = query(collection(db, 'restaurantes'), where('embajadorCodigo', '==', miCodigo));
    const snapRest = await getDocs(qRest);
    document.getElementById('stat-restaurantes').textContent = snapRest.size;

    let totalCubiertos = 0;
    const qPagos = query(collection(db, 'pagos'), where('embajadorCodigo', '==', miCodigo));
    const snapPagos = await getDocs(qPagos);
    snapPagos.forEach(d => {
      totalCubiertos += d.data().personas || 0;
    });
    document.getElementById('stat-cubiertos').textContent = totalCubiertos;
    document.getElementById('stat-comision').textContent = `$${(totalCubiertos * 0.50).toFixed(2)}`;
  } catch (err) {
    console.error('Error stats:', err);
  }
}

async function loadRestaurantes() {
  const cont = document.getElementById('lista-restaurantes');
  if (!cont) return;

  try {
    const q = query(collection(db, 'restaurantes'), where('embajadorCodigo', '==', miCodigo));
    const snap = await getDocs(q);

    if (snap.empty) {
      cont.innerHTML = `<p style="text-align:center;color:#666;">${t('sin-restaurantes-emb')}</p>`;
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
        <p>Estado: <strong>${data.aprobado ? '✅ Aprobado' : '⏳ Pendiente'}</strong></p>
      `;
      cont.appendChild(div);
    });
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">${t('error-generico')}: ${err.message}</p>`;
  }
}

async function loadComisiones() {
  const cont = document.getElementById('lista-comisiones');
  if (!cont) return;

  try {
    const q = query(collection(db, 'pagos'), where('embajadorCodigo', '==', miCodigo));
    const snap = await getDocs(q);

    if (snap.empty) {
      cont.innerHTML = `<p style="text-align:center;color:#666;">${t('sin-comisiones')}</p>`;
      return;
    }

    let total = 0;
    cont.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const comision = (data.comisionEmbajador || data.personas * 0.50);
      total += comision;
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <h4>🎫 ${data.codigo}</h4>
        <p>${data.personas} ${t('personas')} · $${comision.toFixed(2)} USD</p>
        <p style="color:#666; font-size:0.85rem;">${data.estado}</p>
      `;
      cont.appendChild(div);
    });

    const totalDiv = document.createElement('div');
    totalDiv.className = 'card';
    totalDiv.style.cssText = 'background:#E8F5E9; border-left:4px solid #28A745;';
    totalDiv.innerHTML = `<h3 style="color:#28A745;">${t('total-acumulado')}: $${total.toFixed(2)} USD</h3>`;
    cont.insertBefore(totalDiv, cont.firstChild);
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">${t('error-generico')}: ${err.message}</p>`;
  }
}

loadStats();
loadRestaurantes();
loadComisiones();
applyTranslations();
