import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { t } from './utils.js';
import './session.js';

const userId = sessionStorage.getItem('userId');
const miCodigo = sessionStorage.getItem('userCodigo');
if (!miCodigo) window.location.href = '/index.html';

document.getElementById('user-info').textContent = sessionStorage.getItem('userName') || 'Embajador';
document.getElementById('mi-codigo').textContent = miCodigo;
document.getElementById('mi-url').textContent = `https://sabores-costeros.vercel.app/?embajador=${miCodigo}`;

function generarQR() {
  const url = `https://sabores-costeros.vercel.app/?embajador=${miCodigo}`;
  const qrContainer = document.getElementById('mi-qr');
  if (!qrContainer) return;
  
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=10&data=${encodeURIComponent(url)}`;
  qrContainer.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="width:250px;height:250px;border-radius:8px;">`;
}

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

setTimeout(generarQR, 500);

window.copiarURL = function() {
  const url = document.getElementById('mi-url').textContent;
  navigator.clipboard.writeText(url).then(() => {
    alert('URL copiada: ' + url);
  }).catch(() => {
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    alert('URL copiada: ' + url);
  });
};

window.compartirURLWhatsApp = function() {
  const url = document.getElementById('mi-url').textContent;
  const idioma = sessionStorage.getItem('idioma') || 'es';
  const mensajes = {
    es: `¡Sumate a Sabores Costeros! 🌊🍽️ Descubrí los mejores restaurantes de la costa y participá por cenas gratis para 4 personas. Entrá acá: ${url}`,
    pt: `Junte-se ao Sabores Costeros! 🍽️ Descubra os melhores restaurantes da costa e participe de jantares grátis para 4 pessoas. Entre aqui: ${url}`,
    en: `Join Sabores Costeros! 🌊️ Discover the best coastal restaurants and win free dinners for 4. Enter here: ${url}`
  };
  const texto = encodeURIComponent(mensajes[idioma] || mensajes.es);
  window.open(`https://wa.me/?text=${texto}`, '_blank');
};