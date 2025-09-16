import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./src/config/db.js";
import authRoutes from "./src/routes/authRoutes.js";
import productRoutes from "./src/routes/productRoutes.js";
import cartRoutes from "./src/routes/cartRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import reviewRoutes from "./src/routes/reviewRoutes.js";
import wishlistRoutes from "./src/routes/wishlistRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import sellerRoutes from "./src/routes/sellerRoutes.js";
import adminEmailRoutes from "./src/routes/adminEmailRoutes.js";
import categoryRoutes from "./src/routes/categoryRoutes.js";
import adminMediaRoutes from "./src/routes/adminMediaRoutes.js";
import adminCouponRoutes from "./src/routes/adminCouponRoutes.js";
import testEmailRoutes from "./src/routes/testEmail.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";
import searchRoutes from "./src/routes/searchRoutes.js";

// Load environment variables silently
dotenv.config({ path: ".env" });

const app = express();

// If behind a reverse proxy (nginx, Vercel, etc.)
app.set("trust proxy", 1);

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(morgan("dev"));

// API Routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/users", userRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/emails", adminEmailRoutes);
app.use("/api/admin/media", adminMediaRoutes);
app.use("/api/admin/coupons", adminCouponRoutes);
app.use("/api/test-email", testEmailRoutes);
app.use("/api/auth", authRoutes);
// New analytics tracking
app.use("/api/analytics", analyticsRoutes);

// Serve uploads
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is alive" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
