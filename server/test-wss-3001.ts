import WebSocket from 'ws';

const TV_IP = '192.168.3.58';
const PORT = 3001;

// Disable SSL certificate validation for self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('='.repeat(70));
console.log('🔐 Testing WSS Connection on Port 3001 (Secure WebSocket)');
console.log('='.repeat(70));
console.log(`\n🎯 Target: wss://${TV_IP}:${PORT}\n`);

const wsUrl = `wss://${TV_IP}:${PORT}`;
console.log(`📡 Connecting to ${wsUrl}...`);

const ws = new WebSocket(wsUrl, {
  rejectUnauthorized: false, // Accept self-signed certificates
  handshakeTimeout: 5000
});

let hasResponse = false;

const timeout = setTimeout(() => {
  if (!hasResponse) {
    console.log('⏱️  Timeout - no response after 10 seconds');
    ws.terminate();
    process.exit(1);
  }
}, 10000);

ws.on('open', () => {
  console.log('✅ WebSocket CONNECTED successfully!\n');
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
            '': 'LG Remote App'
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

  console.log('📤 Sending registration handshake...');
  ws.send(JSON.stringify(handshake));
  console.log('⏳ Waiting for TV response...\n');
});

ws.on('message', (data) => {
  hasResponse = true;
  clearTimeout(timeout);

  const message = data.toString();
  console.log('📨 RECEIVED MESSAGE FROM TV!\n');

  try {
    const parsed = JSON.parse(message);
    console.log('✨ Parsed response:');
    console.log(JSON.stringify(parsed, null, 2));
    console.log('');

    if (parsed.type === 'registered') {
      console.log('🎉'.repeat(35));
      console.log('🎉 SUCCESS! CONNECTION ESTABLISHED! 🎉');
      console.log('🎉'.repeat(35));
      console.log('\n✅ Configuration confirmed:');
      console.log(`   Protocol: WSS (Secure WebSocket)`);
      console.log(`   Port: ${PORT}`);
      console.log(`   URL: ${wsUrl}`);

      if (parsed.payload?.['client-key']) {
        console.log(`   Client Key: ${parsed.payload['client-key']}`);
        console.log('\n💡 Save this client-key for future connections!');
      }

      console.log('\n✅ The proxy configuration is correct!');
      console.log('   Update your frontend to use wss://3001\n');
    } else if (parsed.type === 'error') {
      console.log(`⚠️  TV returned error: ${parsed.payload?.error || 'Unknown error'}`);
    } else {
      console.log(`📋 Response type: ${parsed.type}`);
    }
  } catch (e) {
    console.log('Raw message (not JSON):');
    console.log(message.substring(0, 200));
  }

  setTimeout(() => {
    ws.close();
    console.log('\n' + '='.repeat(70));
    console.log('🏁 Test completed successfully');
    console.log('='.repeat(70));
    process.exit(0);
  }, 1000);
});

ws.on('error', (error: any) => {
  hasResponse = true;
  clearTimeout(timeout);

  console.log('❌ WebSocket Error occurred:\n');
  console.log(`   Error: ${error.message}`);
  console.log(`   Code: ${error.code || 'N/A'}`);

  if (error.code === 'ECONNRESET') {
    console.log('\n   ⚠️  ECONNRESET - Connection reset by TV');
    console.log('   This usually means:');
    console.log('   - Wrong protocol (ws vs wss)');
    console.log('   - Wrong port');
    console.log('   - TV requires different handshake');
  } else if (error.code === 'ECONNREFUSED') {
    console.log('\n   ⚠️  Connection refused - port might be closed');
  } else if (error.message.includes('certificate')) {
    console.log('\n   ⚠️  SSL certificate issue (should be handled by rejectUnauthorized: false)');
  }

  console.log('\n' + '='.repeat(70));
  console.log('❌ Test failed');
  console.log('='.repeat(70));
  process.exit(1);
});

ws.on('close', (code, reason) => {
  clearTimeout(timeout);
  if (hasResponse) {
    console.log(`\n🔌 Connection closed: ${code} - ${reason || 'No reason provided'}`);
  }
});
