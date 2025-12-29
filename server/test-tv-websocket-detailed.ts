import WebSocket from 'ws';
import https from 'https';

const TV_IP = '192.168.3.58';
const PORT = 3000;

// Disable SSL verification for self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const tests = [
  { url: `ws://${TV_IP}:${PORT}`, desc: 'Plain WebSocket (ws)' },
  { url: `ws://${TV_IP}:${PORT}/`, desc: 'Plain WebSocket with /' },
  { url: `wss://${TV_IP}:${PORT}`, desc: 'Secure WebSocket (wss)' },
  { url: `wss://${TV_IP}:${PORT}/`, desc: 'Secure WebSocket with /' },
];

console.log('='.repeat(70));
console.log('🔬 Detailed LG TV WebSocket Connection Test');
console.log('='.repeat(70));
console.log(`\n🎯 Target: ${TV_IP}:${PORT}\n`);

let currentTest = 0;

function testConnection(config: { url: string; desc: string }) {
  return new Promise<void>((resolve) => {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Test ${currentTest + 1}/${tests.length}: ${config.desc}`);
    console.log(`URL: ${config.url}`);
    console.log('─'.repeat(70));

    const isSecure = config.url.startsWith('wss://');

    const ws = new WebSocket(config.url, {
      rejectUnauthorized: false, // Accept self-signed certificates
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });

    let hasResponse = false;

    const timeout = setTimeout(() => {
      if (!hasResponse) {
        console.log('⏱️  Timeout - no response');
        ws.terminate();
        resolve();
      }
    }, 5000);

    ws.on('open', () => {
      console.log('✅ WebSocket CONNECTED!');
      hasResponse = true;

      const handshake = {
        type: 'register',
        id: 'register_0',
        payload: {
          'forcePairing': false,
          'pairingType': 'PROMPT',
          'manifest': {
            'manifestVersion': 1,
            'appVersion': '1.1',
            'signed': {
              'created': '20140509',
              'appId': 'com.lge.test',
              'vendorId': 'com.lge',
              'localizedAppNames': {
                '': 'LG Remote Test'
              },
              'localizedVendorNames': {
                '': 'LG Electronics'
              },
              'permissions': [
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
                'WRITE_NOTIFICATION_TOAST'
              ],
              'serial': '2f930e2d2cfe083771f68e4fe7bb07'
            },
            'permissions': [
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
        }
      };

      console.log('📤 Sending handshake...');
      ws.send(JSON.stringify(handshake));
    });

    ws.on('message', (data) => {
      hasResponse = true;
      clearTimeout(timeout);

      console.log('📨 RECEIVED MESSAGE!');
      const message = data.toString();

      try {
        const parsed = JSON.parse(message);
        console.log('✨ Parsed JSON:');
        console.log(JSON.stringify(parsed, null, 2));

        if (parsed.type === 'registered') {
          console.log('\n🎉🎉🎉 SUCCESS! THIS IS THE RIGHT CONFIGURATION! 🎉🎉🎉');
          console.log(`\n✅ Use: ${config.url}`);
          console.log(`   Protocol: ${isSecure ? 'WSS (Secure)' : 'WS (Plain)'}`);
          if (parsed.payload?.['client-key']) {
            console.log(`   Client Key: ${parsed.payload['client-key']}`);
          }
        }
      } catch (e) {
        console.log('Raw message:', message);
      }

      setTimeout(() => {
        ws.close();
        resolve();
      }, 1000);
    });

    ws.on('error', (error: any) => {
      hasResponse = true;
      clearTimeout(timeout);
      console.log(`❌ WebSocket Error: ${error.message}`);
      console.log(`   Code: ${error.code || 'N/A'}`);

      if (error.code === 'ECONNRESET') {
        console.log('   → Connection reset by TV');
        console.log('   → TV might expect different protocol or auth');
      } else if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        console.log('   → Self-signed certificate (expected for wss)');
      } else if (error.message.includes('404')) {
        console.log('   → Wrong URL path');
      }

      resolve();
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      if (hasResponse) {
        console.log(`🔌 Connection closed: ${code} - ${reason || 'No reason'}`);
      }
      resolve();
    });
  });
}

async function runTests() {
  for (const test of tests) {
    await testConnection(test);
    currentTest++;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(70));
  console.log('🏁 All tests completed');
  console.log('='.repeat(70));
  process.exit(0);
}

runTests();
