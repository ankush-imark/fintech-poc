import {
    createOrder,
    getOrder
} from "./order.service.js";

import {
    payOrder
} from "./order.payment.service.js";

import {
    requireIdempotency
} from "../idempotency/idempotency.middleware.js";

import {
    completeIdempotencyKey,
    failIdempotencyKey
} from "../idempotency/idempotency.service.js";

import {
    refundOrder
} from "./order.refund.service.js";

export const create = async (
    req,
    res,
    next
) => {

    try {

        const {
            amount
        } = req.body;

        const order =
            await createOrder({
                userId:
                    req.user.id,

                amount
            });

        return res.status(201).json({
            success: true,

            message:
                "Order created successfully",

            data: {
                order
            }
        });

    } catch (error) {
        next(error);
    }
};

export const get = async (
    req,
    res,
    next
) => {

    try {

        const order =
            await getOrder({
                userId:
                    req.user.id,

                orderId:
                    req.params.id
            });

        return res.status(200).json({
            success: true,

            data: {
                order
            }
        });

    } catch (error) {
        next(error);
    }
};

export const pay = async (
    req,
    res,
    next
) => {

    const idempotencyId =
        req.idempotency.id;

    try {

        const result =
            await payOrder({
                userId:
                    req.user.id,

                orderId:
                    req.params.id,

                idempotencyKey:
                    req.idempotency.key
            });


        const response = {
            success: true,

            message:
                result.alreadyPaid
                    ? "Order was already paid"
                    : "Order paid successfully",

            data: {
                order:
                    result.order,

                payment:
                    result.payment
            }
        };


        await completeIdempotencyKey({
            id:
                idempotencyId,

            statusCode:
                200,

            responseBody:
                response
        });


        return res
            .status(200)
            .json(response);


    } catch (error) {

        await failIdempotencyKey(
            idempotencyId
        );

        next(error);
    }
};

export const refund = async (
    req,
    res,
    next
) => {

    const idempotencyId =
        req.idempotency.id;


    try {

        const {
            reason,
            referenceId,
            metadata
        } = req.body;


        const result =
            await refundOrder({
                userId:
                    req.user.id,

                orderId:
                    req.params.id,

                reason,

                referenceId,

                metadata
            });


        const response = {
            success: true,

            message:
                "Order refunded successfully",

            data: {

                order:
                    result.order,

                refund:
                    result.refund,

                transactionId:
                    result.transactionId,

                openingBalance:
                    result.openingBalance.toString(),

                closingBalance:
                    result.closingBalance.toString()
            }
        };


        await completeIdempotencyKey({
            id:
                idempotencyId,

            statusCode:
                200,

            responseBody:
                response
        });


        return res
            .status(200)
            .json(response);


    } catch (error) {

        await failIdempotencyKey(
            idempotencyId
        );

        next(error);
    }
};