import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";

const isProduction = process.env.NODE_ENV === "production";
if (
  isProduction &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
) {
  throw new Error("JWT_SECRET must be at least 32 characters in production.");
}
if (
  isProduction &&
  /^(mongodb:\/\/)?(localhost|127\.0\.0\.1)(:|\/|$)/.test(
    process.env.MONGODB_URI || "",
  )
) {
  throw new Error("Production must use a protected remote MongoDB instance.");
}

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1) {
  throw new Error("PORT is required and must be a valid positive integer.");
}

connectDatabase()
  .then(() =>
    app.listen(port, "0.0.0.0", () => console.log(`API ready on port ${port}`)),
  )
  .catch((error) => {
    console.error("Unable to connect to MongoDB", error);
    process.exit(1);
  });
