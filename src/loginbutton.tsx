import React from 'react';
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

export const LoginButton: React.FC = () => (
  <button onClick={async () => {
    await signInWithPopup(auth, googleProvider);
  }}>
    Googleでログイン
  </button>
);