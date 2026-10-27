
import { Router } from "express";
import mongoose from "mongoose";
import Enrollment from "../models/Enrollment.js";
import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = Router();

const validId = (id) => mongoose.isValidObjectId(id);

const allowedFields = [
    "title",
    "description",
    "content",
    "videoUrl",
    "order",
    "isPreview",
];

const validateLessonFields = (body, isCreate = false) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return "Invalid request body";
    }

    const keys = Object.keys(body);

    if (
        keys.length === 0 ||
        keys.some((key) => !allowedFields.includes(key))
    ) {
        return "Provide valid lesson fields";
    }

    if (
        isCreate &&
        (typeof body.title !== "string" ||
            typeof body.order !== "number")
    ) {
        return "Title and numeric order are required";
    }

    if (
        body.title !== undefined &&
        (typeof body.title !== "string" ||
            body.title.trim().length < 2 ||
            body.title.trim().length > 150)
    ) {
        return "Title must be between 2 and 150 characters";
    }

    if (
        body.description !== undefined &&
        (typeof body.description !== "string" ||
            body.description.length > 1000)
    ) {
        return "Description must be at most 1000 characters";
    }

    if (
        body.content !== undefined &&
        (typeof body.content !== "string" ||
            body.content.length > 50000)
    ) {
        return "Content must be at most 50000 characters";
    }

    if (
        body.videoUrl !== undefined &&
        (typeof body.videoUrl !== "string" ||
            body.videoUrl.length > 2000)
    ) {
        return "Video URL is invalid";
    }

    if (
        body.order !== undefined &&
        (!Number.isInteger(body.order) || body.order < 1)
    ) {
        return "Order must be a positive integer";
    }

    if (
        body.isPreview !== undefined &&
        typeof body.isPreview !== "boolean"
    ) {
        return "isPreview must be true or false";
    }

    return null;
};

// GET /api/courses/:courseId/lessons
// Public: return preview lessons for published courses.
router.get(
    "/courses/:courseId/lessons",
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
            })
                .select("_id title")
                .lean();

            if (!course) {
                return res.status(404).json({
                    message: "Course not found",
                });
            }

            const lessons = await Lesson.find({
                course: courseId,
                isPreview: true,
            })
                .select("-__v")
                .sort({ order: 1 })
                .lean();

            res.status(200).json({
                course,
                count: lessons.length,
                lessons,
            });
        } catch (error) {
            next(error);
        }
    }
);

// GET /api/courses/:courseId/lessons/manage
// Admin: return every lesson in a course.
router.get(
    "/courses/:courseId/lessons/manage",
    protect,
    requireAdmin,
    async (req, res, next) => {
        try {
            const { courseId } = req.params;

            if (!validId(courseId)) {
                return res.status(400).json({
                    message: "Invalid course ID",
                });
            }

            const course = await Course.findById(courseId)
                .select("_id title isPublished")
                .lean();

            if (!course) {
                return res.status(404).json({
                    message: "Course not found",
                });
            }

            const lessons = await Lesson.find({ course: courseId })
                .sort({ order: 1 })
                .lean();

            res.status(200).json({
                course,
                count: lessons.length,
                lessons,
            });
        } catch (error) {
            next(error);
        }
    }
);

// POST /api/courses/:courseId/lessons
// Admin: create a lesson.
router.post(
    "/courses/:courseId/lessons",
    protect,
    requireAdmin,
    async (req, res, next) => {
        try {
            const { courseId } = req.params;

            if (!validId(courseId)) {
                return res.status(400).json({
                    message: "Invalid course ID",
                });
            }

            const validationError = validateLessonFields(req.body, true);

            if (validationError) {
                return res.status(400).json({
                    message: validationError,
                });
            }

            const course = await Course.findById(courseId);

            if (!course) {
                return res.status(404).json({
                    message: "Course not found",
                });
            }

            const lesson = await Lesson.create({
                course: courseId,
                title: req.body.title.trim(),
                description: req.body.description?.trim() ?? "",
                content: req.body.content?.trim() ?? "",
                videoUrl: req.body.videoUrl?.trim() ?? "",
                order: req.body.order,
                isPreview: req.body.isPreview ?? false,
            });

            res.status(201).json({
                message: "Lesson created successfully",
                lesson,
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    message: "A lesson already uses that order in this course",
                });
            }

            next(error);
        }
    }
);

// PATCH /api/lessons/:lessonId
// Admin: update a lesson.
router.patch(
    "/lessons/:lessonId",
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

            const validationError = validateLessonFields(req.body);

            if (validationError) {
                return res.status(400).json({
                    message: validationError,
                });
            }

            const lesson = await Lesson.findById(lessonId);

            if (!lesson) {
                return res.status(404).json({
                    message: "Lesson not found",
                });
            }

            for (const [key, value] of Object.entries(req.body)) {
                lesson[key] =
                    typeof value === "string" &&
                        ["title", "description", "content", "videoUrl"].includes(key)
                        ? value.trim()
                        : value;
            }

            await lesson.save();

            res.status(200).json({
                message: "Lesson updated successfully",
                lesson,
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    message: "A lesson already uses that order in this course",
                });
            }

            next(error);
        }
    }
);

// DELETE /api/lessons/:lessonId
// Admin: delete a lesson.
router.delete(
    "/lessons/:lessonId",
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

            const lesson = await Lesson.findByIdAndDelete(lessonId);

            if (!lesson) {
                return res.status(404).json({
                    message: "Lesson not found",
                });
            }

            res.status(200).json({
                message: "Lesson deleted successfully",
            });
        } catch (error) {
            next(error);
        }
    }
);


router.get(
  "/courses/:courseId/lessons/learn",
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
      })
        .select("_id title")
        .lean();

      if (!course) {
        return res.status(404).json({
          message: "Course not found",
        });
      }

      const enrollment = await Enrollment.findOne({
        student: req.user._id,
        course: courseId,
      });

      if (!enrollment) {
        return res.status(403).json({
          message: "Enroll in this course to access its lessons",
        });
      }

      const lessons = await Lesson.find({ course: courseId })
        .select("-__v")
        .sort({ order: 1 })
        .lean();

      res.status(200).json({
        course,
        lessons,
      });
    } catch (error) {
      next(error);
    }
  }
);


export default router;
