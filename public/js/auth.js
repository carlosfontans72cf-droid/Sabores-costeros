// Sistema de autenticación - Sabores Costeros
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert } from './utils.js';

const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const errorDivLogin = document.getElementById('login-error');
const errorDivRegister = document.getElementById('register-error');

// ========== LOGIN ==========
btnLogin?.addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  errorDivLogin.textContent = '';
  btnLogin.disabled = true;
  btnLogin.textContent = '...';

  try {
    if (!email || !password) {
      errorDivLogin.textContent = 'Completá todos los campos';
      throw new Error('Faltan datos');
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, 'usuarios', user.uid));

    if (!userDoc.exists()) {
      errorDivLogin.textContent = 'Usuario no registrado';
      await auth.signOut();
      throw new Error('Usuario no encontrado');
    }

    const userData = userDoc.data();

    if (userData.activo === false) {
      errorDivLogin.textContent = 'Cuenta desactivada';
      await auth.signOut();
      throw new Error('Cuenta inactiva');
    }

    // Guardar sesión
    sessionStorage.setItem('userId', user.uid);
    sessionStorage.setItem('userEmail', userData.email);
    sessionStorage.setItem('userName', `${userData.nombre} ${userData.apellido}`);
    sessionStorage.setItem('userRole', userData.role);
    sessionStorage.setItem('userCodigo', userData.codigo || '');
    sessionStorage.setItem('userEmbajadorCodigo', userData.embajadorCodigo || '');

    // Redirección según rol
    let destino = '/pages/cliente.html';
    if (userData.role === 'fundador' || userData.role === 'admin') destino = '/pages/admin.html';
    else if (userData.role === 'restaurante') destino = '/pages/restaurante.html';
    else if (userData.role === 'partner') destino = '/pages/partner.html';
    else if (userData.role === 'embajador') destino = '/pages/embajador.html';

    window.location.href = destino;

  } catch (error) {
    console.error('Error login:', error);
    if (error.code === 'auth/invalid-credential') {
      errorDivLogin.textContent = 'Email o contraseña incorrectos';
    } else if (error.code === 'auth/user-not-found') {
      errorDivLogin.textContent = 'No existe cuenta con ese email';
    } else if (error.code === 'auth/wrong-password') {
      errorDivLogin.textContent = 'Contraseña incorrecta';
    }
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = 'Iniciar Sesión';
  }
});

// ========== REGISTRO ==========
btnRegister?.addEventListener('click', async () => {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const apellido = document.getElementById('reg-apellido').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;
  const codigoEmbajador = document.getElementById('reg-codigo-embajador').value.trim();

  errorDivRegister.textContent = '';
  btnRegister.disabled = true;
  btnRegister.textContent = '...';

  try {
    if (!nombre || !apellido || !email || !password) {
      errorDivRegister.textContent = 'Completá todos los campos';
      throw new Error('Faltan datos');
    }

    if (password.length < 6) {
      errorDivRegister.textContent = 'Contraseña mínimo 6 caracteres';
      throw new Error('Contraseña débil');
    }

    // Generar código único
    const codigo = role === 'embajador' 
      ? (codigoEmbajador || 'EMB-' + Math.random().toString(36).substring(2, 6).toUpperCase())
      : null;

    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Guardar datos en Firestore
    await setDoc(doc(db, 'usuarios', user.uid), {
      nombre,
      apellido,
      email,
      role,
      codigo,
      embajadorCodigo: codigoEmbajador || null,
      activo: true,
      aprobado: role === 'restaurante' ? false : true,
      createdAt: serverTimestamp()
    });

    // Redirección
    let destino = '/pages/cliente.html';
    if (role === 'restaurante') destino = '/pages/restaurante.html';
    else if (role === 'embajador') destino = '/pages/embajador.html';

    window.location.href = destino;

  } catch (error) {
    console.error('Error registro:', error);
    if (error.code === 'auth/email-already-in-use') {
      errorDivRegister.textContent = 'Email ya registrado';
    } else if (error.code === 'auth/invalid-email') {
      errorDivRegister.textContent = 'Email inválido';
    } else if (error.code === 'auth/weak-password') {
      errorDivRegister.textContent = 'Contraseña muy débil';
    }
  } finally {
    btnRegister.disabled = false;
    btnRegister.textContent = 'Crear cuenta';
  }
});

// Verificar sesión activa
auth.onAuthStateChanged((user) => {
  if (user) {
    const role = sessionStorage.getItem('userRole');
    if (role === 'fundador' || role === 'admin') window.location.href = '/pages/admin.html';
    else if (role === 'restaurante') window.location.href = '/pages/restaurante.html';
    else if (role === 'partner') window.location.href = '/pages/partner.html';
    else if (role === 'embajador') window.location.href = '/pages/embajador.html';
    else if (role === 'cliente') window.location.href = '/pages/cliente.html';
  }
});
