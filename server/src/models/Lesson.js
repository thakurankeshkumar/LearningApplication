
import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema(
    {
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
            index: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 150,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
        },

        content: {
            type: String,
            trim: true,
            maxlength: 50000,
            default: "",
        },

        videoUrl: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: "",
        },

        order: {
            type: Number,
            required: true,
            min: 1,
        },

        isPreview: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

lessonSchema.index({ course: 1, order: 1 }, { unique: true });

const Lesson = mongoose.model("Lesson", lessonSchema);

export default Lesson;
