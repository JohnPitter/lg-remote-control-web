import WebSocket from 'ws';

const PROXY_URL = 'ws://localhost:3001/tv-proxy?ip=192.168.3.58&port=3001';

console.log('='.repeat(70));
console.log('🔄 Testing Complete Proxy Flow (Client → Proxy → TV)');
console.log('='.repeat(70));
console.log(`\n🎯 Connecting through proxy: ${PROXY_URL}\n`);

const ws = new WebSocket(PROXY_URL);

let hasResponse = false;

const timeout = setTimeout(() => {
  if (!hasResponse) {
    console.log('⏱️  Timeout - no response after 10 seconds');
    ws.terminate();
    process.exit(1);
  }
}, 10000);

ws.on('open', () => {
  console.log('✅ Connected to proxy!\n');
  hasResponse = true;
});

ws.on('message', (data) => {
  hasResponse = true;
  clearTimeout(timeout);

  const message = data.toString();
  console.log('📨 RECEIVED MESSAGE:\n');

  try {
    const parsed = JSON.parse(message);
    console.log(JSON.stringify(parsed, null, 2));
    console.log('');

    if (parsed.type === 'proxy-status' && parsed.status === 'connected') {
      console.log('✅ Proxy connected to TV successfully!');
      console.log('📤 Sending registration handshake through proxy...\n');

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

      ws.send(JSON.stringify(handshake));
    } else if (parsed.type === 'response' && parsed.payload?.pairingType === 'PROMPT') {
      console.log('🎉'.repeat(35));
      console.log('🎉 SUCCESS! PROXY FLOW WORKING! 🎉');
      console.log('🎉'.repeat(35));
      console.log('\n✅ Complete flow verified:');
      console.log('   1. Client connected to proxy ✓');
      console.log('   2. Proxy connected to TV (wss://192.168.3.58:3001) ✓');
      console.log('   3. Handshake sent through proxy ✓');
      console.log('   4. TV responded with pairing prompt ✓');
      console.log('\n💡 Next steps:');
      console.log('   - Accept pairing on TV screen');
      console.log('   - Use client-key for authenticated requests');
      console.log('   - Start sending remote control commands\n');

      setTimeout(() => {
        ws.close();
        console.log('='.repeat(70));
        console.log('🏁 Test completed successfully!');
        console.log('='.repeat(70));
        process.exit(0);
      }, 1000);
    } else if (parsed.type === 'registered') {
      console.log('🎉'.repeat(35));
      console.log('🎉 FULLY REGISTERED! 🎉');
      console.log('🎉'.repeat(35));
      console.log('\n✅ TV accepted the pairing!');
      if (parsed.payload?.['client-key']) {
        console.log(`   Client Key: ${parsed.payload['client-key']}`);
      }

      setTimeout(() => {
        ws.close();
        console.log('\n='.repeat(70));
        console.log('🏁 Test completed - Ready to send commands!');
        console.log('='.repeat(70));
        process.exit(0);
      }, 1000);
    } else if (parsed.type === 'proxy-error') {
      console.log(`❌ Proxy error: ${parsed.error}`);
      process.exit(1);
    } else {
      console.log(`📋 Message type: ${parsed.type}`);
    }
  } catch (e) {
    console.log('Raw message (not JSON):');
    console.log(message);
  }
});

ws.on('error', (error: any) => {
  hasResponse = true;
  clearTimeout(timeout);

  console.log('❌ WebSocket Error:\n');
  console.log(`   ${error.message}`);
  console.log(`   Code: ${error.code || 'N/A'}`);
  console.log('\n' + '='.repeat(70));
  console.log('❌ Test failed');
  console.log('='.repeat(70));
  process.exit(1);
});

ws.on('close', (code, reason) => {
  clearTimeout(timeout);
  if (!hasResponse) {
    console.log('❌ Connection closed before any response');
    console.log(`   Code: ${code}`);
    console.log(`   Reason: ${reason || 'No reason'}`);
    process.exit(1);
  }
});
