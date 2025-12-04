'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  login as apiLogin,
  register as apiRegister,
  getCurrentUser,
  storeTokens,
  clearTokens,
  isAuthenticated,
  LoginInput,
  RegisterInput,
  AuthResponse,
} from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already authenticated
    if (isAuthenticated()) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const refreshUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      clearTokens();
      setUser(null);
    }
  };

  const login = async (input: LoginInput) => {
    const response = await apiLogin(input);
    if (response.tokens) {
      storeTokens(response.tokens.accessToken, response.tokens.refreshToken);
      // Refresh to get full user with tenant object
      await refreshUser();
      // Get tenantType from refreshed user
      const updatedUser = await getCurrentUser().catch(() => null);
      
      // Check if super admin
      if (response.user.role === 'super_admin' || updatedUser?.role === 'super_admin') {
        router.push('/admin/dashboard');
        return;
      }
      
      const tenantType = (updatedUser as any)?.tenant?.type || (response.user as any)?.tenantType || 'supplier';
      router.push(getDashboardPath(tenantType));
    }
  };

  const register = async (input: RegisterInput) => {
    const response = await apiRegister(input);
    
    // Check if registration was successful but pending (no tokens)
    // Type guard: check if response has tokens property and it's defined
    if (!('tokens' in response) || !response.tokens) {
      // Registration successful but pending approval - redirect to login with message
      router.push('/auth/login?pending=true');
      return;
    }
    
    // Type guard: now we know it's AuthResponse with tokens (already checked above)
    const authResponse = response as AuthResponse & { tokens: { accessToken: string; refreshToken: string } };
    
    // If tokens are provided (active registration), store them and proceed
    storeTokens(authResponse.tokens.accessToken, authResponse.tokens.refreshToken);
    // Refresh to get full user with tenant object
    await refreshUser();
    // Get tenantType from refreshed user
    const updatedUser = await getCurrentUser().catch(() => null);
    
    // Check if super admin
    if (authResponse.user.role === 'super_admin' || updatedUser?.role === 'super_admin') {
      router.push('/admin/dashboard');
      return;
    }
    
    const tenantType = (updatedUser as any)?.tenant?.type || (authResponse.user as any)?.tenantType || 'supplier';
    router.push(getDashboardPath(tenantType));
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    router.push('/auth/login');
  };

  function getDashboardPath(tenantType: string): string {
    if (tenantType === 'system') {
      return '/admin/dashboard';
    }
    return tenantType === 'supplier' ? '/supplier/dashboard' : '/company/dashboard';
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

