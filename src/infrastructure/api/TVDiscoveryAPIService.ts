import { TV, TVConnectionStatus } from '@/core/entities/TV';

interface DiscoveryResponse {
  success: boolean;
  count: number;
  tvs: Array<{
    id: string;
    name: string;
    ipAddress: string;
    port: number;
    model?: string;
    manufacturer?: string;
    friendlyName?: string;
    uuid?: string;
  }>;
}

export class TVDiscoveryAPIService {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:3001') {
    this.baseURL = baseURL;
  }

  async discoverTVs(): Promise<TV[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/tv/discover`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: DiscoveryResponse = await response.json();

      if (!data.success) {
        throw new Error('Discovery failed');
      }

      return data.tvs.map((tv) => ({
        id: tv.id,
        name: tv.friendlyName || tv.name,
        ipAddress: tv.ipAddress,
        port: tv.port,
        status: TVConnectionStatus.DISCONNECTED,
      }));
    } catch (error) {
      console.error('Error discovering TVs:', error);
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
