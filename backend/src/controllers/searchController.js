import Product from "../models/Product.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import AnalyticsEvent from "../models/AnalyticsEvent.js"; // ✅ log searches for trending

// Unified global search API
export const globalSearch = async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json({ products: [], categories: [], sellers: [] });

  try {
    const regex = new RegExp(q, "i");

    // 🔍 Find matching categories too
    const matchedCategories = await Category.find({ name: regex }).limit(5);
    const categoryIds = matchedCategories.map((c) => c._id);

    // 🔍 Find products by title / tags / brand / seo / categories
    const products = await Product.find({
      $or: [
        { title: regex },
        { tags: regex },
        { brand: regex },
        { "seo.title": regex },
        { "seo.description": regex },
        { category: { $in: categoryIds } }, // ✅ category match
      ],
    })
      .limit(10)
      .select("title images price tags category");

    const categories = matchedCategories.map((c) => ({
      name: c.name,
      _id: c._id,
    }));

    const sellers = await User.find({ role: "seller", name: regex })
      .limit(5)
      .select("name email");

    // log analytics
    await AnalyticsEvent.create({
      sessionId: req.cookies?.rt || req.ip,
      userId: req.user?._id,
      event: "search",
      meta: { query: q },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

    res.json({ products, categories, sellers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Trending searches API
export const trendingSearches = async (req, res) => {
  try {
    const days = parseInt(req.query.days || "7", 10); // past 7 days default
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const agg = await AnalyticsEvent.aggregate([
      { $match: { event: "search", createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$meta.query", // ✅ group by the query we logged in meta
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    res.json(agg.map((a) => a._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
