import WebSocket from 'ws';
import { WebSocketServer } from 'ws';
import http from 'http';

// Disable SSL certificate validation for self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export class TVWebSocketProxy {
  private wss: WebSocketServer | null = null;
  private tvConnections: Map<string, WebSocket> = new Map();
  private inputSockets: Map<string, WebSocket> = new Map();

  initialize(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: '/tv-proxy' });

    console.log('📡 WebSocket Proxy initialized at ws://localhost:3001/tv-proxy');

    this.wss.on('connection', (clientWs: WebSocket, req) => {
      console.log('🔗 New client connected to proxy');

      // Extract TV IP from query parameters
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const tvIP = url.searchParams.get('ip');
      const tvPort = url.searchParams.get('port') || '3001'; // Changed default to 3001

      if (!tvIP) {
        console.log('❌ No TV IP provided');
        clientWs.send(JSON.stringify({ error: 'TV IP is required' }));
        clientWs.close();
        return;
      }

      // Use WSS (secure WebSocket) for newer webOS TVs
      const protocol = tvPort === '3001' ? 'wss' : 'ws';
      const tvWsUrl = `${protocol}://${tvIP}:${tvPort}`;

      console.log(`🎯 Connecting to TV at ${tvWsUrl}`);

      // Connect to LG TV with SSL support
      const tvWs = new WebSocket(tvWsUrl, {
        rejectUnauthorized: false, // Accept self-signed certificates
      });
      const connectionKey = `${tvIP}:${tvPort}`;
      this.tvConnections.set(connectionKey, tvWs);

      // TV WebSocket events
      tvWs.on('open', () => {
        console.log(`✅ Connected to TV at ${tvIP}:${tvPort}`);
        clientWs.send(JSON.stringify({
          type: 'proxy-status',
          status: 'connected',
          message: 'Successfully connected to TV'
        }));
      });

      tvWs.on('message', (data) => {
        console.log(`📨 Message from TV: ${data.toString().substring(0, 100)}...`);
        // Forward message from TV to client
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data);
        }
      });

      tvWs.on('error', (error) => {
        console.log(`❌ TV WebSocket error: ${error.message}`);
        clientWs.send(JSON.stringify({
          type: 'proxy-error',
          error: error.message
        }));
      });

      tvWs.on('close', () => {
        console.log(`🔌 TV WebSocket closed`);
        this.tvConnections.delete(connectionKey);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close();
        }
      });

      // Client WebSocket events
      clientWs.on('message', async (data) => {
        const message = data.toString();
        console.log(`📤 Message from client: ${message.substring(0, 100)}...`);

        try {
          const parsed = JSON.parse(message);

          // Handle button commands
          if (parsed.type === 'button') {
            await this.handleButtonCommand(tvWs, clientWs, parsed.name, tvIP, tvPort, connectionKey);
            return;
          }
        } catch (e) {
          // Not JSON or parsing error, treat as regular message
        }

        // Forward regular message from client to TV as text
        if (tvWs.readyState === WebSocket.OPEN) {
          tvWs.send(message, { binary: false });
        } else {
          clientWs.send(JSON.stringify({
            error: 'TV not connected',
            type: 'proxy-error'
          }));
        }
      });

      clientWs.on('close', () => {
        console.log('🔌 Client disconnected');
        if (tvWs.readyState === WebSocket.OPEN) {
          tvWs.close();
        }
        this.tvConnections.delete(connectionKey);
      });

      clientWs.on('error', (error) => {
        console.log(`❌ Client WebSocket error: ${error.message}`);
      });
    });
  }

  private async handleButtonCommand(
    tvWs: WebSocket,
    clientWs: WebSocket,
    buttonName: string,
    tvIP: string,
    tvPort: string,
    connectionKey: string
  ): Promise<void> {
    console.log(`🎮 Handling button command: ${buttonName}`);

    try {
      // Check if we already have an InputSocket for this TV
      let inputSocket = this.inputSockets.get(connectionKey);

      if (!inputSocket || inputSocket.readyState !== WebSocket.OPEN) {
        // Need to request InputSocket from TV first
        console.log('🔌 Requesting InputSocket from TV...');

        // Send request for InputSocket
        const inputSocketRequest = {
          type: 'request',
          id: `input_socket_${Date.now()}`,
          uri: 'ssap://com.webos.service.networkinput/getPointerInputSocket',
          payload: {}
        };

        // Wait for response with socket path
        const socketPath = await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('InputSocket request timeout')), 5000);

          const messageHandler = (data: Buffer) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.id === inputSocketRequest.id && response.payload?.socketPath) {
                clearTimeout(timeout);
                tvWs.off('message', messageHandler);
                resolve(response.payload.socketPath);
              }
            } catch (e) {
              // Ignore parsing errors
            }
          };

          tvWs.on('message', messageHandler);
          tvWs.send(JSON.stringify(inputSocketRequest), { binary: false });
        });

        console.log(`✅ Got InputSocket path: ${socketPath}`);

        // Establish InputSocket WebSocket connection
        // Check if socketPath is already a full URL or just a path
        let inputSocketUrl: string;
        if (socketPath.startsWith('ws://') || socketPath.startsWith('wss://')) {
          // Already a complete URL
          inputSocketUrl = socketPath;
        } else {
          // Just a path, need to build full URL
          const protocol = tvPort === '3001' ? 'wss' : 'ws';
          inputSocketUrl = `${protocol}://${tvIP}:${tvPort}${socketPath}`;
        }

        console.log(`🔌 Connecting to InputSocket: ${inputSocketUrl}`);

        inputSocket = new WebSocket(inputSocketUrl, {
          rejectUnauthorized: false,
        });

        await new Promise<void>((resolve, reject) => {
          inputSocket!.on('open', () => {
            console.log('✅ InputSocket connected');
            this.inputSockets.set(connectionKey, inputSocket!);
            resolve();
          });
          inputSocket!.on('error', reject);
        });
      }

      // Send button command through InputSocket
      const buttonCommand = `type:button\nname:${buttonName}\n\n`;
      console.log(`📤 Sending button through InputSocket: ${buttonName}`);
      inputSocket.send(buttonCommand);

      // Send success response to client
      clientWs.send(JSON.stringify({
        type: 'response',
        id: `button_${Date.now()}`,
        payload: {
          returnValue: true,
          button: buttonName
        }
      }));
    } catch (error) {
      console.error(`❌ Error handling button command: ${(error as Error).message}`);
      clientWs.send(JSON.stringify({
        type: 'error',
        error: (error as Error).message
      }));
    }
  }

  close() {
    // Close all TV connections
    this.tvConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    this.tvConnections.clear();

    // Close all InputSockets
    this.inputSockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    this.inputSockets.clear();

    // Close proxy server
    if (this.wss) {
      this.wss.close();
    }
  }
}
