import React, { createContext, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User, signOut as fbSignOut } from "firebase/auth";

export const UserContext = createContext<{
  user: User | null,
  authChecked: boolean,
  signOut: () => Promise<void>;
}>({
  user: null,
  authChecked: false,
  signOut: async () => {},
});

export const UserProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const auth = getAuth();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Sign-out error:", error);
    }
  };

  return (
    <UserContext.Provider value={{ user, authChecked, signOut }}>
      {children}
    </UserContext.Provider>
  );
};

