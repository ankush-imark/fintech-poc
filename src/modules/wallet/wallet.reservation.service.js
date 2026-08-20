import prisma from "../../config/prisma.js";
import { Prisma } from "@prisma/client";


export const reserveWallet = async ({
    walletId,
    amount,
    referenceType = "WITHDRAWAL",
    referenceId,
    metadata = null
}) => {

    const reserveAmount =
        new Prisma.Decimal(amount);

    if (reserveAmount.lte(0)) {

        const error = new Error(
            "Amount must be greater than zero"
        );

        error.statusCode = 400;

        throw error;
    }

    return prisma.$transaction(
        async (tx) => {

            const rows =
                await tx.$queryRaw`
                    SELECT
                        id,
                        availableBalance,
                        lockedBalance,
                        currency,
                        status
                    FROM Wallet
                    WHERE id = ${walletId}
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

            if (wallet.status !== "ACTIVE") {

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

            if (
                openingBalance.lt(
                    reserveAmount
                )
            ) {

                const error = new Error(
                    "Insufficient available balance"
                );

                error.statusCode = 422;

                throw error;
            }

            const closingBalance =
                openingBalance.sub(
                    reserveAmount
                );

            const closingLockedBalance =
                openingLockedBalance.add(
                    reserveAmount
                );

            await tx.wallet.update({
                where: {
                    id: walletId
                },
                data: {
                    availableBalance:
                        closingBalance,

                    lockedBalance:
                        closingLockedBalance,

                    version: {
                        increment: 1
                    }
                }
            });

            const transactionId =
                `TXN-${crypto.randomUUID()}`;

            const ledger =
                await tx.walletLedger.create({
                    data: {
                        transactionId,

                        walletId,

                        transactionType:
                            "WITHDRAWAL_RESERVED",

                        entryType: "DEBIT",

                        amount: reserveAmount,

                        openingBalance,

                        closingBalance,

                        openingLockedBalance,

                        closingLockedBalance,

                        referenceType,

                        referenceId,

                        status: "COMPLETED",

                        metadata
                    }
                });

            return {
                walletId,

                transactionId,

                amount: reserveAmount,

                openingBalance,

                closingBalance,

                openingLockedBalance,

                closingLockedBalance,

                ledger
            };
        }
    );
};

export const releaseWalletReservation = async ({
    walletId,
    amount,
    referenceType = "WITHDRAWAL",
    referenceId,
    metadata = null
}) => {

    const releaseAmount =
        new Prisma.Decimal(amount);

    if (releaseAmount.lte(0)) {

        const error = new Error(
            "Amount must be greater than zero"
        );

        error.statusCode = 400;

        throw error;
    }

    return prisma.$transaction(
        async (tx) => {

            const rows =
                await tx.$queryRaw`
                    SELECT
                        id,
                        availableBalance,
                        lockedBalance,
                        currency,
                        status
                    FROM Wallet
                    WHERE id = ${walletId}
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

            const openingBalance =
                new Prisma.Decimal(
                    wallet.availableBalance
                );

            const openingLockedBalance =
                new Prisma.Decimal(
                    wallet.lockedBalance
                );

            if (
                openingLockedBalance.lt(
                    releaseAmount
                )
            ) {

                const error = new Error(
                    "Insufficient locked balance"
                );

                error.statusCode = 422;

                throw error;
            }

            const closingBalance =
                openingBalance.add(
                    releaseAmount
                );

            const closingLockedBalance =
                openingLockedBalance.sub(
                    releaseAmount
                );

            await tx.wallet.update({
                where: {
                    id: walletId
                },
                data: {
                    availableBalance:
                        closingBalance,

                    lockedBalance:
                        closingLockedBalance,

                    version: {
                        increment: 1
                    }
                }
            });

            const transactionId =
                `TXN-${crypto.randomUUID()}`;

            const ledger =
                await tx.walletLedger.create({
                    data: {
                        transactionId,

                        walletId,

                        transactionType:
                            "WITHDRAWAL_PROCESSED",

                        entryType: "CREDIT",

                        amount: releaseAmount,

                        openingBalance,

                        closingBalance,

                        openingLockedBalance,

                        closingLockedBalance,

                        referenceType,

                        referenceId,

                        status: "COMPLETED",

                        metadata
                    }
                });

            return {
                walletId,

                transactionId,

                amount: releaseAmount,

                openingBalance,

                closingBalance,

                openingLockedBalance,

                closingLockedBalance,

                ledger
            };
        }
    );
};