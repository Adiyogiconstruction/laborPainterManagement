import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./routes/auth.js";
import clientRoutes from "./routes/clients.js";
import workerRoutes from "./routes/workers.js";
import attendanceRoutes from "./routes/attendance.js";
import assignmentRoutes from "./routes/assignments.js";
import paymentRoutes from "./routes/payments.js";
import dashboardRoutes from "./routes/dashboard.js";
import reportRoutes from "./routes/reports.js";
import companyProfileRoutes from "./routes/companyProfile.js";
import dailyEntryRoutes from "./routes/dailyEntries.js";
import paintRoutes from "./routes/paint.js";
import expenseCategoryRoutes from "./routes/expenseCategories.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(",") || true,
    credentials: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(
  "/uploads",
  express.static(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads"),
  ),
);

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "Workforce Operations API" }),
);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/clients", requireAuth, clientRoutes);
app.use("/api/workers", requireAuth, workerRoutes);
app.use("/api/attendance", requireAuth, attendanceRoutes);
app.use("/api/assignments", requireAuth, assignmentRoutes);
app.use("/api/payments", requireAuth, paymentRoutes);
app.use("/api/company-profile", requireAuth, companyProfileRoutes);
app.use("/api/daily-entries", requireAuth, dailyEntryRoutes);
app.use("/api/paint", requireAuth, paintRoutes);
app.use("/api/expense-categories", requireAuth, expenseCategoryRoutes);
app.use("/api/reports", requireAuth, reportRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
