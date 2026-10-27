
import { Router } from "express";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import crypto from "node:crypto";

import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import { protect } from "../middleware/auth.js";

const router = Router();

const validId = (id) => mongoose.isValidObjectId(id);

const getRazorpay = () => {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        throw new Error("Razorpay credentials are not configured");
    }

    return new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET,
    });
};

// POST /api/payments/create-order
router.post("/create-order", protect, async (req, res, next) => {
    try {
        const { courseId } = req.body ?? {};

        if (typeof courseId !== "string" || !validId(courseId)) {
            return res.status(400).json({
                message: "A valid course ID is required",
            });
        }

        const course = await Course.findOne({
            _id: courseId,
            isPublished: true,
        });

        if (!course) {
            return res.status(404).json({
                message: "Course not found",
            });
        }

        if (course.price <= 0) {
            return res.status(400).json({
                message: "This course does not require payment",
            });
        }

        const existingEnrollment = await Enrollment.exists({
            student: req.user._id,
            course: course._id,
        });

        if (existingEnrollment) {
            return res.status(409).json({
                message: "You are already enrolled in this course",
            });
        }

        // Prices are stored in rupees; Razorpay expects paise.
        const amount = Math.round(course.price * 100);

        if (!Number.isSafeInteger(amount) || amount < 100) {
            return res.status(400).json({
                message: "Course price must be at least ₹1",
            });
        }

        const currency = process.env.RAZORPAY_CURRENCY || "INR";
        const razorpay = getRazorpay();

        const order = await razorpay.orders.create({
            amount,
            currency,
            receipt: `lp_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
            notes: {
                studentId: req.user._id.toString(),
                courseId: course._id.toString(),
            },
        });

        await Payment.create({
            student: req.user._id,
            course: course._id,
            orderId: order.id,
            amount,
            currency,
            status: "created",
        });

        res.status(201).json({
            message: "Payment order created",
            keyId: process.env.RAZORPAY_KEY_ID,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
            },
            course: {
                id: course._id,
                title: course.title,
                price: course.price,
            },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/payments/verify

router.post("/verify", protect, async (req, res, next) => {
    try {
        const {
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
        } = req.body ?? {};

        if (
            typeof orderId !== "string" ||
            typeof paymentId !== "string" ||
            typeof signature !== "string" ||
            !orderId ||
            !paymentId ||
            !/^[a-f\d]{64}$/i.test(signature)
        ) {
            return res.status(400).json({
                message: "Invalid payment verification details",
            });
        }

        const payment = await Payment.findOne({
            orderId,
            student: req.user._id,
        });

        if (!payment) {
            return res.status(404).json({
                message: "Payment order not found",
            });
        }

        // Always verify the signature before considering payment state.
        const secret = process.env.RAZORPAY_KEY_SECRET;

        if (!secret) {
            return res.status(503).json({
                message: "Payment verification is not configured",
            });
        }

        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(`${orderId}|${paymentId}`)
            .digest();

        const receivedSignature = Buffer.from(signature, "hex");

        if (
            receivedSignature.length !== expectedSignature.length ||
            !crypto.timingSafeEqual(receivedSignature, expectedSignature)
        ) {
            return res.status(400).json({
                message: "Payment signature verification failed",
            });
        }

        // Fetch the payment from Razorpay; never trust the browser's status.
        const razorpay = getRazorpay();
        const razorpayPayment = await razorpay.payments.fetch(paymentId);

        if (
            razorpayPayment.order_id !== orderId ||
            razorpayPayment.amount !== payment.amount ||
            razorpayPayment.currency !== payment.currency ||
            razorpayPayment.status !== "captured"
        ) {
            return res.status(409).json({
                message: "Payment has not been captured successfully",
            });
        }

        // Re-fetch state after the external API call to reduce race conditions.
        const currentPayment = await Payment.findOne({
            _id: payment._id,
            student: req.user._id,
        });

        if (!currentPayment) {
            return res.status(404).json({
                message: "Payment order not found",
            });
        }

        if (currentPayment.status === "paid") {
            if (currentPayment.paymentId !== paymentId) {
                return res.status(409).json({
                    message: "A different payment is already recorded for this order",
                });
            }

            const existingEnrollment = await Enrollment.findOne({
                student: req.user._id,
                course: currentPayment.course,
            });

            if (!existingEnrollment) {
                return res.status(409).json({
                    message:
                        "Payment is recorded, but enrollment needs reconciliation",
                });
            }

            return res.status(200).json({
                message: "Payment was already verified",
                enrolled: true,
                enrollmentId: existingEnrollment._id,
            });
        }

        const course = await Course.findOne({
            _id: currentPayment.course,
            isPublished: true,
        });

        if (!course) {
            return res.status(409).json({
                message: "Course is no longer available",
            });
        }

        // Claim this order using a conditional update so concurrent requests
        // cannot both finalize different payment IDs for the same order.
        const claimedPayment = await Payment.findOneAndUpdate(
            {
                _id: currentPayment._id,
                student: req.user._id,
                status: "created",
                paymentId: { $exists: false },
            },
            {
                $set: {
                    paymentId,
                    verifiedAt: new Date(),
                },
            },
            {
                new: true,
                runValidators: true,
            }
        );

        if (!claimedPayment) {
            const latestPayment = await Payment.findById(currentPayment._id);

            if (
                latestPayment?.status === "paid" &&
                latestPayment.paymentId === paymentId
            ) {
                const existingEnrollment = await Enrollment.findOne({
                    student: req.user._id,
                    course: currentPayment.course,
                });

                if (existingEnrollment) {
                    return res.status(200).json({
                        message: "Payment was already verified",
                        enrolled: true,
                        enrollmentId: existingEnrollment._id,
                    });
                }
            }

            return res.status(409).json({
                message:
                    "Payment verification is already in progress. Please retry shortly.",
            });
        }

        // Enrollment has a unique student/course index, making retries safe.
        const enrollment = await Enrollment.findOneAndUpdate(
            {
                student: req.user._id,
                course: currentPayment.course,
            },
            {
                $setOnInsert: {
                    student: req.user._id,
                    course: currentPayment.course,
                    enrolledAt: new Date(),
                },
            },
            {
                upsert: true,
                new: true,
                runValidators: true,
            }
        );

        // Mark paid only after enrollment has been confirmed.
        const finalizedPayment = await Payment.findOneAndUpdate(
            {
                _id: claimedPayment._id,
                status: "created",
                paymentId,
            },
            {
                $set: {
                    status: "paid",
                    verifiedAt: new Date(),
                },
            },
            {
                new: true,
                runValidators: true,
            }
        );

        if (!finalizedPayment) {
            return res.status(409).json({
                message:
                    "Enrollment exists, but payment finalization needs reconciliation.",
            });
        }

        return res.status(200).json({
            message: "Payment verified and enrollment confirmed",
            enrolled: true,
            enrollmentId: enrollment._id,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "Payment or enrollment has already been recorded",
            });
        }

        next(error);
    }
});


export default router;
