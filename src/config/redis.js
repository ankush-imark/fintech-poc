import IORedis from "ioredis";

const redis = new IORedis({
    host: process.env.REDIS_HOST || "redis",
    port: Number(process.env.REDIS_PORT || 6379),

    // Important for Bull/BullMQ
    maxRetriesPerRequest: null
});

redis.on("connect", () => {
    console.log("Redis connected");
});

redis.on("ready", () => {
    console.log("Redis ready");
});

redis.on("error", (error) => {
    console.error("Redis error:", error.message);
});

export default redis;

// import { createClient } from "redis";

// const redis = createClient({
//     socket: {
//         host: process.env.REDIS_HOST || "redis",
//         port: Number(
//             process.env.REDIS_PORT || 6379
//         )
//     }
// });

// redis.on("error", (error) => {
//     console.error(
//         "Redis connection error:",
//         error
//     );
// });

// redis.on("connect", () => {
//     console.log("Redis connecting...");
// });

// redis.on("ready", () => {
//     console.log("Redis ready");
// });

// await redis.connect();

// export default redis;