import { registerSchema,loginSchema,refreshTokenSchema, logoutSchema } from "./auth.validation.js";

import { registerUser,loginUser, refreshAccessToken, logoutUser, logoutAllSessions, getUserSessions, revokeSession } from "./auth.service.js";

import { getClientInfo } from "./session.utils.js";

import prisma from "../../config/prisma.js";

export const register = async (req, res, next) => {

    try {

        const data = registerSchema.parse(req.body);

        const user = await registerUser(data);

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                user
            }
        });

    } catch (error) {
        next(error);
    }
};

export const login = async (req, res, next) => {

    try {

        const data = loginSchema.parse(
            req.body
        );

        const clientInfo = getClientInfo(req);

        const result = await loginUser({
            ...data,
            ...clientInfo
        });

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: result
        });

    } catch (error) {
        next(error);
    }
};

export const refresh = async (
    req,
    res,
    next
) => {

    try {

        const data =
            refreshTokenSchema.parse(
                req.body
            );

        const result =
            await refreshAccessToken(
                data.refreshToken
            );

        return res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            data: result
        });

    } catch (error) {
        next(error);
    }
};

export const getMe = async (req, res, next) => {
    try {

        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            },
            select: {
                id: true,
                email: true,
                status: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                user
            }
        });

    } catch (error) {
        next(error);
    }
};

export const logout = async (req, res, next) => {

    try {

        const data = logoutSchema.parse(
            req.body
        );

        await logoutUser({
            userId: req.user.id,
            refreshToken: data.refreshToken
        });

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });

    } catch (error) {
        next(error);
    }
};

export const logoutAll = async (
    req,
    res,
    next
) => {

    try {

        await logoutAllSessions(
            req.user.id
        );

        return res.status(200).json({
            success: true,
            message: "All sessions logged out successfully"
        });

    } catch (error) {
        next(error);
    }
};

export const getSessions = async (
    req,
    res,
    next
) => {

    try {

        const sessions =
            await getUserSessions(
                req.user.id
            );

        return res.status(200).json({
            success: true,
            data: {
                sessions
            }
        });

    } catch (error) {
        next(error);
    }
};

export const revokeUserSession = async (
    req,
    res,
    next
) => {

    try {

        await revokeSession({
            userId: req.user.id,
            sessionId: req.params.sessionId
        });

        return res.status(200).json({
            success: true,
            message: "Session revoked successfully"
        });

    } catch (error) {
        next(error);
    }
};