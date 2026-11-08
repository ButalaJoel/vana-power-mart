
import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import cloudinary from "../lib/cloudinary.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const uploadsRouter = Router();

// Keep files in memory temporarily instead of saving them to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
  fileSize: 15 * 1024 * 1024, // Maximum 15 MB per image.
  files: 8, // Maximum 8 images per request.
},
  fileFilter: (_req, file, callback) => {
    // Reject non-image MIME types.
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Upload an image file."));
      return;
    }

    callback(null, true);
  },
});

// Upload selected product images to Cloudinary.
uploadsRouter.post(
  "/",
  requireAdmin,
  upload.array("images", 8),
  async (req, res) => {
  // This route must be protected by administrator authentication
  // before it is enabled for production use.
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      res.status(503).json({
        success: false,
        message: "Image storage is not configured.",
      });
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;

    if (!files?.length) {
      res.status(400).json({
        success: false,
        message: "Select at least one product image.",
      });
      return;
    }

    // Upload each file and return its secure URL and Cloudinary ID.
    const images = await Promise.all(
      files.map(
        (file) =>
          new Promise<{ url: string; publicId: string }>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder: "vana-power-mart/products",
                resource_type: "image",
                // Avoid exposing original filenames in public asset URLs.
                public_id: randomUUID(),
              },
              (error, result) => {
                if (error || !result) {
                  reject(error ?? new Error("Image upload failed."));
                  return;
                }

                resolve({
                  url: result.secure_url,
                  publicId: result.public_id,
                });
              },
            );

            stream.end(file.buffer);
          }),
      ),
    );

    res.status(201).json({
      success: true,
      data: images,
    });
  } catch (error) {
    console.error("Product image upload failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to upload product images.",
    });
  }
});

export default uploadsRouter;
