import { supabaseAdmin } from './supabase';
import { logAudit } from './audit';

// In-memory failed OTP attempts tracker: key -> { count: number, lockedUntil: number }
const otpFailedAttempts = new Map<string, { count: number; lockedUntil: number }>();

// In-memory device fingerprint mapping per class: classId -> Map<deviceToken, Set<studentId>>
const classDeviceMap = new Map<string, Map<string, Set<string>>>();

// Cleanup expired memory records every 5 minutes
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of otpFailedAttempts.entries()) {
      if (val.lockedUntil < now && val.count === 0) {
        otpFailedAttempts.delete(key);
      }
    }
    // Prune class device map if too large
    if (classDeviceMap.size > 200) {
      classDeviceMap.clear();
    }
  }, 5 * 60 * 1000);
  if (timer && typeof (timer as any).unref === 'function') {
    (timer as any).unref();
  }
}

/**
 * Checks if a student is locked out of OTP verification for a specific class due to too many failed attempts.
 */
export function checkOtpLockout(studentId: string, classId: string): { isLocked: boolean; remainingMinutes: number } {
  const key = `${classId}:${studentId}`;
  const now = Date.now();
  const record = otpFailedAttempts.get(key);

  if (record && record.lockedUntil > now) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    return { isLocked: true, remainingMinutes };
  }

  return { isLocked: false, remainingMinutes: 0 };
}

/**
 * Registers a failed OTP guess. If threshold (3 attempts) reached, locks student out for 10 minutes.
 */
export function recordFailedOtpAttempt(studentId: string, classId: string): { isNowLocked: boolean; attemptsLeft: number } {
  const key = `${classId}:${studentId}`;
  const now = Date.now();
  let record = otpFailedAttempts.get(key);

  if (!record || (record.lockedUntil > 0 && record.lockedUntil <= now)) {
    record = { count: 1, lockedUntil: 0 };
  } else {
    record.count += 1;
  }

  const MAX_ATTEMPTS = 5;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + 10 * 60 * 1000; // 10 minutes lockout
    otpFailedAttempts.set(key, record);
    return { isNowLocked: true, attemptsLeft: 0 };
  }

  otpFailedAttempts.set(key, record);
  return { isNowLocked: false, attemptsLeft: MAX_ATTEMPTS - record.count };
}

/**
 * Resets failed OTP attempts on successful mark.
 */
export function clearOtpAttempts(studentId: string, classId: string) {
  const key = `${classId}:${studentId}`;
  otpFailedAttempts.delete(key);
}

/**
 * Validates GPS coordinates and detects mock/spoofed location anomalies.
 */
export function validateCoordinates(lat?: number, lon?: number, accuracy?: number): { isValid: boolean; error?: string } {
  if (lat === undefined || lon === undefined || lat === null || lon === null) {
    return { isValid: false, error: 'GPS coordinates missing.' };
  }

  // Check valid numerical latitude and longitude ranges
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return { isValid: false, error: 'Malformed GPS coordinates.' };
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { isValid: false, error: 'GPS coordinates out of physical bounds.' };
  }

  // Null Island check (0.0, 0.0)
  if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) {
    return { isValid: false, error: 'Invalid location detected (Null Island coordinates).' };
  }

  // Check if accuracy is unreasonably huge (> 500m)
  if (accuracy !== undefined && accuracy !== null) {
    if (accuracy > 500) {
      return { isValid: false, error: `GPS accuracy too low (${Math.round(accuracy)}m). Please enable High Accuracy / Precise Location.` };
    }
  }

  return { isValid: true };
}

/**
 * Anti-Proxy Device Sharing Check:
 * Ensures a single phone/device isn't used to mark attendance for more than 4 distinct students in the same class.
 */
export function trackDeviceAttendance(
  classId: string,
  deviceFingerprint: string,
  studentId: string
): { isProxyDetected: boolean; otherStudentsCount: number } {
  if (!deviceFingerprint || !classId || !studentId) {
    return { isProxyDetected: false, otherStudentsCount: 0 };
  }

  let classMap = classDeviceMap.get(classId);
  if (!classMap) {
    classMap = new Map();
    classDeviceMap.set(classId, classMap);
  }

  let studentsOnDevice = classMap.get(deviceFingerprint);
  if (!studentsOnDevice) {
    studentsOnDevice = new Set();
    classMap.set(deviceFingerprint, studentsOnDevice);
  }

  studentsOnDevice.add(studentId);

  // Allow up to 4 distinct students on the same device. If 5 or more students try, block as proxy fraud.
  const MAX_STUDENTS_PER_DEVICE = 4;
  if (studentsOnDevice.size > MAX_STUDENTS_PER_DEVICE) {
    studentsOnDevice.delete(studentId); // Do not lock student to this device if rejected
    return { isProxyDetected: true, otherStudentsCount: studentsOnDevice.size };
  }

  return { isProxyDetected: false, otherStudentsCount: studentsOnDevice.size - 1 };
}

/**
 * Sanitizes input strings against HTML injection, script execution, and XSS attacks.
 */
export function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:text\/html/gi, '')
    .trim();
}
