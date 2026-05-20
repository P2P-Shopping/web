import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getApiBaseUrl } from "./api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `${getApiBaseUrl()}/ws`;

const stompClient = new Client({
    webSocketFactory: () => new SockJS(SOCKET_URL),
    reconnectDelay: 5000,
    connectHeaders: {},

    debug: import.meta.env.DEV ? (str: string) => console.debug(str) : () => {},

    onStompError: (frame) => {
        console.error(`Broker reported error: ${frame.headers.message}`);
    },

    onWebSocketError: (event) => {
        if (import.meta.env.DEV) {
            console.debug("[ws] WebSocket error:", event);
        }
    },
});

export default stompClient;
