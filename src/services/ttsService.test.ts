import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { speakInstruction } from "./ttsService";

describe("ttsService", () => {
    let originalAndroidInterface: Window["AndroidInterface"];
    let originalSpeechSynthesis: SpeechSynthesis | undefined;
    let originalSpeechSynthesisUtterance: typeof SpeechSynthesisUtterance;

    beforeEach(() => {
        originalAndroidInterface = (
            globalThis as unknown as {
                AndroidInterface?: Window["AndroidInterface"];
            }
        ).AndroidInterface;
        originalSpeechSynthesis = globalThis.speechSynthesis;
        originalSpeechSynthesisUtterance = (
            globalThis as unknown as {
                SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance;
            }
        ).SpeechSynthesisUtterance;

        (
            globalThis as unknown as Record<string, unknown>
        ).SpeechSynthesisUtterance = class MockUtterance
            implements SpeechSynthesisUtterance
        {
            text: string;
            lang: string = "";
            rate: number = 1;
            pitch: number = 1;
            volume: number = 1;
            voice: SpeechSynthesisVoice | null = null;
            constructor(text: string) {
                this.text = text;
            }
            onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
            onend: ((event: SpeechSynthesisEvent) => void) | null = null;
            onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
            onpause: ((event: SpeechSynthesisEvent) => void) | null = null;
            onresume: ((event: SpeechSynthesisEvent) => void) | null = null;
            onmark: ((event: SpeechSynthesisEvent) => void) | null = null;
            onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;
            addEventListener<K extends keyof SpeechSynthesisUtteranceEventMap>(
                _type: K,
                _listener: (
                    this: SpeechSynthesisUtterance,
                    ev: SpeechSynthesisUtteranceEventMap[K],
                ) => void,
            ): void {}
            removeEventListener<
                K extends keyof SpeechSynthesisUtteranceEventMap,
            >(
                _type: K,
                _listener: (
                    this: SpeechSynthesisUtterance,
                    ev: SpeechSynthesisUtteranceEventMap[K],
                ) => void,
            ): void {}
            dispatchEvent(): boolean {
                return true;
            }
        };
    });

    afterEach(() => {
        (globalThis as unknown as Record<string, unknown>).AndroidInterface =
            originalAndroidInterface;
        globalThis.speechSynthesis = originalSpeechSynthesis;
        (
            globalThis as unknown as Record<string, unknown>
        ).SpeechSynthesisUtterance = originalSpeechSynthesisUtterance;
        vi.restoreAllMocks();
    });

    it("should not do anything if instruction is empty", () => {
        (globalThis as unknown as Record<string, unknown>).AndroidInterface = {
            speak: vi.fn(),
        };
        speakInstruction("");
        expect(
            (globalThis as unknown as Record<string, { speak?: unknown }>)
                .AndroidInterface.speak,
        ).not.toHaveBeenCalled();
    });

    it("should use AndroidInterface if available", () => {
        const mockSpeak = vi.fn();
        (globalThis as unknown as Record<string, unknown>).AndroidInterface = {
            speak: mockSpeak,
        };

        speakInstruction("Salutare");

        expect(mockSpeak).toHaveBeenCalledWith("Salutare");
        expect(mockSpeak).toHaveBeenCalledTimes(1);
    });

    it("should fallback to speechSynthesis if AndroidInterface is not available", () => {
        (globalThis as unknown as Record<string, unknown>).AndroidInterface =
            undefined;

        const mockSpeak = vi.fn();
        globalThis.speechSynthesis = {
            speak: mockSpeak,
        } as unknown as SpeechSynthesis;

        speakInstruction("Merge fallback");

        expect(mockSpeak).toHaveBeenCalledTimes(1);
        const utterance = mockSpeak.mock.calls[0][0];
        expect(utterance.text).toBe("Merge fallback");
        expect(utterance.lang).toBe("ro-RO");
        expect(utterance.rate).toBe(1);
    });

    it("should not throw if no TTS is available", () => {
        (globalThis as unknown as Record<string, unknown>).AndroidInterface =
            undefined;
        (globalThis as unknown as Record<string, unknown>).speechSynthesis =
            undefined;

        expect(() => speakInstruction("Nimic")).not.toThrow();
    });
});
