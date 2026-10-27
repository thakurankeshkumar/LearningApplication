# LingoPro — Language Learning Platform

A full-stack MVP starter using React + Vite, Express, MongoDB, Mongoose, JWT, and bcrypt.

## Requirements
- Node.js 20+
- MongoDB Community Server running locally, or a MongoDB Atlas connection string
- npm

## Setup

### 1. Configure MongoDB and the backend
```bash
cd server
```
Copy `.env.example` to `.env` and set:
- `MONGODB_URI=mongodb://127.0.0.1:27017/lingopro` for local MongoDB, or your MongoDB Atlas connection string
- `JWT_SECRET` to a long random secret (at least 32 characters)
- `CLIENT_ORIGIN=http://localhost:5173`

Then run:
```bash
npm install
npm run dev
```
The API starts on `http://localhost:5000` after MongoDB connects. Visit `http://localhost:5000/api/health` to check the API and database status.

### 2. Start the frontend
Open a second terminal:
```bash
cd client
npm install
npm run dev
```
Open the URL printed by Vite (normally `http://localhost:5173`).

## Demo accounts
- Admin: `admin@lingopro.local` / `Admin123!`
- Student: `student@lingopro.local` / `Student123!`

Local development only. Change or remove demo accounts before sharing or deploying the app.

## MongoDB collections
- `users` — account identity, password hash, role
- `courses` — course metadata and embedded ordered lessons
- `enrollments` — user-to-course access and enrollment state
- `lessonprogress` — per-user completion records
- `quizzes` and `quizattempts` — assessments and results
- `payments` — payment provider/order/status records
- `certificates` — issued certificate records

Mongoose schemas define validation and indexes. Course lessons are embedded because they are usually read with their course; enrollments and per-user progress are separate collections to support queries and analytics.

## Implemented in this starter
- Signup/login with bcrypt password hashing and JWT
- Student-only public signup; admin role is assigned by trusted server-side seed/setup
- Course catalogue and course details API
- Enrollment checks and lesson progress endpoints
- Admin overview, course creation, and student list
- Responsive React catalogue, auth, student dashboard and admin UI

## Not yet production-ready
Razorpay order creation and signature verification, functional quiz authoring/submission, XP/streak calculations, certificate issuance/PDF generation, Gemini integrations, email verification, password reset, rate limiting, audit logs, backups, deployment and full test coverage are staged for later. Do not accept real payments with this starter as-is.

## Security notes
- Never commit `.env`.
- Use HTTPS in deployment, secure token handling, rate limiting, validation, monitoring, backups, and least-privilege database credentials.
- Restrict MongoDB network access. For Atlas, use a database user with only the permissions required by this app.
- Demo credentials are for local development only.
