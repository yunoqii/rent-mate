import { Request, Response, NextFunction } from "express";

// Very simple in-memory rate limiter (fixed window per IP).
// Good enough for one server; with several instances you'd use Redis.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const hits = new Map<string, { count: number; windowStart: number }>();

export const aiRateLimit = (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now - entry.windowStart > WINDOW_MS) {
        hits.set(key, { count: 1, windowStart: now });
        return next();
    }
    if (entry.count >= MAX_REQUESTS) {
        return res.status(429).json({ message: "Too many AI requests, try again in a minute" });
    }
    entry.count++;
    next();
};
