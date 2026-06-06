# Plaid Integration - Quick Start

## ✅ Current Status

The Plaid integration is now **running and ready to test!**

- ✓ Plaid server running on `http://localhost:3000`
- ✓ Frontend configured to connect to local server
- ✓ "Connect Bank Account" button in Expenses tab
- ✓ Using Plaid sandbox credentials (safe for testing)

## 🚀 Test the Connection Now

1. **Open your Bills Website** (or refresh if already open)
   - Local: http://localhost:8000 (or your dev server)
   - Online: https://johnsybuddy.github.io/bills-website

2. **Go to Expenses tab**

3. **Click "🏦 Connect Bank Account"**

4. **Click "🔗 Connect New Bank Account"**

5. **Search for a test bank** (e.g., "Platypus" or "Chase")

6. **Use sandbox credentials:**
   - Username: `user_good`
   - Password: `pass_good`
   - 2FA (if prompted): `1234`

7. **Transactions should sync automatically**

## 📋 How It Works

```
Your App (Browser)
       ↓
   Plaid Link Widget (user logs in here)
       ↓
Plaid Server (plaid-server-minimal.js running on localhost:3000)
       ↓
Plaid API (sandbox.plaid.com)
       ↓
Bank Data → Transactions imported into Bills app
```

## 🌐 For Production (Internet Use)

When you're ready to deploy online, you need to:

### Option 1: Deploy to Render (Recommended - Free)
1. Create account at https://render.com
2. Create new Web Service
3. Connect to GitHub (push `plaid-server-minimal.js`)
4. Set environment variables:
   - `PLAID_CLIENT_ID=69926fbd4c01cb002166c96c3a3371e9e327e41eed0d59a5568d8bd`
   - `PLAID_SECRET=3a3371e9e327e41eed0d59a5568d8b`
5. Get the URL (e.g., `https://your-app.onrender.com`)
6. Update `plaid-integration.js`:
   ```javascript
   const PLAID_SERVER_BASE = 'https://your-app.onrender.com';
   ```

### Option 2: Deploy to Heroku
1. Create account at https://heroku.com
2. Install Heroku CLI
3. Run:
   ```bash
   heroku create your-app-name
   heroku config:set PLAID_CLIENT_ID=69926fbd4c01cb002166c96c3a3371e9e327e41eed0d59a5568d8bd
   heroku config:set PLAID_SECRET=3a3371e9e327e41eed0d59a5568d8b
   git push heroku main
   ```

### Option 3: Deploy to Railway
Similar to Render - minimal setup, can use GitHub integration.

## 📁 Files Created

- **`plaid-server-minimal.js`** - The server (uses only Node.js built-in modules)
- **`plaid-integration.js`** - Frontend code that talks to the server
- **`.env`** - Environment variables (Client ID & Secret)
- **`index.html`** - "Connect Bank Account" button is in Expenses tab

## 🔑 Your Credentials (Already Configured)

- **Client ID:** `69926fbd4c01cb002166c96c3a3371e9e327e41eed0d59a5568d8bd`
- **Secret:** `3a3371e9e327e41eed0d59a5568d8b` 
- **Recovery Code:** `SXRJSCFYPUXHC4K6BG25SRK2ME` (saved in `.plaid-recovery-code.txt`)

These are for **sandbox testing**. When you upgrade to real credentials, follow the same pattern.

## 🛑 Stop the Server

Press `Ctrl+C` in the terminal running the server, or:
```bash
taskkill /PID 11688 /F
```

## 📖 Next Steps

1. Test with sandbox bank accounts
2. Verify transactions import correctly
3. When ready: Deploy server to production (Render recommended)
4. Switch to real bank credentials when going live
5. Enable transaction auto-sync (webhook setup)

## ❓ Troubleshooting

**"Connection refused" error?**
- Make sure `plaid-server-minimal.js` is running
- Check that port 3000 is free: `netstat -ano | findstr "3000"`

**"Failed to create link token"?**
- Check that `.env` file has correct credentials
- Make sure server is running on port 3000
- Check browser console for network errors

**Transactions not importing?**
- Check browser console for errors
- Make sure you selected accounts when connecting
- Verify transactions exist in sandbox bank account

**Need to switch to real credentials?**
- Update `.env` file with your production Plaid credentials
- Restart the server
- Note: Real credentials require higher Plaid tier
