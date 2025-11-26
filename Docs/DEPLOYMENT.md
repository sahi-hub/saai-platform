# Deployment Guide - SAAI Platform

Complete instructions for deploying the SAAI platform to production.

## Overview

The SAAI platform consists of two main components:

1. **Backend (Express.js)**: API server with multi-tenant support
2. **Frontend (Next.js)**: User interface with dynamic theming

These can be deployed separately to different platforms.

## Prerequisites

- [x] Code pushed to GitHub repository
- [x] `.env` files configured locally (for reference)
- [x] All dependencies installed and tested locally
- [x] Production environment variables ready

## Quick Deployment

**Backend:** Railway or Render (recommended)  
**Frontend:** Vercel (recommended)

---

## Frontend Deployment (Vercel)

### Method 1: Import from GitHub (Recommended)

#### Step 1: Connect to Vercel

1. **Go to Vercel:**
   - Navigate to [vercel.com](https://vercel.com)
   - Sign up or log in with your GitHub account

2. **Import Project:**
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Choose your `saai-platform` repository

#### Step 2: Configure Project

**Important:** The frontend code is in the `frontend/` directory, NOT the repository root.

1. **Framework Preset:**
   - Vercel should auto-detect "Next.js"
   - If not, select "Next.js" from dropdown

2. **Root Directory:**
   ```
   frontend
   ```
   ⚠️ **CRITICAL:** Set this to `frontend` (not root, not `ui/shared-ui`)

3. **Build Settings:**
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `.next` (auto-detected)
   - Install Command: `npm install` (auto-detected)

4. **Environment Variables:**

   Click "Add Environment Variable" and add the following:

   | Name | Value | Description |
   |------|-------|-------------|
   | `NEXT_PUBLIC_SAAI_API` | `https://your-backend.railway.app` | Backend API URL |
   | `NEXT_PUBLIC_DEFAULT_TENANT` | `tenant1` | Default tenant ID |

   **Example:**
   ```
   NEXT_PUBLIC_SAAI_API=https://saai-backend-production.up.railway.app
   NEXT_PUBLIC_DEFAULT_TENANT=tenant1
   ```

   ⚠️ **Note:** Replace `https://your-backend.railway.app` with your actual backend URL (see Backend Deployment section)

#### Step 3: Deploy

1. **Click "Deploy"**
   - Vercel will build and deploy your application
   - First deployment takes ~2-3 minutes

2. **Wait for Build:**
   - Watch the build logs for any errors
   - Successful deployment shows: ✅ "Production Deployment Ready"

3. **View Deployment:**
   - Click "Visit" to see your live application
   - Default URL: `https://saai-platform-yourname.vercel.app`

#### Step 4: Test Deployment

1. **Open the URL:**
   ```
   https://saai-platform-yourname.vercel.app
   ```

2. **Verify tenant routing:**
   ```
   https://saai-platform-yourname.vercel.app/tenant1
   https://saai-platform-yourname.vercel.app/tenant2
   ```

3. **Check API connection:**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Navigate to a tenant page
   - Verify requests to backend API are successful (status 200)

4. **Test chat functionality:**
   - Type a message in the chat interface
   - Verify response from LLM
   - Check that tenant theme is applied correctly

### Method 2: Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Navigate to frontend directory
cd frontend

# Deploy to production
vercel --prod

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name? saai-platform
# - Directory? ./ (current directory)
# - Override settings? No
```

**Set environment variables:**

```bash
# Add environment variables
vercel env add NEXT_PUBLIC_SAAI_API production
# Paste your backend URL when prompted

vercel env add NEXT_PUBLIC_DEFAULT_TENANT production
# Type: tenant1

# Redeploy with new environment variables
vercel --prod
```

### Custom Domain (Optional)

1. **Go to Project Settings:**
   - Project → Settings → Domains

2. **Add Domain:**
   - Enter your domain: `chat.yourdomain.com`
   - Add DNS records as instructed
   - Wait for DNS propagation (~5-60 minutes)

3. **Multi-Tenant Subdomains:**

   For tenant-specific subdomains (e.g., `tenant1.yourdomain.com`):

   ```
   # Add wildcard domain
   *.yourdomain.com → Add to Vercel
   
   # Update DNS:
   Type: CNAME
   Name: *
   Value: cname.vercel-dns.com
   ```

   Then configure tenant routing in frontend code to use subdomains.

---

## Backend Deployment

### Option 1: Railway (Recommended)

#### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project"

#### Step 2: Deploy from GitHub

1. **Select "Deploy from GitHub repo"**
   - Choose `saai-platform` repository
   - Railway will auto-detect the backend

2. **Configure Root Directory:**
   - Click on the deployment
   - Go to Settings → Root Directory
   - Set to: `backend`

3. **Add Environment Variables:**

   Go to Variables tab and add:

   ```env
   NODE_ENV=production
   PORT=8080
   LLM_PRIORITY=groq,gemini,mistral
   
   # LLM API Keys (add your own)
   GROQ_API_KEY=your_groq_key_here
   GEMINI_API_KEY=your_gemini_key_here
   MISTRAL_API_KEY=your_mistral_key_here
   
   # Logging (optional)
   ENABLE_TOOL_LOGS=true
   ```

4. **Generate Domain:**
   - Go to Settings → Networking
   - Click "Generate Domain"
   - Copy the URL (e.g., `https://saai-backend-production.up.railway.app`)
   - **Use this URL as `NEXT_PUBLIC_SAAI_API` in frontend deployment**

#### Step 3: Deploy

- Railway auto-deploys on every push to `main`
- Monitor deployment logs in the dashboard
- First deployment takes ~3-5 minutes

#### Step 4: Test Backend

```bash
# Health check
curl https://your-backend.railway.app/

# Get tenant info
curl https://your-backend.railway.app/tenant/tenant1

# Test chat (POST request)
curl -X POST https://your-backend.railway.app/chat \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant1",
    "action": "chat",
    "message": "Hello, how are you?"
  }'
```

Expected responses:
- Health check: `{ "status": "ok", "timestamp": "..." }`
- Tenant info: Full tenant configuration object
- Chat: LLM response with streaming or complete text

### Option 2: Render

#### Step 1: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click "New +" → "Web Service"

#### Step 2: Configure Service

1. **Connect Repository:**
   - Select `saai-platform` repository
   - Name: `saai-backend`
   - Region: Choose closest to your users

2. **Settings:**
   - **Root Directory:** `backend`
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (or paid for production)

3. **Environment Variables:**

   Add the same variables as Railway (see above)

4. **Deploy:**
   - Click "Create Web Service"
   - Copy the service URL
   - Use as `NEXT_PUBLIC_SAAI_API`

### Option 3: AWS EC2 (Advanced)

For full control, deploy to AWS EC2:

#### Step 1: Launch EC2 Instance

```bash
# Ubuntu 22.04 LTS
# Instance type: t2.micro (free tier) or t3.small (production)
# Security group: Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
```

#### Step 2: Connect and Install Dependencies

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-ec2-public-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

#### Step 3: Clone and Setup

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/saai-platform.git
cd saai-platform/backend

# Install dependencies
npm install

# Create .env file
nano .env
# Paste your environment variables (see Railway section)
# Save with Ctrl+X, Y, Enter
```

#### Step 4: Start with PM2

```bash
# Start backend
pm2 start npm --name "saai-backend" -- start

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs (starts with sudo)

# Monitor logs
pm2 logs saai-backend
```

#### Step 5: Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/saai

# Paste configuration:
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/saai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 6: Setup SSL with Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

---

## Environment Variables Reference

### Backend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode (`development` or `production`) |
| `PORT` | No | `8080` | Server port |
| `LLM_PRIORITY` | No | `groq,gemini,mistral` | LLM fallback priority order |
| `GROQ_API_KEY` | Yes* | - | Groq API key |
| `GEMINI_API_KEY` | Yes* | - | Google Gemini API key |
| `MISTRAL_API_KEY` | Yes* | - | Mistral API key |
| `ENABLE_TOOL_LOGS` | No | `false` | Enable tool execution logging in production |

*At least one LLM API key is required

### Frontend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SAAI_API` | Yes | - | Backend API URL (e.g., `https://api.yourdomain.com`) |
| `NEXT_PUBLIC_DEFAULT_TENANT` | No | `tenant1` | Default tenant to load on root page |

---

## Production Checklist

Before deploying to production:

### Security

- [ ] All API keys are in environment variables (not hardcoded)
- [ ] `.env` files are in `.gitignore` (never committed)
- [ ] CORS origins are configured correctly
- [ ] Rate limiting is enabled
- [ ] Security headers are enabled (Helmet)
- [ ] HTTPS is enforced (use SSL certificates)

### Performance

- [ ] Backend uses production mode (`NODE_ENV=production`)
- [ ] Frontend is built with `npm run build` (not dev mode)
- [ ] Caching headers are configured
- [ ] Database connections are pooled (if using DB)
- [ ] Logging is configured for production

### Monitoring

- [ ] Error logging is set up (e.g., Sentry, LogRocket)
- [ ] Performance monitoring is configured
- [ ] Uptime monitoring is active (e.g., UptimeRobot)
- [ ] Logs are centralized (e.g., CloudWatch, Datadog)

### Backups

- [ ] Database backups are scheduled (if applicable)
- [ ] Configuration backups are stored securely
- [ ] Disaster recovery plan is documented

### Testing

- [ ] All features tested in production environment
- [ ] Load testing completed
- [ ] Error handling tested
- [ ] Rollback procedure tested

---

## CI/CD Setup (Optional)

Automate deployments with GitHub Actions:

### Create `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: saai-backend

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend
```

**Setup secrets:**

1. Go to GitHub → Repository → Settings → Secrets and variables → Actions
2. Add secrets:
   - `RAILWAY_TOKEN`: From Railway account settings
   - `VERCEL_TOKEN`: From Vercel account settings
   - `VERCEL_ORG_ID`: From Vercel project settings
   - `VERCEL_PROJECT_ID`: From Vercel project settings

---

## Monitoring & Maintenance

### Health Checks

**Backend:**
```bash
# Manual health check
curl https://your-backend.railway.app/

# Automated (using UptimeRobot)
# Add monitor for: https://your-backend.railway.app/
# Check interval: 5 minutes
```

**Frontend:**
```bash
# Check if site is up
curl -I https://saai-platform.vercel.app

# Check API connectivity from frontend
# (Open DevTools → Network tab)
```

### Logs

**Railway:**
- Dashboard → Project → View Logs
- Real-time streaming logs

**Render:**
- Dashboard → Service → Logs
- Filterable logs with search

**AWS EC2:**
```bash
# PM2 logs
pm2 logs saai-backend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Application logs
tail -f backend/logs/combined.log
```

### Scaling

**Vercel (Frontend):**
- Auto-scales automatically
- No configuration needed

**Railway (Backend):**
- Dashboard → Settings → Autoscaling
- Configure based on CPU/Memory usage

**Render (Backend):**
- Dashboard → Scaling → Add instances
- Horizontal scaling (paid plans)

---

## Troubleshooting

### Frontend can't connect to backend

**Symptoms:**
- Network errors in browser console
- "Failed to fetch" errors
- CORS errors

**Solutions:**

1. **Verify `NEXT_PUBLIC_SAAI_API` is set correctly:**
   ```bash
   # Vercel dashboard → Project → Settings → Environment Variables
   # Check that NEXT_PUBLIC_SAAI_API = your backend URL
   ```

2. **Check CORS configuration in backend:**
   ```javascript
   // backend/server.js
   // Ensure your frontend domain is in allowedOrigins
   const allowedOrigins = [
     'https://saai-platform.vercel.app',
     // Add your Vercel domain
   ];
   ```

3. **Verify backend is running:**
   ```bash
   curl https://your-backend.railway.app/
   ```

### Backend deployment fails

**Common causes:**

1. **Missing environment variables:**
   - Check all required vars are set in Railway/Render

2. **Port configuration:**
   - Railway/Render auto-assign ports
   - Ensure `PORT` is read from `process.env.PORT`

3. **Build errors:**
   - Check deployment logs
   - Verify `package.json` scripts are correct
   - Test build locally: `npm run build` (if applicable)

### Rate limiting triggers too often

**Solution:**

Update rate limit configuration:

```javascript
// backend/server.js
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes (increase this)
  max: 200, // Increase from 100 to 200 requests
  // ...
});
```

Redeploy backend after changes.

---

## Costs Estimation

### Free Tier (Good for testing)

- **Vercel:** Free (Hobby plan)
  - Bandwidth: 100 GB/month
  - Builds: Unlimited
  - Domains: Custom domains supported

- **Railway:** Free credits (trial)
  - $5 free credits monthly
  - Pay-as-you-go after

- **Render:** Free tier
  - Spins down after inactivity (15 min cold start)
  - 750 hours/month

**Total: $0-5/month**

### Production (Recommended)

- **Vercel Pro:** $20/month
  - Better performance
  - Team collaboration
  - Analytics

- **Railway:** ~$10-20/month
  - Always-on backend
  - Predictable pricing

- **Render:** $7-25/month
  - Starter: $7/month (always-on)
  - Standard: $25/month (better performance)

**Total: $30-65/month**

### Enterprise

- **Vercel Enterprise:** Custom pricing
- **AWS EC2:** $10-100/month
  - t3.small: ~$15/month
  - t3.medium: ~$30/month
  - + Bandwidth costs

---

## Next Steps

After deploying:

1. ✅ **Test all features** in production
2. ✅ **Monitor performance** for 24-48 hours
3. ✅ **Set up alerts** for downtime
4. ✅ **Configure custom domain** (optional)
5. ✅ **Enable analytics** (Vercel Analytics, Google Analytics)
6. ✅ **Set up error tracking** (Sentry)
7. ✅ **Plan backup strategy**
8. ✅ **Document runbook** for incidents

---

## Support & Resources

- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Railway Docs:** [docs.railway.app](https://docs.railway.app)
- **Render Docs:** [render.com/docs](https://render.com/docs)
- **Next.js Deployment:** [nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)

---

**Congratulations!** 🎉 Your SAAI platform is now live in production!

For questions or issues, refer to the main [README.md](./README.md) or create a GitHub issue.
