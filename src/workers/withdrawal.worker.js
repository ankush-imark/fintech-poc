import { Worker } from "bullmq";
import { Prisma } from "@prisma/client";

import redis from "../config/redis.js";
import prisma from "../config/prisma.js";


const processWithdrawal = async (job) => {

    const {
        withdrawalId
    } = job.data;

    console.log(
        `[Withdrawal Worker] Processing ${withdrawalId}`
    );


    return prisma.$transaction(
        async (tx) => {

            /*
             * Lock withdrawal.
             */
            const withdrawals =
                await tx.$queryRaw`
                    SELECT
                        id,
                        userId,
                        walletId,
                        amount,
                        currency,
                        status,
                        referenceId
                    FROM withdrawals
                    WHERE id = ${withdrawalId}
                    FOR UPDATE
                `;


            if (!withdrawals.length) {

                throw new Error(
                    `Withdrawal ${withdrawalId} not found`
                );
            }


            const withdrawal =
                withdrawals[0];


            /*
             * Idempotency protection.
             *
             * If worker retries after successful
             * processing, don't process it again.
             */
            if (
                withdrawal.status === "COMPLETED"
            ) {

                console.log(
                    `[Withdrawal Worker] ${withdrawalId} already completed`
                );

                return {
                    status: "COMPLETED",
                    alreadyProcessed: true
                };
            }


            /*
             * Only PENDING withdrawals can
             * enter processing.
             */
            if (
                withdrawal.status !== "PENDING"
            ) {

                throw new Error(
                    `Withdrawal ${withdrawalId} cannot be processed from status ${withdrawal.status}`
                );
            }


            /*
             * Move PENDING → PROCESSING.
             */
            await tx.withdrawal.update({
                where: {
                    id: withdrawal.id
                },

                data: {
                    status: "PROCESSING"
                }
            });


            /*
             * Lock wallet.
             */
            const wallets =
                await tx.$queryRaw`
                    SELECT
                        id,
                        userId,
                        availableBalance,
                        lockedBalance,
                        currency,
                        status
                    FROM wallets
                    WHERE id = ${withdrawal.walletId}
                    FOR UPDATE
                `;


            if (!wallets.length) {

                throw new Error(
                    `Wallet ${withdrawal.walletId} not found`
                );
            }


            const wallet =
                wallets[0];


            const amount =
                new Prisma.Decimal(
                    withdrawal.amount
                );


            const availableBalance =
                new Prisma.Decimal(
                    wallet.availableBalance
                );


            const lockedBalance =
                new Prisma.Decimal(
                    wallet.lockedBalance
                );


            /*
             * The withdrawal amount must
             * already be reserved.
             */
            if (
                lockedBalance.lt(amount)
            ) {

                throw new Error(
                    `Invalid locked balance for withdrawal ${withdrawalId}`
                );
            }


            /*
             * ------------------------------------------------
             * SIMULATED BANK PROCESSING
             * ------------------------------------------------
             *
             * For now we simulate success.
             *
             * Later this will call:
             *
             * Razorpay / Cashfree / bank API / etc.
             */
            const bankResult = {
                success: true,

                providerReference:
                    `BANK-${crypto.randomUUID()}`
            };


            if (bankResult.success) {

                /*
                 * Money leaves the wallet.
                 *
                 * Available remains unchanged.
                 * Locked balance decreases.
                 */
                const closingLockedBalance =
                    lockedBalance.sub(amount);


                await tx.wallet.update({
                    where: {
                        id: wallet.id
                    },

                    data: {

                        lockedBalance:
                            closingLockedBalance,

                        version: {
                            increment: 1
                        }
                    }
                });


                /*
                 * Create immutable ledger entry.
                 */
                const transactionId =
                    `TXN-${crypto.randomUUID()}`;


                await tx.walletLedger.create({
                    data: {

                        transactionId,

                        walletId:
                            wallet.id,

                        transactionType:
                            "WITHDRAWAL_PROCESSED",

                        entryType:
                            "DEBIT",

                        amount,

                        openingBalance:
                            availableBalance,

                        closingBalance:
                            availableBalance,

                        openingLockedBalance:
                            lockedBalance,

                        closingLockedBalance,

                        referenceType:
                            "WITHDRAWAL",

                        referenceId:
                            withdrawal.id,

                        status:
                            "COMPLETED",

                        metadata: {

                            provider:
                                "SIMULATED_BANK",

                            providerReference:
                                bankResult.providerReference
                        }
                    }
                });


                /*
                 * Mark withdrawal completed.
                 */
                await tx.withdrawal.update({
                    where: {
                        id:
                            withdrawal.id
                    },

                    data: {

                        status:
                            "COMPLETED",

                        referenceId:
                            bankResult.providerReference
                    }
                });


                console.log(
                    `[Withdrawal Worker] ${withdrawalId} COMPLETED`
                );


                return {

                    status:
                        "COMPLETED",

                    providerReference:
                        bankResult.providerReference
                };
            }


            throw new Error(
                "Withdrawal provider failed"
            );
        }
    );
};


export const withdrawalWorker =
    new Worker(
        "withdrawal-processing",
        processWithdrawal,
        {
            connection: redis,

            concurrency: 5
        }
    );


withdrawalWorker.on(
    "completed",
    (job, result) => {

        console.log(
            `[Withdrawal Worker] Job ${job.id} completed`,
            result
        );
    }
);


withdrawalWorker.on(
    "failed",
    (job, error) => {

        console.error(
            `[Withdrawal Worker] Job ${job?.id} failed:`,
            error.message
        );
    }
);


withdrawalWorker.on(
    "error",
    (error) => {

        console.error(
            "[Withdrawal Worker] Worker error:",
            error
        );
    }
);


console.log(
    "Withdrawal worker started"
);