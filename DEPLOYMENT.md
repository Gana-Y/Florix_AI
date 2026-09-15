# Deployment Guide for Florix AI

## 🌐 Frontend Deployment (Vercel)

The React/Vite frontend is pre-configured to be deployed seamlessly on **Vercel**.

1. Create an account on [Vercel](https://vercel.com/).
2. Connect your GitHub repository containing Florix AI.
3. Import the `Frontend` directory as the Root Directory for the project.
4. Framework Preset should auto-detect `Vite`.
5. Set your Build Command to `npm run build` and Output Directory to `dist`.
6. Add an Environment Variable for the API URL:
   - `VITE_API_URL` = `https://your-backend-url.onrender.com` (Once backend is deployed)
   *(Note: You will need to update `Frontend/src/utils/api.js` to use `import.meta.env.VITE_API_URL` in production).*
7. Click **Deploy**.

The project includes a `vercel.json` file which handles client-side routing rewrites so that React Router works perfectly without 404 errors.

---

## ⚙️ Backend Deployment (Render or Railway)

The FastAPI backend includes a `Dockerfile`, making it easy to deploy to container-based platforms like **Render** or **Railway**.

### Using Render
1. Create an account on [Render](https://render.com/).
2. Create a new **Web Service**.
3. Connect your repository and select the `Backend` directory as the Root Directory.
4. Render will automatically detect the `Dockerfile`.
5. In the Environment Variables section, add:
   - `GEMINI_API_KEY` = `your_gemini_key`
   - `JWT_SECRET` = `your_secure_secret`
6. Click **Create Web Service**.

*Note: The current version uses SQLite which is stored locally on the container disk. If your platform restarts the container, the database will be wiped. For persistent storage in production, consider attaching a persistent disk or modifying `DATABASE_URL` to point to a managed PostgreSQL database.*
