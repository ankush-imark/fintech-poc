import prisma from "../../config/prisma.js";
import { Prisma } from "@prisma/client";


const assertPositiveAmount = (amount) => {
    const value = new Prisma.Decimal(amount);

    if (value.lte(0)) {
        const error = new Error(
            "Amount must be greater than zero"
        );

        error.statusCode = 400;

        throw error;
    }

    return value;
};

const assertWalletActive = (wallet) => {

    if (wallet.status !== "ACTIVE") {

        const error = new Error(
            "Wallet is not active"
        );

        error.statusCode = 403;

        throw error;
    }
};

export const creditWallet = async ({
    walletId,
    amount,
    transactionType,
    referenceType = null,
    referenceId = null,
    metadata = null
}) => {

    const creditAmount =
        assertPositiveAmount(amount);

    return prisma.$transaction(
        async (tx) => {

            /*
             * Lock wallet row.
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

            assertWalletActive(wallet);

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
                    creditAmount
                );

            /*
             * Update wallet.
             */
            await tx.wallet.update({
                where: {
                    id: walletId
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
             * Immutable ledger.
             */
            const transactionId =
                `TXN-${crypto.randomUUID()}`;

            const ledger =
                await tx.walletLedger.create({
                    data: {
                        transactionId,

                        walletId,

                        transactionType,

                        entryType: "CREDIT",

                        amount: creditAmount,

                        openingBalance,

                        closingBalance,

                        openingLockedBalance,

                        closingLockedBalance:
                            openingLockedBalance,

                        referenceType,

                        referenceId,

                        status: "COMPLETED",

                        metadata
                    }
                });

            return {
                walletId,

                transactionId,

                amount: creditAmount,

                openingBalance,

                closingBalance,

                lockedBalance:
                    openingLockedBalance,

                ledger
            };
        }
    );
};

export const debitWallet = async ({
    walletId,
    amount,
    transactionType,
    referenceType = null,
    referenceId = null,
    metadata = null
}) => {

    const debitAmount =
        assertPositiveAmount(amount);

    return prisma.$transaction(
        async (tx) => {

            /*
             * Lock wallet row.
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

            assertWalletActive(wallet);

            const openingBalance =
                new Prisma.Decimal(
                    wallet.availableBalance
                );

            const openingLockedBalance =
                new Prisma.Decimal(
                    wallet.lockedBalance
                );

            /*
             * NEVER allow negative balance.
             */
            if (
                openingBalance.lt(
                    debitAmount
                )
            ) {

                const error = new Error(
                    "Insufficient wallet balance"
                );

                error.statusCode = 422;

                throw error;
            }

            const closingBalance =
                openingBalance.sub(
                    debitAmount
                );

            await tx.wallet.update({
                where: {
                    id: walletId
                },
                data: {
                    availableBalance:
                        closingBalance,

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

                        transactionType,

                        entryType: "DEBIT",

                        amount: debitAmount,

                        openingBalance,

                        closingBalance,

                        openingLockedBalance,

                        closingLockedBalance:
                            openingLockedBalance,

                        referenceType,

                        referenceId,

                        status: "COMPLETED",

                        metadata
                    }
                });

            return {
                walletId,

                transactionId,

                amount: debitAmount,

                openingBalance,

                closingBalance,

                lockedBalance:
                    openingLockedBalance,

                ledger
            };
        }
    );
};