import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

// Pulls the URL from an environment variable, falling back to localhost if not set
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8082/ws';

const stompClient = new Client({
  webSocketFactory: () => new SockJS(SOCKET_URL),
  reconnectDelay: 3000,

  // Only logs STOMP frames if Vite is running in development mode
  debug: import.meta.env.DEV
    ? (str: string) => console.debug(str)
    : () => {},

  onStompError: (frame) => {
    console.error('Broker reported error: ' + frame.headers['message']);
  }
});

export default stompClient;