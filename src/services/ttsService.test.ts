import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { speakInstruction } from './ttsService';

describe('ttsService', () => {
    let originalAndroidInterface: any;
    let originalSpeechSynthesis: any;
    let originalSpeechSynthesisUtterance: any;

    beforeEach(() => {
        // Save original globals
        originalAndroidInterface = (globalThis as any).AndroidInterface;
        originalSpeechSynthesis = globalThis.speechSynthesis;
        originalSpeechSynthesisUtterance = (globalThis as any).SpeechSynthesisUtterance;
        
        // Mock SpeechSynthesisUtterance
        (globalThis as any).SpeechSynthesisUtterance = class {
            text: string;
            lang: string = '';
            rate: number = 1;
            constructor(text: string) {
                this.text = text;
            }
        };
    });

    afterEach(() => {
        // Restore globals
        (globalThis as any).AndroidInterface = originalAndroidInterface;
        globalThis.speechSynthesis = originalSpeechSynthesis;
        (globalThis as any).SpeechSynthesisUtterance = originalSpeechSynthesisUtterance;
        vi.restoreAllMocks();
    });

    it('should not do anything if instruction is empty', () => {
        (globalThis as any).AndroidInterface = { speak: vi.fn() };
        speakInstruction('');
        expect((globalThis as any).AndroidInterface.speak).not.toHaveBeenCalled();
    });

    it('should use AndroidInterface if available', () => {
        const mockSpeak = vi.fn();
        (globalThis as any).AndroidInterface = { speak: mockSpeak };

        speakInstruction('Salutare');

        expect(mockSpeak).toHaveBeenCalledWith('Salutare');
        expect(mockSpeak).toHaveBeenCalledTimes(1);
    });

    it('should fallback to speechSynthesis if AndroidInterface is not available', () => {
        (globalThis as any).AndroidInterface = undefined;
        
        const mockSpeak = vi.fn();
        globalThis.speechSynthesis = { speak: mockSpeak } as any;

        speakInstruction('Merge fallback');

        expect(mockSpeak).toHaveBeenCalledTimes(1);
        const utterance = mockSpeak.mock.calls[0][0];
        expect(utterance.text).toBe('Merge fallback');
        expect(utterance.lang).toBe('ro-RO');
        expect(utterance.rate).toBe(1);
    });

    it('should not throw if no TTS is available', () => {
        (globalThis as any).AndroidInterface = undefined;
        (globalThis as any).speechSynthesis = undefined;
        
        expect(() => speakInstruction('Nimic')).not.toThrow();
    });
});
