import { NextResponse } from 'next/server';

const ipCache = new Map<string, { count: number, resetTime: number }>();

export function rateLimit(ip: string, limit: number, windowMs: number) {
  const now = Date.now();
  const record = ipCache.get(ip);
  
  if (!record || record.resetTime < now) {
    ipCache.set(ip, { count: 1, resetTime: now + windowMs });
    return true; // allowed
  }
  
  if (record.count >= limit) {
    return false; // blocked
  }
  
  record.count += 1;
  return true; // allowed
}

// Helper function to extract IP
export function getIp(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
