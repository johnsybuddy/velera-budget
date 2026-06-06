# Plaid Server Setup Guide

## Overview
This guide explains how to run the local Plaid integration server for testing the bank connection feature.

## Prerequisites
- Node.js v20+ installed
- npm installed

## Quick Start

### 1. Install Dependencies
```bash
# Rename the server package.json to package.json (temporary)
copy server-package.json package.json

# Install dependencies
npm install
```

### 2. Set Up Environment
Copy the `.env-plaid-server` file to `.env`:
```bash
copy .env-plaid-server .env
```

Or create `.env` file with:
```
PLAID_CLIENT_ID=69926fbd4c01cb002166c96c3a3371e9e327e41eed0d59a5568d8bd
PLAID_SECRET=3a3371e9e327e41eed0d59a5568d8b
PLAID_SERVER_URL=http://localhost:3000
PORT=3000
```

### 3. Start the Server
```bash
node plaid-server.js
```

You should see:
```
Plaid server running on http://localhost:3000
PLAID_CLIENT_ID: ✓
PLAID_SECRET: ✓
```

### 4. Test the Connection
1. Open the Bills Website in your browser (http://localhost:8000 or https://johnsybuddy.github.io/bills-website)
2. Go to the **Expenses** tab
3. Click **🏦 Connect Bank Account**
4. Click **🔗 Connect New Bank Account**
5. You should be prompted to select a bank

### Troubleshooting

#### Server won't start
- Make sure port 3000 is not in use: `netstat -ano | find "3000"`
- Check that Node.js is installed: `node --version`

#### "Connection refused" error in browser
- Make sure the Plaid server is running on `http://localhost:3000`
- Check browser console for CORS errors
- Try clearing browser cache and doing a hard refresh (Ctrl+Shift+R)

#### "Failed to create link token"
- Check that `PLAID_CLIENT_ID` and `PLAID_SECRET` are set correctly in `.env`
- Verify server logs show "✓" for both credentials

#### Plaid Link modal doesn't open
- Check browser console for JavaScript errors
- Verify Plaid script is loaded: `https://cdn.plaid.com/link/v2/stable/link-initialize.js`

## Using Sandbox Credentials

The server is configured to use Plaid's **Sandbox** environment for testing.

### Sandbox Test Banks
Search for these banks in the Plaid Link flow:
- **Platypus Checking** (Institution ID: ins_110000000)
- **First Platypus Bank** (Institution ID: ins_109508)

### Sandbox Test Credentials
- Username: `user_good`
- Password: `pass_good`
- 2FA: (if prompted) `1234`

## Production Deployment

To deploy to production:

1. **Option 1: Deploy to Heroku**
   ```bash
   heroku create your-app-name
   heroku config:set PLAID_CLIENT_ID=your-production-client-id
   heroku config:set PLAID_SECRET=your-production-secret
   git push heroku main
   ```

2. **Option 2: Deploy to Vercel**
   - Update `plaid-server.js` to work with Vercel serverless functions
   - Add environment variables in Vercel dashboard

3. **Option 3: Use Firebase Cloud Functions (Recommended)**
   - See `functions/index.js` for the Cloud Functions implementation
   - Once Firebase CLI authentication is fixed, deploy with: `firebase deploy --only functions`

## Important Security Notes

- **Never commit** `.env` file with real credentials
- **Never use** Plaid credentials in frontend code (always proxy through a backend)
- **Always** use HTTPS in production
- **Store** access tokens securely (database with encryption)
- **Implement** proper authentication on your backend endpoints

## Next Steps

Once the local server is running:
1. Test connecting a Platypus bank account
2. Verify transactions are fetched correctly
3. Check that transactions are imported into the budget
4. Deploy server to production (Heroku, Render, etc.)
5. Update frontend to use production server URL

## File References
- `plaid-server.js` - Express server with Plaid API integration
- `server-package.json` - Dependencies for the server
- `plaid-integration.js` - Frontend code that calls the server
- `index.html` - Contains Plaid UI and "Connect Bank" button
- `.env-plaid-server` - Template environment variables
