import { ITVService } from '../interfaces/ITVService';
import { TV } from '../entities/TV';
import { TVCommand } from '../entities/TVCommand';

export class ControlTV {
  constructor(private tvService: ITVService) {}

  async connectToTV(tv: TV): Promise<void> {
    await this.tvService.connect(tv);
  }

  async disconnectFromTV(): Promise<void> {
    await this.tvService.disconnect();
  }

  async executeCommand(command: TVCommand): Promise<void> {
    await this.tvService.sendCommand(command);
  }

  async getCurrentState() {
    return await this.tvService.getTVState();
  }

  onConnectionStatusChange(callback: (status: string) => void): void {
    this.tvService.onStatusChange(callback);
  }
}
