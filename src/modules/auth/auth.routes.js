import { Router } from "express";

import { register,login,refresh,getMe, logout, logoutAll, getSessions, revokeUserSession } from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
    registerLimiter,
    loginLimiter,
    refreshLimiter
} from "../../middleware/rate-limit.middleware.js";

const router = Router();

router.post(
    "/register",
    registerLimiter,
    register
);

router.post(
    "/login",
    loginLimiter,
    login
);

router.post(
    "/refresh",
    refreshLimiter,
    refresh
);

router.get(
    "/me",
    authenticate,
    getMe
);

router.post(
    "/logout",
    authenticate,
    logout
);

router.post(
    "/logout-all",
    authenticate,
    logoutAll
);

router.get(
    "/sessions",
    authenticate,
    getSessions
);

router.delete(
    "/sessions/:sessionId",
    authenticate,
    revokeUserSession
);

export default router;