import prisma from "../../config/prisma.js";
import { hashPassword, comparePassword, generateAccessToken,generateRefreshToken,
    hashRefreshToken,
    getRefreshTokenExpiry } from "./auth.utils.js";

export const registerUser = async ({ email, password }) => {

    const existingUser = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if (existingUser) {
        const error = new Error("User already exists");
        error.statusCode = 409;

        throw error;
    }

    const passwordHash = await hashPassword(password);

     const result =
        await prisma.$transaction(
            async (tx) => {

                const user =
                    await tx.user.create({
                        data: {
                            email,
                            passwordHash,
                            status: "ACTIVE"
                        }
                    });


                const wallet =
                    await tx.wallet.create({
                        data: {
                            userId: user.id,
                            availableBalance: 0,
                            lockedBalance: 0,
                            currency: "INR",
                            status: "ACTIVE"
                        }
                    });


                return {
                    user,
                    wallet
                };
            }
        );


    return {
        user: {
            id: result.user.id,
            email: result.user.email,
            status: result.user.status
        },

        wallet: {
            id: result.wallet.id,
            currency: result.wallet.currency
        }
    };
};

export const loginUser = async ({
    email,
    password,
    deviceId,
    deviceName,
    ipAddress,
    userAgent
}) => {

    const user = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if (!user) {
        const error = new Error(
            "Invalid email or password"
        );

        error.statusCode = 401;

        throw error;
    }

    if (user.status !== "ACTIVE") {
        const error = new Error(
            "Account is not active"
        );

        error.statusCode = 403;

        throw error;
    }

    const passwordValid = await comparePassword(
        password,
        user.passwordHash
    );

    if (!passwordValid) {
        const error = new Error(
            "Invalid email or password"
        );

        error.statusCode = 401;

        throw error;
    }

    const accessToken = generateAccessToken({
        sub: user.id,
        email: user.email
    });

    const session = await createSession({
        userId: user.id,
        deviceId,
        deviceName,
        ipAddress,
        userAgent
    });

    return {
        user: {
            id: user.id,
            email: user.email,
            status: user.status
        },

        accessToken,

        refreshToken: session.refreshToken,

        expiresAt: session.expiresAt
    };
};

export const createSession = async ({
    userId,
    deviceId,
    deviceName,
    ipAddress,
    userAgent
}) => {

    const sessionExpiresAt = getRefreshTokenExpiry();

    const rawRefreshToken = generateRefreshToken();

    const tokenHash = hashRefreshToken(
        rawRefreshToken
    );

    const result = await prisma.$transaction(
        async (tx) => {

            const session = await tx.session.create({
                data: {
                    userId,
                    deviceId: deviceId || "unknown",
                    deviceName,
                    ipAddress,
                    userAgent,
                    expiresAt: sessionExpiresAt
                }
            });

            await tx.refreshToken.create({
                data: {
                    userId,
                    sessionId: session.id,
                    tokenHash,
                    expiresAt: sessionExpiresAt
                }
            });

            return session;
        }
    );

    return {
        sessionId: result.id,
        refreshToken: rawRefreshToken,
        expiresAt: sessionExpiresAt
    };
};

export const refreshAccessToken = async (
    rawRefreshToken
) => {

    const tokenHash =
        hashRefreshToken(rawRefreshToken);

    const storedToken =
        await prisma.refreshToken.findUnique({
            where: {
                tokenHash
            },
            include: {
                user: true,
                session: true
            }
        });

    /*
     * Token doesn't exist.
     */
    if (!storedToken) {

        const error = new Error(
            "Invalid refresh token"
        );

        error.statusCode = 401;

        throw error;
    }

    /*
     * IMPORTANT:
     *
     * A revoked token being presented again
     * means possible refresh-token reuse.
     */
    if (storedToken.revokedAt) {

        await revokeEntireSession(
            storedToken.sessionId
        );

        const error = new Error(
            "Refresh token reuse detected. Session revoked."
        );

        error.statusCode = 401;

        throw error;
    }

    /*
     * Check expiration.
     */
    if (
        storedToken.expiresAt <= new Date()
    ) {

        const error = new Error(
            "Refresh token has expired"
        );

        error.statusCode = 401;

        throw error;
    }

    /*
     * Check session.
     */
    if (storedToken.session.revokedAt) {

        const error = new Error(
            "Session has been revoked"
        );

        error.statusCode = 401;

        throw error;
    }

    /*
     * Check user.
     */
    if (storedToken.user.status !== "ACTIVE") {

        const error = new Error(
            "Account is not active"
        );

        error.statusCode = 403;

        throw error;
    }

    /*
     * Generate new tokens.
     */
    const newRefreshToken =
        generateRefreshToken();

    const newTokenHash =
        hashRefreshToken(
            newRefreshToken
        );

    const newExpiresAt =
        getRefreshTokenExpiry();

    const accessToken =
        generateAccessToken({
            sub: storedToken.user.id,
            email: storedToken.user.email
        });

    /*
     * Rotate tokens atomically.
     */
    await prisma.$transaction(
        async (tx) => {

            /*
             * Revoke current token.
             */
            await tx.refreshToken.update({
                where: {
                    id: storedToken.id
                },
                data: {
                    revokedAt: new Date()
                }
            });

            /*
             * Update session activity.
             */
            await tx.session.update({
                where: {
                    id: storedToken.sessionId
                },
                data: {
                    lastActiveAt: new Date()
                }
            });

            /*
             * Create replacement token.
             */
            await tx.refreshToken.create({
                data: {
                    userId: storedToken.userId,
                    sessionId: storedToken.sessionId,
                    tokenHash: newTokenHash,
                    expiresAt: newExpiresAt
                }
            });
        }
    );

    return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt
    };
};

export const logoutUser = async ({
    userId,
    refreshToken
}) => {

    const tokenHash = hashRefreshToken(
        refreshToken
    );

    const storedToken =
        await prisma.refreshToken.findUnique({
            where: {
                tokenHash
            }
        });

    /*
     * Don't reveal whether the token exists.
     */
    if (!storedToken) {
        return;
    }

    /*
     * Security check:
     * token must belong to the authenticated user.
     */
    if (storedToken.userId !== userId) {
        return;
    }

    await prisma.$transaction(
        async (tx) => {

            await tx.refreshToken.update({
                where: {
                    id: storedToken.id
                },
                data: {
                    revokedAt: new Date()
                }
            });

            await tx.session.update({
                where: {
                    id: storedToken.sessionId
                },
                data: {
                    revokedAt: new Date()
                }
            });
        }
    );
};

export const logoutAllSessions = async (
    userId
) => {

    await prisma.$transaction(
        async (tx) => {

            await tx.session.updateMany({
                where: {
                    userId,
                    revokedAt: null
                },
                data: {
                    revokedAt: new Date()
                }
            });

            await tx.refreshToken.updateMany({
                where: {
                    userId,
                    revokedAt: null
                },
                data: {
                    revokedAt: new Date()
                }
            });
        }
    );
};

export const getUserSessions = async (
    userId
) => {

    return prisma.session.findMany({
        where: {
            userId,
            revokedAt: null,
            expiresAt: {
                gt: new Date()
            }
        },
        select: {
            id: true,
            deviceId: true,
            deviceName: true,
            ipAddress: true,
            userAgent: true,
            lastActiveAt: true,
            expiresAt: true,
            createdAt: true
        },
        orderBy: {
            lastActiveAt: "desc"
        }
    });
};

export const revokeSession = async ({
    userId,
    sessionId
}) => {

    const session = await prisma.session.findFirst({
        where: {
            id: sessionId,
            userId
        }
    });

    if (!session) {
        const error = new Error(
            "Session not found"
        );

        error.statusCode = 404;

        throw error;
    }

    await prisma.$transaction(
        async (tx) => {

            await tx.session.update({
                where: {
                    id: sessionId
                },
                data: {
                    revokedAt: new Date()
                }
            });

            await tx.refreshToken.updateMany({
                where: {
                    sessionId,
                    revokedAt: null
                },
                data: {
                    revokedAt: new Date()
                }
            });
        }
    );
};

const revokeEntireSession = async (
    sessionId
) => {
    await prisma.$transaction(
        async (tx) => {

            await tx.session.update({
                where: {
                    id: sessionId
                },
                data: {
                    revokedAt: new Date()
                }
            });

            await tx.refreshToken.updateMany({
                where: {
                    sessionId,
                    revokedAt: null
                },
                data: {
                    revokedAt: new Date()
                }
            });
        }
    );
};