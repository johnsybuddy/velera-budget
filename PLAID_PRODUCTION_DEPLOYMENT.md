# Plaid Integration - Production Deployment Guide

## Overview

The Plaid server (`plaid-server-minimal.js`) is running locally on `http://localhost:3000` for testing.

To make it work on the internet, you need to deploy this server to a cloud platform.

## Recommended: Deploy to Render (Free & Easy)

### Why Render?
- ✓ Free tier (no credit card needed to start)
- ✓ Automatic deployments from GitHub
- ✓ Always-on (no sleeping like Heroku free tier)
- ✓ Simple environment variables setup

### Step-by-Step Instructions

#### 1. Push code to GitHub
```bash
cd c:\Users\johns\bills-website
git add plaid-server-minimal.js .env
git commit -m "Add Plaid server for production"
git push origin main
```

#### 2. Create Render Account
- Go to https://render.com
- Sign up with GitHub
- Click "Authorize render-rnw"

#### 3. Create Web Service
- Click "New" button
- Select "Web Service"
- Select your GitHub repository (bills-website)
- Configure:
  - **Name:** `bills-plaid-server` (or any name)
  - **Environment:** `Node`
  - **Build Command:** `echo 'No build needed'`
  - **Start Command:** `node plaid-server-minimal.js`
  - **Region:** `Oregon` (us-west) or `Ohio` (us-east)

#### 4. Add Environment Variables
Before deploying, click "Advanced" and add these:
- Key: `PLAID_CLIENT_ID`
  Value: `69926fbd4c01cb002166c96c3a3371e9e327e41eed0d59a5568d8b`
- Key: `PLAID_SECRET`  
  Value: `3a3371e9e327e41eed0d59a5568d8b`

#### 5. Deploy
- Click "Create Web Service"
- Render will automatically deploy (takes 1-2 minutes)
- You'll get a URL like: `https://bills-plaid-server.onrender.com`

#### 6. Update Frontend
Update `plaid-integration.js`:
```javascript
// Change from:
const PLAID_SERVER_BASE = 'http://localhost:3000';

// To:
const PLAID_SERVER_BASE = 'https://bills-plaid-server.onrender.com';
```

#### 7. Test
- Commit and push the change
- Refresh your Bills Website
- Click "Connect Bank Account"
- Verify it works!

---

## Alternative: Deploy to Heroku

### Prerequisites
- Heroku account (https://heroku.com)
- Heroku CLI installed

### Deploy Steps
```bash
# Login
heroku login

# Create app
heroku create your-bills-plaid-server

# Add environment variables
heroku config:set PLAID_CLIENT_ID=69926fbd4c01cb002166c96c3a3371e9e327e41eed0d59a5568d8b
heroku config:set PLAID_SECRET=3a3371e9e327e41eed0d59a5568d8b

# Create Procfile
echo "web: node plaid-server-minimal.js" > Procfile

# Push to Heroku
git push heroku main

# Get your URL
heroku apps:info -s | grep web_url
```

Then update `plaid-integration.js` with your Heroku URL.

---

## Alternative: Deploy to Railway

### Prerequisites
- GitHub account
- Railway account (https://railway.app)

### Deploy Steps
1. Go to Railway.app
2. Click "Start a New Project"
3. Select "Deploy from GitHub"
4. Select your repository
5. Add variables:
   - `PLAID_CLIENT_ID=69926fbd4c01cb002166c96c3a3371e9e327e41eed0d59a5568d8b`
   - `PLAID_SECRET=3a3371e9e327e41eed0d59a5568d8b`
6. Railway will auto-detect Node.js and deploy
7. Get your URL from Railway dashboard

---

## Verification Checklist

After deploying to any platform:

- [ ] Server is running (check deployment logs)
- [ ] Environment variables are set correctly
- [ ] Server URL is accessible (visit `https://your-url/health`)
- [ ] Updated `plaid-integration.js` with new server URL
- [ ] Committed and pushed changes
- [ ] Browser cache cleared (Ctrl+Shift+R)
- [ ] Tested "Connect Bank Account" button
- [ ] Successfully connected test account
- [ ] Transactions synced successfully

---

## Troubleshooting Production Deployment

### Error: "Connection refused"
- Check that server URL is correct in `plaid-integration.js`
- Check that deployment is running (view deployment logs)
- Wait 1-2 minutes after deployment for server to start

### Error: "Failed to create link token"
- Verify environment variables are set correctly
- Check server logs for error messages
- Verify Plaid API credentials are correct

### Error: "CORS error"
- Check that server has CORS headers (it should)
- Try hard refresh (Ctrl+Shift+R)
- Check browser console for specific CORS error

### Server keeps sleeping (Heroku)
- Use Render or Railway instead (free tier is always-on)
- Or upgrade Heroku to paid tier

### Transactions not syncing
- Ensure you selected accounts when connecting bank
- Check that test account has transactions
- Note: Some banks may take 24 hours for transactions to appear

---

## Production Checklist

Before going live with real bank data:

- [ ] Switch from Sandbox to Production Plaid credentials
- [ ] Set up database to store access tokens (currently in-memory)
- [ ] Add authentication/user management
- [ ] Enable HTTPS (should be automatic with Render/Heroku)
- [ ] Set up transaction auto-sync (webhook)
- [ ] Add error logging/monitoring
- [ ] Test with real bank accounts (carefully)
- [ ] Monitor server logs for issues

---

## Upgrading Plaid Credentials

When ready to use real banks (not sandbox):

### 1. Get Production Credentials
- Go to https://dashboard.plaid.com
- Upgrade your Plaid account tier
- Get new `Client ID` and `Secret`

### 2. Update Server Credentials
In `plaid-server-minimal.js`, change:
```javascript
hostname: 'sandbox.plaid.com',  // Change to 'api.plaid.com'
```

### 3. Update Environment Variables
- Update `PLAID_CLIENT_ID` and `PLAID_SECRET` on your server
- Restart server or redeploy

---

## Maintenance

### Updating the Server
```bash
# Edit plaid-server-minimal.js
# Commit changes
git add plaid-server-minimal.js
git commit -m "Update Plaid server"
git push origin main

# If using Render/Railway: Auto-deploys
# If using Heroku: 
git push heroku main
```

### Viewing Logs
**Render:** View in dashboard → Logs
**Heroku:** `heroku logs --tail`
**Railway:** View in dashboard → Logs

### Monitoring Health
- Render: Built-in monitoring
- Heroku: Use New Relic add-on
- Railway: Built-in monitoring

---

## Cost Summary

| Platform | Cost | Notes |
|----------|------|-------|
| Render | Free | Recommended |
| Heroku | $7+/month | Classic dyno pricing |
| Railway | Free | Good alternative |

---

## Support

If you need help:
1. Check the production logs for errors
2. Verify environment variables are correct
3. Try the `/health` endpoint to check server status
4. Check Plaid API status: https://status.plaid.com
