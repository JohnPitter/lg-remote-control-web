import { ITVService } from '@/core/interfaces/ITVService';
import { TV, TVState, TVConnectionStatus } from '@/core/entities/TV';
import { TVCommand, TVCommandType, NavigationKeys } from '@/core/entities/TVCommand';

export class LGTVWebSocketService implements ITVService {
  private ws: WebSocket | null = null;
  private statusCallbacks: Array<(status: string) => void> = [];
  private stateCallbacks: Array<(state: TVState) => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly proxyUrl = 'ws://localhost:3001/tv-proxy';
  private proxyConnectedToTV = false;
  private currentState: TVState = {
    volume: 0,
    muted: false,
  };

  async connect(tv: TV): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Reset proxy connection flag
        this.proxyConnectedToTV = false;

        // Connect through proxy instead of directly to TV
        const wsUrl = `${this.proxyUrl}?ip=${tv.ipAddress}&port=${tv.port}`;
        console.log(`🔗 Connecting to TV via proxy: ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          console.log('✅ Connected to proxy, waiting for TV connection...');
          // Don't send handshake yet - wait for proxy-status confirmation
          resolve();
        };

        this.ws.onerror = (error) => {
          this.notifyStatusChange(TVConnectionStatus.ERROR);
          reject(error);
        };

        this.ws.onclose = () => {
          this.notifyStatusChange(TVConnectionStatus.DISCONNECTED);
          this.attemptReconnect(tv);
        };

        this.ws.onmessage = async (event) => {
          // Handle both string and Blob data
          let data: string;
          if (event.data instanceof Blob) {
            data = await event.data.text();
          } else {
            data = event.data;
          }
          this.handleMessage(data);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.proxyConnectedToTV = false;
    this.notifyStatusChange(TVConnectionStatus.DISCONNECTED);
  }

  async sendCommand(command: TVCommand): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    // Map command types to their payloads
    // If payload is provided, use it; otherwise set defaults
    let payload = command.payload || {};

    // Only set default payloads if not already provided
    if (!command.payload || Object.keys(command.payload).length === 0) {
      switch (command.type) {
        case TVCommandType.UP:
          payload = { keyCode: NavigationKeys.UP };
          break;
        case TVCommandType.DOWN:
          payload = { keyCode: NavigationKeys.DOWN };
          break;
        case TVCommandType.LEFT:
          payload = { keyCode: NavigationKeys.LEFT };
          break;
        case TVCommandType.RIGHT:
          payload = { keyCode: NavigationKeys.RIGHT };
          break;
        case TVCommandType.ENTER:
          payload = {}; // sendEnterKey doesn't need keyCode
          break;
        case TVCommandType.HOME:
          payload = { id: 'com.webos.app.home' };
          break;
        case TVCommandType.VOLUME_GET:
          payload = {};
          break;
      }
    }

    // Check if this is a button command (navigation keys)
    if (command.type.startsWith('button:')) {
      const buttonName = command.type.split(':')[1];
      const buttonMessage = {
        type: 'button',
        name: buttonName,
      };

      console.log('📤 Sending button command:', buttonName);
      this.ws.send(JSON.stringify(buttonMessage));
    } else {
      // Regular SSAP command
      const message = {
        type: 'request',
        id: `command_${Date.now()}`,
        uri: command.type,
        payload,
      };

      console.log('📤 Sending command:', message);
      console.log('📤 Command URI:', command.type);
      console.log('📤 Command Payload:', JSON.stringify(payload, null, 2));
      this.ws.send(JSON.stringify(message));
    }

    // After volume/mute commands, request fresh state
    const volumeCommands = [
      TVCommandType.VOLUME_UP,
      TVCommandType.VOLUME_DOWN,
      TVCommandType.VOLUME_MUTE, // Note: VOLUME_MUTE is used for both mute and unmute
    ];

    if (volumeCommands.includes(command.type)) {
      // Wait a bit for TV to process, then get fresh state
      setTimeout(() => {
        const getVolumeMessage = {
          type: 'request',
          id: `command_${Date.now()}`,
          uri: TVCommandType.VOLUME_GET,
          payload: {},
        };
        console.log('📤 Requesting volume state after command');
        this.ws?.send(JSON.stringify(getVolumeMessage));
      }, 100);
    }
  }

  async getTVState(): Promise<TVState> {
    // Request fresh state from TV
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      await this.sendCommand({ type: TVCommandType.VOLUME_GET });
    }
    return this.currentState;
  }

  onStatusChange(callback: (status: string) => void): void {
    this.statusCallbacks.push(callback);
  }

  onStateChange(callback: (state: TVState) => void): void {
    this.stateCallbacks.push(callback);
    console.log('📝 State change callback registered, total:', this.stateCallbacks.length);
  }

  private sendHandshake(): void {
    if (!this.ws) return;

    const clientKey = localStorage.getItem('lg-tv-client-key');

    const payload: any = {
      'pairingType': 'PROMPT',
      'forcePairing': false,
      manifest: {
        manifestVersion: 1,
        appVersion: '1.1',
        signed: {
          created: '20140509',
          appId: 'com.lge.test',
          vendorId: 'com.lge',
          localizedAppNames: {
            '': 'LG TV Remote',
            'pt-BR': 'Controle Remoto LG TV'
          },
          localizedVendorNames: {
            '': 'LG Electronics'
          },
          permissions: [
            'TEST_SECURE',
            'CONTROL_INPUT_JOYSTICK',
            'CONTROL_INPUT_MEDIA_RECORDING',
            'CONTROL_INPUT_MEDIA_PLAYBACK',
            'CONTROL_INPUT_TV',
            'CONTROL_POWER',
            'READ_APP_STATUS',
            'READ_CURRENT_CHANNEL',
            'READ_INPUT_DEVICE_LIST',
            'READ_NETWORK_STATE',
            'READ_RUNNING_APPS',
            'READ_TV_CHANNEL_LIST',
            'WRITE_NOTIFICATION_TOAST',
            'CONTROL_INPUT_TEXT',
            'CONTROL_MOUSE_AND_KEYBOARD',
            'READ_INSTALLED_APPS',
            'CONTROL_DISPLAY',
            'CONTROL_INPUT_TOUCHPAD',
            'CONTROL_AUDIO'
          ],
          serial: '2f930e2d2cfe083771f68e4fe7bb07'
        },
        permissions: [
          'LAUNCH',
          'LAUNCH_WEBAPP',
          'APP_TO_APP',
          'CLOSE',
          'TEST_OPEN',
          'TEST_PROTECTED',
          'CONTROL_AUDIO',
          'CONTROL_DISPLAY',
          'CONTROL_INPUT_JOYSTICK',
          'CONTROL_INPUT_MEDIA_RECORDING',
          'CONTROL_INPUT_MEDIA_PLAYBACK',
          'CONTROL_INPUT_TV',
          'CONTROL_POWER',
          'READ_APP_STATUS',
          'READ_CURRENT_CHANNEL',
          'READ_INPUT_DEVICE_LIST',
          'READ_NETWORK_STATE',
          'READ_RUNNING_APPS',
          'READ_TV_CHANNEL_LIST',
          'WRITE_NOTIFICATION_ALERT',
          'CONTROL_INPUT_TEXT',
          'CONTROL_MOUSE_AND_KEYBOARD',
          'READ_INSTALLED_APPS',
          'READ_LGE_SDX',
          'READ_NOTIFICATIONS',
          'SEARCH',
          'WRITE_SETTINGS',
          'WRITE_NOTIFICATION_TOAST'
        ]
      }
    };

    // Only include client-key if we have one
    if (clientKey) {
      payload['client-key'] = clientKey;
      console.log('🔑 Using stored client key');
    } else {
      console.log('🆕 First time pairing - no client key');
    }

    const handshake = {
      type: 'register',
      id: 'register_0',
      payload
    };

    console.log('📤 Sending handshake to TV');
    this.ws.send(JSON.stringify(handshake));
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      console.log('📨 Received message from TV:', message.type);

      // Handle proxy status messages
      if (message.type === 'proxy-status') {
        console.log('✅ Proxy status:', message.status, message.message);
        if (message.status === 'connected' && !this.proxyConnectedToTV) {
          this.proxyConnectedToTV = true;
          console.log('🤝 Proxy connected to TV, sending handshake...');
          this.sendHandshake();
        }
        return;
      }

      if (message.type === 'proxy-error') {
        console.error('❌ Proxy error:', message.error);
        this.notifyStatusChange(TVConnectionStatus.ERROR);
        return;
      }

      // Handle TV registration
      if (message.type === 'registered') {
        console.log('🎉 TV registration successful!');
        const clientKey = message.payload?.['client-key'];
        if (clientKey) {
          console.log('🔑 Saving client key');
          localStorage.setItem('lg-tv-client-key', clientKey);
        }
        this.notifyStatusChange(TVConnectionStatus.CONNECTED);

        // Request initial volume state AFTER registration completes
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const getVolumeMessage = {
              type: 'request',
              id: `command_${Date.now()}`,
              uri: TVCommandType.VOLUME_GET,
              payload: {},
            };
            console.log('📤 Requesting initial volume state after registration');
            this.ws.send(JSON.stringify(getVolumeMessage));
          }
        }, 100);
      }

      // Handle TV responses
      if (message.type === 'response') {
        console.log('📊 TV response:', message);
        console.log('📊 TV response payload:', JSON.stringify(message.payload, null, 2));

        // Check if it's a volume response
        if (message.payload && typeof message.payload === 'object') {
          const payload = message.payload as Record<string, unknown>;

          let updated = false;

          // LG TV returns volume in volumeStatus object
          if (payload.volumeStatus && typeof payload.volumeStatus === 'object') {
            const volumeStatus = payload.volumeStatus as Record<string, unknown>;

            if (typeof volumeStatus.volume === 'number') {
              this.currentState.volume = volumeStatus.volume;
              updated = true;
            }
            if (typeof volumeStatus.muteStatus === 'boolean') {
              this.currentState.muted = volumeStatus.muteStatus;
              updated = true;
            }
          }

          // Check for direct muteStatus in payload (from setMute response)
          if (typeof payload.muteStatus === 'boolean') {
            console.log('📢 Direct muteStatus in response:', payload.muteStatus);
            this.currentState.muted = payload.muteStatus;
            updated = true;
          }

          // Check for direct volume in payload (from volumeUp/Down response)
          if (typeof payload.volume === 'number') {
            this.currentState.volume = payload.volume;
            updated = true;
          }

          if (updated) {
            console.log('🔊 TV State updated:', this.currentState);
            this.notifyStateChange();
          }
        }
      }

      // Handle TV errors
      if (message.type === 'error') {
        console.error('❌ TV error:', message);
      }

    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private notifyStatusChange(status: string): void {
    this.statusCallbacks.forEach((callback) => callback(status));
  }

  private notifyStateChange(): void {
    console.log('🔔 Notifying state change to callbacks:', this.stateCallbacks.length, this.currentState);
    this.stateCallbacks.forEach((callback) => callback({ ...this.currentState }));
  }

  private attemptReconnect(tv: TV): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.reconnectTimeout = setTimeout(() => {
      console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connect(tv).catch(console.error);
    }, delay);
  }
}
