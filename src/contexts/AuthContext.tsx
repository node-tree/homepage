import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 저장된 JWT 의 만료(exp)를 로컬에서 판정한다(네트워크 호출 없음).
//   · 서버 토큰 수명은 7일(auth.js expiresIn:'7d'). 만료된 토큰이 localStorage 에 남아 있으면
//     isAuthenticated 가 계속 true 라 헤더는 로그인 상태로 보이고, /login 은 "이미 로그인됨"으로
//     판단해 홈으로 튕겨낸다 → 재로그인 불가 루프(이미지호스팅 클릭 시 본페이지 복귀의 원인).
//   · 파싱 실패(형식 이상)는 만료로 단정하지 않는다 — 최종 판정은 서버 401 이 한다.
export function isJwtExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const json = JSON.parse(
      decodeURIComponent(
        atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    );
    if (typeof json.exp !== 'number') return false;
    return json.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

// 죽은 사이트 세션(만료·무효 토큰)을 지운다. 서버가 401 을 준 시점에도 호출한다.
export function clearSiteAuthStorage(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 로그아웃
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }, []);

  // 로컬 스토리지에서 토큰 로드
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const savedToken = localStorage.getItem('auth_token');
        const savedUser = localStorage.getItem('auth_user');
        
        if (savedToken && savedUser) {
          // 만료된 토큰이면 복원하지 않고 정리 — 로그인 UI/가드가 실제 상태와 어긋나지 않게 한다.
          if (isJwtExpired(savedToken)) {
            clearSiteAuthStorage();
          } else {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
          }
        }
      } catch (error) {
        console.error('인증 정보 로드 오류:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    loadAuth();
  }, [logout]);

  // 로그인
  const login = (token: string, user: User) => {
    setToken(token);
    setUser(user);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!user && !!token,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 