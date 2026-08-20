import { Router } from "express";

import {
    create,
    get,
    pay,refund
} from "./order.controller.js";

import {
    authenticate
} from "../../middleware/auth.middleware.js";

import {
    apiLimiter
} from "../../middleware/rate-limit.middleware.js";
import { requireIdempotency } from "../idempotency/idempotency.middleware.js";


const router = Router();


router.post(
    "/",
    authenticate,
    apiLimiter,
    create
);


router.get(
    "/:id",
    authenticate,
    apiLimiter,
    get
);

router.post(
    "/:id/pay",
    authenticate,
    apiLimiter,
    requireIdempotency,
    pay
);

router.post(
    "/:id/refund",
    authenticate,
    apiLimiter,
    requireIdempotency,
    refund
);


export default router;