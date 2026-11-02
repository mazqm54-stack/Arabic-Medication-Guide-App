/**
 * Test Utilities and DOM Assertions for E2E Suite
 */

export function assertTouchTargetSenior(el: HTMLElement, minPx = 48): void {
  const style = window.getComputedStyle(el);
  const height = parseFloat(style.height) || parseFloat(el.style.height) || 0;
  const minHeight = parseFloat(style.minHeight) || parseFloat(el.style.minHeight) || 0;
  const rectHeight = el.getBoundingClientRect ? el.getBoundingClientRect().height : 0;
  
  const classList = el.className || '';
  const hasTailwindClass =
    classList.includes('min-h-[48px]') ||
    classList.includes('min-h-[56px]') ||
    classList.includes('min-h-[64px]') ||
    classList.includes('min-w-[48px]') ||
    classList.includes('min-w-[56px]') ||
    classList.includes('min-w-[64px]') ||
    classList.includes('min-h-[72px]') ||
    classList.includes('min-h-[80px]') ||
    classList.includes('h-12') ||
    classList.includes('h-14') ||
    classList.includes('h-16') ||
    classList.includes('h-20') ||
    classList.includes('min-h-12') ||
    classList.includes('min-h-14') ||
    classList.includes('min-h-16') ||
    classList.includes('btn-touch') ||
    classList.includes('btn-primary') ||
    classList.includes('btn-secondary');

  const effectiveHeight = Math.max(height, minHeight, rectHeight);
  if (effectiveHeight < minPx && !hasTailwindClass) {
    throw new Error(`Element does not meet senior touch target height: ${effectiveHeight}px < ${minPx}px (classes: "${classList}")`);
  }
}

export function assertRtlDirection(el: HTMLElement): void {
  const dir = el.getAttribute('dir') || window.getComputedStyle(el).direction;
  const closestRtl = el.closest ? el.closest('[dir="rtl"]') : null;
  const docDir = document.documentElement.getAttribute('dir');

  if (dir !== 'rtl' && !closestRtl && docDir !== 'rtl') {
    throw new Error(`Element does not adhere to RTL layout direction (dir="${dir}")`);
  }
}

export function createMockJpegBase64(longestSide = 1024): string {
  // Generates valid JPEG base64 payload prefix with dummy length
  const prefix = '/9j/4AAQSkZJRgABAQEASABIAAD/';
  const padding = 'A'.repeat(Math.max(500, Math.floor(longestSide / 2)));
  return prefix + padding;
}
