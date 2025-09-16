import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Order from "../models/Order.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import PriceAlertLog from "../models/PriceAlertLog.js";
import { sendPriceDropEmail } from "../services/email/emailService.js";

// ---------------- Customers Also Bought ----------------
const ALSO_BOUGHT_TTL = 10 * 60 * 1000; // 10 minutes
const alsoBoughtCache = new Map(); // key: `${productId}:${limit}` -> { expires, items }

export const getAlsoBought = async (req, res) => {
  try {
    const idOrSlug = req.params.id;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || "8")));

    // Resolve product id from id or slug
    const product =
      (await Product.findById(idOrSlug)) ||
      (await Product.findOne({ slug: idOrSlug }));
    if (!product) return res.status(404).json({ message: "Not found" });

    const productId = new mongoose.Types.ObjectId(product._id);
    const cacheKey = `${productId.toString()}:${limit}`;

    // Cache hit
    const cached = alsoBoughtCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return res.json({ items: cached.items });
    }

    // Aggregate co-purchases from orders (exclude cancelled)
    const agg = await Order.aggregate([
      { $match: { status: { $ne: "cancelled" }, "items.product": productId } },
      { $unwind: "$items" },
      { $match: { "items.product": { $ne: productId } } },
      {
        $group: {
          _id: "$items.product",
          sold: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
        },
      },
      { $sort: { sold: -1, revenue: -1 } },
      { $limit: limit * 3 },
    ]);

    const ids = agg.map((a) => a._id);
    if (ids.length === 0) {
      alsoBoughtCache.set(cacheKey, {
        expires: Date.now() + ALSO_BOUGHT_TTL,
        items: [],
      });
      return res.json({ items: [] });
    }

    // Fetch active products and keep the ranking order from agg
    const prods = await Product.find({
      _id: { $in: ids },
      status: "active",
    })
      .select("title price images avgRating ratingsCount")
      .lean();

    const map = new Map(prods.map((p) => [p._id.toString(), p]));
    const ordered = [];
    for (const a of agg) {
      const p = map.get(a._id.toString());
      if (p) ordered.push(p);
      if (ordered.length >= limit) break;
    }

    const payload = ordered;
    alsoBoughtCache.set(cacheKey, {
      expires: Date.now() + ALSO_BOUGHT_TTL,
      items: payload,
    });

    res.json({ items: payload });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- Create Products (Seller/Admin) ----------------
export const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      stock,
      categoryId,
      tags,
      sku,
      brand,
      discountPrice,
      attributes,
      seo,
      shipping,
    } = req.body;

    if (!title || price == null || stock == null)
      return res.status(400).json({ message: "title, price, stock required" });

    if (req.user.role === "seller" && req.user?.seller?.approved !== true) {
      return res.status(403).json({ message: "Seller not approved" });
    }

    // category
    if (!categoryId)
      return res.status(400).json({ message: "categoryId required" });
    const cat = await Category.findById(categoryId);
    if (!cat || !cat.active)
      return res.status(400).json({ message: "Invalid category" });

    // files (images + video)
    let imageObjs = [];
    let uploadedVideoUrl;

    if (req.files && (req.files.images?.length || req.files.video?.length)) {
      if (Array.isArray(req.files.images) && req.files.images.length > 0) {
        imageObjs = req.files.images.map((file) => ({
          url:
            process.env.STORAGE_MODE === "cloud"
              ? file.path
              : `/uploads/${file.filename}`,
          alt: file.originalname || "",
        }));
      }
      if (Array.isArray(req.files.video) && req.files.video.length > 0) {
        const file = req.files.video[0];
        uploadedVideoUrl =
          process.env.STORAGE_MODE === "cloud"
            ? file.path
            : `/uploads/${file.filename}`;
      }
    }

    // body video URL
    const bodyVideoUrl =
      typeof req.body.videoUrl === "string" && req.body.videoUrl.trim()
        ? req.body.videoUrl.trim()
        : undefined;

    const finalVideoUrl = uploadedVideoUrl || bodyVideoUrl;

    // attributes
    let parsedAttributes = [];
    if (attributes) {
      if (typeof attributes === "string") {
        try {
          const tmp = JSON.parse(attributes);
          if (Array.isArray(tmp)) parsedAttributes = tmp;
        } catch {}
      } else if (Array.isArray(attributes)) {
        parsedAttributes = attributes;
      }
      parsedAttributes = parsedAttributes
        .filter((a) => a && a.key && a.value)
        .map(({ key, value }) => ({ key: String(key), value: String(value) }));
    }

    // seo
    let parsedSeo;
    if (seo) {
      if (typeof seo === "string") {
        try {
          parsedSeo = JSON.parse(seo);
        } catch {}
      } else if (typeof seo === "object") parsedSeo = seo;
      if (parsedSeo)
        parsedSeo = {
          title: parsedSeo.title || "",
          description: parsedSeo.description || "",
        };
    }

    // shipping
    let parsedShipping;
    if (shipping) {
      if (typeof shipping === "string") {
        try {
          parsedShipping = JSON.parse(shipping);
        } catch {}
      } else if (typeof shipping === "object") parsedShipping = shipping;
      if (parsedShipping)
        parsedShipping = {
          weight:
            parsedShipping.weight !== undefined &&
            parsedShipping.weight !== null
              ? Number(parsedShipping.weight)
              : undefined,
          length:
            parsedShipping.length !== undefined &&
            parsedShipping.length !== null
              ? Number(parsedShipping.length)
              : undefined,
          width:
            parsedShipping.width !== undefined && parsedShipping.width !== null
              ? Number(parsedShipping.width)
              : undefined,
          height:
            parsedShipping.height !== undefined &&
            parsedShipping.height !== null
              ? Number(parsedShipping.height)
              : undefined,
        };
    }

    const product = await Product.create({
      title,
      description,
      price: Number(price),
      stock: Number(stock),
      category: cat.name,
      tags: tags
        ? String(tags)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      images: imageObjs,
      videoUrl: finalVideoUrl || undefined,
      owner: req.user._id,
      sku,
      brand,
      discountPrice:
        discountPrice === "" || discountPrice == null
          ? undefined
          : Number(discountPrice),
      attributes: parsedAttributes,
      seo: parsedSeo,
      shipping: parsedShipping,
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- List Products ----------------

export const listProducts = async (req, res) => {
  try {
    const {
      q,
      category,
      minPrice,
      maxPrice,
      tags,
      sort = "createdAt:desc",
      page = 1,
      limit = 12,
      owner,
    } = req.query;

    const filter = { status: "active" };

    // ✅ Search across title, description, category, brand, tags
    if (q) {
      const regex = new RegExp(q, "i");
      filter.$or = [
        { title: regex },
        { description: regex },
        { category: regex },
        { brand: regex },
        { tags: regex },
        { "seo.title": regex },
        { "seo.description": regex },
      ];
    }

    // ✅ Category filter (exact, for sidebar selection)
    if (category) filter.category = category;

    if (minPrice != null || maxPrice != null) {
      filter.price = {};
      if (minPrice != null) filter.price.$gte = Number(minPrice);
      if (maxPrice != null) filter.price.$lte = Number(maxPrice);
    }

    if (tags)
      filter.tags = {
        $in: String(tags)
          .split(",")
          .map((s) => s.trim()),
      };

    if (owner) filter.owner = owner;

    if (
      req.user &&
      req.user.role === "admin" &&
      req.query.includeBlocked === "true"
    ) {
      delete filter.status;
    }

    const [field, direction] = String(sort).split(":");
    const sortBy = { [field]: direction?.toLowerCase() === "asc" ? 1 : -1 };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Product.find(filter).sort(sortBy).skip(skip).limit(limitNum),
      Product.countDocuments(filter),
    ]);

    res.json({
      items,
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- Get Product by ID/Slug ----------------

export const getProduct = async (req, res) => {
  try {
    const idOrSlug = req.params.id;
    const product =
      (await Product.findById(idOrSlug)) ||
      (await Product.findOne({ slug: idOrSlug }));

    if (!product) return res.status(404).json({ message: "Not found" });
    if (
      product.status === "blocked" &&
      (!req.user || req.user.role !== "admin")
    )
      return res.status(403).json({ message: "Product blocked" });

    res.json(product);
  } catch (err) {
    res.status(400).json({ message: "Invalid id/slug" });
  }
};

// ---------------- Update/Delete Products (Owner/Admin) ----------------

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });

    const isOwner = product.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin)
      return res.status(403).json({ message: "Forbidden" });

    // Record old effective price (for drop detection)
    const oldEff = Number(product.discountPrice ?? product.price ?? 0);

    // Primitive fields
    const setIfPresent = (key, transform) => {
      if (req.body[key] !== undefined) {
        product[key] = transform ? transform(req.body[key]) : req.body[key];
      }
    };
    setIfPresent("title");
    setIfPresent("description");
    setIfPresent("price", (v) => Number(v));
    setIfPresent("stock", (v) => Number(v));
    setIfPresent("status");
    setIfPresent("sku");
    setIfPresent("brand");
    setIfPresent("discountPrice", (v) =>
      v === "" || v === null ? undefined : Number(v)
    );

    // Tags
    if (req.body.tags !== undefined) {
      product.tags = Array.isArray(req.body.tags)
        ? req.body.tags
        : String(req.body.tags)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }

    // Category via categoryId
    if (req.body.categoryId) {
      const cat = await Category.findById(req.body.categoryId);
      if (!cat || !cat.active)
        return res.status(400).json({ message: "Invalid category" });
      product.category = cat.name;
    }

    // Attributes
    if (req.body.attributes !== undefined) {
      let arr = [];
      if (typeof req.body.attributes === "string") {
        try {
          const tmp = JSON.parse(req.body.attributes);
          if (Array.isArray(tmp)) arr = tmp;
        } catch {
          return res
            .status(400)
            .json({ message: "Invalid attributes JSON format" });
        }
      } else if (Array.isArray(req.body.attributes)) {
        arr = req.body.attributes;
      }
      const cleaned = (arr || [])
        .filter((a) => a && a.key && a.value)
        .map(({ key, value }) => ({ key: String(key), value: String(value) }));
      product.attributes = cleaned;
    }

    // SEO
    if (req.body.seo !== undefined) {
      let obj = req.body.seo;
      if (typeof obj === "string") {
        try {
          obj = JSON.parse(obj);
        } catch {
          return res.status(400).json({ message: "Invalid SEO JSON format" });
        }
      }
      if (obj && typeof obj === "object") {
        product.seo = {
          title: obj.title || "",
          description: obj.description || "",
        };
      } else {
        product.seo = undefined;
      }
    }

    // Shipping
    if (req.body.shipping !== undefined) {
      let obj = req.body.shipping;
      if (typeof obj === "string") {
        try {
          obj = JSON.parse(obj);
        } catch {
          return res
            .status(400)
            .json({ message: "Invalid shipping JSON format" });
        }
      }
      if (obj && typeof obj === "object") {
        product.shipping = {
          weight:
            obj.weight !== undefined && obj.weight !== null
              ? Number(obj.weight)
              : undefined,
          length:
            obj.length !== undefined && obj.length !== null
              ? Number(obj.length)
              : undefined,
          width:
            obj.width !== undefined && obj.width !== null
              ? Number(obj.width)
              : undefined,
          height:
            obj.height !== undefined && obj.height !== null
              ? Number(obj.height)
              : undefined,
        };
      } else {
        product.shipping = undefined;
      }
    }

    // Handle newly uploaded images (append) and/or video (replace)
    if (req.files && (req.files.images?.length || req.files.video?.length)) {
      if (Array.isArray(req.files.images) && req.files.images.length > 0) {
        const newImages = req.files.images.map((file) => ({
          url:
            process.env.STORAGE_MODE === "cloud"
              ? file.path
              : `/uploads/${file.filename}`,
          alt: file.originalname || "",
        }));
        product.images.push(...newImages);
      }
      if (Array.isArray(req.files.video) && req.files.video.length > 0) {
        const file = req.files.video[0];
        product.videoUrl =
          process.env.STORAGE_MODE === "cloud"
            ? file.path
            : `/uploads/${file.filename}`;
      }
    }

    // body videoUrl (explicit set or clear)
    if (req.body.videoUrl !== undefined) {
      const v = String(req.body.videoUrl).trim();
      product.videoUrl = v ? v : undefined;
    }

    // Compute new effective price after modifications (before save is fine)
    const newEff = Number(
      product.discountPrice == null || product.discountPrice === ""
        ? product.price
        : product.discountPrice
    );
    const isDrop = newEff > 0 && oldEff > 0 && newEff < oldEff;

    await product.save();
    res.json(product);

    // Background: price drop alerts (one email per new effective price per user)
    if (isDrop) {
      setImmediate(async () => {
        try {
          const users = await User.find({
            wishlist: product._id,
            "alerts.priceDropEnabled": true,
          }).select("_id name email");

          if (!users || users.length === 0) return;

          for (const u of users) {
            const exists = await PriceAlertLog.exists({
              user: u._id,
              product: product._id,
              price: newEff,
            });
            if (exists) continue;

            await sendPriceDropEmail(u, product, oldEff, newEff).catch(
              () => {}
            );
            await PriceAlertLog.create({
              user: u._id,
              product: product._id,
              price: newEff,
              sentAt: new Date(),
            });
          }
        } catch (e) {
          console.error("[price-drop] failed:", e?.message || e);
        }
      });
    }
    return;
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ---------------- Delete Product (Owner/Admin) ----------------

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });

    const isOwner = product.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin)
      return res.status(403).json({ message: "Forbidden" });

    await product.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ---------------- Set Product Status (Admin) ----------------

export const setProductStatus = async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Forbidden" });
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status === "blocked" ? "blocked" : "active" },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: "Not found" });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
