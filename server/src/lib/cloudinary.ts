
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary on the server.
// Credentials must never be exposed to the browser.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Reuse this configured client for image uploads.
export default cloudinary;
