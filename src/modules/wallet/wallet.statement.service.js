import prisma from "../../config/prisma.js";
import {
    validateStatementFilters
} from "./wallet.validation.js";

export const getWalletStatement = async ({
    userId,
    page = 1,
    limit = 20,
    transactionType,
    status
}) => {

    const wallet =
        await prisma.wallet.findUnique({
            where: {
                userId
            },
            select: {
                id: true
            }
        });

    if (!wallet) {

        const error = new Error(
            "Wallet not found"
        );

        error.statusCode = 404;

        throw error;
    }

    validateStatementFilters({
        transactionType,
        status
    });

    const safePage =
        Math.max(
            Number(page) || 1,
            1
        );

    const safeLimit =
        Math.min(
            Math.max(
                Number(limit) || 20,
                1
            ),
            100
        );

    const skip =
        (safePage - 1) * safeLimit;


    const where = {
        walletId: wallet.id
    };


    if (transactionType) {
        where.transactionType =
            transactionType;
    }


    if (status) {
        where.status = status;
    }


    const [
        entries,
        total
    ] = await prisma.$transaction([

        prisma.walletLedger.findMany({
            where,

            orderBy: {
                createdAt: "desc"
            },

            skip,

            take: safeLimit,

            select: {
                transactionId: true,
                transactionType: true,
                entryType: true,
                amount: true,
                openingBalance: true,
                closingBalance: true,
                openingLockedBalance: true,
                closingLockedBalance: true,
                referenceType: true,
                referenceId: true,
                status: true,
                metadata: true,
                createdAt: true
            }
        }),

        prisma.walletLedger.count({
            where
        })
    ]);


    return {
        entries,

        pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages:
                Math.ceil(
                    total / safeLimit
                )
        }
    };
};