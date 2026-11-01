import 'vitest';

interface CustomElderlyMatchers<R = unknown> {
  /**
   * Checks that an element satisfies the minimum 64px touch target height.
   * @param minSize Expected minimum pixel height (defaults to 64px).
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
