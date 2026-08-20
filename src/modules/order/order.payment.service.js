import prisma from "../../config/prisma.js";
import { Prisma } from "@prisma/client";


export const payOrder = async ({
    userId,
    orderId,
    idempotencyKey
}) => {

    return prisma.$transaction(
        async (tx) => {

            /*
             * Lock order.
             */
            const orders =
                await tx.$queryRaw`
                    SELECT
                        id,
                        userId,
                        orderNumber,
                        amount,
                        currency,
                        status
                    FROM \`Order\`
                    WHERE id = ${orderId}
                      AND userId = ${userId}
                    FOR UPDATE
                `;


            if (!orders.length) {

                const error = new Error(
                    "Order not found"
                );

                error.statusCode = 404;

                throw error;
            }


            const order = orders[0];


            /*
             * Prevent paying an order twice.
             */
            if (
                order.status === "PAID"
            ) {

                const existingPayment =
                    await tx.orderPayment.findFirst({
                        where: {
                            orderId,
                            status: "COMPLETED"
                        },

                        orderBy: {
                            createdAt: "desc"
                        }
                    });

                return {
                    alreadyPaid: true,
                    order,
                    payment:
                        existingPayment
                };
            }


            if (
                order.status !==
                "PAYMENT_PENDING"
            ) {

                const error = new Error(
                    `Order cannot be paid in status ${order.status}`
                );

                error.statusCode = 409;

                throw error;
            }


            const orderAmount =
                new Prisma.Decimal(
                    order.amount
                );


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


            const lockedBalance =
                new Prisma.Decimal(
                    wallet.lockedBalance
                );


            /*
             * Prevent negative balance.
             */
            if (
                openingBalance.lt(
                    orderAmount
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
                    orderAmount
                );


            /*
             * Debit wallet.
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
             * Create wallet ledger.
             */
            const transactionId =
                `TXN-${crypto.randomUUID()}`;


            await tx.walletLedger.create({
                data: {

                    transactionId,

                    walletId:
                        wallet.id,

                    transactionType:
                        "ORDER_PAYMENT",

                    entryType:
                        "DEBIT",

                    amount:
                        orderAmount,

                    openingBalance,

                    closingBalance,

                    openingLockedBalance:
                        lockedBalance,

                    closingLockedBalance:
                        lockedBalance,

                    referenceType:
                        "ORDER",

                    referenceId:
                        order.id,

                    status:
                        "COMPLETED",

                    metadata: {
                        orderNumber:
                            order.orderNumber
                    }
                }
            });


            /*
             * Create payment record.
             */
            const payment =
                await tx.orderPayment.create({
                    data: {

                        orderId:
                            order.id,

                        transactionId,

                        amount:
                            orderAmount,

                        currency:
                            order.currency,

                        status:
                            "COMPLETED",

                        referenceId:
                            idempotencyKey,

                        metadata: {
                            paymentMethod:
                                "WALLET"
                        }
                    }
                });


            /*
             * Mark order paid.
             */
            const updatedOrder =
                await tx.order.update({
                    where: {
                        id:
                            order.id
                    },

                    data: {
                        status:
                            "PAID"
                    }
                });


            return {
                alreadyPaid: false,

                order:
                    updatedOrder,

                payment
            };
        }
    );
};