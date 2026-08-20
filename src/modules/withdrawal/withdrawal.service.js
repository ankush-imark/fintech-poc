import prisma from "../../config/prisma.js";
import { Prisma } from "@prisma/client";
import { withdrawalQueue } from "../../queues/withdrawal.queue.js";

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
            "Invalid withdrawal amount"
        );

        error.statusCode = 400;

        throw error;
    }


    if (
        !value.isFinite() ||
        value.lte(0)
    ) {
        const error = new Error(
            "Withdrawal amount must be greater than zero"
        );

        error.statusCode = 400;

        throw error;
    }


    if (
        value.decimalPlaces() > 2
    ) {
        const error = new Error(
            "Withdrawal amount cannot have more than 2 decimal places"
        );

        error.statusCode = 400;

        throw error;
    }


    return value;
};


/*
|--------------------------------------------------------------------------
| CREATE WITHDRAWAL
|--------------------------------------------------------------------------
|
| Flow:
|
| 1. Validate amount
| 2. Lock wallet
| 3. Check available balance
| 4. Move AVAILABLE -> LOCKED
| 5. Create withdrawal PENDING
| 6. Create WITHDRAWAL_RESERVED ledger
| 7. Commit transaction
| 8. Add BullMQ job
|
*/

export const createWithdrawal = async ({
    userId,
    amount,
    referenceId,
    metadata
}) => {

    const withdrawalAmount =
        validateAmount(amount);


    /*
     * Database transaction.
     */
    const result =
        await prisma.$transaction(
            async (tx) => {

                /*
                 * Lock wallet row.
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
                        WHERE userId = ${userId}
                        FOR UPDATE
                    `;


                if (!wallets.length) {

                    const error = new Error(
                        "Wallet not found"
                    );

                    error.statusCode = 404;

                    throw error;
                }


                const wallet = wallets[0];


                /*
                 * Wallet must be active.
                 */
                if (
                    wallet.status !== "ACTIVE"
                ) {

                    const error = new Error(
                        "Wallet is not active"
                    );

                    error.statusCode = 403;

                    throw error;
                }


                const openingAvailable =
                    new Prisma.Decimal(
                        wallet.availableBalance
                    );


                const openingLocked =
                    new Prisma.Decimal(
                        wallet.lockedBalance
                    );


                /*
                 * Never allow negative balance.
                 */
                if (
                    openingAvailable.lt(
                        withdrawalAmount
                    )
                ) {

                    const error = new Error(
                        "Insufficient available wallet balance"
                    );

                    error.statusCode = 422;

                    throw error;
                }


                const closingAvailable =
                    openingAvailable.sub(
                        withdrawalAmount
                    );


                const closingLocked =
                    openingLocked.add(
                        withdrawalAmount
                    );


                /*
                 * Reserve wallet funds.
                 */
                await tx.wallet.update({

                    where: {
                        id: wallet.id
                    },

                    data: {

                        availableBalance:
                            closingAvailable,

                        lockedBalance:
                            closingLocked,

                        version: {
                            increment: 1
                        }
                    }
                });


                /*
                 * Create withdrawal.
                 */
                const withdrawal =
                    await tx.withdrawal.create({

                        data: {

                            userId,

                            walletId:
                                wallet.id,

                            amount:
                                withdrawalAmount,

                            currency:
                                wallet.currency,

                            status:
                                "PENDING",

                            referenceId,

                            metadata
                        }
                    });


                /*
                 * Create immutable ledger.
                 */
                const transactionId =
                    `TXN-${crypto.randomUUID()}`;


                await tx.walletLedger.create({

                    data: {

                        transactionId,

                        walletId:
                            wallet.id,

                        transactionType:
                            "WITHDRAWAL_RESERVED",

                        entryType:
                            "DEBIT",

                        amount:
                            withdrawalAmount,

                        openingBalance:
                            openingAvailable,

                        closingBalance:
                            closingAvailable,

                        openingLockedBalance:
                            openingLocked,

                        closingLockedBalance:
                            closingLocked,

                        referenceType:
                            "WITHDRAWAL",

                        referenceId:
                            withdrawal.id,

                        status:
                            "COMPLETED",

                        metadata: {
                            referenceId
                        }
                    }
                });


                return {
                    withdrawal,
                    transactionId
                };
            }
        );


    /*
     * Queue AFTER DB transaction commits.
     */
    try {

        await withdrawalQueue.add(

            "process-withdrawal",

            {
                withdrawalId:
                    result.withdrawal.id,

                userId
            },

            {
                jobId:
                    `withdrawal-${result.withdrawal.id}`
            }
        );

    } catch (error) {

        console.error(
            "[Withdrawal Service] Failed to enqueue job",
            {
                withdrawalId:
                    result.withdrawal.id,

                error:
                    error.message
            }
        );

        /*
         * Do not try to rollback wallet here.
         *
         * The database transaction has already
         * committed.
         *
         * Queue recovery will handle this case.
         */
        throw error;
    }


    return result.withdrawal;
};


/*
|--------------------------------------------------------------------------
| GET WITHDRAWAL
|--------------------------------------------------------------------------
*/

export const getWithdrawal = async ({
    userId,
    withdrawalId
}) => {

    const withdrawal =
        await prisma.withdrawal.findFirst({

            where: {

                id: withdrawalId,

                userId
            }
        });


    if (!withdrawal) {

        const error = new Error(
            "Withdrawal not found"
        );

        error.statusCode = 404;

        throw error;
    }


    return withdrawal;
};


/*
|--------------------------------------------------------------------------
| LIST WITHDRAWALS
|--------------------------------------------------------------------------
*/

export const getWithdrawals = async ({
    userId,
    page = 1,
    limit = 20,
    status
}) => {

    const currentPage =
        Math.max(
            Number(page) || 1,
            1
        );


    const currentLimit =
        Math.min(
            Math.max(
                Number(limit) || 20,
                1
            ),
            100
        );


    const skip =
        (currentPage - 1) *
        currentLimit;


    const where = {
        userId
    };


    if (status) {

        where.status = status;
    }


    const [
        withdrawals,
        total
    ] = await Promise.all([

        prisma.withdrawal.findMany({

            where,

            orderBy: {
                createdAt: "desc"
            },

            skip,

            take: currentLimit
        }),

        prisma.withdrawal.count({
            where
        })
    ]);


    return {

        data: withdrawals,

        pagination: {

            page: currentPage,

            limit: currentLimit,

            total,

            totalPages:
                Math.ceil(
                    total / currentLimit
                )
        }
    };
};


/*
|--------------------------------------------------------------------------
| CANCEL WITHDRAWAL
|--------------------------------------------------------------------------
|
| Only PENDING withdrawals can be cancelled.
|
| PENDING
|   |
|   +--> CANCELLED
|
*/

export const cancelWithdrawal = async ({
    userId,
    withdrawalId
}) => {

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
                        status,
                        currency
                    FROM Withdrawal
                    WHERE id = ${withdrawalId}
                      AND userId = ${userId}
                    FOR UPDATE
                `;


            if (!withdrawals.length) {

                const error = new Error(
                    "Withdrawal not found"
                );

                error.statusCode = 404;

                throw error;
            }


            const withdrawal =
                withdrawals[0];


            /*
             * Only PENDING can be cancelled.
             */
            if (
                withdrawal.status !== "PENDING"
            ) {

                const error = new Error(
                    `Withdrawal cannot be cancelled from ${withdrawal.status} state`
                );

                error.statusCode = 409;

                throw error;
            }


            /*
             * Lock wallet.
             */
            const wallets =
                await tx.$queryRaw`
                    SELECT
                        id,
                        availableBalance,
                        lockedBalance,
                        status
                    FROM Wallet
                    WHERE id = ${withdrawal.walletId}
                    FOR UPDATE
                `;


            if (!wallets.length) {

                const error = new Error(
                    "Wallet not found"
                );

                error.statusCode = 404;

                throw error;
            }


            const wallet =
                wallets[0];


            const amount =
                new Prisma.Decimal(
                    withdrawal.amount
                );


            const openingAvailable =
                new Prisma.Decimal(
                    wallet.availableBalance
                );


            const openingLocked =
                new Prisma.Decimal(
                    wallet.lockedBalance
                );


            /*
             * Sanity check.
             */
            if (
                openingLocked.lt(amount)
            ) {

                const error = new Error(
                    "Invalid locked wallet balance"
                );

                error.statusCode = 500;

                throw error;
            }


            const closingAvailable =
                openingAvailable.add(amount);


            const closingLocked =
                openingLocked.sub(amount);


            /*
             * Release reserved money.
             *
             * LOCKED -> AVAILABLE
             */
            await tx.wallet.update({

                where: {
                    id: wallet.id
                },

                data: {

                    availableBalance:
                        closingAvailable,

                    lockedBalance:
                        closingLocked,

                    version: {
                        increment: 1
                    }
                }
            });


            /*
             * Ledger entry.
             */
            await tx.walletLedger.create({

                data: {

                    transactionId:
                        `TXN-${crypto.randomUUID()}`,

                    walletId:
                        wallet.id,

                    transactionType:
                        "WITHDRAWAL_RELEASED",

                    entryType:
                        "CREDIT",

                    amount,

                    openingBalance:
                        openingAvailable,

                    closingBalance:
                        closingAvailable,

                    openingLockedBalance:
                        openingLocked,

                    closingLockedBalance:
                        closingLocked,

                    referenceType:
                        "WITHDRAWAL",

                    referenceId:
                        withdrawal.id,

                    status:
                        "COMPLETED",

                    metadata: {
                        reason: "USER_CANCELLED"
                    }
                }
            });


            /*
             * Change withdrawal state.
             */
            return tx.withdrawal.update({

                where: {
                    id: withdrawal.id
                },

                data: {

                    status:
                        "CANCELLED"
                }
            });
        }
    );
};