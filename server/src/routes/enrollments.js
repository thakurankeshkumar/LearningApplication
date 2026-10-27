
import { Router } from "express";
import mongoose from "mongoose";

import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import Enrollment from "../models/Enrollment.js";
import { protect } from "../middleware/auth.js";

const router = Router();

const validId = (id) => mongoose.isValidObjectId(id);

// POST /api/courses/:courseId/enroll
// Enroll the logged-in student in a free course.
router.post(
    "/courses/:courseId/enroll",
    protect,
    async (req, res, next) => {
        try {
            const { courseId } = req.params;

            if (!validId(courseId)) {
                return res.status(400).json({
                    message: "Invalid course ID",
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

            if (course.price > 0) {
                return res.status(402).json({
                    message: "Payment is required to enroll in this course",
                });
            }

            const existing = await Enrollment.findOne({
                student: req.user._id,
                course: course._id,
            });

            if (existing) {
                return res.status(409).json({
                    message: "You are already enrolled in this course",
                    enrollmentId: existing._id,
                });
            }

            const enrollment = await Enrollment.create({
                student: req.user._id,
                course: course._id,
            });

            return res.status(201).json({
                message: "Successfully enrolled in course",
                enrollment,
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    message: "You are already enrolled in this course",
                });
            }

            next(error);
        }
    }
);

// GET /api/enrollments/my
// Get the logged-in student's courses and progress.
router.get("/enrollments/my", protect, async (req, res, next) => {
    try {
        const enrollments = await Enrollment.find({
            student: req.user._id,
        })
            .populate(
                "course",
                "title slug description language level thumbnail price durationHours"
            )
            .populate("completedLessons", "title order")
            .sort({ enrolledAt: -1 })
            .lean();

        const results = await Promise.all(
            enrollments.map(async (enrollment) => {
                const totalLessons = await Lesson.countDocuments({
                    course: enrollment.course._id,
                });

                const completedCount = enrollment.completedLessons.length;

                return {
                    ...enrollment,
                    progress: {
                        totalLessons,
                        completedLessons: completedCount,
                        percentage:
                            totalLessons === 0
                                ? 0
                                : Math.round((completedCount / totalLessons) * 100),
                    },
                };
            })
        );

        res.status(200).json({
            count: results.length,
            enrollments: results,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/enrollments/:enrollmentId/lessons/:lessonId/complete
// Mark a lesson as completed.
router.post(
    "/enrollments/:enrollmentId/lessons/:lessonId/complete",
    protect,
    async (req, res, next) => {
        try {
            const { enrollmentId, lessonId } = req.params;

            if (!validId(enrollmentId) || !validId(lessonId)) {
                return res.status(400).json({
                    message: "Invalid enrollment or lesson ID",
                });
            }

            const enrollment = await Enrollment.findOne({
                _id: enrollmentId,
                student: req.user._id,
            });

            if (!enrollment) {
                return res.status(404).json({
                    message: "Enrollment not found",
                });
            }

            const lesson = await Lesson.findOne({
                _id: lessonId,
                course: enrollment.course,
            });

            if (!lesson) {
                return res.status(404).json({
                    message: "Lesson not found in this course",
                });
            }

            const alreadyCompleted = enrollment.completedLessons.some(
                (id) => id.toString() === lessonId
            );

            if (!alreadyCompleted) {
                enrollment.completedLessons.push(lesson._id);
                await enrollment.save();
            }

            const totalLessons = await Lesson.countDocuments({
                course: enrollment.course,
            });

            const completedLessons = enrollment.completedLessons.length;

            res.status(200).json({
                message: "Lesson marked as completed",
                progress: {
                    totalLessons,
                    completedLessons,
                    percentage:
                        totalLessons === 0
                            ? 0
                            : Math.round((completedLessons / totalLessons) * 100),
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
