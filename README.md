
# SkinInsight AI Pro (SkinPro) 🔬✨

**Democratizing Clinical-Quality Digital Dermatology**

SkinInsight Pro (SkinPro) is a state-of-the-art, web-based AI dermatology companion. It rejects the traditional "black-box" guessing game of current consumer skincare apps in favor of transparent, deterministic, pixel-level mathematical analysis combined with context-aware Conversational AI.

🌍 **Live Demo:** [skininsightai.app](https://skininsightai.app)

---

## 📖 Table of Contents
- [What is SkinPro?](#-what-is-skinpro)
- [Key Features](#-key-features)
- [How It Works (The Implementation)](#-how-it-works-the-implementation)
- [System Architecture](#-system-architecture)
- [Getting Started (Local Deployment)](#-getting-started-local-deployment)
- [Deployment Stack](#-deployment-stack)

---

## 💡 What is SkinPro?
For decades, professional dermatological care has been expensive and inaccessible. Meanwhile, most consumer "AI skincare" apps suffer from severe flaws: they over-diagnose based on poor lighting, act as disguised e-commerce funnels, or lock user data behind paywalls.

SkinPro solves this by offering a transparent, mathematically grounded skin analysis tool. We don't just guess a diagnosis; we use a **Hybrid AI & Computer Vision architecture** to calculate physical properties (like high-frequency texture variance for pores, or Difference of Gaussians for acne). 

---

## ✨ Key Features
1. **Deterministic Analysis:** Measures visually quantifiable metrics (redness, texture, color variance) rather than guessing medical diagnoses.
2. **Multi-Angle Ensemble:** Requires 3 photos (Front, Left, Right) processed in parallel to map the 3D geometry of the face accurately.
3. **Actionable, Brand-Agnostic Insights:** Generates personalized AM/PM routines based on active ingredients (e.g., 2% Salicylic Acid), not brand upsells.
4. **"AI Doctor" Chat (RAG):** Integrates an incredibly fast Llama-3.3-70B model. Using a Zero-Shot RAG approach, the AI is secretly fed your specific scan metrics, allowing for hyper-personalized, context-aware conversations about your skin.
5. **Programmatic PDF Reports:** Generates crisp, customized 3-page medical reports on the fly using `jsPDF` for a tiny (<50KB) offline record.

---

## 🛠️ How It Works (The Implementation)

We abandoned the pure deep-learning approach. Our implementation strictly divides tasks between two paradigms:

### 1. Macro-Classification (Deep Learning)
We use a lightweight Convolutional Neural Network (**EfficientNetB0**) exclusively for high-level classification: determining your Skin Type (Oily, Dry, Normal). 
- To achieve sub-second latency on edge servers, the model underwent **INT8 Post-Training Quantization**, shrinking its size from 22MB to under 6MB and increasing inference speed by 4x without losing accuracy.

### 2. Micro-Quantification (Computer Vision Mathematics)
For specific concerns, we use strict mathematical algorithms via OpenCV:
- **Skin Isolation:** We isolate human tissue and geometrically mask out eyes and lips using the **YCrCb** color space (`133 <= Cr <= 173`, `77 <= Cb <= 127`).
- **Acne Detection:** We apply a Multi-Scale **Difference of Gaussians (DoG)** to the `a*` (green-red) channel in the **CIE-Lab** color space to find highly saturated, localized spikes in redness relative to your specific baseline skin tone.
- **Hyperpigmentation:** Calculated by finding pixel clusters that fall significantly below the standard deviation of your localized Luminance (`L*`) channel.
- **Texture:** **Canny Edge Detection** maps wrinkles, while **Laplacian Variance** identifies the high-frequency textural noise of enlarged pores.

---

## 🏗️ System Architecture

SkinPro utilizes a highly decoupled, microservice-oriented **Edge-and-Container** architecture to bypass the limitations of serverless ML inference.

<img width="777" height="272" alt="image" src="https://github.com/user-attachments/assets/28cf6069-fcac-43df-a6eb-243b8f76f963" />


1. **The Client / Edge (Vercel):** The UI is built in **Next.js 16** and **React 19**, deployed to Vercel's global edge network. It handles UI rendering, dynamic imports, and secure reverse proxy routing.
2. **The ML Inference Engine (Railway):** Because Vercel serverless functions have a 50MB limit and "cold start" latency, all ML operations are handed off to a persistent **Python 3.11** container on Railway running **Flask** and **Gunicorn**. The models sit perpetually in RAM, allowing for lightning-fast (<600ms) image processing.
3. **The LLM Brain (Groq):** Conversational AI is powered by **Meta's Llama-3.3-70B**, executed on Groq's custom LPU (Language Processing Unit) hardware. This delivers streaming text at over 250 tokens per second.
4. **Android Native App (Capacitor):** The entire Next.js web application is bundled into a native `.apk` using **Capacitor**, granting access to native hardware camera APIs for superior image capture.

---

## 🚀 Getting Started (Local Deployment)

To run SkinPro locally, you need to spin up both the Frontend (Next.js) and the Backend (Python ML).

### Prerequisites
- Node.js (v18+)
- Python (3.10+)

### 1. Start the ML Backend (Python)
The backend handles the OpenCV and TensorFlow Lite processing.
```bash
cd ml
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

pip install -r requirements.txt

# Start the Flask server
python app.py
```
*The ML server will now run on `http://localhost:5000`*

### 2. Start the Frontend (Next.js)
Open a new terminal window to start the user interface.
```bash
# In the root directory (project1)
npm install

# Start the development server
npm run dev
```
*The app is now running on `http://localhost:3000`*

---

## 📦 Deployment Stack Summary
- **Frontend / Fullstack Framework:** Next.js 16 (App Router), React 19
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Mobile Wrapper:** Capacitor
- **ML Backend:** Python 3.11, Flask, Gunicorn
- **Computer Vision:** OpenCV, TensorFlow Lite
- **Conversational AI:** Groq (Llama-3.3-70B-Versatile)
- **Hosting:** Vercel (Frontend), Railway (Backend)
- **PDF Generation:** jsPDF

---
*Built to bring clinical clarity to consumer skincare.*
