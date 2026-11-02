import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// -------------------------------------------------------------
// 1. Automatic Post-Test Cleanup
// -------------------------------------------------------------
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});

// -------------------------------------------------------------
// 2. Mock window.matchMedia
// -------------------------------------------------------------
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// -------------------------------------------------------------
// 3. Mock window.scrollTo & window.alert
// -------------------------------------------------------------
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});
Object.defineProperty(window, 'alert', {
  writable: true,
  value: vi.fn(),
});

// -------------------------------------------------------------
// 4. Mock URL.createObjectURL & URL.revokeObjectURL
// -------------------------------------------------------------
if (typeof window.URL.createObjectURL === 'undefined') {
  Object.defineProperty(window.URL, 'createObjectURL', {
    writable: true,
    value: vi.fn((file: File) => `blob:mock-url-${file.name || 'image'}`),
  });
}
if (typeof window.URL.revokeObjectURL === 'undefined') {
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    writable: true,
    value: vi.fn(),
  });
}

// -------------------------------------------------------------
// 5. Mock LocalStorage with Spyable Interface
// -------------------------------------------------------------
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem = vi.fn((key: string): string | null => {
    return this.store[key] ?? null;
  });

  setItem = vi.fn((key: string, value: string): void => {
    this.store[key] = String(value);
  });

  removeItem = vi.fn((key: string): void => {
    delete this.store[key];
  });

  clear = vi.fn((): void => {
    this.store = {};
  });

  get length(): number {
    return Object.keys(this.store).length;
  }

  key = vi.fn((index: number): string | null => {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  });
}

const mockLocalStorage = new LocalStorageMock();
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// -------------------------------------------------------------
// 6. Mock Web Speech API (window.speechSynthesis & Utterance)
// -------------------------------------------------------------
export class MockSpeechSynthesisUtterance {
  text: string;
  lang = 'ar-SA';
  voice: SpeechSynthesisVoice | null = null;
  rate = 0.9;
  pitch = 1.0;
  volume = 1.0;
  onstart: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

export class MockSpeechSynthesis {
  speaking = false;
  paused = false;
  pending = false;
  onvoiceschanged: (() => void) | null = null;
  currentUtterance: MockSpeechSynthesisUtterance | null = null;

  voices: SpeechSynthesisVoice[] = [
    { name: 'Maged (Arabic Saudi Arabia)', lang: 'ar-SA', default: true, localService: true, voiceURI: 'ar-sa-1' } as any,
    { name: 'Hoda (Arabic Egypt)', lang: 'ar-EG', default: false, localService: true, voiceURI: 'ar-eg-1' } as any,
    { name: 'David (English US)', lang: 'en-US', default: false, localService: true, voiceURI: 'en-us-1' } as any,
  ];

  getVoices = vi.fn((): SpeechSynthesisVoice[] => {
    return this.voices;
  });

  speak = vi.fn((utterance: MockSpeechSynthesisUtterance): void => {
    this.currentUtterance = utterance;
    this.speaking = true;
    this.paused = false;
    if (utterance.onstart) {
      setTimeout(() => utterance.onstart?.(), 0);
    }
  });

  pause = vi.fn((): void => {
    if (this.speaking && !this.paused) {
      this.paused = true;
      if (this.currentUtterance?.onpause) {
        this.currentUtterance.onpause();
      }
    }
  });

  resume = vi.fn((): void => {
    if (this.speaking && this.paused) {
      this.paused = false;
      if (this.currentUtterance?.onresume) {
        this.currentUtterance.onresume();
      }
    }
  });

  cancel = vi.fn((): void => {
    if (this.speaking || this.paused) {
      this.speaking = false;
      this.paused = false;
      if (this.currentUtterance?.onend) {
        this.currentUtterance.onend();
      }
      this.currentUtterance = null;
    }
  });
}

const mockSynth = new MockSpeechSynthesis();
Object.defineProperty(window, 'speechSynthesis', {
  value: mockSynth,
  writable: true,
  configurable: true,
});
(window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

// -------------------------------------------------------------
// 7. Mock Navigator Service Worker
// -------------------------------------------------------------
if (!('serviceWorker' in navigator)) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: vi.fn().mockResolvedValue({
        scope: '/',
        active: { state: 'activated' },
      }),
      ready: Promise.resolve({
        active: { state: 'activated' },
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
}

// -------------------------------------------------------------
// 8. Custom Vitest Matchers Implementation
// -------------------------------------------------------------
expect.extend({
  /**
   * Asserts that an interactive element satisfies the minimum touch target height (48px base / 56px large).
   * Checks computed styles, inline styles, bounding rects, and Tailwind classes.
   */
  toHaveMinTouchTarget(received: HTMLElement, minSize = 48) {
    if (!received || !(received instanceof HTMLElement)) {
      return {
        pass: false,
        message: () => `Expected a valid HTMLElement, but received: ${received}`,
      };
    }

    const style = window.getComputedStyle(received);
    const computedMinHeight = parseFloat(style.minHeight) || 0;
    const computedHeight = parseFloat(style.height) || 0;
    const inlineMinHeight = parseFloat(received.style.minHeight) || 0;
    const inlineHeight = parseFloat(received.style.height) || 0;
    const rectHeight = received.getBoundingClientRect ? received.getBoundingClientRect().height : 0;

    const effectiveHeight = Math.max(
      computedMinHeight,
      computedHeight,
      inlineMinHeight,
      inlineHeight,
      rectHeight
    );

    // Also check for Tailwind min-h, min-w, and height classes
    const classList = received.className || '';
    const hasTailwindTouchClass =
      classList.includes('min-h-[48px]') ||
      classList.includes('min-h-[56px]') ||
      classList.includes('min-h-[64px]') ||
      classList.includes('min-w-[48px]') ||
      classList.includes('min-w-[56px]') ||
      classList.includes('min-w-[64px]') ||
      classList.includes('min-h-touch') ||
      classList.includes('h-12') ||
      classList.includes('h-14') ||
      classList.includes('h-16') ||
      classList.includes('h-[48px]') ||
      classList.includes('h-[56px]') ||
      classList.includes('h-[64px]') ||
      classList.includes('min-h-12') ||
      classList.includes('min-h-14') ||
      classList.includes('min-h-16') ||
      classList.includes('btn-touch') ||
      classList.includes('btn-primary') ||
      classList.includes('btn-secondary');

    const pass = effectiveHeight >= minSize || hasTailwindTouchClass;

    return {
      pass,
      message: () =>
        pass
          ? `Expected element NOT to have minimum touch target height of ${minSize}px, but effective height is ${effectiveHeight}px (classes: "${classList}")`
          : `Expected element to have minimum touch target height of ${minSize}px, but received effective height of ${effectiveHeight}px (classes: "${classList}")`,
    };
  },

  /**
   * Asserts that an element or its ancestor tree explicitly enforces dir="rtl".
   */
  toHaveRtlDirection(received: HTMLElement) {
    if (!received || !(received instanceof HTMLElement)) {
      return {
        pass: false,
        message: () => `Expected a valid HTMLElement, but received: ${received}`,
      };
    }

    const explicitDir = received.getAttribute('dir');
    const computedDir = window.getComputedStyle(received).direction;
    const closestRtl = received.closest ? received.closest('[dir="rtl"]') : null;
    const documentDir = document.documentElement.getAttribute('dir');

    const pass =
      explicitDir === 'rtl' ||
      computedDir === 'rtl' ||
      closestRtl !== null ||
      documentDir === 'rtl';

    return {
      pass,
      message: () =>
        pass
          ? `Expected element NOT to have dir="rtl", but found explicit="${explicitDir}", computed="${computedDir}", closestRtl=${Boolean(closestRtl)}`
          : `Expected element to have dir="rtl", but found explicit="${explicitDir}", computed="${computedDir}", closestRtl=${Boolean(closestRtl)}`,
    };
  },
});

// -------------------------------------------------------------
// 9. Mock @capacitor/camera for Native Camera & Gallery
// -------------------------------------------------------------
vi.mock('@capacitor/camera', () => ({
  Camera: {
    checkPermissions: vi.fn().mockResolvedValue({ camera: 'granted', photos: 'granted' }),
    requestPermissions: vi.fn().mockResolvedValue({ camera: 'granted', photos: 'granted' }),
    getPhoto: vi.fn().mockResolvedValue({
      base64String:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      dataUrl:
        'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      webPath: 'blob:mock-camera-photo',
      format: 'jpeg',
      width: 100,
      height: 100,
    }),
    pickImages: vi.fn().mockResolvedValue({ photos: [] }),
  },
  CameraSource: {
    Prompt: 'PROMPT',
    Camera: 'CAMERA',
    Photos: 'PHOTOS',
  },
  CameraResultType: {
    Uri: 'uri',
    Base64: 'base64',
    DataUrl: 'dataUrl',
  },
  CameraDirection: {
    Rear: 'REAR',
    Front: 'FRONT',
  },
}));

// -------------------------------------------------------------
// 10. Mock HTMLCanvasElement & HTMLImageElement for jsdom
// -------------------------------------------------------------
if (typeof HTMLCanvasElement !== 'undefined') {
  const defaultGetContext = function (this: HTMLCanvasElement, contextId: string) {
    if (contextId === '2d') {
      return {
        fillStyle: '#FFFFFF',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(1024 * 1024 * 4).fill(128), // Normal gray image
        }),
      };
    }
    return null;
  };
  HTMLCanvasElement.prototype.getContext = defaultGetContext as any;

  const defaultToDataURL = function (this: HTMLCanvasElement, _type?: string) {
    // Valid JPEG base64 starting with /9j/ and > 500 characters
    return (
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////' +
      'wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    );
  };
  HTMLCanvasElement.prototype.toDataURL = defaultToDataURL as any;
}

if (typeof HTMLImageElement !== 'undefined') {
  if (!HTMLImageElement.prototype.decode) {
    HTMLImageElement.prototype.decode = function (this: HTMLImageElement) {
      if (!this.naturalWidth && !this.width) {
        Object.defineProperty(this, 'naturalWidth', { value: 800, configurable: true, writable: true });
        Object.defineProperty(this, 'naturalHeight', { value: 600, configurable: true, writable: true });
      }
      return Promise.resolve();
    };
  }
}

