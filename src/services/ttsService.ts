export function speakInstruction(instruction: string): void {
    if (!instruction) return;

    // biome-ignore lint/suspicious/noExplicitAny: Android interface is injected at runtime
    const win = globalThis as any;

    // biome-ignore lint/complexity/useOptionalChain: explicit null check for Android interface
    if (win.AndroidInterface && win.AndroidInterface.speak) {
        win.AndroidInterface.speak(instruction);
    } else if (globalThis.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(instruction);
        utterance.lang = "ro-RO";
        utterance.rate = 1;
        globalThis.speechSynthesis.speak(utterance);
    }
}
