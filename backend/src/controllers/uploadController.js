export const uploadImage = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    let fileUrl;
    if (process.env.STORAGE_MODE === "cloud") {
      fileUrl = req.file.path; // Cloudinary secure_url
    } else {
      fileUrl = `/uploads/${req.file.filename}`; // Local relative path
    }

    res.json({ url: fileUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const uploadFile = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const fileUrl =
      process.env.STORAGE_MODE === "cloud"
        ? req.file.path
        : `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
