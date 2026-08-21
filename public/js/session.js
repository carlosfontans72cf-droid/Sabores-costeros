import { auth, db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function verificarSesion() {
  await new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(user => {
      unsub();
      resolve(user);
    });
  });

  const user = auth.currentUser;
  
  if (!user) {
    sessionStorage.clear();
    window.location.href = '/index.html';
    return false;
  }
  
  const role = sessionStorage.getItem('userRole');
  
  if (!role) {
    try {
      const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
      if (!userDoc.exists()) {
        sessionStorage.clear();
        await auth.signOut();
        window.location.href = '/index.html';
        return false;
      }
      
      const userData = userDoc.data();
      sessionStorage.setItem('userId', user.uid);
      sessionStorage.setItem('userEmail', userData.email);
      sessionStorage.setItem('userName', `${userData.nombre} ${userData.apellido || ''}`);
      sessionStorage.setItem('userRole', userData.role);
      sessionStorage.setItem('userCodigo', userData.codigo || '');
      sessionStorage.setItem('userEmbajadorCodigo', userData.embajadorCodigo || '');
      
      if (userData.activo === false) {
        sessionStorage.clear();
        await auth.signOut();
        window.location.href = '/index.html';
        return false;
      }
      
      actualizarUserInfo();
      
      const paginaActual = window.location.pathname;
      const paginaCorrecta = getPaginaParaRol(userData.role);
      
      if (paginaActual !== paginaCorrecta) {
        window.location.href = paginaCorrecta;
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error verificando sesión:', err);
      sessionStorage.clear();
      window.location.href = '/index.html';
      return false;
    }
  }
  
  actualizarUserInfo();
  
  const paginaActual = window.location.pathname;
  const paginaCorrecta = getPaginaParaRol(role);
  
  if (paginaActual !== paginaCorrecta) {
    window.location.href = paginaCorrecta;
    return false;
  }
  
  return true;
}

function actualizarUserInfo() {
  const userName = sessionStorage.getItem('userName');
  const userInfoEl = document.getElementById('user-info');
  if (userInfoEl && userName) {
    userInfoEl.textContent = userName;
  }
}

function getPaginaParaRol(role) {
  switch (role) {
    case 'fundador':
    case 'admin':
      return '/pages/admin.html';
    case 'restaurante':
      return '/pages/restaurante.html';
    case 'partner':
      return '/pages/partner.html';
    case 'embajador':
      return '/pages/embajador.html';
    default:
      return '/pages/cliente.html';
  }
}

verificarSesion();