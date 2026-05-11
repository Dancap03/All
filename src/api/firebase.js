import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
 
const firebaseConfig = {
  apiKey: "AIzaSyCtfDrJwWbmE7m9OwwHxSJwAiIvkr1GKTU",
  authDomain: "dancaballinone.firebaseapp.com",
  projectId: "dancaballinone",
  storageBucket: "dancaballinone.firebasestorage.app",
  messagingSenderId: "375365819039",
  appId: "1:375365819039:web:b72ff45bfadc8ff9a520aa",
  // measurementId eliminado: evita que Firebase cargue Analytics/moment.js
  // que provoca el warning de updateLocale y puede causar errores de inicializacion
};
 
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
