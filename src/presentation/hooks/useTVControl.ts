import { useState, useCallback, useEffect } from 'react';
import { ControlTV } from '@/core/usecases/ControlTV';
import { LGTVWebSocketService } from '@/infrastructure/api/LGTVWebSocketService';
import { TV, TVConnectionStatus, TVState } from '@/core/entities/TV';
import { TVCommand, TVCommandType } from '@/core/entities/TVCommand';

const tvService = new LGTVWebSocketService();
const controlTV = new ControlTV(tvService);

// LocalStorage keys for session persistence
const SAVED_TV_SESSION_KEY = 'lg-tv-session';
const MANUAL_DISCONNECT_KEY = 'lg-tv-manual-disconnect';

interface SavedTVSession {
  ipAddress: string;
  port: number;
  lastConnected: string;
}

export function useTVControl() {
  const [connectionStatus, setConnectionStatus] = useState<TVConnectionStatus>(
    TVConnectionStatus.DISCONNECTED
  );
  const [error, setError] = useState<string | null>(null);
  const [tvState, setTvState] = useState<TVState>({
    volume: 0,
    muted: false,
  });
  const [connectedTV, setConnectedTV] = useState<SavedTVSession | null>(null);

  useEffect(() => {
    console.log('🎣 Registering TV control hooks');

    controlTV.onConnectionStatusChange((status) => {
      setConnectionStatus(status as TVConnectionStatus);

      // When connected, request initial TV state
      if (status === TVConnectionStatus.CONNECTED) {
        getTVState();
      }
    });

    // Subscribe to TV state changes
    tvService.onStateChange((state) => {
      console.log('🎣 useTVControl received state update:', state);
      setTvState(state);
    });

    console.log('✅ TV control hooks registered');
  }, []);

  const connect = useCallback(async (ipAddress: string, port: number = 3000) => {
    setError(null);
    setConnectionStatus(TVConnectionStatus.CONNECTING);

    const tv: TV = {
      id: `tv-${ipAddress}`,
      name: 'LG TV',
      ipAddress,
      port,
      status: TVConnectionStatus.CONNECTING,
    };

    try {
      await controlTV.connectToTV(tv);

      // Save session to localStorage on successful connection
      const session: SavedTVSession = {
        ipAddress,
        port,
        lastConnected: new Date().toISOString(),
      };
      localStorage.setItem(SAVED_TV_SESSION_KEY, JSON.stringify(session));
      // Clear manual disconnect flag since user is connecting
      localStorage.removeItem(MANUAL_DISCONNECT_KEY);
      setConnectedTV(session);
      console.log('💾 TV session saved to localStorage');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao conectar à TV');
      setConnectionStatus(TVConnectionStatus.ERROR);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await controlTV.disconnectFromTV();

      // Mark as manual disconnect - prevents auto-reconnect
      localStorage.setItem(MANUAL_DISCONNECT_KEY, 'true');
      // Clear saved session
      localStorage.removeItem(SAVED_TV_SESSION_KEY);
      setConnectedTV(null);
      console.log('🗑️ TV session cleared - manual disconnect');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desconectar da TV');
    }
  }, []);

  const sendCommand = useCallback(
    async (type: TVCommandType, payload?: Record<string, unknown>) => {
      if (connectionStatus !== TVConnectionStatus.CONNECTED) {
        setError('Não conectado à TV');
        return;
      }

      const command: TVCommand = { type, payload };

      try {
        await controlTV.executeCommand(command);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao enviar comando');
      }
    },
    [connectionStatus]
  );

  const getTVState = useCallback(async () => {
    try {
      const state = await tvService.getTVState();
      setTvState(state);
    } catch (err) {
      console.error('Error getting TV state:', err);
    }
  }, []);

  // Load saved session from localStorage
  const loadSavedSession = useCallback((): SavedTVSession | null => {
    try {
      const saved = localStorage.getItem(SAVED_TV_SESSION_KEY);
      if (saved) {
        const session: SavedTVSession = JSON.parse(saved);
        console.log('📂 Found saved TV session:', session);
        return session;
      }
    } catch (err) {
      console.error('Error loading saved session:', err);
      localStorage.removeItem(SAVED_TV_SESSION_KEY);
    }
    return null;
  }, []);

  // Restore connection from saved session
  const restoreSession = useCallback(async () => {
    // Check if user manually disconnected last time
    const manualDisconnect = localStorage.getItem(MANUAL_DISCONNECT_KEY);
    if (manualDisconnect === 'true') {
      console.log('⛔ Skipping auto-reconnect - user disconnected manually');
      return;
    }

    const session = loadSavedSession();
    if (session) {
      console.log('🔄 Restoring TV session...');
      await connect(session.ipAddress, session.port);
    }
  }, [connect, loadSavedSession]);

  return {
    connectionStatus,
    error,
    tvState,
    connectedTV,
    connect,
    disconnect,
    sendCommand,
    getTVState,
    loadSavedSession,
    restoreSession,
  };
}
