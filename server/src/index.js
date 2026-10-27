import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import aiRoutes from "./routes/ai.js";
import rateLimit from "express-rate-limit";
import courseRoutes from "./routes/courses.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";
import lessonRoutes from "./routes/lessons.js";
import enrollmentRoutes from "./routes/enrollments.js";
import quizRoutes from "./routes/quizzes.js";
import paymentRoutes from "./routes/payments.js";
import certificateRoutes from "./routes/certificates.js";
import crypto from "node:crypto";
import Payment from "./models/Payment.js";
import Enrollment from "./models/Enrollment.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
}

app.disable("x-powered-by");

app.use(helmet());

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", }));


app.use(express.json({ limit: "10kb" }));


app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
        try {
            const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
            const signature = req.headers["x-razorpay-signature"];

            if (!secret || typeof signature !== "string" || !Buffer.isBuffer(req.body)) {
                return res.status(400).json({
                    message: "Invalid webhook configuration or request",
                });
            }

            const expectedSignature = crypto
                .createHmac("sha256", secret)
                .update(req.body)
                .digest();

            let receivedSignature;

            if (!/^[a-f\d]{64}$/i.test(signature)) {
                return res.status(400).json({
                    message: "Invalid webhook signature",
                });
            }

            receivedSignature = Buffer.from(signature, "hex");

            if (
                receivedSignature.length !== expectedSignature.length ||
                !crypto.timingSafeEqual(receivedSignature, expectedSignature)
            ) {
                return res.status(400).json({
                    message: "Webhook signature verification failed",
                });
            }

            const event = JSON.parse(req.body.toString("utf8"));

            if (!["payment.captured", "order.paid"].includes(event.event)) {
                return res.status(200).json({ received: true });
            }

            const razorpayPayment = event.payload?.payment?.entity;

            if (
                !razorpayPayment ||
                razorpayPayment.status !== "captured" ||
                typeof razorpayPayment.order_id !== "string" ||
                typeof razorpayPayment.id !== "string"
            ) {
                return res.status(200).json({ received: true });
            }

            const payment = await Payment.findOne({
                orderId: razorpayPayment.order_id,
            });

            // Ignore orders that do not belong to this application.
            if (!payment) {
                return res.status(200).json({ received: true });
            }

            if (
                razorpayPayment.amount !== payment.amount ||
                razorpayPayment.currency !== payment.currency
            ) {
                console.error("Razorpay webhook amount/currency mismatch", {
                    orderId: payment.orderId,
                });

                return res.status(400).json({
                    message: "Payment details do not match the recorded order",
                });
            }

            if (payment.status === "paid") {
                if (payment.paymentId !== razorpayPayment.id) {
                    console.error("Conflicting payment ID for paid order", {
                        orderId: payment.orderId,
                    });
                }

                return res.status(200).json({ received: true });
            }

            // A different payment must not claim an already-claimed order.
            if (
                payment.paymentId &&
                payment.paymentId !== razorpayPayment.id
            ) {
                console.error("Conflicting payment ID for order", {
                    orderId: payment.orderId,
                });

                return res.status(200).json({ received: true });
            }

            // Unique student/course index makes this safe to retry.
            await Enrollment.findOneAndUpdate(
                {
                    student: payment.student,
                    course: payment.course,
                },
                {
                    $setOnInsert: {
                        student: payment.student,
                        course: payment.course,
                        enrolledAt: new Date(),
                    },
                },
                {
                    upsert: true,
                    new: true,
                    runValidators: true,
                }
            );

            const updatedPayment = await Payment.findOneAndUpdate(
                {
                    _id: payment._id,
                    status: "created",
                    $or: [
                        { paymentId: razorpayPayment.id },
                        { paymentId: { $exists: false } },
                        { paymentId: null },
                    ],
                },
                {
                    $set: {
                        paymentId: razorpayPayment.id,
                        status: "paid",
                        verifiedAt: new Date(),
                    },
                },
                {
                    new: true,
                    runValidators: true,
                }
            );

            if (!updatedPayment) {
                const latestPayment = await Payment.findById(payment._id);

                if (
                    latestPayment?.status !== "paid" ||
                    latestPayment.paymentId !== razorpayPayment.id
                ) {
                    // A non-2xx response tells Razorpay it should retry.
                    return res.status(500).json({
                        message: "Payment finalization needs retry",
                    });
                }
            }

            return res.status(200).json({ received: true });
        } catch (error) {
            if (error instanceof SyntaxError) {
                return res.status(400).json({
                    message: "Invalid webhook JSON",
                });
            }

            console.error("Razorpay webhook error:", error.message);

            return res.status(500).json({
                message: "Webhook processing failed",
            });
        }
    }
);


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

app.use("/api", lessonRoutes);

app.use("/api", enrollmentRoutes);

app.use("/api", quizRoutes);

app.use("/api/payments", paymentRoutes);

app.use("/api/certificates", certificateRoutes);

app.use("/api/ai", aiRoutes);

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