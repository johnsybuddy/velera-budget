# Plaid Integration - Quick Reference

## 🚀 Quick Start (5 Minutes)

### 1. Get Plaid Credentials
- Sign up: https://dashboard.plaid.com/signup
- Get your **Client ID** and **Sandbox Secret** from Team Settings → Keys

### 2. Configure Firebase
```bash
firebase functions:config:set plaid.client_id="YOUR_CLIENT_ID"
firebase functions:config:set plaid.secret="YOUR_SANDBOX_SECRET"
```

### 3. Deploy Functions
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 4. Add UI to index.html
Copy the content from `plaid-ui.html` and add:
- Plaid script tag in `<head>`
- Bank Connections Modal before `</body>`
- Floating button or quick action button

### 5. Add Code to app.js
Copy the entire content from `plaid-integration.js` and paste at the end of your `app.js` file.

### 6. Test!
- Click "Bank Connections" button
- Click "Connect New Bank Account"
- Use test credentials:
  - Username: `user_good`
  - Password: `pass_good`
- Select any test bank
- Transactions will sync automatically!

## 📋 Common Commands

```bash
# View current config
firebase functions:config:get

# Deploy only functions
firebase deploy --only functions

# View function logs
firebase functions:log

# Test locally
cd functions && npm run serve

# Switch to production
firebase functions:config:set plaid.secret="YOUR_PRODUCTION_SECRET"
```

## 🏦 Supported Institutions

Plaid supports 12,000+ institutions including:
- ✅ Most major banks (Chase, Bank of America, Wells Fargo, etc.)
- ✅ Credit unions (including Royal Credit Union)
- ✅ Credit cards (including Synchrony/Sam's Club)
- ✅ Investment accounts
- ✅ PayPal, Venmo, Cash App

## 🔄 How Auto-Sync Works

1. **Daily Sync**: Runs automatically at 6 AM Central Time
2. **Manual Sync**: Click "Sync Transactions Now" button
3. **Webhook**: Plaid notifies your app when new transactions are available
4. **Deduplication**: Plaid transaction IDs prevent duplicates

## 💰 Pricing

| Tier | Cost | Limit |
|------|------|-------|
| Sandbox | Free | Unlimited (test data only) |
| Development | Free | 100 connected accounts |
| Production | $0.25-$0.50/account/month | Unlimited |

For personal use with 2 accounts: ~$0.50-$1.00/month

## 🔒 Security

- ✅ Bank-level encryption (256-bit)
- ✅ Read-only access (cannot move money)
- ✅ Credentials never stored
- ✅ Access tokens encrypted in Firestore
- ✅ User authentication required
- ✅ SOC 2 Type II certified

## 🐛 Troubleshooting

### "Failed to create link token"
- Check Firebase Functions are deployed
- Verify Plaid config is set: `firebase functions:config:get`
- Check Firebase Console → Functions → Logs

### "User must be authenticated"
- Make sure Firebase Authentication is enabled
- User must be logged in (check `firebase.auth().currentUser`)

### Transactions not syncing
- Check Firebase Console → Functions → Logs
- Verify access token is stored in Firestore
- Try manual sync first

### Bank not found
- Sandbox: Use test banks only
- Development: Most banks available
- Production: All 12,000+ institutions

## 📊 Transaction Mapping

Plaid transactions are automatically mapped to your bill categories:

| Plaid Category | Your Category |
|----------------|---------------|
| Food and Drink → Groceries | Groceries |
| Food and Drink → Restaurants | Restaurants/Entertainment |
| Transportation → Gas | Gas |
| Home → Mortgage | Mortgage + Escrow |
| Auto → Payment | Car Payment |
| Utilities → Electric | Xcel Energy |
| Utilities → Water | Water |
| Childcare | Daycare |

Unmapped transactions default to "Miscellaneous" and can be recategorized.

## 🎯 Next Steps After Setup

1. **Test in Sandbox** with fake data
2. **Request Development Access** from Plaid (instant approval)
3. **Connect real accounts** using Development credentials
4. **Monitor for 30 days** to ensure stability
5. **Request Production Access** (requires Plaid review)
6. **Switch to Production** credentials

## 📞 Support

- **Plaid Docs**: https://plaid.com/docs/
- **Plaid Dashboard**: https://dashboard.plaid.com/
- **Firebase Functions**: https://firebase.google.com/docs/functions
- **Your Functions Logs**: Firebase Console → Functions → Logs

## ⚡ Pro Tips

1. **Auto-categorization**: The system learns from your manual categorizations
2. **Pending transactions**: Marked with `pending: true`, amounts may change
3. **Duplicates**: Plaid IDs prevent duplicates even if you import CSV
4. **Multiple accounts**: Connect both Sam's Club and Royal Credit Union
5. **Historical data**: Can fetch up to 2 years of transaction history

## 🔄 Update Cycle

1. Plaid syncs with banks: Every 4-6 hours
2. Your app syncs with Plaid: Daily at 6 AM (or manual)
3. Transactions appear: Within 24 hours of posting at bank

## 📝 Files Created

- `functions/index.js` - Cloud Functions code
- `functions/package.json` - Dependencies
- `plaid-integration.js` - Frontend code (add to app.js)
- `plaid-ui.html` - UI components (add to index.html)
- `PLAID_SETUP_GUIDE.md` - Detailed setup instructions
- `deploy-plaid.bat` - Quick deployment script

---

**Ready to go live?** Follow the setup guide and you'll have automatic transaction syncing in under 10 minutes! 🚀
