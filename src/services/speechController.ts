import { AudioState } from '../types';

export interface SpeechControllerState {
  status: AudioState;
  supported: boolean;
  error: string | null;
}

export type StateChangeCallback = (state: SpeechControllerState) => void;

export class SpeechSynthesisController {
  private status: AudioState = 'idle';
  private supported: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private listeners: Set<StateChangeCallback> = new Set();
  private voices: SpeechSynthesisVoice[] = [];
  private onEndCallback: (() => void) | null = null;

  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (this.supported) {
      this.initVoices();
    }
  }

  private initVoices(): void {
    if (!this.supported) return;

    const loadVoices = () => {
      this.voices = window.speechSynthesis.getVoices() || [];
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  public subscribe(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    const currentState = this.getState();
    this.listeners.forEach((listener) => listener(currentState));
  }

  public getState(): SpeechControllerState {
    return {
      status: this.status,
      supported: this.supported,
      error: this.supported ? null : 'خاصية القراءة الصوتية غير مدعومة في هذا المتصفح'
    };
  }

  public isSupported(): boolean {
    return this.supported;
  }

  public getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }

  private findArabicVoice(): SpeechSynthesisVoice | null {
    if (!this.voices.length && this.supported) {
      this.voices = window.speechSynthesis.getVoices() || [];
    }

    // 1. Try finding exact Saudi or Egyptian Arabic voices
    const preferred = this.voices.find(
      (v) => v.lang === 'ar-SA' || v.lang === 'ar-EG' || v.lang.toLowerCase().startsWith('ar')
    );
    if (preferred) return preferred;

    // 2. Try finding by name containing 'Arabic' or 'عربي'
    const byName = this.voices.find(
      (v) => v.name.toLowerCase().includes('arabic') || v.name.includes('عربي')
    );
    if (byName) return byName;

    return null;
  }

  public speak(text: string, onEnd?: () => void): void {
    if (!this.supported) {
      console.warn('[Speech] SpeechSynthesis not supported.');
      return;
    }

    if (!text || !text.trim()) {
      return;
    }

    // Cancel any previous speech
    this.stop();

    this.onEndCallback = onEnd || null;
    const utterance = new SpeechSynthesisUtterance(text.trim());
    
    // Configure voice & senior-friendly pacing (rate 0.85 = clearer, easier to follow)
    const arabicVoice = this.findArabicVoice();
    if (arabicVoice) {
      utterance.voice = arabicVoice;
      utterance.lang = arabicVoice.lang;
    } else {
      utterance.lang = 'ar-SA';
    }

    utterance.rate = 0.85; // Slightly slower pace for elderly comfort
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.status = 'speaking';
      this.notify();
    };

    utterance.onpause = () => {
      this.status = 'paused';
      this.notify();
    };

    utterance.onresume = () => {
      this.status = 'speaking';
      this.notify();
    };

    utterance.onend = () => {
      this.status = 'idle';
      this.currentUtterance = null;
      this.notify();
      if (this.onEndCallback) {
        this.onEndCallback();
        this.onEndCallback = null;
      }
    };

    utterance.onerror = (e) => {
      console.warn('[Speech] Synthesis error event:', e);
      this.status = 'idle';
      this.currentUtterance = null;
      this.notify();
    };

    this.currentUtterance = utterance;
    this.status = 'speaking';
    this.notify();
    window.speechSynthesis.speak(utterance);
  }

  public pause(): void {
    if (!this.supported) return;
    if (this.status === 'speaking') {
      window.speechSynthesis.pause();
      this.status = 'paused';
      this.notify();
    }
  }

  public resume(): void {
    if (!this.supported) return;
    if (this.status === 'paused') {
      window.speechSynthesis.resume();
      this.status = 'speaking';
      this.notify();
    }
  }

  public stop(): void {
    if (!this.supported) return;
    window.speechSynthesis.cancel();
    this.status = 'idle';
    this.currentUtterance = null;
    this.notify();
  }

  public cleanup(): void {
    this.stop();
    this.listeners.clear();
  }
}

// Export singleton instance
export const speechController = new SpeechSynthesisController();
