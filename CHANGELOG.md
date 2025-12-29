# Changelog

Todas as melhorias e mudanças notáveis neste projeto serão documentadas neste arquivo.

## [2025-12-29] - Navigation Buttons Fix (InputSocket Implementation)

### Problema Identificado
- Botões de navegação (UP, DOWN, LEFT, RIGHT, ENTER) retornando erro 404
- Erro: `ssap://com.webos.service.ime/sendKeyEvent` - "404 no such service or method"
- URI `sendKeyEvent` não existe na API LG webOS

### Solução Implementada: InputSocket API

A LG webOS requer uso de **InputSocket** separado para comandos de botão/navegação, não aceita via SSAP regular.

#### Como Funciona InputSocket

1. **Request InputSocket Path** - Solicita caminho do socket via SSAP:
```json
{
  "type": "request",
  "uri": "ssap://com.webos.service.networkinput/getPointerInputSocket",
  "payload": {}
}
```

2. **TV Response** - TV responde com caminho único:
```json
{
  "type": "response",
  "payload": {
    "socketPath": "/path/to/input/socket/xyz123"
  }
}
```

3. **Establish WebSocket** - Conecta ao InputSocket:
```
wss://TV_IP:3001/path/to/input/socket/xyz123
```

4. **Send Button Commands** - Envia em formato texto específico:
```
type:button
name:UP

```

### Mudanças Implementadas

#### 1. TVCommand.ts - Comandos com Prefixo `button:`
```typescript
// Antes (não funcionava)
UP = 'ssap://com.webos.service.ime/sendKeyEvent',
DOWN = 'ssap://com.webos.service.ime/sendKeyEvent',

// Depois (funciona)
UP = 'button:UP',
DOWN = 'button:DOWN',
LEFT = 'button:LEFT',
RIGHT = 'button:RIGHT',
ENTER = 'button:ENTER',
```

#### 2. LGTVWebSocketService.ts - Detecção de Button Commands
Adicionado detector que identifica comandos com prefixo `button:` e envia formato especial:
```typescript
if (command.type.startsWith('button:')) {
  const buttonName = command.type.split(':')[1];
  const buttonMessage = {
    type: 'button',
    name: buttonName,
  };
  this.ws.send(JSON.stringify(buttonMessage));
}
```

#### 3. TVWebSocketProxy.ts - Handler InputSocket
Novo método `handleButtonCommand()` que:
- ✅ Solicita InputSocket path da TV via `getPointerInputSocket`
- ✅ Aguarda resposta com socketPath (timeout 5s)
- ✅ Estabelece conexão WebSocket separada ao InputSocket
- ✅ Cacheia InputSocket por TV (reutiliza em próximos comandos)
- ✅ Envia comando no formato `type:button\nname:UP\n\n`
- ✅ Retorna resposta de sucesso ao cliente

```typescript
private async handleButtonCommand(
  tvWs: WebSocket,
  clientWs: WebSocket,
  buttonName: string,
  tvIP: string,
  tvPort: string,
  connectionKey: string
): Promise<void> {
  // Request InputSocket if not cached
  if (!this.inputSockets.get(connectionKey)) {
    const socketPath = await requestInputSocket();
    const inputSocket = new WebSocket(`wss://${tvIP}:${tvPort}${socketPath}`);
    this.inputSockets.set(connectionKey, inputSocket);
  }

  // Send button command
  const buttonCommand = `type:button\nname:${buttonName}\n\n`;
  inputSocket.send(buttonCommand);
}
```

### Arquitetura do Fluxo

```
User clicks UP button
    ↓
RemoteControl.tsx → sendCommand(TVCommandType.UP)
    ↓
useTVControl.ts → tvService.sendCommand({ type: 'button:UP' })
    ↓
LGTVWebSocketService.ts → detecta 'button:' prefix
    ↓
Envia via WebSocket: { type: 'button', name: 'UP' }
    ↓
TVWebSocketProxy.ts → recebe no handler clientWs.on('message')
    ↓
handleButtonCommand() → Request/Connect InputSocket
    ↓
Envia via InputSocket: "type:button\nname:UP\n\n"
    ↓
LG TV executa comando de navegação
```

### Logs Esperados

Quando usuário clicar em botão de navegação:
```
📤 Sending button command: UP
🔗 New client connected to proxy
🎮 Handling button command: UP
🔌 Requesting InputSocket from TV...
✅ Got InputSocket path: /path/to/socket/xyz
✅ InputSocket connected
📤 Sending button through InputSocket: UP
```

### Benefícios

- ✅ Botões de navegação funcionando corretamente
- ✅ Reutilização de InputSocket (performance)
- ✅ Suporte a todos os botões da LG (não apenas navegação)
- ✅ Arquitetura escalável para novos comandos

### Correção de Timing na Conexão

**Problema**: Requisições de volume sendo enviadas antes do registro completar, causando erro "401 insufficient permissions"

**Solução**: Movida requisição inicial de volume de `proxy-status` para `registered` handler:
```typescript
// Antes: enviava após proxy-status (muito cedo)
if (message.type === 'proxy-status') {
  setTimeout(() => getVolume(), 500); // ❌ TV ainda não registrada
}

// Depois: envia apenas após registro completar
if (message.type === 'registered') {
  setTimeout(() => getVolume(), 100); // ✅ TV já registrada
}
```

### Filtro de IPs Locais no Discovery

**Problema**: Discovery detectava o próprio servidor (192.168.3.6:3001) como uma "TV" e tentava conectar, causando erro SSL

**Solução**: Adicionado filtro de IPs locais no TVDiscoveryService:
```typescript
constructor() {
  this.initializeLocalIPs();  // Detecta IPs da máquina
}

private initializeLocalIPs(): void {
  const interfaces = os.networkInterfaces();
  // Adiciona todos os IPs locais ao Set
  this.localIPs.add(addr.address);
}

// No network scan:
socket.on('connect', () => {
  if (this.localIPs.has(ip)) {
    this.log(`⏭️  Skipping local IP ${ip} (this server)`);
    return;  // Não adiciona próprio servidor como TV
  }
  // Adiciona TV descoberta normalmente
});
```

**Resultado**: Discovery agora retorna apenas TVs reais, não o servidor proxy

### Correção de URL do InputSocket

**Problema**: LG TV retorna `socketPath` como URL completa (`wss://192.168.3.58:3001/resources/...`), mas código estava concatenando, resultando em URL duplicada

**Erro**:
```
Invalid URL: wss://192.168.3.58:3001wss://192.168.3.58:3001/resources/.../netinput.pointer.sock
```

**Solução**: Detectar se socketPath já é URL completa:
```typescript
let inputSocketUrl: string;
if (socketPath.startsWith('ws://') || socketPath.startsWith('wss://')) {
  // Already a complete URL - use directly
  inputSocketUrl = socketPath;
} else {
  // Just a path - build full URL
  const protocol = tvPort === '3001' ? 'wss' : 'ws';
  inputSocketUrl = `${protocol}://${tvIP}:${tvPort}${socketPath}`;
}
```

**Resultado**: InputSocket agora conecta corretamente independente do formato retornado pela TV

### Arquivos Modificados
- `src/core/entities/TVCommand.ts` - Mudou URIs para prefixo `button:`
- `src/infrastructure/api/LGTVWebSocketService.ts` - Detector de button commands + timing fix
- `server/src/services/TVWebSocketProxy.ts` - InputSocket handler + correção de URL
- `server/src/services/TVDiscoveryService.ts` - Filtro de IPs locais

---

## [2025-12-29] - UI/UX Improvements & Session Persistence

### Melhorias de Interface

#### 1. Reorganização dos Botões do Controle Remoto
- ✅ Layout reorganizado por contexto funcional:
  - **POWER**: Topo, centralizado
  - **TV State Display**: Volume e status de mute em tempo real
  - **Navigation Pad**: Setas direcionais + OK
  - **HOME**: Botão único centralizado
  - **BACK + MUTE/UNMUTE**: Lado a lado, acima dos controles de volume
  - **VOL+/VOL-**: Lado a lado, centralizados (70% largura)
  - **CH+/CH-**: Abaixo dos volumes
  - **Media Controls**: 5 botões (⏪ ▶ ⏸ ⏹ ⏩)

#### 2. Sistema de Mute/Unmute Inteligente
- ✅ Botão único que alterna entre "MUTAR" e "DESMUTAR"
- ✅ Label dinâmica baseada no estado atual da TV
- ✅ Comandos corretos:
  - Quando não mutado → envia `VOLUME_MUTE` com `{mute: true}`
  - Quando mutado → envia `VOLUME_UNMUTE` com `{mute: false}`

#### 3. Exibição do Estado da TV em Tempo Real
- ✅ Painel de estado mostrando:
  - Volume atual (0-100)
  - Status de mute (🔇 Mutado / 🔊 Som Ativo)
- ✅ Design glassmorphism Apple-style
- ✅ Atualização automática ao mudar volume/mute

#### 4. Design Apple-Style Glassmorphism
- ✅ Botões com `backdrop-filter: blur(20px)`
- ✅ Gradientes LG vermelho para botões primários
- ✅ Efeito de brilho com `::before` pseudo-elemento
- ✅ Sombras em múltiplas camadas
- ✅ Animações suaves com `cubic-bezier`
- ✅ Estados hover/active interativos

### Persistência de Sessão

#### 5. Auto-Reconexão com LocalStorage
- ✅ Salva sessão automaticamente ao conectar:
  ```json
  {
    "ipAddress": "192.168.3.58",
    "port": 3000,
    "lastConnected": "2025-12-29T12:30:00.000Z"
  }
  ```
- ✅ Reconecta automaticamente ao recarregar página
- ✅ Mensagem de feedback: "🔄 Reconectando à TV..."
- ✅ Status mostra IP quando conectado: "Conectado - 192.168.3.58"

#### 6. Controle de Desconexão Manual
- ✅ Flag `lg-tv-manual-disconnect` para diferenciar:
  - Desconexão manual (usuário clicou) → não reconecta
  - Desconexão automática (erro de rede) → tentaria reconectar
- ✅ Ao conectar novamente, limpa flag e habilita auto-reconexão
- ✅ Logs claros: `⛔ Skipping auto-reconnect - user disconnected manually`

### Correções Técnicas

#### 7. Parser de Volume LG TV
- ✅ Corrigido para ler estrutura correta da resposta:
  ```json
  {
    "volumeStatus": {
      "volume": 23,
      "muteStatus": false
    }
  }
  ```
- ✅ Fallback para propriedades diretas quando aplicável
- ✅ Suporte para múltiplos formatos de resposta da TV

#### 8. Deduplicação de TVs na Descoberta
- ✅ Usa **IP address** como chave única (não UUID)
- ✅ Previne duplicatas quando mesma TV responde múltiplos serviços UPnP:
  - Antes: 7 TVs (mesma TV física aparecia 6x)
  - Depois: 2 TVs (uma por dispositivo físico)
- ✅ Lógica inteligente: prefere nomes mais descritivos
- ✅ Logs: `ℹ️ Skipping duplicate TV response from 192.168.3.58`

#### 9. State Management com Callbacks
- ✅ Sistema de callbacks para mudanças de estado:
  ```typescript
  tvService.onStateChange((state) => {
    setTvState(state);
  });
  ```
- ✅ Notificações automáticas após comandos de volume/mute
- ✅ Request automático de estado após 100ms de cada comando
- ✅ Múltiplos subscribers suportados

### Arquivos Modificados

#### Frontend
- `src/core/entities/TVCommand.ts` - Adicionado VOLUME_UNMUTE, VOLUME_GET
- `src/core/interfaces/ITVService.ts` - Adicionado onStateChange()
- `src/infrastructure/api/LGTVWebSocketService.ts` - Parser de volume, state management
- `src/presentation/hooks/useTVControl.ts` - Persistência de sessão, controle de reconexão
- `src/presentation/pages/RemoteControl/RemoteControl.tsx` - Nova organização de botões
- `src/presentation/pages/RemoteControl/RemoteControl.module.css` - Estilos Apple-style
- `src/presentation/components/RemoteButton/RemoteButton.module.css` - Glassmorphism

#### Backend
- `server/src/services/TVDiscoveryService.ts` - Deduplicação por IP

### Logs de Debug Adicionados
```
💾 TV session saved to localStorage
📂 Found saved TV session: {...}
🔄 Restoring TV session...
⛔ Skipping auto-reconnect - user disconnected manually
🔊 TV State updated: {volume: 23, muted: false}
🔔 Notifying state change to callbacks: 2
🎣 useTVControl received state update: {...}
📢 Direct muteStatus in response: true
🔇 Mute button clicked, tvState.muted: false
```

---

## [2025-12-29] - WebSocket Connection Fix

### Problema Identificado
- TV LG rejeitando conexões WebSocket com erro `ECONNRESET`
- Erro "400 binary messages not supported" ao enviar handshake
- Conexão na porta 3000 falhando consistentemente

### Causa Raiz
Atualizações recentes de firmware do LG webOS (patches de segurança CVE-2021-4154 e CVE-2022-2588) mudaram os requisitos do protocolo WebSocket:
- **Antes**: `ws://TV_IP:3000` (WebSocket não criptografado)
- **Depois**: `wss://TV_IP:3001` (WebSocket criptografado com SSL)
- TV rejeita mensagens em formato binário, aceita apenas texto

### Mudanças Implementadas

#### 1. WebSocket Proxy (`server/src/services/TVWebSocketProxy.ts`)
- ✅ Porta padrão alterada de 3000 para 3001
- ✅ Protocolo alterado para WSS quando porta é 3001
- ✅ Adicionado suporte SSL com `rejectUnauthorized: false`
- ✅ Mensagens enviadas como texto: `tvWs.send(data.toString(), { binary: false })`
- ✅ Variável de ambiente `NODE_TLS_REJECT_UNAUTHORIZED='0'` para aceitar certificados auto-assinados

```typescript
// Antes
const tvWsUrl = `ws://${tvIP}:3000`;
tvWs.send(data);

// Depois
const protocol = tvPort === '3001' ? 'wss' : 'ws';
const tvWsUrl = `${protocol}://${tvIP}:${tvPort}`;
tvWs.send(data.toString(), { binary: false });
```

#### 2. TV Discovery Service (`server/src/services/TVDiscoveryService.ts`)
- ✅ Constante `LG_TV_PORT` alterada de 3000 para 3001
- ✅ Mensagens de log atualizadas para refletir porta correta

#### 3. Server Startup (`server/src/index.ts`)
- ✅ URL de exemplo atualizada: `ws://localhost:3001/tv-proxy?ip=<TV_IP>&port=3001`

### Scripts de Teste Criados

#### `server/test-wss-3001.ts`
Testa conexão direta WSS na porta 3001
```bash
npm run test:wss
```

#### `server/test-proxy-flow.ts`
Testa fluxo completo (Cliente → Proxy → TV)
```bash
npm run test:proxy-flow
```

#### Outros Scripts de Diagnóstico
- `npm run test:find-port` - Escaneia portas comuns da TV LG
- `npm run test:tv-paths` - Testa diferentes caminhos WebSocket
- `npm run test:ws-detailed` - Teste detalhado de conexão WebSocket

### Resultados dos Testes

#### ✅ Teste de Conexão Direta WSS
```
🔐 Testing WSS Connection on Port 3001
✅ WebSocket CONNECTED successfully!
📤 Sending registration handshake...
📨 RECEIVED MESSAGE FROM TV!
Type: response (pairing prompt)
```

#### ✅ Teste de Fluxo Completo do Proxy
```
🔄 Testing Complete Proxy Flow
✅ Connected to proxy!
✅ Proxy connected to TV successfully!
📤 Sending registration handshake through proxy...
📨 RECEIVED MESSAGE:
🎉 SUCCESS! PROXY FLOW WORKING! 🎉
```

### Arquitetura do Proxy

O proxy é necessário porque:
1. **Restrições de CORS/SSL**: Navegadores não podem conectar diretamente à TV
2. **Validação de Certificado SSL**: Proxy lida com certificados auto-assinados
3. **Formato de Mensagem**: Garante que mensagens são enviadas como texto, não binário

**Fluxo**:
```
Browser (localhost:5173)
    ↓ ws://localhost:3001/tv-proxy?ip=192.168.3.58&port=3001
Node.js Proxy (localhost:3001)
    ↓ wss://192.168.3.58:3001 (SSL)
LG TV webOS
```

---

## [2025-12-29] - TV Discovery Implementation

### Funcionalidades Adicionadas

#### SSDP Discovery Service
- Descoberta automática via SSDP (Simple Service Discovery Protocol)
- Multicast UDP na rede local
- Search Target: `urn:lge-com:service:webos-second-screen:1`
- Timeout de 5 segundos

#### Network Scan Fallback
- Escaneamento de rede como fallback quando SSDP falha
- Testa porta 3001 em todos os IPs da subnet (192.168.3.0/24)
- Identifica TVs LG mesmo sem resposta SSDP

#### Manual IP Input
- Interface para entrada manual de IP
- Fallback final quando discovery automático falha
- Validação de formato de IP

### Script de Teste
```bash
npm run test:discovery
```

Executa:
1. Teste de conexão direta a IP específico
2. Discovery SSDP completo
3. Network scan da subnet
4. Logs detalhados do que foi encontrado

---

## Troubleshooting

### WebSocket Connection Issues

**Problema**: Conexão com TV falha com `ECONNRESET` ou "binary messages not supported"

**Solução**:
1. Usar `wss://TV_IP:3001` ao invés de `ws://TV_IP:3000`
2. Configurar `NODE_TLS_REJECT_UNAUTHORIZED='0'` para aceitar certificados auto-assinados
3. Enviar mensagens como texto com opção `{ binary: false }`

**Arquivos Afetados**:
- `server/src/services/TVWebSocketProxy.ts`
- `server/src/services/TVDiscoveryService.ts`
- `server/src/index.ts`

**Teste**:
```bash
npm run test:proxy-flow
```

**Saída Esperada**:
```
✅ Proxy connected to TV (wss://192.168.3.58:3001)
✅ TV responded with pairing prompt
```

### TV Not Discovered

**Problema**: TV não aparece na lista de discovery

**Soluções**:
1. Garantir que TV está na mesma rede Wi-Fi
2. Verificar configurações de rede da TV (permitir conexões remotas)
3. Usar entrada manual de IP como fallback
4. Executar teste de discovery: `npm run test:discovery`

**Fallback Automático**: O serviço de discovery inclui escaneamento de rede que testa portas comuns em todos os IPs da subnet.

### Debugging WebSocket Connection

**Logs do Proxy**:
```bash
npm run dev:server
```

Observe:
- `🔗 New client connected to proxy`
- `🎯 Connecting to TV at wss://...`
- `✅ Connected to TV at ...`
- `📤 Message from client: ...`
- `📨 Message from TV: ...`

**Testes de Diagnóstico**:
```bash
# Testar conexão direta
npm run test:wss

# Testar fluxo completo
npm run test:proxy-flow

# Escanear portas
npm run test:find-port

# Testar diferentes caminhos
npm run test:tv-paths
```

---

## Informações Técnicas

### Protocolo WebSocket

#### LG webOS SSAP (Second Screen Application Protocol)

**Handshake de Registro**:
```json
{
  "type": "register",
  "id": "register_0",
  "payload": {
    "forcePairing": false,
    "pairingType": "PROMPT",
    "manifest": {
      "manifestVersion": 1,
      "appVersion": "1.1",
      "permissions": [
        "CONTROL_POWER",
        "CONTROL_INPUT_TV",
        "CONTROL_AUDIO",
        ...
      ]
    }
  }
}
```

**Resposta de Pairing**:
```json
{
  "type": "response",
  "id": "register_0",
  "payload": {
    "pairingType": "PROMPT",
    "returnValue": true
  }
}
```

**Resposta de Registro Completo**:
```json
{
  "type": "registered",
  "id": "register_0",
  "payload": {
    "client-key": "xxxxx..."
  }
}
```

### CVEs Relacionadas

#### CVE-2021-4154
- Vulnerabilidade em conexões WebSocket não criptografadas
- LG respondeu exigindo SSL/TLS em firmware recente

#### CVE-2022-2588
- Vulnerabilidade em validação de mensagens
- LG passou a rejeitar mensagens binárias, aceita apenas texto

### Compatibilidade

**Testado com**:
- LG webOS TV 2020+
- Firmware atualizado com patches de segurança recentes
- Porta 3001 com SSL/TLS

**Portas**:
- **3000**: Porta legada (desabilitada em firmwares recentes)
- **3001**: Porta atual com SSL/TLS
- **36866**: Porta alternativa em alguns modelos (retorna 404)

---

## Next Features

### Planejado
- [ ] Persistência de client-key para reconexão automática
- [ ] Suporte a múltiplas TVs simultaneamente
- [ ] Comandos avançados (abrir apps, navegar menus)
- [ ] Interface de configuração de rede
- [ ] Modo offline com cache de comandos
- [ ] Notificações de estado da TV

### Em Investigação
- [ ] Suporte a modelos mais antigos (porta 3000)
- [ ] Discovery via mDNS/Bonjour
- [ ] Wake-on-LAN para ligar TV
