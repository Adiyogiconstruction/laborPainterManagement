import { v2 as cloudinary } from "cloudinary";

const hasCloudinaryConfig = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );

function assertCloudinaryConfig() {
  if (!hasCloudinaryConfig()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
    );
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const imageOptimization = [{ quality: "auto:best", fetch_format: "auto" }];

export function uploadImage(buffer, folder, options = {}) {
  assertCloudinaryConfig();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: imageOptimization,
        ...options,
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
}

export async function deleteImage(publicId) {
  if (!publicId || !hasCloudinaryConfig()) return;
  assertCloudinaryConfig();
  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
}

export function authenticatedImageUrl(publicId) {
  if (!publicId) return "";
  assertCloudinaryConfig();
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "image",
    type: "authenticated",
    sign_url: true,
    transformation: imageOptimization,
  });
}

export function optimizedImageUrl(publicId) {
  if (!publicId) return "";
  assertCloudinaryConfig();
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "image",
    transformation: imageOptimization,
  });
}
