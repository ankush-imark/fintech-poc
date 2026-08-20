import express from "express";
import prisma from "./config/prisma.js";
import {errorHandler} from "./middleware/error.middleware.js";
import authRoutes from "./modules/auth/auth.routes.js";
import walletRoutes from "./modules/wallet/wallet.routes.js";
import { apiLimiter } from "./middleware/rate-limit.middleware.js";
import orderRoutes from "./modules/order/order.routes.js";
import withdrawalRoutes from "./modules/withdrawal/withdrawal.routes.js";

const app = express();

app.use(express.json());
app.use(apiLimiter);

app.get("/health", async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        res.status(200).json({
            success: true,
            service: "fintech-api",
            status: "healthy",
            database: "connected"
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            service: "fintech-api",
            status: "unhealthy",
            database: "disconnected",
            error: error.message
        });
    }
});

app.use("/api/v1/auth",authRoutes);
app.use("/api/v1/wallet",walletRoutes);
app.use("/api/v1/orders",orderRoutes);
app.use("/api/v1/withdrawals",withdrawalRoutes);
app.use(errorHandler);
export default app;