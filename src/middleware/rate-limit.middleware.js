import rateLimit from "express-rate-limit";

import {
    RedisStore
} from "rate-limit-redis";

import redis from "../config/redis.js";


const createLimiter = ({
    windowMs,
    limit,
    message
}) => {

    return rateLimit({
        windowMs,
        limit,

        standardHeaders: true,
        legacyHeaders: false,

        store: new RedisStore({
            sendCommand: (...args) => {
                return redis.call(...args);
            }
        }),

        handler: (req, res) => {
            return res.status(429).json({
                success: false,
                message
            });
        }
    });
};


export const registerLimiter =
    createLimiter({

        windowMs: 15 * 60 * 1000,

        limit: 5,

        message:
            "Too many registration attempts. Please try again later."
    });


export const loginLimiter =
    createLimiter({

        windowMs: 15 * 60 * 1000,

        limit: 10,

        message:
            "Too many login attempts. Please try again later."
    });


export const refreshLimiter =
    createLimiter({

        windowMs: 15 * 60 * 1000,

        limit: 20,

        message:
            "Too many token refresh attempts. Please try again later."
    });


export const apiLimiter =
    createLimiter({

        windowMs: 60 * 1000,

        limit: 100,

        message:
            "Too many requests. Please try again later."
    });