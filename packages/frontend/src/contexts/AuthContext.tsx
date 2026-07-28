import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../services/api';
import { AuthUser } from '../types';
import { connectSocket, disconnectSocket, onSessionClosed, offSessionClosed } from '../services/socket.service';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string, twoFactorToken?: string) => Promise<any>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authApi.getProfile()
        .then((res) => {
          setUser(res.data);
          connectSocket(token);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      const handleSessionClosed = (data: any) => {
        alert(data.message || 'Tu sesión ha sido cerrada');
        logout();
      };

      onSessionClosed(handleSessionClosed);

      return () => {
        offSessionClosed(handleSessionClosed);
      };
    }
  }, [token]);

  const login = async (username: string, password: string, twoFactorToken?: string) => {
    const res = await authApi.login(username, password, twoFactorToken);
    if (res.data.requires2FA) {
      return { requires2FA: true, userId: res.data.userId };
    }
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    connectSocket(res.data.token);
    return { requires2FA: false };
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    disconnectSocket();
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
