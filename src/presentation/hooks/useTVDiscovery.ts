import { useState, useCallback } from 'react';
import { TV } from '@/core/entities/TV';
import { TVDiscoveryAPIService } from '@/infrastructure/api/TVDiscoveryAPIService';

const discoveryService = new TVDiscoveryAPIService();

export function useTVDiscovery() {
  const [discoveredTVs, setDiscoveredTVs] = useState<TV[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(async () => {
    setIsDiscovering(true);
    setError(null);

    try {
      const tvs = await discoveryService.discoverTVs();
      setDiscoveredTVs(tvs);

      if (tvs.length === 0) {
        setError('Nenhuma TV encontrada na rede');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao buscar TVs. Verifique se o servidor está rodando.'
      );
      setDiscoveredTVs([]);
    } finally {
      setIsDiscovering(false);
    }
  }, []);

  return {
    discoveredTVs,
    isDiscovering,
    error,
    discover,
  };
}
