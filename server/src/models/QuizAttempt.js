
import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        quiz: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Quiz",
            required: true,
        },

        lesson: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lesson",
            required: true,
        },

        answers: [
            {
                questionId: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true,
                },

                selectedAnswer: {
                    type: Number,
                    required: true,
                    min: 0,
                },

                isCorrect: {
                    type: Boolean,
                    required: true,
                },
            },
        ],

        score: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },

        passed: {
            type: Boolean,
            required: true,
        },

        submittedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

quizAttemptSchema.index({ student: 1, quiz: 1, submittedAt: -1 });

const QuizAttempt = mongoose.model("QuizAttempt", quizAttemptSchema);

export default QuizAttempt;
