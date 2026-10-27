
import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
    {
        certificateNumber: {
            type: String,
            required: true,
            unique: true,
            immutable: true,
        },

        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },

        enrollment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Enrollment",
            required: true,
        },

        issuedAt: {
            type: Date,
            default: Date.now,
            immutable: true,
        },
    },
    {
        timestamps: true,
    }
);

certificateSchema.index(
    { student: 1, course: 1 },
    { unique: true }
);

const Certificate = mongoose.model("Certificate", certificateSchema);

export default Certificate;
