// Gestor de Sesión - Se importa en todas las páginas protegidas
import { auth, db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function verificarSesion() {
  // Esperar a que Firebase Auth se inicialice
  await new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(user => {
      unsub();
      resolve(user);
    });
  });

  const user = auth.currentUser;
  
  if (!user) {
    // No hay sesión de Firebase - ir al login
    sessionStorage.clear();
    window.location.href = '/index.html';
    return false;
  }
  
  const role = sessionStorage.getItem('userRole');
  
  if (!role) {
    // sessionStorage vacío - restaurar desde Firestore
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
      
      // Verificar que el usuario esté activo
      if (userData.activo === false) {
        sessionStorage.clear();
        await auth.signOut();
        window.location.href = '/index.html';
        return false;
      }
      
      // Actualizar user-info en la página
      actualizarUserInfo();
      
      // Verificar que el usuario esté en la página correcta
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
  
  // sessionStorage tiene datos - actualizar user-info
  actualizarUserInfo();
  
  // Verificar que estemos en la página correcta
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

// Ejecutar inmediatamente
verificarSesion();
