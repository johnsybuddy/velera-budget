# Render Deployment - Quick Reference

## Your Credentials (Ready to Use)
- **Client ID:** `69926fbd4c01cb002166c96c3a3371e9e327e41eed0d59a5568d8bd`
- **Secret:** `3a3371e9e327e41eed0d59a5568d8b`

## GitHub Files Ready
✓ `plaid-server-minimal.js` - The server code
✓ `.env` - Your credentials
✓ `package.json` - Dependencies
✓ `Procfile` - Heroku/Render config
✓ `render.yaml` - Auto-deployment config

## Deploy Steps (5 minutes)

1. **Sign up:** https://render.com (use GitHub)
2. **Create Web Service:** From your bills-website repo
3. **Add Environment Variables:**
   - `PLAID_CLIENT_ID=69926fbd4c01cb002166c96c3a3371e9e327e41eed0d59a5568d8bd`
   - `PLAID_SECRET=3a3371e9e327e41eed0d59a5568d8b`
4. **Deploy:** Click "Create Web Service"
5. **Wait:** 2-3 minutes (watch logs)
6. **Copy URL:** e.g., `https://bills-plaid-server.onrender.com`

## Update Frontend (2 minutes)

Edit `plaid-integration.js` line 3:
```javascript
// Change from:
const PLAID_SERVER_BASE = 'http://localhost:3000';

// To:
const PLAID_SERVER_BASE = 'https://bills-plaid-server.onrender.com';  // YOUR URL HERE
```

Push to GitHub:
```bash
git add plaid-integration.js
git commit -m "Update Plaid server URL"
git push origin master:main
```

## Test It

1. Hard refresh: `Ctrl+Shift+R`
2. Go to Expenses tab
3. Click "🏦 Connect Bank Account"
4. Search "Platypus" and test with:
   - Username: `user_good`
   - Password: `pass_good`

## Status Check

- **Green checkmark** on Render = Server is running ✓
- **Hard refresh** if it still shows old URL
- **Check logs** in Render if it fails

## One-Time Setup Complete!

Once deployed, your Plaid integration will work for:
- All users who visit your site
- All future bank connections
- Auto-syncing transactions
- Real banks (when you upgrade credentials)

No more local server needed!
