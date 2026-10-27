
import { Router } from "express";
import Course from "../models/Course.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = Router();

const createSlug = (value) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

const isValidObjectId = (id) =>
    /^[a-f\d]{24}$/i.test(id);

// GET /api/courses
// Public: list published courses.
router.get("/", async (req, res, next) => {
    try {
        const { language, level, search } = req.query;

        const filter = { isPublished: true };

        if (typeof language === "string" && language.trim()) {
            filter.language = language.trim();
        }

        if (
            typeof level === "string" &&
            ["Beginner", "Intermediate", "Advanced"].includes(level)
        ) {
            filter.level = level;
        }

        if (typeof search === "string" && search.trim()) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            filter.$or = [
                { title: { $regex: escaped, $options: "i" } },
                { description: { $regex: escaped, $options: "i" } },
                { language: { $regex: escaped, $options: "i" } },
            ];
        }

        const courses = await Course.find(filter)
            .select("-createdBy -__v")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        res.status(200).json({
            count: courses.length,
            courses,
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/courses/:id
// Public: view a published course.
router.get("/:id", async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid course ID",
            });
        }

        const course = await Course.findOne({
            _id: req.params.id,
            isPublished: true,
        })
            .select("-createdBy -__v")
            .lean();

        if (!course) {
            return res.status(404).json({
                message: "Course not found",
            });
        }

        res.status(200).json({ course });
    } catch (error) {
        next(error);
    }
});

// POST /api/courses
// Admin only: create a course.
router.post("/", protect, requireAdmin, async (req, res, next) => {
    try {
        const {
            title,
            description,
            language,
            level,
            thumbnail,
            price,
            durationHours,
            isPublished,
        } = req.body ?? {};

        if (
            typeof title !== "string" ||
            typeof description !== "string" ||
            typeof language !== "string"
        ) {
            return res.status(400).json({
                message: "Title, description and language are required",
            });
        }

        const cleanTitle = title.trim();
        const cleanDescription = description.trim();
        const cleanLanguage = language.trim();

        if (
            cleanTitle.length < 3 ||
            cleanTitle.length > 120 ||
            !cleanDescription ||
            cleanDescription.length > 3000 ||
            !cleanLanguage ||
            cleanLanguage.length > 50
        ) {
            return res.status(400).json({
                message: "Please check the course title, description and language",
            });
        }

        const cleanLevel = level ?? "Beginner";

        if (!["Beginner", "Intermediate", "Advanced"].includes(cleanLevel)) {
            return res.status(400).json({
                message: "Invalid course level",
            });
        }

        const cleanPrice = price === undefined ? 0 : price;
        const cleanDuration = durationHours === undefined ? 0 : durationHours;

        if (
            typeof cleanPrice !== "number" ||
            !Number.isFinite(cleanPrice) ||
            cleanPrice < 0 ||
            cleanPrice > 10000000
        ) {
            return res.status(400).json({
                message: "Price must be a valid non-negative number",
            });
        }

        if (
            typeof cleanDuration !== "number" ||
            !Number.isFinite(cleanDuration) ||
            cleanDuration < 0 ||
            cleanDuration > 100000
        ) {
            return res.status(400).json({
                message: "Duration must be a valid non-negative number",
            });
        }

        if (
            thumbnail !== undefined &&
            (typeof thumbnail !== "string" || thumbnail.length > 1000)
        ) {
            return res.status(400).json({
                message: "Thumbnail must be a string of at most 1000 characters",
            });
        }

        if (
            isPublished !== undefined &&
            typeof isPublished !== "boolean"
        ) {
            return res.status(400).json({
                message: "isPublished must be true or false",
            });
        }

        const baseSlug = createSlug(cleanTitle);

        if (!baseSlug) {
            return res.status(400).json({
                message: "Course title cannot generate a valid slug",
            });
        }

        let slug = baseSlug;
        let suffix = 2;

        while (await Course.exists({ slug })) {
            slug = `${baseSlug}-${suffix}`;
            suffix += 1;
        }

        const course = await Course.create({
            title: cleanTitle,
            slug,
            description: cleanDescription,
            language: cleanLanguage,
            level: cleanLevel,
            thumbnail: thumbnail?.trim() ?? "",
            price: cleanPrice,
            durationHours: cleanDuration,
            isPublished: isPublished ?? false,
            createdBy: req.user._id,
        });

        res.status(201).json({
            message: "Course created successfully",
            course,
        });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/courses/:id
// Admin only: update a course.
router.patch("/:id", protect, requireAdmin, async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid course ID",
            });
        }

        const allowedFields = [
            "title",
            "description",
            "language",
            "level",
            "thumbnail",
            "price",
            "durationHours",
            "isPublished",
        ];

        const updates = req.body ?? {};
        const keys = Object.keys(updates);

        if (
            keys.length === 0 ||
            keys.some((key) => !allowedFields.includes(key))
        ) {
            return res.status(400).json({
                message: "Provide valid course fields to update",
            });
        }

        if (
            updates.title !== undefined &&
            (typeof updates.title !== "string" ||
                updates.title.trim().length < 3 ||
                updates.title.trim().length > 120)
        ) {
            return res.status(400).json({
                message: "Title must be between 3 and 120 characters",
            });
        }

        if (
            updates.description !== undefined &&
            (typeof updates.description !== "string" ||
                !updates.description.trim() ||
                updates.description.trim().length > 3000)
        ) {
            return res.status(400).json({
                message: "Description is invalid",
            });
        }

        if (
            updates.language !== undefined &&
            (typeof updates.language !== "string" ||
                !updates.language.trim() ||
                updates.language.trim().length > 50)
        ) {
            return res.status(400).json({
                message: "Language is invalid",
            });
        }

        if (
            updates.level !== undefined &&
            !["Beginner", "Intermediate", "Advanced"].includes(updates.level)
        ) {
            return res.status(400).json({
                message: "Invalid course level",
            });
        }

        if (
            updates.thumbnail !== undefined &&
            (typeof updates.thumbnail !== "string" ||
                updates.thumbnail.length > 1000)
        ) {
            return res.status(400).json({
                message: "Thumbnail is invalid",
            });
        }

        for (const field of ["price", "durationHours"]) {
            if (
                updates[field] !== undefined &&
                (typeof updates[field] !== "number" ||
                    !Number.isFinite(updates[field]) ||
                    updates[field] < 0)
            ) {
                return res.status(400).json({
                    message: `${field} must be a non-negative number`,
                });
            }
        }

        if (
            updates.isPublished !== undefined &&
            typeof updates.isPublished !== "boolean"
        ) {
            return res.status(400).json({
                message: "isPublished must be true or false",
            });
        }

        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({
                message: "Course not found",
            });
        }

        for (const field of keys) {
            if (field === "title") {
                course.title = updates.title.trim();
            } else if (field === "description" || field === "language") {
                course[field] = updates[field].trim();
            } else if (field === "thumbnail") {
                course.thumbnail = updates.thumbnail.trim();
            } else {
                course[field] = updates[field];
            }
        }

        if (updates.title !== undefined) {
            const baseSlug = createSlug(course.title);
            let slug = baseSlug;
            let suffix = 2;

            while (
                await Course.exists({
                    slug,
                    _id: { $ne: course._id },
                })
            ) {
                slug = `${baseSlug}-${suffix}`;
                suffix += 1;
            }

            course.slug = slug;
        }

        await course.save();

        res.status(200).json({
            message: "Course updated successfully",
            course,
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/courses/:id
// Admin only: delete a course.
router.delete("/:id", protect, requireAdmin, async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid course ID",
            });
        }

        const course = await Course.findByIdAndDelete(req.params.id);

        if (!course) {
            return res.status(404).json({
                message: "Course not found",
            });
        }

        res.status(200).json({
            message: "Course deleted successfully",
        });
    } catch (error) {
        next(error);
    }
});

export default router;
