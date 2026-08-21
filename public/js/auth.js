import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, t } from './utils.js';

const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const errorDivLogin = document.getElementById('login-error');
const errorDivRegister = document.getElementById('register-error');

btnLogin?.addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  errorDivLogin.textContent = '';
  btnLogin.disabled = true;
  btnLogin.textContent = '...';

  try {
    if (!email || !password) {
      errorDivLogin.textContent = t('error-empty-fields');
      throw new Error('Faltan datos');
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, 'usuarios', user.uid));

    if (!userDoc.exists()) {
      errorDivLogin.textContent = t('error-user-not-found');
      await auth.signOut();
      throw new Error('Usuario no encontrado');
    }

    const userData = userDoc.data();

    if (userData.activo === false) {
      errorDivLogin.textContent = t('error-account-deactivated');
      await auth.signOut();
      throw new Error('Cuenta inactiva');
    }

    sessionStorage.setItem('userId', user.uid);
    sessionStorage.setItem('userEmail', userData.email);
    sessionStorage.setItem('userName', `${userData.nombre} ${userData.apellido || ''}`);
    sessionStorage.setItem('userRole', userData.role);
    sessionStorage.setItem('userCodigo', userData.codigo || '');
    sessionStorage.setItem('userEmbajadorCodigo', userData.embajadorCodigo || '');

    let destino = '/pages/cliente.html';
    if (userData.role === 'fundador' || userData.role === 'admin') destino = '/pages/admin.html';
    else if (userData.role === 'restaurante') destino = '/pages/restaurante.html';
    else if (userData.role === 'partner') destino = '/pages/partner.html';
    else if (userData.role === 'embajador') destino = '/pages/embajador.html';

    window.location.href = destino;

  } catch (error) {
    console.error('Error login:', error);
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      errorDivLogin.textContent = t('error-wrong-password');
    } else if (error.code === 'auth/user-not-found') {
      errorDivLogin.textContent = t('error-user-not-found');
    } else if (error.code === 'auth/too-many-requests') {
      errorDivLogin.textContent = 'Demasiados intentos. Intentá más tarde.';
    }
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = t('btn-login');
  }
});

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
      errorDivRegister.textContent = t('error-empty-fields');
      throw new Error('Faltan datos');
    }

    if (password.length < 6) {
      errorDivRegister.textContent = t('error-weak-password');
      throw new Error('Contraseña débil');
    }

    const codigo = role === 'embajador' 
      ? (codigoEmbajador || 'EMB-' + Math.random().toString(36).substring(2, 6).toUpperCase())
      : null;

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const urlParams = new URLSearchParams(window.location.search);
    const partnerCodigo = urlParams.get('partner') || sessionStorage.getItem('lastPartner') || null;
    const embajadorCodigo = urlParams.get('embajador') || sessionStorage.getItem('lastEmbajador') || null;
    
    if (partnerCodigo) sessionStorage.setItem('lastPartner', partnerCodigo);
    if (embajadorCodigo) sessionStorage.setItem('lastEmbajador', embajadorCodigo);

    await setDoc(doc(db, 'usuarios', user.uid), {
      nombre,
      apellido,
      email,
      role,
      codigo,
      embajadorCodigo: codigoEmbajador || embajadorCodigo || null,
      partnerReferido: partnerCodigo || null,
      embajadorReferido: embajadorCodigo || null,
      activo: true,
      aprobado: role === 'restaurante' ? false : true,
      createdAt: serverTimestamp()
    });

    sessionStorage.setItem('userId', user.uid);
    sessionStorage.setItem('userEmail', email);
    sessionStorage.setItem('userName', `${nombre} ${apellido}`);
    sessionStorage.setItem('userRole', role);
    sessionStorage.setItem('userCodigo', codigo || '');
    sessionStorage.setItem('userEmbajadorCodigo', codigoEmbajador || embajadorCodigo || '');

    let destino = '/pages/cliente.html';
    if (role === 'restaurante') destino = '/pages/restaurante.html';
    else if (role === 'embajador') destino = '/pages/embajador.html';

    window.location.href = destino;

  } catch (error) {
    console.error('Error registro:', error);
    if (error.code === 'auth/email-already-in-use') {
      errorDivRegister.textContent = t('error-email-exists');
    } else if (error.code === 'auth/invalid-email') {
      errorDivRegister.textContent = t('error-invalid-email');
    } else if (error.code === 'auth/weak-password') {
      errorDivRegister.textContent = t('error-weak-password');
    }
  } finally {
    btnRegister.disabled = false;
    btnRegister.textContent = t('btn-register');
  }
});

auth.onAuthStateChanged((user) => {
  if (user && window.location.pathname === '/index.html') {
    const role = sessionStorage.getItem('userRole');
    if (role) {
      let destino = '/pages/cliente.html';
      if (role === 'fundador' || role === 'admin') destino = '/pages/admin.html';
      else if (role === 'restaurante') destino = '/pages/restaurante.html';
      else if (role === 'partner') destino = '/pages/partner.html';
      else if (role === 'embajador') destino = '/pages/embajador.html';
      window.location.href = destino;
    }
  }
});