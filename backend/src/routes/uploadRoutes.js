import express from "express";
import upload from "../config/storage.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { uploadImage } from "../controllers/uploadController.js";

const router = express.Router();

// Only seller/admin can upload product images
router.post(
  "/",
  protect,
  authorizeRoles("seller", "admin"),
  upload.single("image"),
  uploadImage
);

export default router;
