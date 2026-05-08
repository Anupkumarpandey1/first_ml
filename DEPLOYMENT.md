# 🚀 Free Deployment Guide

This guide will walk you through deploying the **HealthAI Diagnostics** application completely for free using **Render** for the backend (FastAPI/Python) and **Vercel** for the frontend (React/Vite).

---

## 🛠️ Prerequisites

1. A **GitHub** account (free).
2. A **Google Gemini API Key** (free at [Google AI Studio](https://aistudio.google.com/app/apikey)).
3. Accounts on **Render** (render.com) and **Vercel** (vercel.com).
4. Your project pushed to a GitHub repository.

---

## 1️⃣ Backend Deployment (Render)

Render provides a free tier that is perfect for hosting Python/FastAPI applications.

1. Go to your [Render Dashboard](https://dashboard.render.com/) and click **New+** > **Web Service**.
2. Connect your GitHub account and select your `HealthAI Diagnostics` repository.
3. Configure the web service with the following settings:
   - **Name**: `healthai-backend` (or whatever you prefer)
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt && python ml_pipeline.py && python rag_pipeline.py`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Under **Environment Variables**, add:
   - `GOOGLE_API_KEY`: *(Paste your Gemini API key here)*
5. Select the **Free** instance type and click **Create Web Service**.
6. Wait for the deployment to finish (it might take 2-5 minutes). Once done, you will get a URL like `https://healthai-backend-xxxx.onrender.com`. Copy this URL!

---

## 2️⃣ Frontend Deployment (Vercel)

Vercel provides blazing-fast, free hosting for frontend frameworks like React and Vite.

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New** > **Project**.
2. Connect your GitHub account and import your `HealthAI Diagnostics` repository.
3. Configure the project:
   - **Project Name**: `healthai-frontend` (or similar)
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` (Click Edit to set this)
4. Under **Environment Variables**, add:
   - `VITE_API_URL`: *(Paste the Render backend URL you copied in step 1, e.g., `https://healthai-backend-xxxx.onrender.com`)*
5. Click **Deploy**.
6. Vercel will build and deploy your frontend in seconds. Once done, you will get a live URL (e.g., `https://healthai-frontend.vercel.app`).

---

## 🎉 You're Done!

Your full-stack AI health platform is now live on the internet for free! 

> **Note on Render's Free Tier**: If the backend receives no traffic for 15 minutes, it will "spin down" to save resources. When the next user visits, the first request might take 30-50 seconds to wake up the server. This is normal for free hosting. You can use a free pinging service like Cron-job.org to ping the backend every 14 minutes if you want to keep it awake.
