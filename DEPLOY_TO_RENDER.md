# Deploy Plaid Server to Render - Step by Step

Your Plaid server code is now pushed to GitHub. Follow these steps to deploy it to Render (free tier).

## Step 1: Create a Render Account

1. Go to https://render.com
2. Click **Sign Up**
3. Select **Sign up with GitHub**
4. Authorize Render to access your GitHub account
5. Click **Authorize render-rnw**

## Step 2: Create a Web Service

1. After signing in, click the **New** button (top right)
2. Select **Web Service**
3. Select your GitHub repository: **bills-website**
4. Configure the service:
   - **Name:** `bills-plaid-server` (or any name you want)
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node plaid-server-minimal.js`
   - **Instance Type:** Free

## Step 3: Add Environment Variables

Before deploying, click **Advanced** or scroll down:

1. Click **Add Environment Variable**
2. Add first variable:
   - **Key:** `PLAID_CLIENT_ID`
   - **Value:** `69926fbd4c01cb002166c96c3a3371e9e327e41eed0d59a5568d8bd`
   - Click **Save**

3. Add second variable:
   - **Key:** `PLAID_SECRET`
   - **Value:** `3a3371e9e327e41eed0d59a5568d8b`
   - Click **Save**

## Step 4: Deploy

1. Click **Create Web Service**
2. Render will automatically start building
3. Wait 2-3 minutes for deployment to complete
4. You'll see a green checkmark when done
5. Copy your service URL (should be something like: `https://bills-plaid-server.onrender.com`)

## Step 5: Update Your Frontend

1. In your bills-website repository, edit `plaid-integration.js`
2. Find this line (around line 3):
   ```javascript
   const PLAID_SERVER_BASE = 'http://localhost:3000';
   ```
3. Replace it with your Render URL:
   ```javascript
   const PLAID_SERVER_BASE = 'https://bills-plaid-server.onrender.com';
   ```
   (Use your actual service URL from Step 4)

4. Save the file
5. Commit and push to GitHub:
   ```bash
   git add plaid-integration.js
   git commit -m "Update Plaid server URL to production"
   git push origin master:main
   ```

## Step 6: Test

1. Do a hard refresh on your Bills Website:
   - Windows/Linux: `Ctrl+Shift+R`
   - Mac: `Cmd+Shift+R`

2. Go to **Expenses** tab
3. Click **🏦 Connect Bank Account**
4. Click **🔗 Connect New Bank Account**
5. Search for a test bank (e.g., "Platypus")
6. Use sandbox credentials:
   - Username: `user_good`
   - Password: `pass_good`
   - 2FA (if prompted): `1234`

7. You should see success! ✓

## Troubleshooting

### "Build failed" or "Deployment failed"
1. Check the deployment logs in Render dashboard
2. Make sure `plaid-server-minimal.js` exists in your repository
3. Make sure `.env` file is committed (it contains your credentials)

### "Connection refused" on Bills Website
1. Make sure you updated `plaid-integration.js` with your Render URL
2. Do a hard refresh (Ctrl+Shift+R)
3. Check that Render deployment shows a green checkmark

### "Failed to create link token"
1. Verify environment variables are set correctly in Render dashboard
2. Check Render logs for error messages
3. Make sure credentials are exactly as shown above (no extra spaces)

### Server keeps timing out
1. Free tier Render instances may sleep after 15 minutes of inactivity
2. Access the `/health` endpoint to keep it awake
3. Or upgrade to a paid plan (Starter = $12/month)

## What Happens Next

- Your Plaid server is now **live on the internet** ✓
- Anyone accessing your Bills Website can connect their bank account
- Transactions will sync automatically
- When you're ready, upgrade your Plaid account for real banks (not sandbox)

## Monitoring

You can monitor your server in the Render dashboard:
- View logs: Click on your service → **Logs** tab
- Check status: Click on your service → see deployment status
- Restart server: Click **Manual Deploy** button

## Next Steps

1. ✓ Deploy to Render (you're here!)
2. Test with sandbox bank account
3. Verify transactions import correctly
4. When ready: Upgrade Plaid credentials for real banks
5. Deploy to production Plaid environment

## Support

If something goes wrong:
1. Check Render deployment logs
2. Verify `.env` file has correct credentials
3. Make sure `plaid-integration.js` has your correct Render URL
4. Try clearing browser cache and hard refresh
