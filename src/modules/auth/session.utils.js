export const getClientInfo = (req) => {

    const deviceId =
        req.headers["x-device-id"] || null;

    const deviceName =
        req.headers["x-device-name"] || null;

    const userAgent =
        req.headers["user-agent"] || null;

    const ipAddress =
        req.ip ||
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        null;

    return {
        deviceId,
        deviceName,
        userAgent,
        ipAddress
    };
};