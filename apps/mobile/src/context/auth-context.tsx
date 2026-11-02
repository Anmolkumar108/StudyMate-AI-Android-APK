import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { authApi } from '../services/api/client';
import { clearTokens, getRefreshToken, hasTokens } from '../services/storage/token-storage';
import {
  AuthStatus,
  LoginRequest,
  RegisterRequest,
  UserResponse,
} from '../types/auth';

interface AuthContextValue {
  status: AuthStatus;
  user: UserResponse | null;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<UserResponse>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const tokensExist = await hasTokens();
      if (!tokensExist) {
        setStatus('unauthenticated');
        setUser(null);
        return;
      }

      const profile = await authApi.getMe();
      if (profile.status === 'suspended') {
        await clearTokens();
        setStatus('unauthenticated');
        setUser(null);
        setError('Your account is suspended. Please contact support.');
        return;
      }

      if (profile.status === 'pending_verification') {
        setUser(profile);
        setStatus('pending_verification');
        return;
      }

      setUser(profile);
      setStatus('authenticated');
    } catch {
      await clearTokens();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      await restoreSession();
      if (isMounted) {
        setIsLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [restoreSession]);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      setIsLoading(true);
      setError(null);
      try {
        await authApi.login(credentials);
        const profile = await authApi.getMe();

        if (profile.status === 'suspended') {
          await clearTokens();
          setStatus('unauthenticated');
          setUser(null);
          throw new Error('Account is suspended. Please contact support.');
        }

        if (profile.status === 'pending_verification') {
          setUser(profile);
          setStatus('pending_verification');
          return;
        }

        setUser(profile);
        setStatus('authenticated');
      } catch (err) {
        const message = (err as Error).message || 'Failed to log in.';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const register = useCallback(
    async (payload: RegisterRequest): Promise<UserResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const newUser = await authApi.register(payload);
        return newUser;
      } catch (err) {
        const message = (err as Error).message || 'Registration failed.';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        try {
          await authApi.logout(refreshToken);
        } catch {
          // Failure on remote logout should not block local session teardown
        }
      }
    } finally {
      await clearTokens();
      setUser(null);
      setStatus('unauthenticated');
      setError(null);
      setIsLoading(false);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await authApi.logoutAll();
    } catch {
      // Proceed with local logout regardless of remote response
    } finally {
      await clearTokens();
      setUser(null);
      setStatus('unauthenticated');
      setError(null);
      setIsLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await authApi.getMe();
      setUser(profile);
      if (profile.status === 'active') {
        setStatus('authenticated');
      } else if (profile.status === 'pending_verification') {
        setStatus('pending_verification');
      }
    } catch (err) {
      console.error('Failed to refresh profile:', (err as Error).message);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isLoading,
      error,
      login,
      register,
      logout,
      logoutAll,
      refreshProfile,
      clearError,
    }),
    [
      status,
      user,
      isLoading,
      error,
      login,
      register,
      logout,
      logoutAll,
      refreshProfile,
      clearError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
