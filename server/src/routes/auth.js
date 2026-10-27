import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = Router();

const createToken = (userId) => {
    return jwt.sign(
        { userId: userId.toString() },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );
};

const publicUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
});

// POST /api/auth/signup
router.post("/signup", async (req, res, next) => {
    try {
        const { name, email, password } = req.body ?? {};

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                message: "Name, email and password are required",
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanName.length < 2 || cleanName.length > 60) {
            return res.status(400).json({
                message: "Name must be between 2 and 60 characters",
            });
        }

        if (
            cleanEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        ) {
            return res.status(400).json({
                message: "Enter a valid email address",
            });
        }

        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                message: "Password must be between 8 and 72 characters",
            });
        }

        const existingUser = await User.findOne({ email: cleanEmail });

        if (existingUser) {
            return res.status(409).json({
                message: "An account with this email already exists",
            });
        }

        const user = await User.create({
            name: cleanName,
            email: cleanEmail,
            password,
            role: "student",
        });

        const token = createToken(user._id);

        return res.status(201).json({
            message: "Account created successfully",
            token,
            user: publicUser(user),
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "An account with this email already exists",
            });
        }

        next(error);
    }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body ?? {};

        if (
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const user = await User.findOne({ email: cleanEmail })
            .select("+password");

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = createToken(user._id);

        return res.status(200).json({
            message: "Login successful",
            token,
            user: publicUser(user),
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me
router.get("/me", protect, (req, res) => {
    return res.status(200).json({
        user: publicUser(req.user),
    });
});

export default router;