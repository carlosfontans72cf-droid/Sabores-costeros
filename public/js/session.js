// Gestor de Sesión - Se importa en todas las páginas protegidas
// Verifica la sesión de Firebase y restaura sessionStorage si es necesario
import { auth, db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function verificarSesion() {
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
      
      return true;
    } catch (err) {
      console.error('Error verificando sesión:', err);
      sessionStorage.clear();
      window.location.href = '/index.html';
      return false;
    }
  }
  
  // sessionStorage tiene datos - sesión válida
  return true;
}

// Ejecutar inmediatamente
verificarSesion();
