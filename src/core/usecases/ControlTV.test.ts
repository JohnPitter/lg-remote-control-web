import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ControlTV } from './ControlTV';
import { ITVService } from '../interfaces/ITVService';
import { TV, TVConnectionStatus } from '../entities/TV';
import { TVCommandType } from '../entities/TVCommand';

describe('ControlTV', () => {
  let mockTVService: ITVService;
  let controlTV: ControlTV;

  beforeEach(() => {
    mockTVService = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      sendCommand: vi.fn().mockResolvedValue(undefined),
      getTVState: vi.fn().mockResolvedValue({ volume: 50, muted: false }),
      onStatusChange: vi.fn(),
    };

    controlTV = new ControlTV(mockTVService);
  });

  it('should connect to TV', async () => {
    const tv: TV = {
      id: 'tv-1',
      name: 'LG TV',
      ipAddress: '192.168.1.100',
      port: 3000,
      status: TVConnectionStatus.DISCONNECTED,
    };

    await controlTV.connectToTV(tv);
    expect(mockTVService.connect).toHaveBeenCalledWith(tv);
  });

  it('should disconnect from TV', async () => {
    await controlTV.disconnectFromTV();
    expect(mockTVService.disconnect).toHaveBeenCalled();
  });

  it('should execute command', async () => {
    const command = { type: TVCommandType.VOLUME_UP };
    await controlTV.executeCommand(command);
    expect(mockTVService.sendCommand).toHaveBeenCalledWith(command);
  });

  it('should get current state', async () => {
    const state = await controlTV.getCurrentState();
    expect(state).toEqual({ volume: 50, muted: false });
    expect(mockTVService.getTVState).toHaveBeenCalled();
  });

  it('should register status change callback', () => {
    const callback = vi.fn();
    controlTV.onConnectionStatusChange(callback);
    expect(mockTVService.onStatusChange).toHaveBeenCalledWith(callback);
  });
});
