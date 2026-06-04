import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { speakInstruction } from "./ttsService";

describe("ttsService", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Android interface is injected at runtime
    let originalAndroidInterface: any;
    // biome-ignore lint/suspicious/noExplicitAny
    let originalSpeechSynthesis: any;
    // biome-ignore lint/suspicious/noExplicitAny
    let originalSpeechSynthesisUtterance: any;

    beforeEach(() => {
        // Save original globals
        // biome-ignore lint/suspicious/noExplicitAny: Android interface is injected at runtime
        originalAndroidInterface = (globalThis as any).AndroidInterface;
        originalSpeechSynthesis = globalThis.speechSynthesis;
        // biome-ignore lint/suspicious/noExplicitAny
        originalSpeechSynthesisUtterance = (globalThis as any)
            .SpeechSynthesisUtterance;

        // Mock SpeechSynthesisUtterance
        // biome-ignore lint/suspicious/noExplicitAny
        (globalThis as any).SpeechSynthesisUtterance = class {
            text: string;
            lang: string = "";
            rate: number = 1;
            constructor(text: string) {
                this.text = text;
            }
        };
    });

    afterEach(() => {
        // Restore globals
        // biome-ignore lint/suspicious/noExplicitAny: Android interface is injected at runtime
        (globalThis as any).AndroidInterface = originalAndroidInterface;
        globalThis.speechSynthesis = originalSpeechSynthesis;
        // biome-ignore lint/suspicious/noExplicitAny
        (globalThis as any).SpeechSynthesisUtterance =
            originalSpeechSynthesisUtterance;
        vi.restoreAllMocks();
    });

    it("should not do anything if instruction is empty", () => {
        // biome-ignore lint/suspicious/noExplicitAny: Android interface is injected at runtime
        (globalThis as any).AndroidInterface = { speak: vi.fn() };
        speakInstruction("");
        expect(
            // biome-ignore lint/suspicious/noExplicitAny: Android interface is injected at runtime
            (globalThis as any).AndroidInterface.speak,
        ).not.toHaveBeenCalled();
    });

    it("should use AndroidInterface if available", () => {
        const mockSpeak = vi.fn();
        // biome-ignore lint/suspicious/noExplicitAny: Android interface is injected at runtime
        (globalThis as any).AndroidInterface = { speak: mockSpeak };

        speakInstruction("Salutare");

        expect(mockSpeak).toHaveBeenCalledWith("Salutare");
        expect(mockSpeak).toHaveBeenCalledTimes(1);
    });

    it("should fallback to speechSynthesis if AndroidInterface is not available", () => {
        // biome-ignore lint/suspicious/noExplicitAny: Android interface is injected at runtime
        (globalThis as any).AndroidInterface = undefined;

        const mockSpeak = vi.fn();
        // biome-ignore lint/suspicious/noExplicitAny
        globalThis.speechSynthesis = { speak: mockSpeak } as any;

        speakInstruction("Merge fallback");

        expect(mockSpeak).toHaveBeenCalledTimes(1);
        const utterance = mockSpeak.mock.calls[0][0];
        expect(utterance.text).toBe("Merge fallback");
        expect(utterance.lang).toBe("ro-RO");
        expect(utterance.rate).toBe(1);
    });

    it("should not throw if no TTS is available", () => {
        // biome-ignore lint/suspicious/noExplicitAny: Android interface is injected at runtime
        (globalThis as any).AndroidInterface = undefined;
        // biome-ignore lint/suspicious/noExplicitAny: Android interface is injected at runtime
        (globalThis as any).speechSynthesis = undefined;

        expect(() => speakInstruction("Nimic")).not.toThrow();
    });
});
