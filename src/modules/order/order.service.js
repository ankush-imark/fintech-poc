import prisma from "../../config/prisma.js";
import { Prisma } from "@prisma/client";


const validateAmount = (amount) => {

    let value;

    try {
        value = new Prisma.Decimal(amount);
    } catch {
        const error = new Error(
            "Invalid order amount"
        );

        error.statusCode = 400;

        throw error;
    }

    if (
        !value.isFinite() ||
        value.lte(0)
    ) {
        const error = new Error(
            "Order amount must be greater than zero"
        );

        error.statusCode = 400;

        throw error;
    }

    if (value.decimalPlaces() > 2) {
        const error = new Error(
            "Order amount cannot have more than 2 decimal places"
        );

        error.statusCode = 400;

        throw error;
    }

    return value;
};


export const createOrder = async ({
    userId,
    amount
}) => {

    const orderAmount =
        validateAmount(amount);

    const orderNumber =
        `ORD-${crypto.randomUUID()}`;

    const order =
        await prisma.order.create({
            data: {
                userId,

                orderNumber,

                amount:
                    orderAmount,

                currency:
                    "INR",

                status:
                    "PAYMENT_PENDING"
            }
        });

    return order;
};

export const getOrder = async ({
    userId,
    orderId
}) => {

    const order =
        await prisma.order.findFirst({
            where: {
                id: orderId,
                userId
            },

            include: {
                payments: {
                    orderBy: {
                        createdAt: "desc"
                    }
                }
            }
        });

    if (!order) {

        const error = new Error(
            "Order not found"
        );

        error.statusCode = 404;

        throw error;
    }

    return order;
};