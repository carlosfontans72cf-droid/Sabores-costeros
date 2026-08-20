// Configuración de Firebase - Sabores Costeros
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJVKFY4fmQ5XGh1W1SsBg0KNlboTd0ceg",
  authDomain: "sabores-costeros.firebaseapp.com",
  projectId: "sabores-costeros",
  storageBucket: "sabores-costeros.firebasestorage.app",
  messagingSenderId: "391421444669",
  appId: "1:391421444669:web:8937a00cf25266d2bf2054"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

auth.setPersistence(browserLocalPersistence).catch(() => {});
