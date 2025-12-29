# LG TV Remote Control

Aplicação web React para controlar TVs LG webOS via Wi-Fi.

## Funcionalidades

- **Descoberta Automática de TVs**: Encontra TVs LG na rede sem precisar digitar IP
- Conexão via WebSocket com TVs LG webOS
- Interface de controle remoto completa
- Controles de navegação (setas, OK, voltar, home)
- Controles de volume e mute
- Controles de canal
- Controles de mídia (play, pause, stop, avançar, retroceder)
- Botão de power
- Reconexão automática com backoff exponencial
- Interface responsiva com tema escuro

## Tecnologias

### Frontend
- **React 19** - Framework UI
- **TypeScript** - Type safety
- **Vite** - Build tool e dev server
- **Vitest** - Framework de testes
- **React Testing Library** - Testes de componentes
- **ESLint + Prettier** - Qualidade de código
- **CSS Modules** - Estilos com escopo

### Backend
- **Node.js** - Runtime para servidor de descoberta
- **Express** - Framework web
- **SSDP** - Protocolo de descoberta via UDP multicast
- **TypeScript** - Type safety no servidor

## Arquitetura

O projeto segue os princípios de **Clean Architecture**:

- **Core**: Entidades, casos de uso e interfaces
- **Infrastructure**: Implementações de APIs e storage
- **Presentation**: Componentes, páginas e hooks React
- **Shared**: Utilitários e constantes

## Como Usar

### Pré-requisitos

- Node.js 18+
- TV LG webOS conectada na mesma rede Wi-Fi

### Instalação

```bash
npm install
```

### Desenvolvimento

**IMPORTANTE**: A aplicação requer frontend E backend rodando juntos.

Execute ambos simultaneamente:
```bash
npm run dev:all
```

Ou execute separadamente em terminais diferentes:
```bash
# Terminal 1
npm run dev:server  # Backend (porta 3001)

# Terminal 2
npm run dev         # Frontend (porta 3000)
```

**Por que precisa do backend?**
- Descoberta automática de TVs via SSDP
- Proxy WebSocket para conectar com a TV
- Navegadores não podem conectar diretamente à TV por restrições de segurança

### Build de Produção

```bash
npm run build
```

### Executar Testes

```bash
npm test              # Testes unitários (modo watch)
npm test -- --run     # Testes unitários (uma vez)
npm run test:coverage # Testes com cobertura
npm run test:discovery # Testar descoberta de TVs na rede
npm run test:proxy     # Testar conexão WebSocket com TV (requer backend rodando)
```

**Teste rápido da conexão:**
1. Abra um terminal e execute: `npm run dev:server`
2. Em outro terminal execute: `npm run test:proxy`
3. Se a TV estiver ligada, você verá: `🎉 SUCCESS! TV Accepted Connection!`

### Linting

```bash
npm run lint
```

## Como Conectar

1. Certifique-se de que sua TV LG está ligada e na mesma rede Wi-Fi
2. Execute a aplicação com `npm run dev:all`
3. Abra http://localhost:3000 no navegador
4. A aplicação automaticamente buscará TVs na rede
5. Clique na TV que deseja controlar na lista
6. Na primeira conexão, aceite o pareamento na TV
7. Use os controles para operar sua TV

**Nota**: Se nenhuma TV for encontrada automaticamente, clique em "Buscar Novamente" ou verifique se:
- A TV está ligada
- A TV está na mesma rede Wi-Fi
- Não há firewall bloqueando o tráfego SSDP (porta UDP 1900)

## Troubleshooting

### TV não encontrada automaticamente

Se a aplicação não encontrar sua TV automaticamente:

1. **Use a conexão manual**:
   - Clique em "Conectar Manualmente"
   - Digite o IP da sua TV (ex: 192.168.3.58)
   - Clique em "Conectar"

2. **Teste a descoberta**:
   ```bash
   npm run test:discovery
   ```
   Este comando testará a descoberta SSDP e varredura de rede, mostrando todas as TVs encontradas.

3. **Verifique logs do servidor**:
   - Ao executar `npm run dev:all`, observe os logs do servidor
   - Procure por mensagens como "Found TV at 192.168.x.x"

4. **Problemas comuns**:
   - **Firewall**: Certifique-se que a porta UDP 1900 (SSDP) e TCP 3000 (LG TV) não estão bloqueadas
   - **Subnet diferente**: O código atualmente varre 192.168.3.0/24 - se sua TV está em outra subnet, use conexão manual
   - **TV em modo standby**: Certifique-se que a TV está completamente ligada, não apenas em standby

## Desenvolvimento

Para mais informações sobre desenvolvimento, consulte o arquivo [CLAUDE.md](./CLAUDE.md).