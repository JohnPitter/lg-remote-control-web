import { useEffect, useState } from 'react';
import { useTVControl } from '@/presentation/hooks/useTVControl';
import { useTVDiscovery } from '@/presentation/hooks/useTVDiscovery';
import { TV, TVConnectionStatus } from '@/core/entities/TV';
import { TVCommandType } from '@/core/entities/TVCommand';
import { RemoteButton } from '@/presentation/components/RemoteButton/RemoteButton';
import { TVList } from '@/presentation/components/TVList/TVList';
import { Button } from '@/presentation/components/Button/Button';
import { Input } from '@/presentation/components/Input/Input';
import styles from './RemoteControl.module.css';

export function RemoteControl() {
  const [manualIP, setManualIP] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const {
    connectionStatus,
    error,
    tvState,
    connectedTV,
    connect,
    disconnect,
    sendCommand,
    restoreSession
  } = useTVControl();
  const {
    discoveredTVs,
    isDiscovering,
    error: discoveryError,
    discover,
  } = useTVDiscovery();

  const isConnected = connectionStatus === TVConnectionStatus.CONNECTED;

  useEffect(() => {
    // Try to restore previous session first, then discover TVs
    const initialize = async () => {
      console.log('🚀 Initializing TV Remote Control...');
      await restoreSession();

      // Small delay to check if session was restored
      setTimeout(() => {
        if (connectionStatus === TVConnectionStatus.DISCONNECTED) {
          console.log('📡 No saved session, starting TV discovery...');
          discover();
        }
      }, 500);
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  useEffect(() => {
    console.log('🖥️ RemoteControl - tvState updated:', tvState);
  }, [tvState]);

  const handleSelectTV = async (tv: TV) => {
    await connect(tv.ipAddress, tv.port);
  };

  const handleManualConnect = async () => {
    if (manualIP) {
      await connect(manualIP, 3000);
    }
  };

  const handleCommand = (commandType: TVCommandType) => {
    console.log('🎮 handleCommand called with:', commandType);
    console.log('🎮 Current tvState:', tvState);
    sendCommand(commandType);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>LG TV Remote Control</h1>
        <div className={styles.connectionStatus}>
          <span
            className={`${styles.statusIndicator} ${
              isConnected ? styles.connected : ''
            }`}
          />
          <span className={styles.statusText}>
            {connectionStatus === TVConnectionStatus.CONNECTED && 'Conectado'}
            {connectionStatus === TVConnectionStatus.CONNECTING && 'Conectando...'}
            {connectionStatus === TVConnectionStatus.DISCONNECTED && 'Desconectado'}
            {connectionStatus === TVConnectionStatus.ERROR && 'Erro de conexão'}
            {connectedTV && isConnected && ` - ${connectedTV.ipAddress}`}
          </span>
        </div>
      </header>

      {!isConnected && (
        <div className={styles.connectionPanel}>
          {connectionStatus === TVConnectionStatus.CONNECTING && connectedTV && (
            <div className={styles.infoMessage}>
              🔄 Reconectando à TV {connectedTV.ipAddress}...
            </div>
          )}

          <div className={styles.discoverySection}>
            <TVList
              tvs={discoveredTVs}
              onSelectTV={handleSelectTV}
              isLoading={isDiscovering}
            />

            {discoveryError && (
              <div className={styles.errorMessage}>{discoveryError}</div>
            )}

            {error && <div className={styles.errorMessage}>{error}</div>}

            <div className={styles.actions}>
              <Button onClick={discover} variant="secondary" fullWidth disabled={isDiscovering}>
                {isDiscovering ? 'Procurando...' : 'Buscar Novamente'}
              </Button>

              <div className={styles.divider}>
                <span>ou</span>
              </div>

              {!showManualInput ? (
                <Button
                  onClick={() => setShowManualInput(true)}
                  variant="ghost"
                  fullWidth
                >
                  Conectar Manualmente
                </Button>
              ) : (
                <div className={styles.manualInputSection}>
                  <Input
                    label="Endereço IP da TV"
                    placeholder="192.168.3.58"
                    value={manualIP}
                    onChange={(e) => setManualIP(e.target.value)}
                    fullWidth
                  />
                  <div className={styles.manualActions}>
                    <Button onClick={handleManualConnect} fullWidth disabled={!manualIP}>
                      Conectar
                    </Button>
                    <Button
                      onClick={() => setShowManualInput(false)}
                      variant="ghost"
                      fullWidth
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isConnected && (
        <>
          <div className={styles.remoteContainer}>
            {/* Power Button */}
            <div className={styles.powerSection}>
              <RemoteButton
                label="POWER"
                onClick={() => handleCommand(TVCommandType.POWER)}
                variant="danger"
                size="lg"
              />
            </div>

            {/* TV State Display */}
            <div className={styles.stateDisplay}>
              <div className={styles.stateItem}>
                <span className={styles.stateLabel}>Volume</span>
                <span className={styles.stateValue}>{tvState.volume}</span>
              </div>
              <div className={styles.stateItem}>
                <span className={styles.stateLabel}>Status</span>
                <span className={styles.stateValue}>
                  {tvState.muted ? '🔇 Mutado' : '🔊 Som Ativo'}
                </span>
              </div>
            </div>

            {/* Navigation Pad */}
            <div className={styles.navigationPad}>
              <div className={styles.navRow}>
                <RemoteButton
                  label="↑"
                  onClick={() => handleCommand(TVCommandType.UP)}
                />
              </div>
              <div className={styles.navRow}>
                <RemoteButton
                  label="←"
                  onClick={() => handleCommand(TVCommandType.LEFT)}
                />
                <RemoteButton
                  label="OK"
                  onClick={() => handleCommand(TVCommandType.ENTER)}
                  variant="primary"
                />
                <RemoteButton
                  label="→"
                  onClick={() => handleCommand(TVCommandType.RIGHT)}
                />
              </div>
              <div className={styles.navRow}>
                <RemoteButton
                  label="↓"
                  onClick={() => handleCommand(TVCommandType.DOWN)}
                />
              </div>
            </div>

            {/* Home Button */}
            <div className={styles.homeSection}>
              <RemoteButton
                label="HOME"
                onClick={() => handleCommand(TVCommandType.HOME)}
              />
            </div>

            {/* Back & Mute Controls */}
            <div className={styles.backMuteControls}>
              <RemoteButton
                label="BACK"
                onClick={() => handleCommand(TVCommandType.BACK)}
              />
              <RemoteButton
                label={tvState.muted ? "DESMUTAR" : "MUTAR"}
                onClick={() => {
                  console.log('🔇 Mute button clicked, tvState.muted:', tvState.muted);
                  const muteValue = !tvState.muted; // Toggle: se mutado → false, se não mutado → true
                  console.log('🔇 Setting mute to:', muteValue);
                  sendCommand(TVCommandType.VOLUME_MUTE, { mute: muteValue });
                }}
              />
            </div>

            {/* Volume Controls */}
            <div className={styles.volumeControls}>
              <RemoteButton
                label="VOL +"
                onClick={() => handleCommand(TVCommandType.VOLUME_UP)}
              />
              <RemoteButton
                label="VOL −"
                onClick={() => handleCommand(TVCommandType.VOLUME_DOWN)}
              />
            </div>

            {/* Channel Controls */}
            <div className={styles.channelControls}>
              <RemoteButton
                label="CH +"
                onClick={() => handleCommand(TVCommandType.CHANNEL_UP)}
              />
              <RemoteButton
                label="CH −"
                onClick={() => handleCommand(TVCommandType.CHANNEL_DOWN)}
              />
            </div>

            {/* Media Controls */}
            <div className={styles.mediaControls}>
              <RemoteButton
                label="⏪"
                onClick={() => handleCommand(TVCommandType.REWIND)}
                size="sm"
              />
              <RemoteButton
                label="▶"
                onClick={() => handleCommand(TVCommandType.PLAY)}
                size="sm"
              />
              <RemoteButton
                label="⏸"
                onClick={() => handleCommand(TVCommandType.PAUSE)}
                size="sm"
              />
              <RemoteButton
                label="⏹"
                onClick={() => handleCommand(TVCommandType.STOP)}
                size="sm"
              />
              <RemoteButton
                label="⏩"
                onClick={() => handleCommand(TVCommandType.FAST_FORWARD)}
                size="sm"
              />
            </div>
          </div>

          <div className={styles.disconnectSection}>
            <Button onClick={disconnect} variant="secondary" fullWidth>
              Desconectar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
