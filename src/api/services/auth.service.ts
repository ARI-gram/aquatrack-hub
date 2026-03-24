/**
 * Authentication Service
 * Handles all authentication-related API calls
 */
// /src/api/services/auth.service.ts
import axiosInstance from '../axios.config';
import { API_ENDPOINTS } from '../endpoints';
import { LoginCredentials, User } from '@/types/auth.types';

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Raw shape returned by the Django backend */
interface BackendLoginResponse {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    phone: string | null;
    role: string;
    client: string | null;
    is_active: boolean;
    is_verified: boolean;
    created_at: string;
    updated_at?: string;
    last_login: string | null;
    avatar?: string;
  };
  tokens: {
    access: string;
    refresh: string;
  };
}

/**
 * Authentication service methods
 */
export const authService = {
  /**
   * Login user with email and password.
   * Maps the backend snake_case / nested-tokens response to the
   * camelCase flat shape the rest of the frontend expects.
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await axiosInstance.post<BackendLoginResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials
    );

    const { user: backendUser, tokens } = response.data;

    const user: User = {
      id: backendUser.id,
      email: backendUser.email,
      firstName: backendUser.first_name,
      lastName: backendUser.last_name,
      role: backendUser.role as User['role'],
      avatar: backendUser.avatar,
      clientId: backendUser.client ?? undefined,
      createdAt: backendUser.created_at,
      updatedAt: backendUser.updated_at ?? backendUser.created_at,
    };

    return {
      user,
      token: tokens.access,
      refreshToken: tokens.refresh,
    };
  },

  /**
   * Logout current user.
   * Sends the stored refresh token so the backend can blacklist it.
   */
  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('aquatrack_refresh_token');
    await axiosInstance.post(API_ENDPOINTS.AUTH.LOGOUT, {
      refresh: refreshToken,
    });
  },

  /**
   * Refresh access token using a refresh token.
   * SimpleJWT returns { access: "..." } — we normalise to { token: "..." }.
   */
  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    const response = await axiosInstance.post<{ access: string }>(
      API_ENDPOINTS.AUTH.REFRESH_TOKEN,
      { refresh: refreshToken }   // SimpleJWT expects the key "refresh"
    );
    return { token: response.data.access };
  },

  /**
   * Request password reset email
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string }> {
    const response = await axiosInstance.post<{ message: string }>(
      API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
      data
    );
    return response.data;
  },

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    const response = await axiosInstance.post<{ message: string }>(
      API_ENDPOINTS.AUTH.RESET_PASSWORD,
      data
    );
    return response.data;
  },

  /**
   * Change current user's password
   */
  async changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
    const response = await axiosInstance.post<{ message: string }>(
      API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
      {
        old_password: data.currentPassword,       // map to Django field names
        new_password: data.newPassword,
        new_password_confirm: data.confirmPassword,
      }
    );
    return response.data;
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await axiosInstance.post<{ message: string }>(
      API_ENDPOINTS.AUTH.VERIFY_EMAIL,
      { token }
    );
    return response.data;
  },

  /**
   * Get current user profile.
   * Maps snake_case backend fields to the camelCase User type.
   */
  async getCurrentUser(): Promise<User> {
    const response = await axiosInstance.get<BackendLoginResponse['user']>(
      API_ENDPOINTS.USERS.PROFILE
    );

    const u = response.data;
    return {
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role as User['role'],
      avatar: u.avatar,
      clientId: u.client ?? undefined,
      createdAt: u.created_at,
      updatedAt: u.updated_at ?? u.created_at,
    };
  },
};

export default authService;