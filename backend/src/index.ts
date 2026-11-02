import express from "express";
import cors from "cors";
import { env } from "./lib/env";
import prisma from "./lib/prisma";
import { isAiConfigured } from "./lib/openrouter";

import authRoutes from "./routes/auth.routes";
import listingRoutes from "./routes/listing.routes";
import preferencesRoutes from "./routes/preferences.routes";
import bookingRoutes from "./routes/booking.routes";
import aiRoutes from "./routes/ai.routes";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware";

const app = express();

// Order matters: cors -> json -> routes -> 404 -> error handler (always last)
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
    res.json({ status: "ok", ai: isAiConfigured() });
});

app.get("/health/db", async (_req, res, next) => {
    try {
        const users = await prisma.user.count();
        res.json({ status: "ok", users });
    } catch (error) {
        next(error);
    }
});

app.use("/auth", authRoutes);
app.use("/listings", listingRoutes);
app.use("/preferences", preferencesRoutes);
app.use("/bookings", bookingRoutes);
app.use("/ai", aiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// In Express 5 the callback also receives an error (e.g. EADDRINUSE)
app.listen(env.PORT, (error?: Error) => {
    if (error) {
        console.error(`Failed to start on port ${env.PORT}:`, error.message);
        process.exit(1);
    }
    console.log(`Server is running on http://localhost:${env.PORT}`);
});
