import prisma from "../../config/prisma.js";


export const getIdempotencyKey = (
    req
) => {

    const key =
        req.get("Idempotency-Key");

    if (!key) {

        const error = new Error(
            "Idempotency-Key header is required"
        );

        error.statusCode = 400;

        throw error;
    }

    if (key.length > 255) {

        const error = new Error(
            "Idempotency-Key is too long"
        );

        error.statusCode = 400;

        throw error;
    }

    return key;
};

export const completeIdempotencyKey = async ({
    id,
    statusCode,
    responseBody
}) => {

    await prisma.idempotencyKey.update({
        where: {
            id
        },
        data: {
            status: "COMPLETED",
            responseStatus: statusCode,
            responseBody
        }
    });
};

export const failIdempotencyKey = async (
    id
) => {

    await prisma.idempotencyKey.update({
        where: {
            id
        },
        data: {
            status: "FAILED"
        }
    });
};