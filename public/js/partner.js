// Panel Partner - Sabores Costeros
import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { t } from './utils.js';

const userId = sessionStorage.getItem('userId');
const miCodigo = sessionStorage.getItem('userCodigo');
if (!miCodigo) window.location.href = '/index.html';

document.getElementById('user-info').textContent = sessionStorage.getItem('userName') || 'Partner';
document.getElementById('mi-codigo').textContent = miCodigo;
document.getElementById('mi-url').textContent = `https://sabores-costeros.vercel.app/?partner=${miCodigo}`;

// ========== GENERAR QR REAL ==========
function generarQR() {
  const url = `https://sabores-costeros.vercel.app/?partner=${miCodigo}`;
  const qrContainer = document.getElementById('mi-qr');
  if (!qrContainer) return;
  
  // Usar la API de qrserver.com (gratuita y confiable)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=10&data=${encodeURIComponent(url)}`;
  qrContainer.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="width:250px;height:250px;border-radius:8px;">`;
}

async function loadStats() {
  try {
    let totalReservas = 0;
    let totalCubiertos = 0;

    const qPagos = query(collection(db, 'pagos'), where('partnerCodigo', '==', miCodigo));
    const snapPagos = await getDocs(qPagos);
    snapPagos.forEach(d => {
      totalReservas++;
      totalCubiertos += d.data().personas || 0;
    });

    document.getElementById('stat-reservas').textContent = totalReservas;
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
    // Buscar restaurantes que tengan este partnerCodigo
    const q = query(collection(db, 'restaurantes'), where('partnerCodigo', '==', miCodigo));
    const snap = await getDocs(q);

    if (snap.empty) {
      cont.innerHTML = `<p style="text-align:center;color:#666;">${t('sin-restaurantes-partner') || 'Aún no hay restaurantes con tu código'}</p>`;
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
        ${data.whatsapp ? `<p><a href="https://wa.me/${data.whatsapp.replace(/[^0-9]/g,'')}" target="_blank" style="color:#25D366;">📱 WhatsApp</a></p>` : ''}
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
    const q = query(collection(db, 'pagos'), where('partnerCodigo', '==', miCodigo));
    const snap = await getDocs(q);

    if (snap.empty) {
      cont.innerHTML = `<p style="text-align:center;color:#666;">${t('sin-comisiones')}</p>`;
      return;
    }

    let total = 0;
    cont.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const comision = data.comisionPartner || data.personas * 0.50;
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
    totalDiv.style.cssText = 'background:#FFF3CD; border-left:4px solid #FFD700;';
    totalDiv.innerHTML = `<h3 style="color:#722F37;">${t('total-acumulado')}: $${total.toFixed(2)} USD</h3>`;
    cont.insertBefore(totalDiv, cont.firstChild);
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">${t('error-generico')}: ${err.message}</p>`;
  }
}

loadStats();
loadRestaurantes();
loadComisiones();

// Generar QR cuando se cargue la página
setTimeout(generarQR, 500);
