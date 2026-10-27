
import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
    {
        question: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },

        options: {
            type: [String],
            required: true,
            validate: {
                validator: (options) =>
                    options.length >= 2 &&
                    options.length <= 6 &&
                    options.every(
                        (option) =>
                            typeof option === "string" &&
                            option.trim().length > 0 &&
                            option.length <= 500
                    ),
                message: "Each question must have 2–6 valid options",
            },
        },

        correctAnswer: {
            type: Number,
            required: true,
            min: 0,
        },

        explanation: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
        },
    },
    { _id: true }
);

questionSchema.pre("validate", function () {
    if (
        !Number.isInteger(this.correctAnswer) ||
        this.correctAnswer < 0 ||
        this.correctAnswer >= this.options.length
    ) {
        this.invalidate(
            "correctAnswer",
            "Correct answer must match an existing option"
        );
    }
});

const quizSchema = new mongoose.Schema(
    {
        lesson: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lesson",
            required: true,
            unique: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },

        questions: {
            type: [questionSchema],
            required: true,
            validate: {
                validator: (questions) =>
                    questions.length >= 1 && questions.length <= 50,
                message: "A quiz must have 1–50 questions",
            },
        },

        passPercentage: {
            type: Number,
            default: 70,
            min: 1,
            max: 100,
        },
    },
    { timestamps: true }
);

const Quiz = mongoose.model("Quiz", quizSchema);

export default Quiz;
