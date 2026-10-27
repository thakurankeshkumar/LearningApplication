
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },

        orderId: {
            type: String,
            required: true,
            unique: true,
        },

        paymentId: {
            type: String,
            unique: true,
            sparse: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 1,
        },

        currency: {
            type: String,
            required: true,
            default: "INR",
        },

        status: {
            type: String,
            enum: ["created", "paid", "failed"],
            default: "created",
        },

        verifiedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

paymentSchema.index({ student: 1, course: 1, status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
