import WebSocket from 'ws';

const TV_IP = '192.168.3.58';

// Test different ports and paths
const configurations = [
  // Port 3000 with different paths
  { port: 3000, path: '', secure: false },
  { port: 3000, path: '/', secure: false },
  { port: 3000, path: '/api/v1', secure: false },
  { port: 3000, path: '/ws', secure: false },
  { port: 3000, path: '/socket', secure: false },

  // Port 3001 with different paths
  { port: 3001, path: '', secure: false },
  { port: 3001, path: '/', secure: false },
  { port: 3001, path: '/ws', secure: false },

  // Port 36866 (returned 404, so server exists!)
  { port: 36866, path: '', secure: false },
  { port: 36866, path: '/', secure: false },
  { port: 36866, path: '/api', secure: false },
  { port: 36866, path: '/api/v1', secure: false },
  { port: 36866, path: '/ws', secure: false },
  { port: 36866, path: '/websocket', secure: false },
  { port: 36866, path: '/lgtv', secure: false },
  { port: 36866, path: '/webos', secure: false },

  // Try secure on 3000/3001
  { port: 3000, path: '/', secure: true },
  { port: 3001, path: '/', secure: true },
];

console.log('='.repeat(70));
console.log('🔍 Testing Different WebSocket Paths');
console.log('='.repeat(70));
console.log(`\n🎯 Target: ${TV_IP}\n`);

let currentTest = 0;
const totalTests = configurations.length;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function testConfig(config: { port: number; path: string; secure: boolean }) {
  return new Promise<void>((resolve) => {
    const protocol = config.secure ? 'wss' : 'ws';
    const url = `${protocol}://${TV_IP}:${config.port}${config.path}`;

    currentTest++;
    console.log(`[${currentTest}/${totalTests}] Testing: ${url}`);

    const ws = new WebSocket(url, {
      rejectUnauthorized: false,
      handshakeTimeout: 3000
    });

    let responded = false;

    const timeout = setTimeout(() => {
      if (!responded) {
        console.log('  ⏱️  Timeout\n');
        ws.terminate();
        resolve();
      }
    }, 3000);

    ws.on('open', () => {
      responded = true;
      clearTimeout(timeout);
      console.log('  ✅ CONNECTED! Sending handshake...');

      const handshake = {
        type: 'register',
        id: 'test',
        payload: {
          'pairingType': 'PROMPT',
          manifest: {
            manifestVersion: 1,
            permissions: ['TEST']
          }
        }
      };

      ws.send(JSON.stringify(handshake));

      // Wait a bit for response
      setTimeout(() => {
        if (!responded) {
          console.log('  ⚠️  No response to handshake\n');
          ws.close();
          resolve();
        }
      }, 2000);
    });

    ws.on('message', (data) => {
      responded = true;
      clearTimeout(timeout);

      const message = data.toString();
      console.log('  📨 RECEIVED RESPONSE!');

      try {
        const parsed = JSON.parse(message);
        console.log('  ✨ Type:', parsed.type);

        if (parsed.type === 'registered') {
          console.log('\n' + '🎉'.repeat(35));
          console.log('  🎉🎉🎉 SUCCESS! FOUND THE RIGHT CONFIGURATION! 🎉🎉🎉');
          console.log('  🎉'.repeat(35));
          console.log(`\n  ✅ Working URL: ${url}`);
          console.log(`  ✅ Protocol: ${protocol.toUpperCase()}`);
          console.log(`  ✅ Port: ${config.port}`);
          console.log(`  ✅ Path: "${config.path || '(root)'}"`);
          console.log('\n');
        } else {
          console.log('  Response:', JSON.stringify(parsed, null, 2));
        }
      } catch (e) {
        console.log('  Raw:', message.substring(0, 100));
      }

      console.log('');
      ws.close();
      setTimeout(resolve, 500);
    });

    ws.on('error', (error: any) => {
      responded = true;
      clearTimeout(timeout);

      if (error.code === 'ECONNRESET') {
        console.log('  ❌ Connection reset\n');
      } else if (error.message.includes('404')) {
        console.log('  ❌ 404 - Wrong path\n');
      } else if (error.message.includes('403')) {
        console.log('  ❌ 403 - Forbidden\n');
      } else if (error.code === 'ECONNREFUSED') {
        console.log('  ❌ Connection refused\n');
      } else {
        console.log(`  ❌ ${error.message}\n`);
      }

      resolve();
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function runTests() {
  for (const config of configurations) {
    await testConfig(config);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('='.repeat(70));
  console.log('🏁 Test complete');
  console.log('='.repeat(70));
  process.exit(0);
}

runTests();
