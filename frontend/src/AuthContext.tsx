import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  token: string | null;
  username: string | null;
  login: (token: string, username: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUsername = localStorage.getItem('username');
    if (savedToken && savedUsername) {
      setToken(savedToken);
      setUsername(savedUsername);
    }
  }, []);

  const login = (token: string, username: string) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('username', username);
    setToken(token);
    setUsername(username);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
  };

  const value = {
    token,
    username,
    login,
    logout,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};