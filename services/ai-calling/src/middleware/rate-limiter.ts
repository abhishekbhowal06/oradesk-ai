import rateLimit from 'express-rate-limit';

// Global API Limiter (Generous, prevents catastrophic DDoS)
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
});

// Strict Limiter for Auth endpoints (Brute force protection)
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Limit each IP to 20 login/auth requests per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts from this IP, please try again after an hour' },
});

// Strict Limiter for AI/Calling endpoints (Cost protection against Twilio/LLM drain)
export const callsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 call requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many call requests from this IP, please try again later' },
});

// Webhook Limiter (slightly higher tolerance for upstream bursts)
export const webhookLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 500, // 500 events per 5 mins
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Webhook rate limit exceeded' },
});
