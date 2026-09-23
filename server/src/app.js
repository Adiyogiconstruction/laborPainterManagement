import express from "express";
import cors from "cors";
import helmet from "helmet";
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
import expenseCategoryRoutes from "./routes/expenseCategories.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();
app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.use(helmet());
const isProduction = process.env.NODE_ENV === "production";
const clientOrigins = (process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS)
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (isProduction && !clientOrigins?.length) {
  throw new Error("CLIENT_ORIGIN is required in production.");
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || clientOrigins?.includes(origin)) {
      return callback(null, true);
    }

    if (
      !isProduction &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }

    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
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
app.use("/api/expense-categories", requireAuth, expenseCategoryRoutes);
app.use("/api/reports", requireAuth, reportRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
