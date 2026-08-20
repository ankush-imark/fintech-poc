import {
    createWallet,
    getWallet,
    getWalletBalance
} from "./wallet.service.js";

import {
    getWalletStatement
} from "./wallet.statement.service.js";

import {
    topUpWallet
} from "./wallet.topup.service.js";

import {
    completeIdempotencyKey,
    failIdempotencyKey
} from "../idempotency/idempotency.service.js";


export const create = async (
    req,
    res,
    next
) => {

    try {

        const wallet =
            await createWallet(
                req.user.id
            );

        return res.status(201).json({
            success: true,
            message: "Wallet created successfully",
            data: {
                wallet
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

        const wallet =
            await getWallet(
                req.user.id
            );

        return res.status(200).json({
            success: true,
            data: {
                wallet
            }
        });

    } catch (error) {
        next(error);
    }
};


export const balance = async (
    req,
    res,
    next
) => {

    try {

        const walletBalance =
            await getWalletBalance(
                req.user.id
            );

        return res.status(200).json({
            success: true,
            data: walletBalance
        });

    } catch (error) {
        next(error);
    }
};

export const statement = async (
    req,
    res,
    next
) => {

    try {

        const {
            page,
            limit,
            transactionType,
            status
        } = req.query;

        const result =
            await getWalletStatement({
                userId: req.user.id,
                page,
                limit,
                transactionType,
                status
            });

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {

        next(error);
    }
};

export const topup = async (
    req,
    res,
    next
) => {

    const idempotencyId =
        req.idempotency.id;


    try {

        const {
            amount,
            referenceId,
            metadata
        } = req.body;


        const result =
            await topUpWallet({
                userId:
                    req.user.id,

                amount,

                referenceId,

                metadata,

                idempotencyKey:
                    req.idempotency.key
            });


        const response = {
            success: true,

            message:
                "Wallet topped up successfully",

            data: {
                transactionId:
                    result.transactionId,

                walletId:
                    result.walletId,

                amount:
                    result.amount.toString(),

                openingBalance:
                    result.openingBalance.toString(),

                closingBalance:
                    result.closingBalance.toString(),

                lockedBalance:
                    result.lockedBalance.toString(),

                currency:
                    result.currency,

                status:
                    result.status
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