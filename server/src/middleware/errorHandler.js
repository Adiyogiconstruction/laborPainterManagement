export function notFound(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  console.error(error);
  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: Object.values(error.errors)
        .map((item) => item.message)
        .join(", "),
    });
  }
  if (error.name === "MulterError") {
    return res
      .status(400)
      .json({ message: "The uploaded file is invalid or too large." });
  }
  if (error.code === 11000)
    return res
      .status(409)
      .json({ message: "A record with that value already exists." });
  if (error.name === "CastError")
    return res.status(400).json({ message: "Invalid record identifier." });
  const status = error.status || 500;
  return res.status(status).json({
    message: status < 500 ? error.message : "Something went wrong.",
  });
}
