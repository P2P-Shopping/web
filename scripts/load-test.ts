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

async function simulateUser(userId: number) {
    return new Promise((resolve, reject) => {
        let interval: any;
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

                let eventsSent = 0;
                interval = setInterval(
                    () => {
                        const isBatch = secureRandom() > 0.7;

                        if (isBatch) {
                            const batch = Array.from({ length: 3 }).map(() => ({
                                action: "CHECK_OFF",
                                itemId: `load-item-${Math.floor(secureRandom() * 20)}`,
                                checked: secureRandom() > 0.5,
                                timestamp: Date.now(),
                            }));
                            client.publish({
                                destination: `/app/list/${LIST_ID}/batch-update`,
                                body: JSON.stringify(batch),
                            });
                        } else {
                            const payload = {
                                action: "CHECK_OFF",
                                itemId: `load-item-${Math.floor(secureRandom() * 20)}`,
                                checked: secureRandom() > 0.5,
                                timestamp: Date.now(),
                            };
                            client.publish({
                                destination: `/app/list/${LIST_ID}/update`,
                                body: JSON.stringify(payload),
                            });
                        }

                        eventsSent++;
                        if (eventsSent >= EVENTS_PER_USER) {
                            // Stay connected a bit then disconnect
                            setTimeout(() => {
                                cleanup();
                                resolve(true);
                            }, 1000);
                        }
                    },
                    500 + secureRandom() * 1000,
                );
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
                // If it closed before finishing events, consider it an error for the test
                reject(new Error("WebSocket closed unexpectedly"));
            },
        });

        const safetyTimeout = setTimeout(() => {
            if (!settled) {
                console.error(`User ${userId} simulation timed out`);
                cleanup();
                reject(new Error("Simulation timeout"));
            }
        }, 20000); // 20s safety timeout

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

    // Run users in chunks to avoid overwhelming the local machine's FD limit
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

runTest().catch((err) => {
    console.error("Test failed:", err);
});
