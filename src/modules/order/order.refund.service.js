import prisma from "../../config/prisma.js";
import { Prisma } from "@prisma/client";


export const refundOrder = async ({
    userId,
    orderId,
    reason,
    referenceId,
    metadata
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
             * Only PAID orders can be refunded.
             */
            if (
                order.status !== "PAID"
            ) {

                const error = new Error(
                    `Order cannot be refunded in status ${order.status}`
                );

                error.statusCode = 409;

                throw error;
            }


            /*
             * Make sure there isn't already
             * a completed refund.
             */
            const existingRefund =
                await tx.orderRefund.findFirst({
                    where: {
                        orderId,
                        status: "COMPLETED"
                    }
                });


            if (existingRefund) {

                const error = new Error(
                    "Order has already been refunded"
                );

                error.statusCode = 409;

                throw error;
            }


            const refundAmount =
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


            const closingBalance =
                openingBalance.add(
                    refundAmount
                );


            /*
             * Credit wallet.
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
             * Create refund transaction.
             */
            const transactionId =
                `TXN-${crypto.randomUUID()}`;


            await tx.walletLedger.create({
                data: {

                    transactionId,

                    walletId:
                        wallet.id,

                    transactionType:
                        "REFUND",

                    entryType:
                        "CREDIT",

                    amount:
                        refundAmount,

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
                            order.orderNumber,

                        reason:
                            reason || null,

                        source:
                            "ORDER_REFUND"
                    }
                }
            });


            /*
             * Create refund record.
             */
            const refund =
                await tx.orderRefund.create({
                    data: {

                        orderId:
                            order.id,

                        transactionId,

                        amount:
                            refundAmount,

                        currency:
                            order.currency,

                        status:
                            "COMPLETED",

                        referenceId,

                        reason,

                        metadata
                    }
                });


            /*
             * Mark order as refunded.
             */
            const updatedOrder =
                await tx.order.update({
                    where: {
                        id:
                            order.id
                    },

                    data: {
                        status:
                            "REFUNDED"
                    }
                });


            return {
                order:
                    updatedOrder,

                refund,

                transactionId,

                openingBalance,

                closingBalance
            };
        }
    );
};