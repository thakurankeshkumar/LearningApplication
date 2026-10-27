import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import courseRoutes from "./routes/courses.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
}

app.disable("x-powered-by");

app.use(helmet());

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", }));

app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "LingoPro API",
    });
});

app.use("/api/auth", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        message: "Too many authentication requests. Please try again later.",
    },
}), authRoutes);

app.use("/api/courses", courseRoutes);

app.use((req, res) => {
    res.status(404).json({
        message: "Route not found",
    });
});

app.use((error, req, res, next) => {
    console.error(error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        message: "Internal server error",
    });
});

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`LingoPro API running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();
