import net from 'net';
import WebSocket from 'ws';

const TV_IP = '192.168.3.58';
const PORTS_TO_TEST = [3000, 3001, 8080, 8001, 9998, 36866];

console.log('='.repeat(70));
console.log('🔍 Finding LG TV WebSocket Port');
console.log('='.repeat(70));
console.log(`\n🎯 Testing TV at: ${TV_IP}\n`);

async function testPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);

    socket.on('connect', () => {
      console.log(`✅ Port ${port} is OPEN - testing WebSocket...`);
      socket.destroy();

      // Now test WebSocket on this port
      testWebSocket(port).then(resolve);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, TV_IP);
  });
}

async function testWebSocket(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const wsUrl = `ws://${TV_IP}:${port}`;
    const ws = new WebSocket(wsUrl);
    let responded = false;

    const timeout = setTimeout(() => {
      if (!responded) {
        console.log(`   ⏱️  Port ${port}: Timeout on WebSocket`);
        ws.close();
        resolve(false);
      }
    }, 3000);

    ws.on('open', () => {
      console.log(`   🔗 Port ${port}: WebSocket CONNECTED!`);

      // Send a simple ping or handshake
      const handshake = {
        type: 'register',
        id: 'test',
        payload: {
          'pairingType': 'PROMPT',
          'forcePairing': false,
          manifest: {
            manifestVersion: 1,
            appVersion: '1.0',
            permissions: ['TEST']
          }
        }
      };

      ws.send(JSON.stringify(handshake));
    });

    ws.on('message', (data) => {
      responded = true;
      clearTimeout(timeout);
      const message = data.toString();
      console.log(`   📨 Port ${port}: Received response!`);
      console.log(`      ${message.substring(0, 100)}...`);

      try {
        const parsed = JSON.parse(message);
        if (parsed.type === 'registered' || parsed.type === 'error' || parsed.type === 'response') {
          console.log(`   🎉 Port ${port}: VALID LG TV WebSocket!`);
          console.log(`\n${'='.repeat(70)}`);
          console.log(`✅ FOUND IT! Use port ${port}`);
          console.log(`   WebSocket URL: ws://${TV_IP}:${port}`);
          console.log(`${'='.repeat(70)}\n`);
        }
      } catch (e) {
        // Not JSON, but still a response
        console.log(`   ⚠️  Port ${port}: Response not JSON`);
      }

      ws.close();
      resolve(true);
    });

    ws.on('error', (error) => {
      if (!responded) {
        console.log(`   ❌ Port ${port}: WebSocket error - ${error.message}`);
        clearTimeout(timeout);
        resolve(false);
      }
    });

    ws.on('close', () => {
      if (!responded) {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  });
}

async function findTVPort() {
  console.log('Testing common LG TV ports:\n');

  for (const port of PORTS_TO_TEST) {
    process.stdout.write(`📡 Testing port ${port}... `);
    const found = await testPort(port);

    if (!found) {
      console.log(`❌ Port ${port} not accessible`);
    }

    // Add a small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(70));
  console.log('🏁 Port scan complete');
  console.log('='.repeat(70));
  process.exit(0);
}

findTVPort();
