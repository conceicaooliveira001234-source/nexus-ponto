import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDSRabB61Nj_yBabfMufcgoclSrcVdN6BU",
  authDomain: "app-ponto-ed97f.firebaseapp.com",
  projectId: "app-ponto-ed97f",
  storageBucket: "app-ponto-ed97f.firebasestorage.app",
  messagingSenderId: "1040347094352",
  appId: "1:1040347094352:web:eb3318f023c7f56145e055"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);