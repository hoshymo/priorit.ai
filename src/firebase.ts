import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBadQ0iACXOxu758wG12DmJLNrb6jIIW0M",
  authDomain: "hoshymo.firebaseapp.com",
  projectId: "hoshymo",
  storageBucket: "hoshymo.firebasestorage.app",
  messagingSenderId: "1064199407438",
  appId: "1:1064199407438:web:8c0e48e23bbaaee454c01f",
  measurementId: "G-XV4XCYXMHM"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.appdata');
export const db = getFirestore(app);