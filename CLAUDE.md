# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based web application for controlling LG webOS TVs via Wi-Fi. Built with React, TypeScript, and Vite, following Clean Architecture principles.

## Architecture

### Clean Architecture Layers

The project follows Clean Architecture with clear separation of concerns:

- **Core Layer** (`src/core/`):
  - `entities/`: Business entities (TV, TVCommand, TVState)
  - `usecases/`: Application business rules (ControlTV)
  - `interfaces/`: Contracts/abstractions (ITVService)

- **Infrastructure Layer** (`src/infrastructure/`):
  - `api/`: External integrations (LGTVWebSocketService, TVDiscoveryAPIService)
  - `storage/`: Data persistence

- **Server Layer** (`server/src/`):
  - `services/`: TV Discovery via SSDP and WebSocket Proxy
  - `routes/`: REST API endpoints
  - `types/`: TypeScript type definitions

- **Presentation Layer** (`src/presentation/`):
  - `components/`: Reusable UI components (Button, Input, RemoteButton)
  - `pages/`: Page-level components (RemoteControl)
  - `hooks/`: Custom React hooks (useTVControl)
  - `styles/`: Global styles and design tokens

- **Shared Layer** (`src/shared/`):
  - `utils/`: Utility functions
  - `constants/`: Application constants

### TV Discovery

The application automatically discovers LG TVs on the local network:
- **Protocol**: SSDP (Simple Service Discovery Protocol) via UDP multicast
- **Implementation**: Node.js backend service using native `dgram` module
- **Search Target**: `urn:lge-com:service:webos-second-screen:1`
- **Discovery Time**: ~5 seconds timeout
- **Fallback**: Network scan on subnet 192.168.3.0/24
- **Manual Input**: Option to manually enter TV IP address

### Communication Protocol

The application uses WebSocket to communicate with LG webOS TVs:
- **WebSocket Proxy**: Node.js backend proxy at `ws://localhost:3001/tv-proxy`
- **TV Connection**: Secure WebSocket (WSS) on port 3001 (`wss://TV_IP:3001`)
- **Protocol**: SSAP (Second Screen Application Protocol)
- **Security**:
  - SSL/TLS encrypted connection to TV (self-signed certificates accepted)
  - Client-key based pairing stored in localStorage
  - Text-only message format (binary not supported by webOS)
- **Features**: Auto-reconnection with exponential backoff

**Proxy Architecture**:
The proxy is required because:
1. Browsers cannot connect directly to TV due to CORS/SSL restrictions
2. Proxy handles SSL certificate validation (self-signed certs)
3. Ensures messages are sent as text (not binary)

**Flow**:
```
Browser → ws://localhost:3001/tv-proxy → Node.js Proxy → wss://TV_IP:3001 → LG TV
```

## Princípios de Desenvolvimento

### Prompt Mestre

1. Arquitetura Limpa
2. Performance Baseada na Teoria do Big O Notation
3. Mitigado Contra Principais CVEs
4. Resiliência dos Serviços e Uso de Cache
5. Design Moderno Baseado No Contexto
6. Garantia das Funcionalidades Através da Pirâmide de Testes
7. Segurança
8. Observabilidade
9. Princípios do Designs System
10. Criar um Plano e Construção Por Fases e SubFases
11. Alterações Documentadas
12. Alteração da Aplicação com Build Funcional

### Agente

1. Se Um Comando Demorar Muito Para Rodar Cancele
2. Caso Uma Solução Não Funcione, Tente Uma Nova Abordagem Pesquisando Na Internet
3. Economia de Token: Foco na Implementação e Menos em Resumos

## Development Commands

### Setup
```bash
npm install
```

### Development
```bash
npm run dev          # Start frontend dev server (port 5173)
npm run dev:server   # Start backend server (port 3001)
npm run dev:all      # Start both frontend and backend concurrently
npm run build        # Build frontend for production
npm run build:server # Build backend server
npm run preview      # Preview production build
```

**Important**: For full functionality (TV discovery + control), run both servers:
```bash
npm run dev:all
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run test         # Run tests in watch mode
npm run test -- --run # Run tests once
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage report
```

### Testing Strategy

The project follows the Testing Pyramid:
- **Unit Tests**: Core business logic (usecases, entities)
- **Integration Tests**: Service integrations (WebSocket, storage)
- **Component Tests**: UI components with React Testing Library

Test files are colocated with source files using `.test.ts` or `.test.tsx` extension.

### Diagnostic Tests

#### TV Discovery
```bash
npm run test:discovery  # Test SSDP and network scan discovery
```

#### WebSocket Connection
```bash
npm run test:wss          # Test direct WSS connection to TV on port 3001
npm run test:proxy-flow   # Test complete proxy flow (Client → Proxy → TV)
npm run test:find-port    # Scan common LG TV ports
npm run test:tv-paths     # Test different WebSocket paths
npm run test:ws-detailed  # Detailed WebSocket connection test
```

### Design System

UI components follow a consistent design system with:
- Design tokens defined in `src/presentation/styles/tokens.ts`
- CSS Modules for component styling
- Dark theme by default (LG brand colors)
- Responsive and accessible components

## Important Files

### Configuration
- `vite.config.ts` - Frontend build configuration
- `server/tsconfig.json` - Backend TypeScript configuration
- `tsconfig.json` - Frontend TypeScript configuration
- `package.json` - Dependencies and scripts

### Core Services
- `server/src/services/TVDiscoveryService.ts` - SSDP discovery + network scan
- `server/src/services/TVWebSocketProxy.ts` - WebSocket proxy for TV communication
- `src/infrastructure/api/LGTVWebSocketService.ts` - Frontend WebSocket client
- `src/infrastructure/api/TVDiscoveryAPIService.ts` - Discovery API client

### Test Scripts
- `server/test-wss-3001.ts` - Direct WSS connection test
- `server/test-proxy-flow.ts` - Complete proxy flow test
- `server/test-tv-connection.ts` - Discovery test
- `server/test-find-tv-port.ts` - Port scanning test

## Documentation

- **CHANGELOG.md** - Todas as melhorias, mudanças e troubleshooting
- **README.md** - User-facing documentation
- **CLAUDE.md** - This file (developer guidance)

## Technical Notes

### WebSocket Protocol (SSAP)

LG webOS uses SSAP (Second Screen Application Protocol) over WebSocket.

**Current Requirements** (firmware with CVE-2021-4154, CVE-2022-2588 patches):
- Port: 3001 (legacy port 3000 disabled)
- Protocol: WSS (SSL/TLS encrypted)
- Message Format: Text only (binary rejected)

**Handshake**: See `CHANGELOG.md` for detailed protocol documentation.

### Environment Variables

```bash
NODE_TLS_REJECT_UNAUTHORIZED='0'  # Accept self-signed SSL certificates (proxy only)
```

### Key Dependencies

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Express, ws (WebSocket), Node.js native modules (dgram, net)
- **Testing**: Vitest, React Testing Library
- **Dev Tools**: ESLint, Prettier, Nodemon, tsx

## Troubleshooting

For troubleshooting information, error solutions, and detailed changelog, see **CHANGELOG.md**.
