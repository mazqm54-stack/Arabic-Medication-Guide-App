import {
  Camera,
  CameraSource,
  CameraResultType,
  CameraDirection,
  PermissionStatus
} from '@capacitor/camera';

export interface CaptureResult {
  base64Data: string;
  format: 'jpeg';
  width: number;
  height: number;
  file: File;
}

export type NativePhotoFile = File & {
  base64Data: string;
  format: 'jpeg';
  width: number;
  height: number;
  dataUrl: string;
};

export class CameraPermissionDeniedError extends Error {
  constructor(
    message = 'تم رفض إذن الكاميرا. يرجى تفعيل إذن استخدام الكاميرا من إعدادات الهاتف لتصوير علبة الدواء، أو يمكنك اختيار صورة من الألبوم.'
  ) {
    super(message);
    this.name = 'CameraPermissionDeniedError';
  }
}

export class PhotosPermissionDeniedError extends Error {
  constructor(
    message = 'تم رفض إذن الوصول إلى الصور. يرجى تفعيل الإذن من إعدادات الهاتف لاختيار صورة من الألبوم.'
  ) {
    super(message);
    this.name = 'PhotosPermissionDeniedError';
  }
}

/**
 * Checks whether an error is due to user cancelation (dismissing the camera/photos app).
 */
export function isUserCancelation(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  return /cancelled|canceled|no image picked|user cancelled|closed/i.test(message);
}

/**
 * Converts a base64 string into a standard File object.
 */
export function base64ToFile(
  base64Data: string,
  filename = `medication_${Date.now()}.jpg`,
  mimeType = 'image/jpeg'
): File {
  const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

/**
 * Checks and requests runtime camera permissions.
 * Returns true if granted, false otherwise.
 */
export async function checkAndRequestCameraPermissions(): Promise<boolean> {
  try {
    const status: PermissionStatus = await Camera.checkPermissions();
    if (status.camera === 'granted') {
      return true;
    }
    const requested = await Camera.requestPermissions({ permissions: ['camera'] });
    return requested.camera === 'granted';
  } catch (err) {
    console.warn('Error checking/requesting camera permissions:', err);
    // If permission API is unavailable (e.g. web fallback), allow attempt
    return true;
  }
}

/**
 * Checks and requests runtime photos/gallery permissions.
 * Returns true if granted, false otherwise.
 */
export async function checkAndRequestPhotosPermissions(): Promise<boolean> {
  try {
    const status: PermissionStatus = await Camera.checkPermissions();
    if (status.photos === 'granted') {
      return true;
    }
    const requested = await Camera.requestPermissions({ permissions: ['photos'] });
    return requested.photos === 'granted';
  } catch (err) {
    console.warn('Error checking/requesting photos permissions:', err);
    return true;
  }
}

/**
 * Internal helper to process a Capacitor Photo result into a NativePhotoFile.
 */
async function processPhotoResult(photo: any, prefix: string): Promise<NativePhotoFile> {
  let base64String = photo.base64String || '';
  let dataUrl = photo.dataUrl || '';

  if (!base64String && dataUrl) {
    base64String = dataUrl.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  } else if (!dataUrl && base64String) {
    dataUrl = `data:image/jpeg;base64,${base64String}`;
  }

  // If both base64String and dataUrl are missing but webPath exists, fetch it
  if (!base64String && photo.webPath) {
    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    const readerResult = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    dataUrl = readerResult;
    base64String = readerResult.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  }

  const filename = `${prefix}_${Date.now()}.jpg`;
  const file = base64ToFile(base64String, filename, 'image/jpeg');

  const nativeFile = file as NativePhotoFile;
  nativeFile.base64Data = base64String;
  nativeFile.format = 'jpeg';
  nativeFile.width = photo.width || 0;
  nativeFile.height = photo.height || 0;
  nativeFile.dataUrl = dataUrl;

  return nativeFile;
}

/**
 * Captures a photo using the native rear camera (CameraSource.Camera).
 * Returns a File (with attached base64Data) or null if user cancelled.
 */
export async function capturePhoto(): Promise<NativePhotoFile | null> {
  const hasPermission = await checkAndRequestCameraPermissions();
  if (!hasPermission) {
    const errorMsg =
      'تم رفض إذن الكاميرا. يرجى تفعيل إذن استخدام الكاميرا من إعدادات الهاتف لتصوير علبة الدواء، أو يمكنك اختيار صورة من الألبوم.';
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      try {
        window.alert(errorMsg);
      } catch {
        // ignore in environments without alert
      }
    }
    throw new CameraPermissionDeniedError(errorMsg);
  }

  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      direction: CameraDirection.Rear,
      correctOrientation: true,
      saveToGallery: false,
    });

    return await processPhotoResult(photo, 'medication_camera');
  } catch (err: unknown) {
    if (isUserCancelation(err)) {
      return null;
    }
    throw err;
  }
}

/**
 * Picks a photo from the device photo gallery (CameraSource.Photos).
 * Returns a File (with attached base64Data) or null if user cancelled.
 */
export async function pickPhoto(): Promise<NativePhotoFile | null> {
  const hasPermission = await checkAndRequestPhotosPermissions();
  if (!hasPermission) {
    const errorMsg =
      'تم رفض إذن الوصول إلى الصور. يرجى تفعيل الإذن من إعدادات الهاتف لاختيار صورة من الألبوم.';
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      try {
        window.alert(errorMsg);
      } catch {
        // ignore in environments without alert
      }
    }
    throw new PhotosPermissionDeniedError(errorMsg);
  }

  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      correctOrientation: true,
      saveToGallery: false,
    });

    return await processPhotoResult(photo, 'medication_gallery');
  } catch (err: unknown) {
    if (isUserCancelation(err)) {
      return null;
    }
    throw err;
  }
}

/**
 * Capture from camera returning structured CaptureResult interface.
 */
export async function captureFromCamera(): Promise<CaptureResult | null> {
  const file = await capturePhoto();
  if (!file) return null;
  return {
    base64Data: file.base64Data,
    format: 'jpeg',
    width: file.width,
    height: file.height,
    file,
  };
}

/**
 * Pick from gallery returning structured CaptureResult interface.
 */
export async function pickFromGallery(): Promise<CaptureResult | null> {
  const file = await pickPhoto();
  if (!file) return null;
  return {
    base64Data: file.base64Data,
    format: 'jpeg',
    width: file.width,
    height: file.height,
    file,
  };
}
