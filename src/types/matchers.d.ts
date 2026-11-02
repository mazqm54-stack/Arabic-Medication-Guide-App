import 'vitest';

interface CustomElderlyMatchers<R = unknown> {
  /**
   * Checks that an element satisfies the minimum touch target height (48px base / 56px large).
   * @param minSize Expected minimum pixel height (defaults to 48px).
   */
  toHaveMinTouchTarget(minSize?: number): R;

  /**
   * Checks that an element or its ancestor enforces Right-to-Left (dir="rtl") direction.
   */
  toHaveRtlDirection(): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomElderlyMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomElderlyMatchers {}
}

export {};
