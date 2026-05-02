import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

/**
 * Singleton service managing the STOMP WebSocket connection.
 * Handles automatic reconnection and routes messages between the React frontend and Spring Boot backend.
 */
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "/ws";

const stompClient = new Client({
    webSocketFactory: () => new SockJS(SOCKET_URL),
    reconnectDelay: 3000,
    connectHeaders: {}, // Will be set dynamically

    // Security: Only print STOMP frames to the console during local development.
    debug: import.meta.env.DEV ? (str: string) => console.debug(str) : () => {},

    onStompError: (frame) => {
        console.error(`Broker reported error: ${frame.headers.message}`);
    },
});

export default stompClient;
