import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";

/**
 * Singleton service managing the STOMP WebSocket connection.
 * Handles automatic reconnection and routes messages between the React frontend and Spring Boot backend.
 */
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "/ws";

// In development, we bypass the Vite proxy for WebSockets to avoid connection abortion issues.
const isLocal = globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1";
const DEV_BACKEND_WS = "ws://localhost:8081/ws";

const protocol = globalThis.location.protocol === "https:" ? "wss" : "ws";
const PRODUCTION_WS = `${protocol}://${globalThis.location.host}${SOCKET_URL}`;

/** Unique identifier for this specific browser tab/instance. */
export const clientInstanceId = Math.random().toString(36).substring(2, 15);

const stompClient = new Client({
    brokerURL: isLocal ? DEV_BACKEND_WS : PRODUCTION_WS,
    reconnectDelay: 3000,
    connectHeaders: {}, // Will be set dynamically

    // Security: Only print STOMP frames to the console during local development.
    debug: import.meta.env.DEV ? (str: string) => console.debug(str) : () => {},

    onStompError: (frame) => {
        console.error(`Broker reported error: ${frame.headers.message}`);
    },
});

/**
 * Convenience wrapper exposing a stable, typed API for list-level subscriptions and publishes.
 */
export const socketService = {
    /**
     * Subscribes to a STOMP destination when the socket is connected.
     * @param destination - Topic destination to subscribe to.
     * @param callback - Message handler called for each incoming frame.
     * @returns Active subscription, or null when the socket is disconnected.
     */
    subscribe: (
        destination: string,
        callback: (message: IMessage) => void,
    ): StompSubscription | null => {
        if (!stompClient.connected) {
            return null;
        }
        return stompClient.subscribe(destination, callback);
    },

    /**
     * Publishes a message body to a STOMP destination when the socket is connected.
     * @param destination - Application destination that receives updates.
     * @param body - JSON payload serialized as a string.
     */
    publish: (destination: string, body: string): void => {
        if (!stompClient.connected) {
            console.warn("[ws] cannot publish, not connected", destination);
            return;
        }
        stompClient.publish({
            destination,
            body,
            headers: { "content-type": "application/json" },
        });
    },
};

export default stompClient;
