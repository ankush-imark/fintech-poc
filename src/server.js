import "dotenv/config";

import app from "./app.js";
import prisma from "./config/prisma.js";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Fintech API running on port ${PORT}`);
});

const shutdown = async () => {
    console.log("Shutting down API...");

    server.close(async () => {
        await prisma.$disconnect();

        console.log("Database connection closed");

        process.exit(0);
    });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);