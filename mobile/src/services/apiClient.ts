import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { AuthResponse, LoginCredentials } from '../types';

// Use environment variable for API URL, fallback to localhost for development
const defaultUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:10000';
export const API_URL = defaultUrl;

class APIClient {
  private client: AxiosInstance;
  private restaurantId: string | null = null;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000, // Increased from 10s to 30s to handle slower endpoints
    });

    // Add request interceptor for auth
    this.client.interceptors.request.use(
      async (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        if (this.restaurantId) {
          config.headers['X-Restaurant-ID'] = this.restaurantId;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.setupAuthToken();
  }

  private async setupAuthToken() {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      const restaurantId = await SecureStore.getItemAsync('restaurantId');
      const apiBaseUrl = await SecureStore.getItemAsync('apiBaseUrl');
      if (token) this.token = token;
      if (restaurantId) this.restaurantId = restaurantId;
      if (apiBaseUrl) this.client.defaults.baseURL = apiBaseUrl;
    } catch (error) {
      console.error('Failed to load auth token:', error);
    }
  }

  // Auth endpoints
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await this.client.post<AuthResponse>('/api/auth/login', credentials);
      const { token, restaurantId, apiBaseUrl } = response.data;
      
      // Ensure token is a string
      const tokenString = typeof token === 'string' ? token : JSON.stringify(token);
      const restaurantIdString = restaurantId ? (typeof restaurantId === 'string' ? restaurantId : String(restaurantId)) : null;
      
      await SecureStore.setItemAsync('authToken', tokenString);
      if (restaurantIdString) {
        await SecureStore.setItemAsync('restaurantId', restaurantIdString);
        this.restaurantId = restaurantIdString;
      }
      this.token = tokenString;

      // Switch to custom deployment URL if restaurant has one
      if (apiBaseUrl) {
        this.client.defaults.baseURL = apiBaseUrl;
        await SecureStore.setItemAsync('apiBaseUrl', apiBaseUrl);
      } else {
        await SecureStore.deleteItemAsync('apiBaseUrl');
        this.client.defaults.baseURL = API_URL;
      }
      
      return response.data;
    } catch (error) {
      console.error('[API] Login failed:', error);
      throw this.handleError(error);
    }
  }

  async kitchenLogin(pin: string, restaurantId?: string): Promise<AuthResponse> {
    try {
      const payload: any = { pin };
      if (restaurantId) {
        payload.restaurantId = restaurantId;
      }
      const response = await this.client.post<AuthResponse>('/api/auth/kitchen-login', payload);
      const { token, restaurantId: responseRestaurantId, apiBaseUrl } = response.data;
      
      const tokenString = typeof token === 'string' ? token : JSON.stringify(token);
      const restaurantIdString = responseRestaurantId ? (typeof responseRestaurantId === 'string' ? responseRestaurantId : String(responseRestaurantId)) : null;
      
      await SecureStore.setItemAsync('authToken', tokenString);
      if (restaurantIdString) {
        await SecureStore.setItemAsync('restaurantId', restaurantIdString);
        this.restaurantId = restaurantIdString;
      }
      this.token = tokenString;

      // Switch to custom deployment URL if restaurant has one
      if (apiBaseUrl) {
        this.client.defaults.baseURL = apiBaseUrl;
        await SecureStore.setItemAsync('apiBaseUrl', apiBaseUrl);
      } else {
        await SecureStore.deleteItemAsync('apiBaseUrl');
        this.client.defaults.baseURL = API_URL;
      }
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async staffLogin(pin: string, restaurantId?: string): Promise<AuthResponse> {
    try {
      const payload: any = { pin };
      if (restaurantId) {
        payload.restaurantId = restaurantId;
      }
      const response = await this.client.post<any>('/api/auth/staff-login', payload);
      const data = response.data;
      const { token, restaurantId: responseRestaurantId, apiBaseUrl } = data;
      
      const tokenString = typeof token === 'string' ? token : JSON.stringify(token);
      const restaurantIdString = responseRestaurantId ? (typeof responseRestaurantId === 'string' ? responseRestaurantId : String(responseRestaurantId)) : null;
      
      await SecureStore.setItemAsync('authToken', tokenString);
      if (restaurantIdString) {
        await SecureStore.setItemAsync('restaurantId', restaurantIdString);
        this.restaurantId = restaurantIdString;
      }
      this.token = tokenString;

      // Switch to custom deployment URL if restaurant has one
      if (apiBaseUrl) {
        this.client.defaults.baseURL = apiBaseUrl;
        await SecureStore.setItemAsync('apiBaseUrl', apiBaseUrl);
      } else {
        await SecureStore.deleteItemAsync('apiBaseUrl');
        this.client.defaults.baseURL = API_URL;
      }

      // Normalize field names and persist extra staff data
      const userId = String(data.user_id || data.userId || '');
      await SecureStore.setItemAsync('userId', userId);
      await SecureStore.setItemAsync('role', data.role || 'staff');
      if (data.access_rights) {
        await SecureStore.setItemAsync('accessRights', JSON.stringify(data.access_rights));
      }
      if (data.currently_clocked_in !== undefined) {
        await SecureStore.setItemAsync('clockedIn', data.currently_clocked_in ? 'true' : 'false');
      }
      
      return {
        token: tokenString,
        role: data.role,
        restaurantId: restaurantIdString || '',
        userId,
        access_rights: data.access_rights,
        currently_clocked_in: data.currently_clocked_in,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync('authToken');
    await SecureStore.deleteItemAsync('restaurantId');
    await SecureStore.deleteItemAsync('apiBaseUrl');
    await SecureStore.deleteItemAsync('userId');
    await SecureStore.deleteItemAsync('role');
    await SecureStore.deleteItemAsync('accessRights');
    await SecureStore.deleteItemAsync('clockedIn');
    this.token = null;
    this.restaurantId = null;
    this.client.defaults.baseURL = API_URL;
  }

  // Menu endpoints
  async getMenu() {
    try {
      const response = await this.client.get(`/api/restaurants/${this.restaurantId}/menu`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getMenuItems(categoryId?: string) {
    try {
      const params = categoryId ? { category_id: categoryId } : {};
      const response = await this.client.get(
        `/api/restaurants/${this.restaurantId}/menu-items`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Session endpoints
  async createSession(tableId: string) {
    try {
      const response = await this.client.post(
        `/api/restaurants/${this.restaurantId}/sessions`,
        { table_id: tableId }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSession(sessionId: string) {
    try {
      const response = await this.client.get(`/api/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async closeSession(sessionId: string) {
    try {
      const response = await this.client.patch(`/api/sessions/${sessionId}/close`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Order endpoints
  async createOrder(sessionId: string, items: any[]) {
    try {
      const response = await this.client.post(
        `/api/sessions/${sessionId}/orders`,
        { items }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getOrders(sessionId: string) {
    try {
      const response = await this.client.get(`/api/sessions/${sessionId}/orders`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateOrderStatus(orderItemId: string, status: string) {
    try {
      const response = await this.client.patch(
        `/api/order-items/${orderItemId}/status`,
        { status, restaurantId: this.restaurantId }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Kitchen endpoints
  async getKitchenItems() {
    try {
      const response = await this.client.get(
        `/api/kitchen/items`,
        { params: { restaurantId: this.restaurantId } }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Tables endpoints
  async getTables() {
    try {
      const response = await this.client.get(
        `/api/restaurants/${this.restaurantId}/tables`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Printer endpoints
  async getPrinterConfig() {
    try {
      const response = await this.client.get(
        `/api/restaurants/${this.restaurantId}/printer-config`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async savePrinterConfig(config: any) {
    try {
      const response = await this.client.post(
        `/api/restaurants/${this.restaurantId}/printer-config`,
        config
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  setRestaurantId(id: string) {
    this.restaurantId = id;
  }

  setToken(token: string) {
    this.token = token;
  }

  // Generic HTTP methods
  async get(url: string, config?: any) {
    try {
      const response = await this.client.get(url, config);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async post(url: string, data?: any, config?: any) {
    try {
      const response = await this.client.post(url, data, config);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async put(url: string, data?: any, config?: any) {
    try {
      const response = await this.client.put(url, data, config);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async delete(url: string, config?: any) {
    try {
      const response = await this.client.delete(url, config);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async patch(url: string, data?: any, config?: any) {
    try {
      const response = await this.client.patch(url, data, config);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Restaurant info (public - for PIN login display)
  async getRestaurantInfo(restaurantId: string): Promise<{ id: number; name: string }> {
    try {
      const response = await this.client.get(`/api/restaurants/${restaurantId}/info`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Register with Google (create restaurant + admin account)
  async register(data: {
    email: string;
    google_id?: string;
    restaurant_name: string;
    address?: string;
    phone?: string;
    service_charge_percent?: number;
    language_preference?: string;
    timezone?: string;
  }): Promise<AuthResponse> {
    try {
      const response = await this.client.post('/api/auth/register', data);
      const { token, restaurantId, role, userId } = response.data;

      const tokenString = typeof token === 'string' ? token : JSON.stringify(token);
      const restaurantIdString = restaurantId ? String(restaurantId) : '';

      await SecureStore.setItemAsync('authToken', tokenString);
      await SecureStore.setItemAsync('restaurantId', restaurantIdString);
      await SecureStore.setItemAsync('role', role || 'admin');
      await SecureStore.setItemAsync('userId', String(userId || ''));
      this.token = tokenString;
      this.restaurantId = restaurantIdString;

      return {
        token: tokenString,
        role: role || 'admin',
        restaurantId: restaurantIdString,
        userId: String(userId || ''),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Google login (returning users)
  async googleLogin(email: string, googleId?: string): Promise<AuthResponse> {
    try {
      const response = await this.client.post('/api/auth/google-login', { email, google_id: googleId });
      const { token, restaurantId, role, userId } = response.data;

      const tokenString = typeof token === 'string' ? token : JSON.stringify(token);
      const restaurantIdString = restaurantId ? String(restaurantId) : '';

      await SecureStore.setItemAsync('authToken', tokenString);
      await SecureStore.setItemAsync('restaurantId', restaurantIdString);
      await SecureStore.setItemAsync('role', role || 'admin');
      await SecureStore.setItemAsync('userId', String(userId || ''));
      this.token = tokenString;
      this.restaurantId = restaurantIdString;

      return {
        token: tokenString,
        role,
        restaurantId: restaurantIdString,
        userId: String(userId || ''),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Send email verification code
  async sendVerificationCode(email: string): Promise<void> {
    try {
      await this.client.post('/api/auth/send-verification', { email });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Verify email code
  async verifyCode(email: string, code: string): Promise<void> {
    try {
      await this.client.post('/api/auth/verify-code', { email, code });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Register with verified email + password
  async registerEmail(data: {
    email: string;
    password: string;
    name?: string;
    restaurant_name: string;
    address?: string;
    country?: string;
    phone?: string;
    service_charge_percent?: number;
    language_preference?: string;
    timezone?: string;
  }): Promise<AuthResponse> {
    try {
      const response = await this.client.post('/api/auth/register-email', data);
      const { token, restaurantId, role, userId } = response.data;

      const tokenString = typeof token === 'string' ? token : JSON.stringify(token);
      const restaurantIdString = restaurantId ? String(restaurantId) : '';

      await SecureStore.setItemAsync('authToken', tokenString);
      await SecureStore.setItemAsync('restaurantId', restaurantIdString);
      await SecureStore.setItemAsync('role', role || 'admin');
      await SecureStore.setItemAsync('userId', String(userId || ''));
      this.token = tokenString;
      this.restaurantId = restaurantIdString;

      return {
        token: tokenString,
        role,
        restaurantId: restaurantIdString,
        userId: String(userId || ''),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Forgot password
  async forgotPassword(email: string): Promise<void> {
    try {
      await this.client.post('/api/auth/forgot-password', { email });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Reset password with token
  async resetPassword(token: string, password: string): Promise<void> {
    try {
      await this.client.post('/api/auth/reset-password', { token, password });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ========== Profile ==========
  async getProfile(): Promise<any> {
    try {
      const response = await this.client.get('/api/me');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProfile(data: { name?: string; email?: string; password?: string; pin?: string }): Promise<any> {
    try {
      const response = await this.client.patch('/api/me', data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ========== User Management ==========
  async getUsers(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/users');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createUser(data: {
    name: string; email?: string; password?: string; role: string;
    pin?: string; restaurant_id?: number; access_rights?: string[]; hourly_rate_cents?: number;
  }): Promise<any> {
    try {
      const response = await this.client.post('/api/users', data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateUser(userId: number, data: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.patch(`/api/users/${userId}`, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteUser(userId: number): Promise<void> {
    try {
      await this.client.delete(`/api/users/${userId}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ========== Restaurant Management ==========
  async getRestaurants(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/manage/restaurants');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createRestaurant(data: {
    name: string; address?: string; phone?: string;
    timezone?: string; service_charge_percent?: number; language_preference?: string;
  }): Promise<any> {
    try {
      const response = await this.client.post('/api/manage/restaurants', data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateRestaurant(restaurantId: number, data: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.patch(`/api/manage/restaurants/${restaurantId}`, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteRestaurant(restaurantId: number): Promise<void> {
    try {
      await this.client.delete(`/api/manage/restaurants/${restaurantId}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Payment terminal applications
  async submitTerminalApplication(restaurantId: number, formData: FormData): Promise<any> {
    try {
      const response = await this.client.post(
        `/api/restaurants/${restaurantId}/payment-terminal-applications`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getTerminalApplications(restaurantId: number): Promise<any[]> {
    try {
      const response = await this.client.get(`/api/restaurants/${restaurantId}/payment-terminal-applications`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAllTerminalApplications(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/manage/payment-terminal-applications');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateTerminalApplication(id: number, data: { status?: string; admin_notes?: string }): Promise<any> {
    try {
      const response = await this.client.patch(`/api/manage/payment-terminal-applications/${id}`, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Upload image (logo/background)
  async uploadImage(uri: string, type: 'logo' | 'background'): Promise<string> {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'upload.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const mimeType = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('image', {
        uri,
        name: filename,
        type: mimeType,
      } as any);

      const endpoint = type === 'logo'
        ? `/api/restaurants/${this.restaurantId}/logo`
        : `/api/restaurants/${this.restaurantId}/background`;

      const response = await this.client.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.url || response.data.logo_url || response.data.background_url || '';
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async uploadMenuItemImage(restaurantId: string | number, menuItemId: number, uri: string): Promise<string> {
    try {
      const filename = uri.split('/').pop() || 'menu-item.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const mimeType = match ? `image/${match[1]}` : 'image/jpeg';

      const buildFormData = () => {
        const formData = new FormData();
        formData.append('restaurantId', String(restaurantId));
        formData.append('image', {
          uri,
          name: filename,
          type: mimeType,
        } as any);
        return formData;
      };

      let response;

      try {
        response = await this.client.post(
          `/api/restaurants/${restaurantId}/menu-items/${menuItemId}/image`,
          buildFormData(),
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          throw error;
        }

        response = await this.client.post(
          `/api/menu-items/${menuItemId}/image`,
          buildFormData(),
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
      }

      return response.data.image_url || '';
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.response?.data?.message || error.message;
      const fullError = `API Error - Status: ${status}, Message: ${message}, URL: ${error.config?.url}`;
      console.error('[API Error]', fullError);
      console.error('[API Error Details]', {
        status,
        message,
        url: error.config?.url,
        method: error.config?.method,
        response: error.response?.data,
        originalError: error.message
      });
      return new Error(message);
    }
    console.error('[API Error] Non-axios error:', error);
    return error as Error;
  }
}

export const apiClient = new APIClient();
