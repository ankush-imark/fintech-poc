import prisma from "../../config/prisma.js";

import {
    getIdempotencyKey
} from "./idempotency.service.js";


export const requireIdempotency =
    async (req, res, next) => {

        try {

            const key =
                getIdempotencyKey(req);

            const userId =
                req.user.id;

            const endpoint =
                `${req.method}:${req.originalUrl}`;

            const existing =
                await prisma.idempotencyKey.findUnique({
                    where: {
                        userId_key: {
                            userId,
                            key
                        }
                    }
                });

            if (existing) {

                /*
                 * Previous request is still running.
                 */
                if (
                    existing.status ===
                    "PROCESSING"
                ) {

                    return res.status(409).json({
                        success: false,
                        message:
                            "A request with this Idempotency-Key is already being processed"
                    });
                }

                /*
                 * Previous request completed.
                 */
                if (
                    existing.status ===
                    "COMPLETED"
                ) {

                    return res
                        .status(
                            existing.responseStatus || 200
                        )
                        .json(
                            existing.responseBody
                        );
                }
            }

            const record =
                await prisma.idempotencyKey.create({
                    data: {
                        userId,
                        key,
                        endpoint,
                        status: "PROCESSING"
                    }
                });

            req.idempotency = {
                id: record.id,
                key
            };

            next();

        } catch (error) {

            /*
             * Prisma unique constraint means
             * another request created the same
             * key between our SELECT and INSERT.
             */
            if (
                error.code === "P2002"
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Request with this Idempotency-Key is already being processed"
                });
            }

            next(error);
        }
    };