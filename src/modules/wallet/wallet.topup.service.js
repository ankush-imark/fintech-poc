import prisma from "../../config/prisma.js";
import { Prisma } from "@prisma/client";


const validateAmount = (amount) => {

    if (
        amount === undefined ||
        amount === null ||
        amount === ""
    ) {
        const error = new Error(
            "Amount is required"
        );

        error.statusCode = 400;

        throw error;
    }

    let value;

    try {
        value = new Prisma.Decimal(amount);
    } catch {
        const error = new Error(
            "Invalid amount"
        );

        error.statusCode = 400;

        throw error;
    }

    if (!value.isFinite() || value.lte(0)) {

        const error = new Error(
            "Amount must be greater than zero"
        );

        error.statusCode = 400;

        throw error;
    }

    /*
     * Wallet supports maximum 2 decimal places
     * for INR.
     */
    if (
        value.decimalPlaces() > 2
    ) {

        const error = new Error(
            "Amount cannot have more than 2 decimal places"
        );

        error.statusCode = 400;

        throw error;
    }

    return value;
};

export const topUpWallet = async ({
    userId,
    amount,
    referenceId,
    metadata,
    idempotencyKey
}) => {

    const topUpAmount =
        validateAmount(amount);


    return prisma.$transaction(
        async (tx) => {

            /*
             * Get wallet and lock it.
             */
            const rows =
                await tx.$queryRaw`
                    SELECT
                        id,
                        userId,
                        availableBalance,
                        lockedBalance,
                        currency,
                        status
                    FROM Wallet
                    WHERE userId = ${userId}
                    FOR UPDATE
                `;


            if (!rows.length) {

                const error = new Error(
                    "Wallet not found"
                );

                error.statusCode = 404;

                throw error;
            }


            const wallet = rows[0];


            if (
                wallet.status !== "ACTIVE"
            ) {

                const error = new Error(
                    "Wallet is not active"
                );

                error.statusCode = 403;

                throw error;
            }


            const openingBalance =
                new Prisma.Decimal(
                    wallet.availableBalance
                );


            const openingLockedBalance =
                new Prisma.Decimal(
                    wallet.lockedBalance
                );


            const closingBalance =
                openingBalance.add(
                    topUpAmount
                );


            /*
             * Update wallet.
             */
            await tx.wallet.update({
                where: {
                    id: wallet.id
                },

                data: {
                    availableBalance:
                        closingBalance,

                    version: {
                        increment: 1
                    }
                }
            });


            /*
             * Create immutable ledger.
             */
            const transactionId =
                `TXN-${crypto.randomUUID()}`;


            const ledger =
                await tx.walletLedger.create({
                    data: {

                        transactionId,

                        walletId:
                            wallet.id,

                        transactionType:
                            "WALLET_TOPUP",

                        entryType:
                            "CREDIT",

                        amount:
                            topUpAmount,

                        openingBalance,

                        closingBalance,

                        openingLockedBalance,

                        closingLockedBalance:
                            openingLockedBalance,

                        referenceType:
                            "TOPUP",

                        referenceId,

                        status:
                            "COMPLETED",

                        metadata
                    }
                });


            return {
                transactionId,

                walletId:
                    wallet.id,

                amount:
                    topUpAmount,

                openingBalance,

                closingBalance,

                lockedBalance:
                    openingLockedBalance,

                currency:
                    wallet.currency,

                status:
                    ledger.status,

                idempotencyKey
            };
        }
    );
};