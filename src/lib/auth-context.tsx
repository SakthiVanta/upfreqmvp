'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { RobotProfile } from './andino-data';

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
  activeAnalysis: any | null;
  setActiveAnalysis: (data: any | null) => void;
  selectedRobot: RobotProfile | null;
  setSelectedRobot: (robot: RobotProfile | null) => void;
  ingestedRepoUrl: string;
  setIngestedRepoUrl: (url: string) => void;
  loginWithGithub: () => void;
  loginWithCredentials: (username: string, password?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  activeAnalysis: null,
  setActiveAnalysis: () => {},
  selectedRobot: null,
  setSelectedRobot: () => {},
  ingestedRepoUrl: '',
  setIngestedRepoUrl: () => {},
  loginWithGithub: () => {},
  loginWithCredentials: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<any | null>(null);
  const [selectedRobot, setSelectedRobot] = useState<RobotProfile | null>(null);
  const [ingestedRepoUrl, setIngestedRepoUrl] = useState<string>('');

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
    setActiveAnalysis(null);
    setSelectedRobot(null);
    setIngestedRepoUrl('');
    localStorage.removeItem('upfreq_user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      activeAnalysis,
      setActiveAnalysis,
      selectedRobot,
      setSelectedRobot,
      ingestedRepoUrl,
      setIngestedRepoUrl,
      loginWithGithub,
      loginWithCredentials,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
