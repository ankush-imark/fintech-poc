import prisma from "../../config/prisma.js";


export const createWallet = async (userId) => {

    const existingWallet =
        await prisma.wallet.findUnique({
            where: {
                userId
            }
        });

    if (existingWallet) {
        return existingWallet;
    }

    return prisma.wallet.create({
        data: {
            userId,
            availableBalance: 0,
            lockedBalance: 0,
            currency: "INR",
            status: "ACTIVE"
        }
    });
};

export const getWallet = async (userId) => {

    const wallet =
        await prisma.wallet.findUnique({
            where: {
                userId
            },
            select: {
                id: true,
                userId: true,
                availableBalance: true,
                lockedBalance: true,
                currency: true,
                status: true,
                createdAt: true,
                updatedAt: true
            }
        });

    if (!wallet) {

        const error = new Error(
            "Wallet not found"
        );

        error.statusCode = 404;

        throw error;
    }

    return wallet;
};

export const getWalletBalance = async (
    userId
) => {

    const wallet =
        await prisma.wallet.findUnique({
            where: {
                userId
            },
            select: {
                availableBalance: true,
                lockedBalance: true,
                currency: true,
                status: true
            }
        });

    if (!wallet) {

        const error = new Error(
            "Wallet not found"
        );

        error.statusCode = 404;

        throw error;
    }

    return {
        availableBalance:
            wallet.availableBalance,

        lockedBalance:
            wallet.lockedBalance,

        totalBalance:
            wallet.availableBalance
                .add(wallet.lockedBalance),

        currency: wallet.currency,

        status: wallet.status
    };
};