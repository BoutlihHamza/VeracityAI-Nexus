import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // Max requests per window

export const rateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp = req.ip || 'unknown';
  const now = Date.now();
  
  // Clean up expired entries
  Object.keys(store).forEach(ip => {
    if (store[ip].resetTime < now) {
      delete store[ip];
    }
  });
  
  // Initialize or update client entry
  if (!store[clientIp]) {
    store[clientIp] = {
      count: 1,
      resetTime: now + WINDOW_MS
    };
  } else {
    store[clientIp].count++;
  }
  
  // Check rate limit
  if (store[clientIp].count > MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      retryAfter: Math.ceil((store[clientIp].resetTime - now) / 1000)
    });
    return;
  }
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS - store[clientIp].count);
  res.setHeader('X-RateLimit-Reset', Math.ceil(store[clientIp].resetTime / 1000));
  
  next();
};