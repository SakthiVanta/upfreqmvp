'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  username: string;
  name: string;
  email: string;
  avatarUrl: string;
  provider: 'github' | 'credentials';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loginWithGithub: () => void;
  loginWithCredentials: (username: string, password?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  loginWithGithub: () => {},
  loginWithCredentials: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('upfreq_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

  const loginWithGithub = () => {
    const newUser: User = {
      username: 'ekumen-engineer',
      name: 'Ekumen OS Robotics Team',
      email: 'engineering@ekumenlabs.com',
      avatarUrl: 'https://github.com/Ekumen-OS.png',
      provider: 'github',
    };
    setUser(newUser);
    localStorage.setItem('upfreq_user', JSON.stringify(newUser));
  };

  const loginWithCredentials = (username: string, password?: string) => {
    const newUser: User = {
      username: username || 'robotics_lead',
      name: username || 'Robotics Lead Engineer',
      email: `${username || 'engineer'}@upfreq.com`,
      avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${username || 'upfreq'}`,
      provider: 'credentials',
    };
    setUser(newUser);
    localStorage.setItem('upfreq_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('upfreq_user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      loginWithGithub,
      loginWithCredentials,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
