import { Client } from "@stomp/stompjs";

/**
 * Load Test Script for P2P Shopping Concurrency Controller
 * Simulates 100 simultaneous users connecting to the same list and sending rapid updates.
 *
 * Usage: bun scripts/load-test.ts [listId]
 */

const LIST_ID = process.argv[2] || "demo-list";
const USER_COUNT = 100;
const EVENTS_PER_USER = 5;
const SOCKET_URL = "ws://localhost:8081/ws";

// Use Bun's built-in WebSocket
if (typeof WebSocket === "undefined") {
    console.error("This script must be run with Bun.");
    process.exit(1);
}

function secureRandom(): number {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
}

function generateEventPayload() {
    const createItem = () => ({
        action: "CHECK_OFF",
        itemId: `load-item-${Math.floor(secureRandom() * 20)}`,
        checked: secureRandom() > 0.5,
        timestamp: Date.now(),
    });

    return secureRandom() > 0.7
        ? Array.from({ length: 3 }).map(createItem)
        : createItem();
}

function startUserActivity(client: Client, onComplete: () => void) {
    let eventsSent = 0;
    const interval = setInterval(
        () => {
            const payload = generateEventPayload();
            const destination = Array.isArray(payload)
                ? `/app/list/${LIST_ID}/batch-update`
                : `/app/list/${LIST_ID}/update`;

            client.publish({
                destination,
                body: JSON.stringify(payload),
            });

            eventsSent++;
            if (eventsSent >= EVENTS_PER_USER) {
                clearInterval(interval);
                setTimeout(onComplete, 1000);
            }
        },
        500 + secureRandom() * 1000,
    );
    return interval;
}

async function simulateUser(userId: number) {
    return new Promise((resolve, reject) => {
        let interval: ReturnType<typeof setInterval> | undefined;
        let settled = false;

        const cleanup = () => {
            if (settled) return;
            settled = true;
            if (interval) clearInterval(interval);
            if (safetyTimeout) clearTimeout(safetyTimeout);
            client.deactivate();
        };

        const client = new Client({
            brokerURL: SOCKET_URL,
            webSocketFactory: () => new WebSocket(SOCKET_URL),
            reconnectDelay: 0,
            debug: (str) => {
                if (userId === 0) console.log(`[User 0] ${str}`);
            },
            onConnect: () => {
                if (userId % 10 === 0) console.log(`User ${userId} connected`);
                interval = startUserActivity(client, () => {
                    cleanup();
                    resolve(true);
                });
            },
            onStompError: (frame) => {
                console.error(
                    `User ${userId} STOMP error:`,
                    frame.headers.message,
                );
                cleanup();
                reject(frame);
            },
            onWebSocketClose: () => {
                if (userId % 10 === 0)
                    console.log(`User ${userId} connection closed`);
                cleanup();
                reject(new Error("WebSocket closed unexpectedly"));
            },
        });

        const safetyTimeout = setTimeout(() => {
            if (!settled) {
                console.error(`User ${userId} simulation timed out`);
                cleanup();
                reject(new Error("Simulation timeout"));
            }
        }, 20000);

        client.activate();
    });
}

async function runTest() {
    console.log("==========================================");
    console.log(`Starting Concurrency Load Test`);
    console.log(`Users: ${USER_COUNT}`);
    console.log(`Target List: ${LIST_ID}`);
    console.log(`Total Expected Events: ${USER_COUNT * EVENTS_PER_USER}`);
    console.log("==========================================");

    const startTime = Date.now();

    const CHUNK_SIZE = 20;
    for (let i = 0; i < USER_COUNT; i += CHUNK_SIZE) {
        const chunk = [];
        for (let j = i; j < i + CHUNK_SIZE && j < USER_COUNT; j++) {
            chunk.push(simulateUser(j));
        }
        await Promise.all(chunk);
        console.log(
            `Completed chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(USER_COUNT / CHUNK_SIZE)}`,
        );
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log("==========================================");
    console.log(`Test Finished in ${duration.toFixed(2)}s`);
    console.log("Monitor server memory using: jstat -gc <pid>");
    console.log("==========================================");
}

try {
    await runTest();
} catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
}
