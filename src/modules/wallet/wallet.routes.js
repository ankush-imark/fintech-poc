import { Router } from "express";

import {
    create,
    get,
    balance
} from "./wallet.controller.js";

import {
    authenticate
} from "../../middleware/auth.middleware.js";

import {
    apiLimiter
} from "../../middleware/rate-limit.middleware.js";

import {
    statement
} from "./wallet.controller.js";

import {
    topup
} from "./wallet.controller.js";

import {
    requireIdempotency
} from "../idempotency/idempotency.middleware.js";


const router = Router();


router.post(
    "/",
    authenticate,
    apiLimiter,
    create
);


router.get(
    "/",
    authenticate,
    apiLimiter,
    get
);


router.get(
    "/balance",
    authenticate,
    apiLimiter,
    balance
);

router.get(
    "/statement",
    authenticate,
    apiLimiter,
    statement
);

router.post(
    "/topup",
    authenticate,
    apiLimiter,
    requireIdempotency,
    topup
);


export default router;