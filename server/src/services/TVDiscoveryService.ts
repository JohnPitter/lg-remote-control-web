import dgram from 'dgram';
import net from 'net';
import os from 'os';
import { DiscoveredTV } from '../types/tv';

export class TVDiscoveryService {
  private static readonly SSDP_ADDRESS = '239.255.255.250';
  private static readonly SSDP_PORT = 1900;
  private static readonly SEARCH_TARGET = 'urn:lge-com:service:webos-second-screen:1';
  private static readonly TIMEOUT_MS = 5000;
  private static readonly LG_TV_PORT = 3001;

  private discoveredDevices: Map<string, DiscoveredTV> = new Map();
  private debugMode = true;
  private localIPs: Set<string> = new Set();

  constructor() {
    this.initializeLocalIPs();
  }

  private initializeLocalIPs(): void {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
      if (iface) {
        for (const addr of iface) {
          if (addr.family === 'IPv4' && !addr.internal) {
            this.localIPs.add(addr.address);
            this.log(`🏠 Local IP detected: ${addr.address}`);
          }
        }
      }
    }
  }

  async discoverTVs(): Promise<DiscoveredTV[]> {
    this.discoveredDevices.clear();
    this.log('🔍 Starting TV discovery...');

    // Try both SSDP and network scan
    await Promise.all([
      this.discoverViaSSDPGeneric(),
      this.discoverViaNetworkScan()
    ]);

    const devices = Array.from(this.discoveredDevices.values());
    this.log(`✅ Discovery complete. Found ${devices.length} device(s)`);

    return devices;
  }

  private async discoverViaSSDPGeneric(): Promise<void> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      // Try generic SSDP first
      const searchMessages = [
        // LG specific
        'M-SEARCH * HTTP/1.1\r\n' +
        `HOST: ${TVDiscoveryService.SSDP_ADDRESS}:${TVDiscoveryService.SSDP_PORT}\r\n` +
        'MAN: "ssdp:discover"\r\n' +
        'MX: 3\r\n' +
        'ST: urn:lge-com:service:webos-second-screen:1\r\n\r\n',

        // Generic DIAL
        'M-SEARCH * HTTP/1.1\r\n' +
        `HOST: ${TVDiscoveryService.SSDP_ADDRESS}:${TVDiscoveryService.SSDP_PORT}\r\n` +
        'MAN: "ssdp:discover"\r\n' +
        'MX: 3\r\n' +
        'ST: urn:dial-multiscreen-org:service:dial:1\r\n\r\n',

        // All devices
        'M-SEARCH * HTTP/1.1\r\n' +
        `HOST: ${TVDiscoveryService.SSDP_ADDRESS}:${TVDiscoveryService.SSDP_PORT}\r\n` +
        'MAN: "ssdp:discover"\r\n' +
        'MX: 3\r\n' +
        'ST: ssdp:all\r\n\r\n'
      ];

      let messageCount = 0;

      socket.on('message', (msg, rinfo) => {
        const response = msg.toString();
        messageCount++;

        this.log(`📨 Received SSDP response #${messageCount} from ${rinfo.address}`);
        this.log(`Response preview: ${response.substring(0, 200)}...`);

        // Check if it's any TV or media device
        const tv = this.parseResponse(response, rinfo.address);
        if (tv) {
          // Use IP address as key to deduplicate multiple UPnP services from same TV
          const existingTV = this.discoveredDevices.get(tv.ipAddress);

          // If we already have this IP, keep the one with better name
          if (existingTV) {
            // Prefer more descriptive names (with "LG TV at" format)
            if (tv.friendlyName.includes('LG TV at') && !existingTV.friendlyName.includes('LG TV at')) {
              this.log(`✅ Updating TV entry: ${tv.name} at ${tv.ipAddress}`);
              this.discoveredDevices.set(tv.ipAddress, tv);
            } else {
              this.log(`ℹ️  Skipping duplicate TV response from ${tv.ipAddress}`);
            }
          } else {
            this.log(`✅ Found TV: ${tv.name} at ${tv.ipAddress}`);
            this.discoveredDevices.set(tv.ipAddress, tv);
          }
        }
      });

      socket.on('error', (err) => {
        this.log(`❌ SSDP Socket error: ${err.message}`);
        socket.close();
        resolve();
      });

      socket.bind(() => {
        try {
          socket.addMembership(TVDiscoveryService.SSDP_ADDRESS);
          this.log('📡 SSDP socket bound, sending search messages...');

          // Send all search messages
          searchMessages.forEach((message, index) => {
            setTimeout(() => {
              socket.send(
                message,
                0,
                message.length,
                TVDiscoveryService.SSDP_PORT,
                TVDiscoveryService.SSDP_ADDRESS,
                (err) => {
                  if (err) {
                    this.log(`❌ Error sending SSDP search #${index + 1}: ${err.message}`);
                  } else {
                    this.log(`📤 Sent SSDP search message #${index + 1}`);
                  }
                }
              );
            }, index * 500); // Stagger messages
          });

          // Wait for responses
          setTimeout(() => {
            this.log(`📊 SSDP discovery timeout. Received ${messageCount} responses total`);
            socket.close();
            resolve();
          }, TVDiscoveryService.TIMEOUT_MS);
        } catch (err) {
          this.log(`❌ Error in SSDP discovery: ${(err as Error).message}`);
          socket.close();
          resolve();
        }
      });
    });
  }

  private async discoverViaNetworkScan(): Promise<void> {
    this.log('🔎 Starting network scan...');

    // Get local subnet
    const subnet = this.getLocalSubnet();
    this.log(`📡 Scanning subnet: ${subnet}.0/24`);

    const promises: Promise<void>[] = [];

    // Scan common IP ranges
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      promises.push(this.testTVConnection(ip));

      // Batch in groups of 20 to avoid overwhelming the network
      if (i % 20 === 0) {
        await Promise.all(promises.splice(0, promises.length));
      }
    }

    await Promise.all(promises);
    this.log('✅ Network scan complete');
  }

  private async testTVConnection(ip: string, timeout = 500): Promise<void> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve();
        }
      };

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        // Skip local IPs (don't add our own server as a TV)
        if (this.localIPs.has(ip)) {
          this.log(`⏭️  Skipping local IP ${ip} (this server)`);
          cleanup();
          return;
        }

        this.log(`✅ Found open port 3001 on ${ip}`);

        const tv: DiscoveredTV = {
          id: ip,
          name: `LG TV at ${ip}`,
          ipAddress: ip,
          port: TVDiscoveryService.LG_TV_PORT,
          friendlyName: `LG TV at ${ip}`,
          manufacturer: 'LG Electronics',
        };

        // Use IP as key to avoid duplicates with SSDP results
        this.discoveredDevices.set(ip, tv);
        cleanup();
      });

      socket.on('timeout', cleanup);
      socket.on('error', cleanup);

      socket.connect(TVDiscoveryService.LG_TV_PORT, ip);
    });
  }

  private getLocalSubnet(): string {
    // Default to 192.168.3 based on user's TV IP
    // In production, would detect from network interfaces
    return '192.168.3';
  }

  private log(message: string): void {
    if (this.debugMode) {
      console.log(`[TVDiscovery] ${message}`);
    }
  }

  private parseResponse(response: string, ipAddress: string): DiscoveredTV | null {
    try {
      const lines = response.split('\r\n');
      const headers: Record<string, string> = {};

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim().toLowerCase();
          const value = line.substring(colonIndex + 1).trim();
          headers[key] = value;
        }
      }

      // Check if this is a TV/media device
      const lowerResponse = response.toLowerCase();
      const isTVDevice =
        lowerResponse.includes('lg') ||
        lowerResponse.includes('webos') ||
        lowerResponse.includes('lge-com') ||
        lowerResponse.includes('dial') ||
        lowerResponse.includes('smarttv') ||
        lowerResponse.includes('tv');

      if (!isTVDevice) {
        return null;
      }

      // Extract UUID from USN or LOCATION for reference
      const usn = headers['usn'] || '';
      const uuidMatch = usn.match(/uuid:([^:]+)/);
      const uuid = uuidMatch ? uuidMatch[1] : undefined;

      // Try to get friendly name from headers
      let friendlyName = headers['server'] || headers['user-agent'] || headers['st'] || 'TV Device';

      // Create a more descriptive name
      let displayName = friendlyName;
      if (friendlyName.includes('LG') || friendlyName.toLowerCase().includes('webos')) {
        displayName = `LG TV at ${ipAddress}`;
      }

      this.log(`📋 Parsed device: ${displayName} (${friendlyName})`);

      return {
        id: ipAddress, // Use IP as unique identifier to prevent duplicates
        name: displayName,
        ipAddress,
        port: TVDiscoveryService.LG_TV_PORT,
        friendlyName: displayName,
        uuid: uuid,
        manufacturer: 'LG Electronics',
      };
    } catch (err) {
      this.log(`❌ Error parsing SSDP response: ${(err as Error).message}`);
      return null;
    }
  }

  // Test a specific IP address
  async testSpecificIP(ip: string): Promise<DiscoveredTV | null> {
    this.log(`🔍 Testing specific IP: ${ip}`);

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const cleanup = (tv: DiscoveredTV | null) => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(tv);
        }
      };

      socket.setTimeout(3000);

      socket.on('connect', () => {
        this.log(`✅ Successfully connected to ${ip}:3001`);

        const tv: DiscoveredTV = {
          id: ip,
          name: `LG TV (${ip})`,
          ipAddress: ip,
          port: TVDiscoveryService.LG_TV_PORT,
          friendlyName: `LG TV at ${ip}`,
          manufacturer: 'LG Electronics',
        };

        cleanup(tv);
      });

      socket.on('timeout', () => {
        this.log(`⏱️ Timeout connecting to ${ip}`);
        cleanup(null);
      });

      socket.on('error', (err) => {
        this.log(`❌ Error connecting to ${ip}: ${err.message}`);
        cleanup(null);
      });

      socket.connect(TVDiscoveryService.LG_TV_PORT, ip);
    });
  }
}
