import React, { createContext, useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";

export const UserContext = createContext<{ user: User | null, authChecked: boolean }>({ user: null, authChecked: false });

export const UserProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);
  // return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
  return <UserContext.Provider value={{ user, authChecked }}>{children}</UserContext.Provider>;
};

