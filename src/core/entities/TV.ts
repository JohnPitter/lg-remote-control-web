export enum TVConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface TV {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  status: TVConnectionStatus;
  lastConnected?: Date;
}

export interface TVState {
  volume: number;
  muted: boolean;
  currentChannel?: string;
  currentApp?: string;
}
