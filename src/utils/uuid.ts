export const uuid = () => {
    const crypto = globalThis.crypto;
    if (crypto?.randomUUID) {
        return crypto.randomUUID();
    }
    if (crypto?.getRandomValues) {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return `${Date.now()}-${array[0].toString(36)}`;
    }
    // Fallback for environments without crypto
    return `${Date.now()}-${Date.now().toString(36)}`;
};
