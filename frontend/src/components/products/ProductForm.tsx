import { useEffect, useMemo, useState } from "react";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import { getImageUrl } from "../../utils/images";
import { currency } from "../../utils/format";

type ExistingImage = { url: string; alt?: string };
type Category = { _id: string; name: string; slug: string; active: boolean };

type ProductInput = {
  title: string;
  description?: string;
  price: number;
  stock: number;
  tags?: string; // comma separated
  sku?: string;
  brand?: string;
  discountPrice?: number;
  seoTitle?: string;
  seoDescription?: string;
  shipWeight?: number;
  shipLength?: number;
  shipWidth?: number;
  shipHeight?: number;
};

type Attr = { key: string; value: string };

type Props = {
  initial?: any; // existing product object when editing
  onSuccess?: (p: any) => void;
};

export default function ProductForm({ initial, onSuccess }: Props) {
  const [form, setForm] = useState<ProductInput>({
    title: initial?.title || "",
    description: initial?.description || "",
    price: initial?.price ?? 0,
    stock: initial?.stock ?? 0,
    tags: Array.isArray(initial?.tags)
      ? initial.tags.join(", ")
      : initial?.tags || "",
    sku: initial?.sku || "",
    brand: initial?.brand || "",
    discountPrice: initial?.discountPrice ?? undefined,
    seoTitle: initial?.seo?.title || "",
    seoDescription: initial?.seo?.description || "",
    shipWeight: initial?.shipping?.weight ?? undefined,
    shipLength: initial?.shipping?.length ?? undefined,
    shipWidth: initial?.shipping?.width ?? undefined,
    shipHeight: initial?.shipping?.height ?? undefined,
  });

  const [attrs, setAttrs] = useState<Attr[]>(
    Array.isArray(initial?.attributes) && initial.attributes.length
      ? initial.attributes
      : [{ key: "", value: "" }]
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");

  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newFileURLs, setNewFileURLs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [videoUrl, setVideoUrl] = useState<string>(initial?.videoUrl || "");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const existingImages = useMemo(() => {
    return (initial?.images || []).map((img: any) =>
      typeof img === "string" ? { url: img } : img
    ) as ExistingImage[];
  }, [initial]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/categories");
        setCategories(data || []);
        // preselect category if editing
        if (initial?.category) {
          const match = (data || []).find(
            (c: Category) => c.name === initial.category
          );
          if (match) setCategoryId(match._id);
        } else if (data?.[0]?._id) {
          setCategoryId(data[0]._id);
        }
      } catch {}
    })();
  }, [initial?.category]);

  useEffect(() => {
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setNewFileURLs(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [newFiles]);

  useEffect(() => {
    if (!videoFile) {
      setVideoPreview(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const onChange =
    (key: keyof ProductInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = [
        "price",
        "stock",
        "discountPrice",
        "shipWeight",
        "shipLength",
        "shipWidth",
        "shipHeight",
      ].includes(key as string)
        ? e.target.value === ""
          ? undefined
          : Number(e.target.value)
        : e.target.value;
      setForm((f) => ({ ...f, [key]: v as any }));
    };

  const addAttr = () => setAttrs((arr) => [...arr, { key: "", value: "" }]);
  const setAttr = (i: number, part: "key" | "value", val: string) => {
    setAttrs((arr) =>
      arr.map((a, idx) => (idx === i ? { ...a, [part]: val } : a))
    );
  };
  const removeAttr = (i: number) =>
    setAttrs((arr) => arr.filter((_, idx) => idx !== i));

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setNewFiles((prev) => [...prev, ...files].slice(0, 5));
  };
  const removeNewFile = (idx: number) =>
    setNewFiles((arr) => arr.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title || form.price == null || form.stock == null) {
      toast.error("Please fill title, price, and stock.");
      return;
    }
    if (!categoryId) {
      toast.error("Please select a category.");
      return;
    }

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description || "");
    fd.append("price", String(form.price ?? 0));
    fd.append("stock", String(form.stock ?? 0));
    fd.append("categoryId", categoryId);
    if (form.tags) fd.append("tags", form.tags);

    if (videoUrl) fd.append("videoUrl", videoUrl);
    if (videoFile) fd.append("video", videoFile);

    // advanced fields
    if (form.sku) fd.append("sku", form.sku);
    if (form.brand) fd.append("brand", form.brand);
    if (form.discountPrice != null)
      fd.append("discountPrice", String(form.discountPrice));

    const cleanAttrs = attrs
      .filter((a) => a.key && a.value)
      .map(({ key, value }) => ({ key, value }));
    if (cleanAttrs.length) fd.append("attributes", JSON.stringify(cleanAttrs));

    const seo: any = {};
    if (form.seoTitle) seo.title = form.seoTitle;
    if (form.seoDescription) seo.description = form.seoDescription;
    if (Object.keys(seo).length) fd.append("seo", JSON.stringify(seo));

    const shipping: any = {};
    if (form.shipWeight != null) shipping.weight = form.shipWeight;
    if (form.shipLength != null) shipping.length = form.shipLength;
    if (form.shipWidth != null) shipping.width = form.shipWidth;
    if (form.shipHeight != null) shipping.height = form.shipHeight;
    if (Object.keys(shipping).length)
      fd.append("shipping", JSON.stringify(shipping));

    newFiles.forEach((f) => fd.append("images", f));

    setSubmitting(true);
    try {
      let res;
      if (initial?._id) {
        res = await api.put(`/products/${initial._id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await api.post(`/products`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      toast.success(`Product ${initial?._id ? "updated" : "created"}!`);
      onSuccess?.(res.data);
      if (!initial?._id) {
        setForm({
          title: "",
          description: "",
          price: 0,
          stock: 0,
          tags: "",
          sku: "",
          brand: "",
          discountPrice: undefined,
          seoTitle: "",
          seoDescription: "",
          shipWeight: undefined,
          shipLength: undefined,
          shipWidth: undefined,
          shipHeight: undefined,
        });
        setAttrs([{ key: "", value: "" }]);
        setNewFiles([]);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save product");
    } finally {
      setSubmitting(false);
    }
  };

  const previewImage =
    newFileURLs[0] ||
    (existingImages[0]?.url ? getImageUrl(existingImages[0]) : "/fallback.png");

  const effectivePrice =
    form.discountPrice != null ? form.discountPrice : form.price;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 space-y-8"
      >
        {/* Basic */}
        <div>
          <h3 className="text-xl font-black uppercase tracking-widest text-foreground mb-4 border-b-[3px] border-border pb-2">
            Basic Information
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">Title</label>
              <input
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:font-bold placeholder:uppercase placeholder:text-xs"
                value={form.title}
                onChange={onChange("title")}
                required
                placeholder="Product Title"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">
                Category
              </label>
              <select
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select category
                </option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">Price</label>
              <input
                type="number"
                min={0}
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground"
                value={form.price ?? 0}
                onChange={onChange("price")}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">Stock</label>
              <input
                type="number"
                min={0}
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground"
                value={form.stock ?? 0}
                onChange={onChange("stock")}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Advanced */}
        <div>
          <h3 className="text-xl font-black uppercase tracking-widest text-foreground mb-4 border-b-[3px] border-border pb-2">Advanced</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">SKU</label>
              <input
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
                value={form.sku || ""}
                onChange={onChange("sku")}
                placeholder="SKU-12345"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">Brand</label>
              <input
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
                value={form.brand || ""}
                onChange={onChange("brand")}
                placeholder="Brand name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">
                Discount Price
              </label>
              <input
                type="number"
                min={0}
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
                value={form.discountPrice ?? ""}
                onChange={onChange("discountPrice")}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">
              Tags (comma separated)
            </label>
            <input
              className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
              value={form.tags || ""}
              onChange={onChange("tags")}
              placeholder="featured, limited, new"
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">
              Description
            </label>
            <textarea
              rows={4}
              className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:font-bold placeholder:text-[10px]"
              value={form.description || ""}
              onChange={onChange("description")}
              placeholder="Describe your product..."
            />
          </div>
        </div>

        {/* Attributes */}
        <div>
          <div className="flex items-center justify-between mb-4 border-b-[3px] border-border pb-2">
            <h3 className="text-xl font-black uppercase tracking-widest text-foreground m-0">Attributes</h3>
            <button
              type="button"
              onClick={addAttr}
              className="px-3 py-1.5 border-[3px] border-border bg-card shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all font-bold uppercase text-[10px]"
            >
              Add
            </button>
          </div>
          <div className="space-y-3">
            {attrs.map((a, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="w-full sm:flex-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Key (e.g. Color)</label>
                  <input
                    placeholder="Key"
                    value={a.key}
                    onChange={(e) => setAttr(i, "key", e.target.value)}
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
                  />
                </div>
                <div className="w-full sm:flex-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Value (e.g. Red)</label>
                  <input
                    placeholder="Value"
                    value={a.value}
                    onChange={(e) => setAttr(i, "value", e.target.value)}
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
                  />
                </div>
                <div className="w-full sm:w-auto h-[46px] pt-1">
                  <button
                    type="button"
                    aria-label="Remove attribute"
                    onClick={() => removeAttr(i)}
                    className="w-full sm:w-12 h-full border-[3px] border-border bg-rose-600 text-white font-black hover:bg-rose-500 shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all flex items-center justify-center text-xl"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SEO */}
        <div>
          <h3 className="text-xl font-black uppercase tracking-widest text-foreground mb-4 border-b-[3px] border-border pb-2">SEO</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">
                SEO Title
              </label>
              <input
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
                value={form.seoTitle || ""}
                onChange={onChange("seoTitle")}
                placeholder="Custom meta title"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">
                SEO Description
              </label>
              <input
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
                value={form.seoDescription || ""}
                onChange={onChange("seoDescription")}
                placeholder="Custom meta description"
              />
            </div>
          </div>
        </div>

        {/* Shipping */}
        <div>
          <h3 className="text-xl font-black uppercase tracking-widest text-foreground mb-4 border-b-[3px] border-border pb-2">Shipping</h3>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">
                Weight (kg)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
                value={form.shipWeight ?? ""}
                onChange={onChange("shipWeight")}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">
                Length (cm)
              </label>
              <input
                type="number"
                min={0}
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
                value={form.shipLength ?? ""}
                onChange={onChange("shipLength")}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">
                Width (cm)
              </label>
              <input
                type="number"
                min={0}
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
                value={form.shipWidth ?? ""}
                onChange={onChange("shipWidth")}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">
                Height (cm)
              </label>
              <input
                type="number"
                min={0}
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
                value={form.shipHeight ?? ""}
                onChange={onChange("shipHeight")}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div>
          <h3 className="text-xl font-black uppercase tracking-widest text-foreground mb-4 border-b-[3px] border-border pb-2">Images</h3>
          <div className="flex gap-4">
            <input
              type="file"
              id="media-upload"
              multiple
              accept="image/*"
              onChange={onFiles}
              className="sr-only"
            />
            <label
              htmlFor="media-upload"
              className="inline-flex items-center gap-2 px-6 py-2 border-[3px] border-border bg-card shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all font-bold uppercase text-xs cursor-pointer"
            >
              <svg
                className="w-4 h-4 text-foreground"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M4 3a2 2 0 00-2 2v2h2V5h12v10H4v-2H2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                <path d="M9 7v3H6l4 4 4-4h-3V7H9z" />
              </svg>
              Upload Images
            </label>
          </div>

          {newFileURLs.length > 0 && (
            <div className="mt-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">New Images</label>
              <div className="flex gap-4 flex-wrap">
                {newFileURLs.map((url, i) => (
                  <div key={i} className="relative w-24 h-24 border-[3px] border-border shadow-[4px_4px_0px_#111] group">
                    <img
                      src={url}
                      alt={`new-${i}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() => removeNewFile(i)}
                      className="absolute -top-3 -right-3 border-[3px] border-border bg-rose-600 text-white font-black text-xs rounded-none w-8 h-8 flex items-center justify-center shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all opacity-0 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {existingImages.length > 0 && (
            <div className="mt-6 border-t-[3px] border-border pt-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Existing Images
              </label>
              <div className="flex gap-4 flex-wrap">
                {existingImages.map((img, i) => (
                  <div key={i} className="w-24 h-24 border-[3px] border-border shadow-[4px_4px_0px_#111]">
                    <img
                      src={getImageUrl(img)}
                      alt={img.alt || "Image"}
                      className="w-full h-full object-cover"
                      onError={(e) =>
                        ((e.currentTarget as HTMLImageElement).src =
                          "/fallback.png")
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-2">
                Note: Updating appends new images.
              </p>
            </div>
          )}
        </div>

        {/* Video */}
        <div>
          <h3 className="text-xl font-black uppercase tracking-widest text-foreground mb-4 border-b-[3px] border-border pb-2">
            Video (optional)
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">
                Video URL
              </label>
              <input
                type="url"
                placeholder="https://... (Cloudinary/YouTube/mp4)"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground placeholder:uppercase placeholder:text-[10px]"
              />
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-2">
                Provide a direct mp4 URL or a Cloudinary URL. If you also upload
                a file, the file will be used.
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-foreground mb-1">
                Upload Video
              </label>
              <input
                type="file"
                id="video-upload"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="sr-only"
              />
              <label
                htmlFor="video-upload"
                className="inline-flex items-center gap-2 px-6 py-2 border-[3px] border-border bg-card shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all font-bold uppercase text-xs cursor-pointer w-fit"
              >
                <svg
                  className="w-4 h-4 text-foreground"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M4 3a2 2 0 00-2 2v2h2V5h12v10H4v-2H2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                  <path d="M9 7v3H6l4 4 4-4h-3V7H9z" />
                </svg>
                Choose Video
              </label>
              {videoPreview ? (
                <div className="mt-4 border-[3px] border-border shadow-[4px_4px_0px_#111] bg-muted w-full max-w-xs">
                  <video
                    src={videoPreview}
                    className="w-full aspect-video"
                    controls
                    playsInline
                  />
                </div>
              ) : initial?.videoUrl ? (
                <div className="mt-4 border-[3px] border-border shadow-[4px_4px_0px_#111] bg-muted w-full max-w-xs">
                  <video
                    src={initial.videoUrl}
                    className="w-full aspect-video"
                    controls
                    playsInline
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-8 px-8 py-3 w-full sm:w-auto border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:-translate-y-0 disabled:hover:shadow-[4px_4px_0px_transparent]"
        >
          {submitting
            ? initial?._id
              ? "Updating..."
              : "Creating..."
            : initial?._id
            ? "Update Product"
            : "Create Product"}
        </button>
      </form>

      {/* Live Preview */}
      <aside className="w-full lg:w-80 h-fit bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] flex flex-col sm:flex-row lg:flex-col shrink-0">
        <div className="bg-primary/10 border-b-[3px] sm:border-b-0 lg:border-b-[3px] sm:border-r-[3px] lg:border-r-0 border-border p-3 shrink-0">
          <div className="text-[10px] font-black uppercase tracking-widest text-primary text-center">Live Preview</div>
        </div>
        <div className="flex-1">
          <div className="border-b-[3px] border-border aspect-square bg-muted">
            <img
              src={previewImage}
              alt="preview"
              className="w-full h-full object-cover"
              onError={(e) =>
                ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
              }
            />
          </div>
          <div className="p-4 flex flex-col h-full bg-card">
            <h3 className="font-black uppercase tracking-widest text-foreground text-sm line-clamp-2 leading-tight mb-2">
              {form.title || "Product title"}
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl font-black text-primary">
                {currency(Number(effectivePrice) || 0)}
              </span>
              {form.discountPrice != null && (
                <span className="text-xs font-bold text-muted-foreground line-through">
                  {currency(Number(form.price) || 0)}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground line-clamp-3 uppercase leading-relaxed mt-auto">
              {form.description || "Product description will appear here..."}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
