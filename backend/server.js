import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./lib/supabase.js"; // your existing supabase client
import fs from "fs";
import multer from "multer";

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());
// IMPORTANT: Add this CORS configuration
app.use(cors({
  origin: '*', // We'll update this later with your actual frontend URL
  credentials: true
}));

app.use(express.json());

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================
const upload = multer({ dest: "uploads/" });

// ============================================
// AUTH ROUTES (SIGNUP + LOGIN)
// ============================================

// SIGNUP - Create new Supabase Auth user + profile
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    // 1. Create Supabase Auth user using service role key
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const userId = authUser.user.id;

    // 2. Create user profile entry
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        full_name,
        grade_level: null,
        school: null,
        created_at: new Date()
      });

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    res.status(200).json({
      message: "Signup successful",
      user: authUser.user,
    });
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ error: "Server error during signup" });
  }
});

// ============================================
// REPORT RETRIEVAL ROUTES
// ============================================

// Get all reports
app.get("/api/reports", async (req, res) => {
  try {
    const { data, error } = await supabase.from("reports").select("*");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error retrieving reports" });
  }
});

// Get crime reports
app.get("/api/reports/crime", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("report_type", "crime");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error retrieving crime reports" });
  }
});

// Get accident reports
app.get("/api/reports/accident", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("report_type", "accident");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error retrieving accident reports" });
  }
});

// ============================================
// REPORT CREATION ROUTE
// ============================================

app.post("/api/report", upload.single("image"), async (req, res) => {
  try {
    const {
      name,
      contact_number,
      age,
      report_type,
      description,
      date,
      location,
    } = req.body;

    let image_path = null;

    // If a file was uploaded
    if (req.file) {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("report_images")
        .upload(`images/${Date.now()}-${req.file.originalname}`, fs.readFileSync(req.file.path), {
          contentType: req.file.mimetype,
        });

      if (uploadError) {
        return res.status(400).json({ error: uploadError.message });
      }

      image_path = uploadData.path;

      // Delete from local uploads/
      fs.unlinkSync(req.file.path);
    }

    // Insert into reports table
    const { data, error } = await supabase.from("reports").insert([
      {
        name,
        contact_number,
        age,
        report_type,
        description,
        date,
        location,
        image_path,
      },
    ]);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: "Report submitted successfully",
      data,
    });
  } catch (err) {
    console.error("Error submitting report:", err);
    res.status(500).json({ error: "Server error submitting report" });
  }
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
