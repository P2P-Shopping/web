import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

// If you test this on a physical mobile device later, change 'localhost' to your computer's actual IPv4 address.
const SOCKET_URL = 'http://localhost:8082/ws';

const stompClient = new Client({
  // We use SockJS here because you configured `.withSockJS()` in your Spring Boot backend.
  webSocketFactory: () => new SockJS(SOCKET_URL),

  // Fulfills the requirement: "try to re-establish the link every 3 seconds"
  reconnectDelay: 3000,

  // Logs STOMP traffic to your browser console for easy debugging
  debug: (str: string) => {
    console.log(str);
  },

  onStompError: (frame) => {
    console.error('Broker reported error: ' + frame.headers['message']);
  }
});

export default stompClient;