// Panel Partner - Sabores Costeros
import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const userId = sessionStorage.getItem('userId');
const miCodigo = sessionStorage.getItem('userCodigo');
if (!miCodigo) window.location.href = '/index.html';

document.getElementById('user-info').textContent = sessionStorage.getItem('userName') || 'Partner';
document.getElementById('mi-codigo').textContent = miCodigo;
document.getElementById('mi-url').textContent = `https://sabores-costeros.vercel.app/?partner=${miCodigo}`;

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

async function loadComisiones() {
  const cont = document.getElementById('lista-comisiones');
  if (!cont) return;

  try {
    const q = query(collection(db, 'pagos'), where('partnerCodigo', '==', miCodigo));
    const snap = await getDocs(q);

    if (snap.empty) {
      cont.innerHTML = '<p style="text-align:center;color:#666;">Sin comisiones aún</p>';
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
        <p>${data.personas} personas · $${comision.toFixed(2)} USD</p>
        <p style="color:#666; font-size:0.85rem;">${data.estado}</p>
      `;
      cont.appendChild(div);
    });

    const totalDiv = document.createElement('div');
    totalDiv.className = 'card';
    totalDiv.style.cssText = 'background:#FFF3CD; border-left:4px solid #FFD700;';
    totalDiv.innerHTML = `<h3 style="color:#722F37;">Total acumulado: $${total.toFixed(2)} USD</h3>`;
    cont.insertBefore(totalDiv, cont.firstChild);
  } catch (err) {
    cont.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

loadStats();
loadComisiones();
