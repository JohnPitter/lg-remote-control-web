import { Router, Request, Response } from 'express';
import { TVDiscoveryService } from '../services/TVDiscoveryService';

const router = Router();
const discoveryService = new TVDiscoveryService();

router.get('/discover', async (_req: Request, res: Response) => {
  try {
    console.log('🔍 Discovery request received');
    const tvs = await discoveryService.discoverTVs();
    console.log(`✅ Discovery complete: Found ${tvs.length} TV(s)`);

    res.json({
      success: true,
      count: tvs.length,
      tvs,
    });
  } catch (error) {
    console.error('❌ Error discovering TVs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discover TVs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/test-ip', async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP address is required',
      });
    }

    console.log(`🔍 Testing specific IP: ${ip}`);
    const tv = await discoveryService.testSpecificIP(ip);

    if (tv) {
      console.log(`✅ Successfully connected to ${ip}`);
      res.json({
        success: true,
        tv,
      });
    } else {
      console.log(`❌ Could not connect to ${ip}`);
      res.json({
        success: false,
        error: `Could not connect to TV at ${ip}. Make sure the TV is on and port 3000 is open.`,
      });
    }
  } catch (error) {
    console.error('❌ Error testing IP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test IP',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
