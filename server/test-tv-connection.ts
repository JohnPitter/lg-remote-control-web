import { TVDiscoveryService } from './src/services/TVDiscoveryService';

async function testConnection() {
  const service = new TVDiscoveryService();

  console.log('='.repeat(60));
  console.log('🧪 Testing TV Discovery Service');
  console.log('='.repeat(60));

  // Test specific IP
  console.log('\n1️⃣  Testing specific IP: 192.168.3.58');
  console.log('-'.repeat(60));
  const tvResult = await service.testSpecificIP('192.168.3.58');

  if (tvResult) {
    console.log('✅ SUCCESS! TV found:');
    console.log(JSON.stringify(tvResult, null, 2));
  } else {
    console.log('❌ FAILED: Could not connect to 192.168.3.58:3000');
    console.log('   Make sure:');
    console.log('   - TV is powered on');
    console.log('   - TV is on the same network');
    console.log('   - Port 3000 is accessible');
  }

  // Test full discovery
  console.log('\n2️⃣  Testing full discovery (SSDP + Network Scan)');
  console.log('-'.repeat(60));
  const tvs = await service.discoverTVs();

  console.log(`\n📊 Discovery Results: Found ${tvs.length} TV(s)`);
  if (tvs.length > 0) {
    tvs.forEach((tv, index) => {
      console.log(`\n   TV #${index + 1}:`);
      console.log(JSON.stringify(tv, null, 2));
    });
  } else {
    console.log('   No TVs found');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete');
  console.log('='.repeat(60));
}

testConnection().catch(console.error);
