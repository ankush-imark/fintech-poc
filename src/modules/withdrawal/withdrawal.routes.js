import { Router } from "express";

import {
    create,
    list,
    getById,
    cancel
} from "./withdrawal.controller.js";

import { authenticate } from "../../middleware/auth.middleware.js";

import { apiLimiter } from "../../middleware/rate-limit.middleware.js";

import { requireIdempotency } from "../idempotency/idempotency.middleware.js";


const router = Router();


router.post(
    "/",
    authenticate,
    apiLimiter,
    requireIdempotency,
    create
);

router.get(
    "/",
    authenticate,
    apiLimiter,
    list
);

router.get(
    "/:id",
    authenticate,
    apiLimiter,
    getById
);

router.post(
    "/:id/cancel",
    authenticate,
    apiLimiter,
    requireIdempotency,
    cancel
);



export default router;