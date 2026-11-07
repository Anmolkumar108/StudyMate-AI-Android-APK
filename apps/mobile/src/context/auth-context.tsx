import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { authApi } from '../services/api/client';
import { promptGoogleSignIn, signInWithGoogleDirect } from '../services/google-auth';
import { clearTokens, getRefreshToken, hasTokens } from '../services/storage/token-storage';
import {
  AuthStatus,
  LoginRequest,
  OtpResponse,
  RegisterRequest,
  ResetPasswordOtpRequest,
  ResetPasswordRequest,
  UserResponse,
  VerificationResponse,
} from '../types/auth';

interface AuthContextValue {
  status: AuthStatus;
  user: UserResponse | null;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  loginWithGoogle: () => Promise<boolean>;
  loginWithGoogleEmail: (email: string) => Promise<boolean>;
  register: (payload: RegisterRequest) => Promise<UserResponse>;
  verifyEmail: (token: string) => Promise<VerificationResponse>;
  resendVerification: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  requestPasswordResetOtp: (email: string) => Promise<OtpResponse>;
  resetPasswordWithOtp: (payload: ResetPasswordOtpRequest) => Promise<void>;
  resetPassword: (payload: ResetPasswordRequest) => Promise<void>;
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

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await promptGoogleSignIn();
      if (result.cancelled) {
        setIsLoading(false);
        return false;
      }
      if (!result.success) {
        throw new Error(result.error || 'Google authentication failed.');
      }

      const profile = await authApi.getMe();
      if (profile.status === 'suspended') {
        await clearTokens();
        setStatus('unauthenticated');
        setUser(null);
        throw new Error('Account is suspended. Please contact support.');
      }

      setUser(profile);
      setStatus('authenticated');
      return true;
    } catch (err) {
      const message = (err as Error).message || 'Google Sign-In failed.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogleEmail = useCallback(async (email: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogleDirect(email);
      if (!result.success) {
        throw new Error(result.error || 'Google authentication failed.');
      }

      const profile = await authApi.getMe();
      if (profile.status === 'suspended') {
        await clearTokens();
        setStatus('unauthenticated');
        setUser(null);
        throw new Error('Account is suspended. Please contact support.');
      }

      setUser(profile);
      setStatus('authenticated');
      return true;
    } catch (err) {
      const message = (err as Error).message || 'Google Sign-In failed.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (payload: RegisterRequest): Promise<UserResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const newUser = await authApi.register(payload, true);
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

  const verifyEmail = useCallback(async (token: string): Promise<VerificationResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.verifyEmail(token);
      return res;
    } catch (err) {
      const message = (err as Error).message || 'Email verification failed.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resendVerification = useCallback(async (email: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.resendVerification(email);
    } catch (err) {
      const message = (err as Error).message || 'Unable to resend verification email.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(email);
    } catch (err) {
      const message = (err as Error).message || 'Unable to request password reset.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestPasswordResetOtp = useCallback(async (email: string): Promise<OtpResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.requestPasswordResetOtp(email);
      return res;
    } catch (err) {
      const message = (err as Error).message || 'Unable to send verification code.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPasswordWithOtp = useCallback(
    async (payload: ResetPasswordOtpRequest): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await authApi.resetPasswordWithOtp(payload);
      } catch (err) {
        const message = (err as Error).message || 'Invalid or expired verification code.';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const resetPassword = useCallback(async (payload: ResetPasswordRequest): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.resetPassword(payload);
    } catch (err) {
      const message = (err as Error).message || 'Password reset failed.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      loginWithGoogle,
      loginWithGoogleEmail,
      register,
      verifyEmail,
      resendVerification,
      forgotPassword,
      requestPasswordResetOtp,
      resetPasswordWithOtp,
      resetPassword,
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
      loginWithGoogle,
      loginWithGoogleEmail,
      register,
      verifyEmail,
      resendVerification,
      forgotPassword,
      requestPasswordResetOtp,
      resetPasswordWithOtp,
      resetPassword,
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
