'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { RobotProfile } from './robot-profile';

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
  const [selectedRobot, setSelectedRobotState] = useState<RobotProfile | null>(null);
  const [ingestedRepoUrl, setIngestedRepoUrlState] = useState<string>('');

  useEffect(() => {
    // Restore User
    const savedUser = localStorage.getItem('upfreq_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }

    // Restore Selected Robot Profile across page navigations & refreshes
    const savedRobot = localStorage.getItem('upfreq_selected_robot');
    if (savedRobot) {
      try {
        setSelectedRobotState(JSON.parse(savedRobot));
      } catch (e) {}
    }

    // Restore Ingested Repo URL
    const savedUrl = localStorage.getItem('upfreq_ingested_repo_url');
    if (savedUrl) {
      setIngestedRepoUrlState(savedUrl);
    }
  }, []);

  const setSelectedRobot = (robot: RobotProfile | null) => {
    setSelectedRobotState(robot);
    if (robot) {
      localStorage.setItem('upfreq_selected_robot', JSON.stringify(robot));
    } else {
      localStorage.removeItem('upfreq_selected_robot');
    }
  };

  const setIngestedRepoUrl = (url: string) => {
    setIngestedRepoUrlState(url);
    if (url) {
      localStorage.setItem('upfreq_ingested_repo_url', url);
    } else {
      localStorage.removeItem('upfreq_ingested_repo_url');
    }
  };

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
    setSelectedRobotState(null);
    setIngestedRepoUrlState('');
    localStorage.removeItem('upfreq_user');
    localStorage.removeItem('upfreq_selected_robot');
    localStorage.removeItem('upfreq_ingested_repo_url');
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
