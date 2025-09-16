import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const storageMode = process.env.STORAGE_MODE || "local"; // "local" or "cloud"

let upload;

if (storageMode === "cloud") {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const cloudStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "ecommerce-products",
      resource_type: "auto", // allow images and videos
      allowed_formats: [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "mp4",
        "webm",
        "mov",
        "mkv",
      ],
    },
  });

  upload = multer({ storage: cloudStorage });
} else {
  // local storage (unchanged)
  const localStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(process.cwd(), "uploads/"));
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    },
  });

  upload = multer({ storage: localStorage });
}

export default upload;
