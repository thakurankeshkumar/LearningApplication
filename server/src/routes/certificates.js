
import { Router } from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";

import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import Quiz from "../models/Quiz.js";
import QuizAttempt from "../models/QuizAttempt.js";
import Certificate from "../models/Certificate.js";
import { protect } from "../middleware/auth.js";

const router = Router();

const validId = (id) => mongoose.isValidObjectId(id);

// POST /api/certificates/:courseId/issue

router.post("/:courseId/issue", protect, async (req, res) => {
    try {
        const { courseId } = req.params;
        const studentId = req.user._id;

        const course = await Course.findOne({
            _id: courseId,
            isPublished: true,
        });

        if (!course) {
            return res.status(404).json({
                message: "Published course not found.",
            });
        }

        const enrollment = await Enrollment.findOne({
            student: studentId,
            course: courseId,
        });

        if (!enrollment) {
            return res.status(403).json({
                message: "You must be enrolled in this course.",
            });
        }

        const lessons = await Lesson.find({
            course: courseId,
        }).select("_id");

        const lessonIds = lessons.map((lesson) => lesson._id);
        const completedIds = new Set(
            enrollment.completedLessons.map((id) => id.toString())
        );

        const allLessonsCompleted = lessonIds.every((id) =>
            completedIds.has(id.toString())
        );

        if (!allLessonsCompleted) {
            return res.status(400).json({
                message: "Complete every lesson before requesting a certificate.",
            });
        }

        const quizzes = await Quiz.find({
            lesson: { $in: lessonIds },
        }).select("_id lesson");

        if (quizzes.length > 0) {
            const passedQuizIds = await QuizAttempt.distinct("quiz", {
                student: studentId,
                quiz: { $in: quizzes.map((quiz) => quiz._id) },
                passed: true,
            });

            const passedQuizSet = new Set(
                passedQuizIds.map((id) => id.toString())
            );

            const missingQuiz = quizzes.find(
                (quiz) => !passedQuizSet.has(quiz._id.toString())
            );

            if (missingQuiz) {
                return res.status(403).json({
                    message: "Pass every course quiz before requesting a certificate.",
                });
            }
        }

        const existingCertificate = await Certificate.findOne({
            student: studentId,
            course: courseId,
        });

        if (existingCertificate) {
            return res.status(200).json({
                message: "Certificate already exists.",
                certificate: existingCertificate,
            });
        }

        try {
            const certificate = await Certificate.create({
                student: studentId,
                course: courseId,
                enrollment: enrollment._id,
            });

            return res.status(201).json({
                message: "Certificate issued successfully.",
                certificate,
            });
        } catch (error) {
            // Handle simultaneous requests for the same certificate.
            if (error.code === 11000) {
                const certificate = await Certificate.findOne({
                    student: studentId,
                    course: courseId,
                });

                if (certificate) {
                    return res.status(200).json({
                        message: "Certificate already exists.",
                        certificate,
                    });
                }
            }

            throw error;
        }
    } catch (error) {
        console.error("Issue certificate error:", error.message);

        return res.status(500).json({
            message: "Unable to issue certificate.",
        });
    }
});


// GET /api/certificates/my
router.get("/my", protect, async (req, res, next) => {
    try {
        const certificates = await Certificate.find({
            student: req.user._id,
        })
            .populate("course", "title language level")
            .sort({ issuedAt: -1 })
            .lean();

        res.status(200).json({
            count: certificates.length,
            certificates,
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/certificates/verify/:certificateNumber
// Public: verify that a certificate exists.
router.get(
    "/verify/:certificateNumber",
    async (req, res, next) => {
        try {
            const certificateNumber = req.params.certificateNumber;

            if (
                typeof certificateNumber !== "string" ||
                !/^LP-[A-F0-9]{16}$/.test(certificateNumber)
            ) {
                return res.status(400).json({
                    message: "Invalid certificate number",
                });
            }

            const certificate = await Certificate.findOne({
                certificateNumber,
            })
                .populate("course", "title language level")
                .populate("student", "name")
                .lean();

            if (!certificate) {
                return res.status(404).json({
                    valid: false,
                    message: "Certificate not found",
                });
            }

            res.status(200).json({
                valid: true,
                certificate: {
                    certificateNumber: certificate.certificateNumber,
                    studentName: certificate.student.name,
                    courseTitle: certificate.course.title,
                    issuedAt: certificate.issuedAt,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
