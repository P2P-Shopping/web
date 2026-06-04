export function speakInstruction(instruction: string): void {
    if (!instruction) return;
    
    const win = globalThis as any;
    
    if (win.AndroidInterface && win.AndroidInterface.speak) {
        win.AndroidInterface.speak(instruction);
    } else if (globalThis.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(instruction);
        utterance.lang = "ro-RO";
        utterance.rate = 1;
        globalThis.speechSynthesis.speak(utterance);
    }
}
