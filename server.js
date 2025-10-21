// server.js
import express from "express";
import multer from "multer";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

const upload = multer({ dest: "uploads/" });
const FOLDER = process.env.FOLDER_NAME || "portfolio-gallery";

/**
 * Upload endpoint
 * - accepts multipart/form-data with field name "image"
 * - uploads to Cloudinary folder and returns JSON { url, public_id }
 */
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    // upload file to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: FOLDER,
      use_filename: true,
      unique_filename: true,
      overwrite: false
    });

    // cleanup temp file
    await fs.unlink(req.file.path).catch(() => {});

    return res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Delete endpoint
 * - call DELETE /delete/:public_id
 */
app.delete("/delete/:public_id", async (req, res) => {
  try {
    const publicId = req.params.public_id;
    const result = await cloudinary.uploader.destroy(publicId);
    return res.json({ result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /images
 * - returns list of images in the folder (public URLs and public_id)
 * - Cloudinary API paginates; here we fetch first page (max 100)
 */
app.get("/images", async (req, res) => {
  try {
    // use cloudinary admin API to list resources by prefix (folder)
    const response = await cloudinary.api.resources({
      type: "upload",
      prefix: `${FOLDER}/`,
      max_results: 200 // increase if needed
    });
    // map to useful fields
    const images = (response.resources || []).map(r => ({
      url: r.secure_url,
      public_id: r.public_id,
      width: r.width,
      height: r.height,
      format: r.format,
      created_at: r.created_at
    }));
    res.json(images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Simple health check
app.get("/", (req, res) => res.send("Cloudinary admin server running"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
