import { TV, TVState } from '../entities/TV';
import { TVCommand } from '../entities/TVCommand';

export interface ITVService {
  connect(tv: TV): Promise<void>;
  disconnect(): Promise<void>;
  sendCommand(command: TVCommand): Promise<void>;
  getTVState(): Promise<TVState>;
  onStatusChange(callback: (status: string) => void): void;
  onStateChange(callback: (state: TVState) => void): void;
}
