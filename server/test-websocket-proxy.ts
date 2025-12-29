import WebSocket from 'ws';

const TV_IP = '192.168.3.58';
const TV_PORT = '3000';
const PROXY_URL = `ws://localhost:3001/tv-proxy?ip=${TV_IP}&port=${TV_PORT}`;

console.log('='.repeat(70));
console.log('🧪 Testing WebSocket Proxy Connection to LG TV');
console.log('='.repeat(70));
console.log(`\n📡 Proxy URL: ${PROXY_URL}`);
console.log(`🎯 Target TV: ${TV_IP}:${TV_PORT}\n`);
console.log('⏳ Connecting...\n');

const ws = new WebSocket(PROXY_URL);
let messageCount = 0;

ws.on('open', () => {
  console.log('✅ WebSocket Proxy Connected!\n');
  console.log('📤 Sending handshake to TV...\n');

  // LG TV Handshake message
  const handshake = {
    type: 'register',
    id: 'test-connection',
    payload: {
      'forcePairing': false,
      'pairingType': 'PROMPT',
      'manifest': {
        'manifestVersion': 1,
        'appVersion': '1.0.0',
        'signed': {
          'created': '20140509',
          'appId': 'com.lge.test',
          'vendorId': 'com.lge',
          'localizedAppNames': {
            '': 'LG TV Remote Test',
            'pt-BR': 'Teste Controle LG TV'
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
            'WRITE_NOTIFICATION_TOAST',
            'CONTROL_INPUT_TEXT',
            'CONTROL_MOUSE_AND_KEYBOARD',
            'READ_INSTALLED_APPS',
            'CONTROL_DISPLAY',
            'CONTROL_INPUT_TOUCHPAD',
            'CONTROL_INPUT_TV',
            'CONTROL_INPUT_MEDIA_PLAYBACK',
            'CONTROL_AUDIO'
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
          'WRITE_NOTIFICATION_TOAST',
          'CONTROL_INPUT_TOUCHPAD',
          'CONTROL_INPUT_TV',
          'CONTROL_INPUT_MEDIA_PLAYBACK',
          'CONTROL_AUDIO'
        ]
      }
    }
  };

  ws.send(JSON.stringify(handshake));
  console.log('✉️  Handshake sent!\n');
});

ws.on('message', (data) => {
  messageCount++;
  const message = data.toString();

  console.log(`📨 Message #${messageCount} from TV (${message.length} bytes):`);
  console.log('-'.repeat(70));

  try {
    const parsed = JSON.parse(message);
    console.log(JSON.stringify(parsed, null, 2));

    if (parsed.type === 'registered') {
      console.log('\n🎉 SUCCESS! TV Accepted Connection!');
      console.log('✅ Registration successful');

      if (parsed.payload?.['client-key']) {
        console.log(`🔑 Client Key: ${parsed.payload['client-key']}`);
      }

      // Try to get volume
      setTimeout(() => {
        console.log('\n📊 Testing command: Get Volume');
        const volumeRequest = {
          type: 'request',
          id: 'get-volume-1',
          uri: 'ssap://audio/getVolume'
        };
        ws.send(JSON.stringify(volumeRequest));
      }, 1000);

      // Close after 3 seconds
      setTimeout(() => {
        console.log('\n👋 Closing connection...');
        ws.close();
      }, 3000);
    }

    if (parsed.type === 'response') {
      console.log('\n📊 TV Response received');
    }

    if (parsed.type === 'error') {
      console.log('\n❌ TV returned error');
    }

  } catch (e) {
    console.log(message);
  }

  console.log('-'.repeat(70) + '\n');
});

ws.on('error', (error) => {
  console.log(`\n❌ WebSocket Error: ${error.message}\n`);
  process.exit(1);
});

ws.on('close', () => {
  console.log('='.repeat(70));
  console.log('🔌 Connection Closed');
  console.log(`📊 Total messages received: ${messageCount}`);
  console.log('='.repeat(70));
  process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('\n⏱️  Timeout - No response from TV');
  console.log('   Make sure:');
  console.log('   1. npm run dev:server is running');
  console.log('   2. TV is powered on (not standby)');
  console.log('   3. TV is at 192.168.3.58');
  ws.close();
}, 10000);
