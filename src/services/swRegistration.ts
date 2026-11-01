/**
 * Service Worker Registration and Lifecycle Controller
 */

export interface SWRegistrationCallbacks {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

export async function registerServiceWorker(
  callbacks: SWRegistrationCallbacks = {}
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  return new Promise((resolve) => {
    const handleRegister = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        if (callbacks.onSuccess) {
          callbacks.onSuccess(registration);
        }

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (
                installingWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                if (callbacks.onUpdate) {
                  callbacks.onUpdate(registration);
                }
                window.dispatchEvent(new CustomEvent('pwa-update-available'));
              }
            });
          }
        });

        resolve(registration);
      } catch (error) {
        if (callbacks.onError && error instanceof Error) {
          callbacks.onError(error);
        }
        resolve(null);
      }
    };

    if (document.readyState === 'complete') {
      handleRegister();
    } else {
      window.addEventListener('load', handleRegister);
    }
  });
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      return registration.unregister();
    }
  }
  return false;
}
