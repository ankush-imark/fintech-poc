import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const hashPassword = async (password) => {
    return bcrypt.hash(password, 12);
};

export const comparePassword = async (password, passwordHash) => {
    return bcrypt.compare(password, passwordHash);
};

export const generateAccessToken = (payload) => {
    return jwt.sign(
        payload,
        process.env.JWT_ACCESS_SECRET,
        {
            expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m"
        }
    );
};

// export const generateRefreshToken = (payload) => {
//     return jwt.sign(
//         payload,
//         process.env.JWT_REFRESH_SECRET,
//         {
//             expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d"
//         }
//     );
// };
export const generateRefreshToken = () => {
    return crypto.randomBytes(64).toString("hex");
};

export const hashRefreshToken = (token) => {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
};

export const getRefreshTokenExpiry = () => {
    const days = 7;

    const expiresAt = new Date();

    expiresAt.setDate(
        expiresAt.getDate() + days
    );

    return expiresAt;
};

export const verifyAccessToken = (token) => {
    return jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET
    );
};

export const verifyRefreshToken = (token) => {
    return jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET
    );
};