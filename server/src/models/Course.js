
import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Course title is required"],
            trim: true,
            minlength: 3,
            maxlength: 120,
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        description: {
            type: String,
            required: [true, "Course description is required"],
            trim: true,
            maxlength: 3000,
        },

        language: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50,
        },

        level: {
            type: String,
            required: true,
            enum: ["Beginner", "Intermediate", "Advanced"],
            default: "Beginner",
        },

        thumbnail: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
        },

        price: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },

        durationHours: {
            type: Number,
            min: 0,
            default: 0,
        },

        isPublished: {
            type: Boolean,
            default: false,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

courseSchema.index({ isPublished: 1, createdAt: -1 });

const Course = mongoose.model("Course", courseSchema);
export default Course;