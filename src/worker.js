import "dotenv/config";

import { Worker } from "bullmq";
import { Prisma } from "@prisma/client";

import redis from "./config/redis.js";
import prisma from "./config/prisma.js";


console.log("=================================");
console.log("Fintech worker started");
console.log("Withdrawal worker initializing...");
console.log("=================================");

const simulateBankWithdrawal = async (withdrawal) => {

    if (
        withdrawal.referenceId?.startsWith("BANK-FAIL")
    ) {
        return {
            success: false,
            failureReason:
                "Bank rejected the withdrawal"
        };
    }


    return {
        success: true,

        providerReference:
            `BANK-${crypto.randomUUID()}`
    };
};

const processWithdrawal = async (job) => {

    const {
        withdrawalId
    } = job.data;


    console.log(
        `[Withdrawal Worker] Processing ${withdrawalId}`
    );


    const result =
        await prisma.$transaction(
            async (tx) => {

                /*
                 * Get withdrawal and lock it.
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
                        FROM Withdrawal
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

                console.log(
                    `[Withdrawal Worker] Current status: ${withdrawal.status}`
                );


                /*
                 * Idempotency protection.
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

                if (withdrawal.status === "FAILED") {

                    console.log(
                        `[Withdrawal Worker] ${withdrawalId} already failed`
                    );

                    return {
                        status: "FAILED",
                        alreadyProcessed: true
                    };
                }

                if (
                    withdrawal.status === "CANCELLED"
                ) {

                    console.log(
                        `[Withdrawal Worker] ${withdrawalId} was cancelled`
                    );

                    return {
                        status: "CANCELLED",
                        alreadyProcessed: true
                    };
                }

                if (
                    withdrawal.status === "PROCESSING"
                ) {

                    console.log(
                        `[Withdrawal Worker] ${withdrawalId} is already processing`
                    );

                    return {
                        status: "PROCESSING",
                        alreadyProcessing: true
                    };
                }


                /*
                 * Only PENDING withdrawals
                 * can be processed.
                 */
                if (
                    withdrawal.status !== "PENDING"
                ) {

                    throw new Error(
                        `Withdrawal ${withdrawalId} cannot be processed from ${withdrawal.status}`
                    );
                }


                /*
                 * PENDING → PROCESSING
                 */
                const updated =
                await tx.withdrawal.updateMany({

                    where: {

                        id: withdrawal.id,

                        status: "PENDING"
                    },

                    data: {

                        status: "PROCESSING"
                    }
                });

                if (updated.count !== 1) {
                    console.log(
                        `[Withdrawal Worker] ${withdrawalId} was already picked up`
                    );

                    return {
                        status: "PROCESSING",
                        alreadyProcessing: true
                    };
                }


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
                        FROM Wallet
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
                 * Validate reserved balance.
                 */
                if (
                    lockedBalance.lt(amount)
                ) {

                    throw new Error(
                        `Insufficient locked balance for withdrawal ${withdrawalId}`
                    );
                }


                /*
                 * -------------------------------------
                 * SIMULATE BANK PROCESSING
                 * -------------------------------------
                 */
                // const bankResult = {

                //     success: true,

                //     providerReference:
                //         `BANK-${crypto.randomUUID()}`
                // };
                const bankResult =
                    await simulateBankWithdrawal(
                        withdrawal
                    );


                if (!bankResult.success) {

                    console.log(
                        `[Withdrawal Worker] Bank rejected ${withdrawalId}`
                    );


                    const closingLockedBalance =
                        lockedBalance.sub(amount);


                    const closingAvailableBalance =
                        availableBalance.add(amount);


                    /*
                    * Release reserved money.
                    */
                    await tx.wallet.update({

                        where: {
                            id: wallet.id
                        },

                        data: {

                            availableBalance:
                                closingAvailableBalance,

                            lockedBalance:
                                closingLockedBalance,

                            version: {
                                increment: 1
                            }
                        }
                    });


                    /*
                    * Create release ledger.
                    */
                    const transactionId =
                        `TXN-${crypto.randomUUID()}`;


                    await tx.walletLedger.create({

                        data: {

                            transactionId,

                            walletId:
                                wallet.id,

                            transactionType:
                                "WITHDRAWAL_RELEASED",

                            entryType:
                                "CREDIT",

                            amount,

                            openingBalance:
                                availableBalance,

                            closingBalance:
                                closingAvailableBalance,

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

                                reason:
                                    bankResult.failureReason
                            }
                        }
                    });


                    /*
                    * Mark withdrawal failed.
                    */
                    await tx.withdrawal.update({

                        where: {
                            id: withdrawal.id
                        },

                        data: {

                            status:
                                "FAILED",

                            failureReason:
                                bankResult.failureReason
                        }
                    });


                    console.log(
                        `[Withdrawal Worker] ${withdrawalId} FAILED`
                    );


                    return {

                        status:
                            "FAILED",

                        failureReason:
                            bankResult.failureReason
                    };
                }


                /*
                 * -------------------------------------
                 * SUCCESS
                 * -------------------------------------
                 *
                 * Money was already moved from
                 * available → locked during reservation.
                 *
                 * Now remove it from locked.
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
                 * Create processed ledger.
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
                 * PENDING/PROCESSING → COMPLETED
                 */
                await tx.withdrawal.update({

                    where: {
                        id: withdrawal.id
                    },

                    data: {

                        status:
                            "COMPLETED",

                        referenceId:
                            bankResult.providerReference
                    }
                });


                return {

                    status:
                        "COMPLETED",

                    providerReference:
                        bankResult.providerReference
                };
            }
        );


    console.log(
        `[Withdrawal Worker] ${withdrawalId} completed`,
        result
    );


    return result;
};


const withdrawalWorker =
    new Worker(
        "withdrawal-processing",

        processWithdrawal,

        {
            connection: redis,

            concurrency: 5
        }
    );


withdrawalWorker.on(
    "ready",
    () => {

        console.log(
            "Withdrawal BullMQ worker is ready"
        );
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


const shutdown = async (
    signal
) => {

    console.log(
        `Fintech worker shutting down (${signal})...`
    );


    try {

        await withdrawalWorker.close();

        await prisma.$disconnect();

        await redis.quit();

        console.log(
            "Fintech worker shutdown completed"
        );

        process.exit(0);

    } catch (error) {

        console.error(
            "Worker shutdown error:",
            error
        );

        process.exit(1);
    }
};


process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);


process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);