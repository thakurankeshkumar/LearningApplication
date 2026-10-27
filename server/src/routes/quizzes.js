
import { Router } from "express";
import mongoose from "mongoose";

import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Quiz from "../models/Quiz.js";
import QuizAttempt from "../models/QuizAttempt.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = Router();

const validId = (id) => mongoose.isValidObjectId(id);

const hasEnrollment = (studentId, courseId) =>
    Enrollment.exists({
        student: studentId,
        course: courseId,
    });

const publicQuiz = (quiz) => ({
    _id: quiz._id,
    lesson: quiz.lesson,
    title: quiz.title,
    passPercentage: quiz.passPercentage,
    questions: quiz.questions.map((question) => ({
        _id: question._id,
        question: question.question,
        options: question.options,
    })),
});

// POST /api/lessons/:lessonId/quiz
// Admin only: create a quiz for a lesson.
router.post(
    "/lessons/:lessonId/quiz",
    protect,
    requireAdmin,
    async (req, res, next) => {
        try {
            const { lessonId } = req.params;

            if (!validId(lessonId)) {
                return res.status(400).json({
                    message: "Invalid lesson ID",
                });
            }

            const { title, questions, passPercentage = 70 } = req.body ?? {};

            if (
                typeof title !== "string" ||
                !title.trim() ||
                title.trim().length > 150
            ) {
                return res.status(400).json({
                    message: "A valid quiz title is required",
                });
            }

            if (
                !Array.isArray(questions) ||
                questions.length < 1 ||
                questions.length > 50
            ) {
                return res.status(400).json({
                    message: "A quiz must contain 1–50 questions",
                });
            }

            if (
                typeof passPercentage !== "number" ||
                !Number.isFinite(passPercentage) ||
                passPercentage < 1 ||
                passPercentage > 100
            ) {
                return res.status(400).json({
                    message: "Pass percentage must be between 1 and 100",
                });
            }

            for (const question of questions) {
                if (
                    !question ||
                    typeof question.question !== "string" ||
                    !question.question.trim() ||
                    question.question.length > 1000 ||
                    !Array.isArray(question.options) ||
                    question.options.length < 2 ||
                    question.options.length > 6 ||
                    !question.options.every(
                        (option) =>
                            typeof option === "string" &&
                            option.trim().length > 0 &&
                            option.length <= 500
                    ) ||
                    !Number.isInteger(question.correctAnswer) ||
                    question.correctAnswer < 0 ||
                    question.correctAnswer >= question.options.length ||
                    (question.explanation !== undefined &&
                        (typeof question.explanation !== "string" ||
                            question.explanation.length > 1000))
                ) {
                    return res.status(400).json({
                        message: "One or more questions have invalid fields",
                    });
                }
            }

            const lesson = await Lesson.findById(lessonId);

            if (!lesson) {
                return res.status(404).json({
                    message: "Lesson not found",
                });
            }

            const quiz = await Quiz.create({
                lesson: lesson._id,
                title: title.trim(),
                passPercentage,
                questions: questions.map((question) => ({
                    question: question.question.trim(),
                    options: question.options.map((option) => option.trim()),
                    correctAnswer: question.correctAnswer,
                    explanation: question.explanation?.trim() ?? "",
                })),
            });

            res.status(201).json({
                message: "Quiz created successfully",
                quiz: {
                    _id: quiz._id,
                    lesson: quiz.lesson,
                    title: quiz.title,
                    questionCount: quiz.questions.length,
                    passPercentage: quiz.passPercentage,
                },
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    message: "A quiz already exists for this lesson",
                });
            }

            next(error);
        }
    }
);

// GET /api/lessons/:lessonId/quiz
// Enrolled students only: retrieve quiz without answers.
router.get(
    "/lessons/:lessonId/quiz",
    protect,
    async (req, res, next) => {
        try {
            const { lessonId } = req.params;

            if (!validId(lessonId)) {
                return res.status(400).json({
                    message: "Invalid lesson ID",
                });
            }

            const lesson = await Lesson.findById(lessonId)
                .select("_id course title")
                .lean();

            if (!lesson) {
                return res.status(404).json({
                    message: "Lesson not found",
                });
            }

            const enrollment = await hasEnrollment(
                req.user._id,
                lesson.course
            );

            if (!enrollment) {
                return res.status(403).json({
                    message: "Enroll in this course to take its quiz",
                });
            }

            const quiz = await Quiz.findOne({ lesson: lessonId }).lean();

            if (!quiz) {
                return res.status(404).json({
                    message: "Quiz not found",
                });
            }

            res.status(200).json({
                quiz: publicQuiz(quiz),
            });
        } catch (error) {
            next(error);
        }
    }
);

// POST /api/lessons/:lessonId/quiz/submit
// Enrolled students only: grade answers on the server.
router.post(
    "/lessons/:lessonId/quiz/submit",
    protect,
    async (req, res, next) => {
        try {
            const { lessonId } = req.params;

            if (!validId(lessonId)) {
                return res.status(400).json({
                    message: "Invalid lesson ID",
                });
            }

            const { answers } = req.body ?? {};

            if (!Array.isArray(answers)) {
                return res.status(400).json({
                    message: "Answers must be an array",
                });
            }

            const lesson = await Lesson.findById(lessonId);

            if (!lesson) {
                return res.status(404).json({
                    message: "Lesson not found",
                });
            }

            const enrollment = await Enrollment.findOne({
                student: req.user._id,
                course: lesson.course,
            });

            if (!enrollment) {
                return res.status(403).json({
                    message: "Enroll in this course to submit its quiz",
                });
            }

            const quiz = await Quiz.findOne({ lesson: lessonId });

            if (!quiz) {
                return res.status(404).json({
                    message: "Quiz not found",
                });
            }

            if (answers.length !== quiz.questions.length) {
                return res.status(400).json({
                    message: "Submit exactly one answer for every question",
                });
            }

            const submitted = new Map();

            for (const answer of answers) {
                if (
                    !answer ||
                    typeof answer.questionId !== "string" ||
                    !validId(answer.questionId) ||
                    !Number.isInteger(answer.selectedAnswer) ||
                    answer.selectedAnswer < 0
                ) {
                    return res.status(400).json({
                        message: "One or more submitted answers are invalid",
                    });
                }

                if (submitted.has(answer.questionId)) {
                    return res.status(400).json({
                        message: "Duplicate question answers are not allowed",
                    });
                }

                submitted.set(answer.questionId, answer.selectedAnswer);
            }

            const gradedAnswers = [];

            for (const question of quiz.questions) {
                const questionId = question._id.toString();

                if (!submitted.has(questionId)) {
                    return res.status(400).json({
                        message: "An answer is missing",
                    });
                }

                const selectedAnswer = submitted.get(questionId);

                if (selectedAnswer >= question.options.length) {
                    return res.status(400).json({
                        message: "An answer option is out of range",
                    });
                }

                gradedAnswers.push({
                    questionId: question._id,
                    selectedAnswer,
                    isCorrect: selectedAnswer === question.correctAnswer,
                });
            }

            const correctCount = gradedAnswers.filter(
                (answer) => answer.isCorrect
            ).length;

            const score = Math.round(
                (correctCount / quiz.questions.length) * 100
            );

            const passed = score >= quiz.passPercentage;

            const attempt = await QuizAttempt.create({
                student: req.user._id,
                quiz: quiz._id,
                lesson: lesson._id,
                answers: gradedAnswers,
                score,
                passed,
            });

            // A passing quiz completes the associated lesson.
            if (passed) {
                await Enrollment.updateOne(
                    { _id: enrollment._id },
                    { $addToSet: { completedLessons: lesson._id } }
                );
            }

            res.status(200).json({
                message: passed ? "Quiz passed!" : "Quiz not passed. Try again.",
                attemptId: attempt._id,
                score,
                correctCount,
                totalQuestions: quiz.questions.length,
                passed,
                passPercentage: quiz.passPercentage,
                results: quiz.questions.map((question, index) => ({
                    questionId: question._id,
                    question: question.question,
                    selectedAnswer: gradedAnswers[index].selectedAnswer,
                    correctAnswer: question.correctAnswer,
                    isCorrect: gradedAnswers[index].isCorrect,
                    explanation: question.explanation,
                })),
            });
        } catch (error) {
            next(error);
        }
    }
);

// GET /api/quizzes/my-attempts
// Students can view only their own quiz attempts.
router.get("/quizzes/my-attempts", protect, async (req, res, next) => {
    try {
        const attempts = await QuizAttempt.find({
            student: req.user._id,
        })
            .select("-answers")
            .populate("quiz", "title")
            .populate("lesson", "title")
            .sort({ submittedAt: -1 })
            .limit(100)
            .lean();

        res.status(200).json({
            count: attempts.length,
            attempts,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
