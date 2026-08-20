// Utilidades y Multi-idioma - Sabores Costeros

// ========== SISTEMA DE TRADUCCIONES ==========
const traducciones = {
  es: {
    appName: 'Sabores Costeros',
    login: 'Iniciar Sesión',
    email: 'Email',
    password: 'Contraseña',
    nombre: 'Nombre',
    apellido: 'Apellido',
    registrarse: 'Registrarse',
    noTienesCuenta: '¿No tenés cuenta?',
    yaTienesCuenta: '¿Ya tenés cuenta?',
    bienvenida: 'Bienvenido',
    salir: 'Salir',
    reservar: 'Reservar Mesa',
    codigoReserva: 'Tu código de reserva',
    presentarCodigo: 'Presentá este código al llegar',
    validarCodigo: 'Validar código',
    sorteo: '¡Participá del sorteo!',
    sorteoDesc: 'Validá tu código y ganá una cena gratis',
    reseña: 'Dejá tu reseña',
    restaurantes: 'Restaurantes',
    cerca: 'Cerca de vos',
    reservarMesa: 'Reservar mesa',
    personas: 'personas',
    fecha: 'Fecha',
    hora: 'Hora',
    confirmar: 'Confirmar',
    cancelar: 'Cancelar',
    guardar: 'Guardar',
    eliminar: 'Eliminar',
    editar: 'Editar',
    busqueda: 'Buscar...',
    filtro: 'Filtrar',
    todos: 'Todos',
    abierto: 'Abierto',
    cerrado: 'Cerrado',
    reservas: 'Reservas',
    misReservas: 'Mis reservas',
    perfil: 'Mi perfil',
    idioma: 'Idioma',
    español: 'Español',
    portugues: 'Português',
    ingles: 'English'
  },
  pt: {
    appName: 'Sabores Costeros',
    login: 'Entrar',
    email: 'Email',
    password: 'Senha',
    nombre: 'Nome',
    apellido: 'Sobrenome',
    registrarse: 'Cadastrar',
    noTienesCuenta: 'Não tem conta?',
    yaTienesCuenta: 'Já tem conta?',
    bienvenida: 'Bem-vindo',
    salir: 'Sair',
    reservar: 'Reservar Mesa',
    codigoReserva: 'Seu código de reserva',
    presentarCodigo: 'Apresente este código ao chegar',
    validarCodigo: 'Validar código',
    sorteo: 'Participe do sorteio!',
    sorteoDesc: 'Valide seu código e ganhe um jantar grátis',
    reseña: 'Deixe sua avaliação',
    restaurantes: 'Restaurantes',
    cerca: 'Perto de você',
    reservarMesa: 'Reservar mesa',
    personas: 'pessoas',
    fecha: 'Data',
    hora: 'Hora',
    confirmar: 'Confirmar',
    cancelar: 'Cancelar',
    guardar: 'Salvar',
    eliminar: 'Excluir',
    editar: 'Editar',
    busqueda: 'Buscar...',
    filtro: 'Filtrar',
    todos: 'Todos',
    abierto: 'Aberto',
    cerrado: 'Fechado',
    reservas: 'Reservas',
    misReservas: 'Minhas reservas',
    perfil: 'Meu perfil',
    idioma: 'Idioma',
    español: 'Español',
    portugues: 'Português',
    ingles: 'English'
  },
  en: {
    appName: 'Sabores Costeros',
    login: 'Sign In',
    email: 'Email',
    password: 'Password',
    nombre: 'First Name',
    apellido: 'Last Name',
    registrarse: 'Sign Up',
    noTienesCuenta: "Don't have an account?",
    yaTienesCuenta: 'Already have an account?',
    bienvenida: 'Welcome',
    salir: 'Logout',
    reservar: 'Book a Table',
    codigoReserva: 'Your booking code',
    presentarCodigo: 'Present this code upon arrival',
    validarCodigo: 'Validate code',
    sorteo: 'Join the raffle!',
    sorteoDesc: 'Validate your code and win a free dinner',
    reseña: 'Leave your review',
    restaurantes: 'Restaurants',
    cerca: 'Near you',
    reservarMesa: 'Book a table',
    personas: 'people',
    fecha: 'Date',
    hora: 'Time',
    confirmar: 'Confirm',
    cancelar: 'Cancel',
    guardar: 'Save',
    eliminar: 'Delete',
    editar: 'Edit',
    busqueda: 'Search...',
    filtro: 'Filter',
    todos: 'All',
    abierto: 'Open',
    cerrado: 'Closed',
    reservas: 'Reservations',
    misReservas: 'My reservations',
    perfil: 'My profile',
    idioma: 'Language',
    español: 'Español',
    portugues: 'Português',
    ingles: 'English'
  }
};

let idiomaActual = sessionStorage.getItem('idioma') || 'es';

export function t(clave) {
  return traducciones[idiomaActual][clave] || clave;
}

export function cambiarIdioma(nuevoIdioma) {
  idiomaActual = nuevoIdioma;
  sessionStorage.setItem('idioma', nuevoIdioma);
  location.reload();
}

export function getIdiomaActual() {
  return idiomaActual;
}

// ========== UTILIDADES ==========
export function showAlert(message, type = 'info') {
  const colors = {
    success: '#28A745',
    danger: '#DC3545',
    warning: '#FFC107',
    info: '#17A2B8'
  };

  const div = document.createElement('div');
  div.style.cssText = `
    position:fixed;top:20px;right:20px;z-index:9999;
    padding:15px 25px;border-radius:8px;color:white;
    font-weight:600;background:${colors[type] || colors.info};
    box-shadow:0 4px 15px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `;
  div.textContent = message;
  document.body.appendChild(div);

  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, 4000);
}

export function generarCodigoReserva() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = 'SC-';
  for (let i = 0; i < 4; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return codigo;
}

export function formatDate(timestamp) {
  if (!timestamp) return '—';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

// CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;
document.head.appendChild(style);
