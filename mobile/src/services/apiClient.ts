import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { AuthResponse, LoginCredentials } from '../types';

// For iOS simulator on Mac, use 127.0.0.1 instead of localhost
// For physical devices, you would need the actual host IP
export const API_URL = 'http://localhost:10000';

class APIClient {
  private client: AxiosInstance;
  private restaurantId: string | null = null;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 10000,
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
      if (token) this.token = token;
      if (restaurantId) this.restaurantId = restaurantId;
    } catch (error) {
      console.error('Failed to load auth token:', error);
    }
  }

  // Auth endpoints
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await this.client.post<AuthResponse>('/api/auth/login', credentials);
      const { token, restaurantId } = response.data;
      
      await SecureStore.setItemAsync('authToken', token);
      if (restaurantId) {
        await SecureStore.setItemAsync('restaurantId', restaurantId);
        this.restaurantId = restaurantId;
      }
      this.token = token;
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async kitchenLogin(pin: string): Promise<AuthResponse> {
    try {
      const response = await this.client.post<AuthResponse>('/api/auth/kitchen-login', { pin });
      const { token, restaurantId } = response.data;
      
      await SecureStore.setItemAsync('authToken', token);
      if (restaurantId) {
        await SecureStore.setItemAsync('restaurantId', restaurantId);
        this.restaurantId = restaurantId;
      }
      this.token = token;
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync('authToken');
    await SecureStore.deleteItemAsync('restaurantId');
    this.token = null;
    this.restaurantId = null;
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

  async updateOrderStatus(orderId: string, status: string) {
    try {
      const response = await this.client.patch(
        `/api/orders/${orderId}`,
        { status }
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
        `/api/restaurants/${this.restaurantId}/kitchen/items`
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

  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      return new Error(message);
    }
    return error as Error;
  }
}

export const apiClient = new APIClient();
