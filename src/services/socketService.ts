import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "/ws";

const stompClient = new Client({
    webSocketFactory: () => new SockJS(SOCKET_URL),
    reconnectDelay: 0,
    connectHeaders: {},

    debug: import.meta.env.DEV ? (str: string) => console.debug(str) : () => {},

    onStompError: (frame) => {
        console.error(`Broker reported error: ${frame.headers.message}`);
    },
});

export default stompClient;
