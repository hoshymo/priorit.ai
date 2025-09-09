import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// const firebaseConfig = {
//   apiKey: "AIzaSyBadQ0iACXOxu758wG12DmJLNrb6jIIW0M",
//   authDomain: "hoshymo.firebaseapp.com",
//   projectId: "hoshymo",
//   storageBucket: "hoshymo.firebasestorage.app",
//   messagingSenderId: "1064199407438",
//   appId: "1:1064199407438:web:8c0e48e23bbaaee454c01f",
//   measurementId: "G-XV4XCYXMHM"
// };

const firebaseConfig = {
  apiKey: "AIzaSyCJ7V4SrHuFB820s5ZyUiABJFfwIV0IEhg",
  authDomain: "gemini-task-f9557.firebaseapp.com",
  projectId: "gemini-task-f9557",
  storageBucket: "gemini-task-f9557.firebasestorage.app",
  messagingSenderId: "751147111145",
  appId: "1:751147111145:web:7281711c238fb2ae171678",
  measurementId: "G-CHPHCPLTFB"
};



const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);