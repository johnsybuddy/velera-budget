# Plaid Integration Setup Guide

This guide will help you set up automatic bank transaction syncing using Plaid.

## Prerequisites

1. Node.js installed (v18 or higher)
2. Firebase CLI installed: `npm install -g firebase-tools`
3. Plaid account (free sandbox for testing)

## Step 1: Create Plaid Account

1. Go to https://dashboard.plaid.com/signup
2. Sign up for a free account
3. Once logged in, go to **Team Settings** → **Keys**
4. Copy your:
   - **Client ID**
   - **Sandbox Secret** (for testing)
   - **Development Secret** (for real banks, later)

## Step 2: Initialize Firebase Functions

Open your terminal in the project root and run:

```bash
# Login to Firebase
firebase login

# Initialize Firebase Functions (if not already done)
firebase init functions

# When prompted:
# - Select "Use an existing project" → johnson-fam-bills
# - Choose JavaScript
# - Do NOT overwrite existing files
# - Install dependencies: Yes
```

## Step 3: Configure Plaid Credentials

Set your Plaid credentials in Firebase:

```bash
# Set Plaid Client ID
firebase functions:config:set plaid.client_id="YOUR_CLIENT_ID_HERE"

# Set Plaid Secret (use sandbox secret for testing)
firebase functions:config:set plaid.secret="YOUR_SANDBOX_SECRET_HERE"

# View your config to verify
firebase functions:config:get
```

## Step 4: Install Dependencies

```bash
cd functions
npm install
cd ..
```

## Step 5: Deploy Functions

```bash
firebase deploy --only functions
```

This will deploy all the Cloud Functions. You should see output like:
```
✔  functions[createLinkToken(us-central1)]
✔  functions[exchangePublicToken(us-central1)]
✔  functions[fetchTransactions(us-central1)]
✔  functions[scheduledTransactionSync(us-central1)]
✔  functions[plaidWebhook(us-central1)]
✔  functions[getConnectedAccounts(us-central1)]
✔  functions[removeAccount(us-central1)]
```

## Step 6: Update Firebase Security Rules

Add these rules to allow users to access their Plaid data:

```javascript
// In Firebase Console → Firestore → Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /plaidAccounts/{accountId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /transactions/{transactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## Step 7: Add Plaid Link to Your Website

The frontend code has been added to `app.js`. You'll need to:

1. Add the Plaid Link script to `index.html` (already done in next step)
2. Enable Firebase Authentication (if not already enabled)
3. Test the connection

## Step 8: Enable Firebase Authentication

1. Go to Firebase Console → Authentication
2. Click "Get Started"
3. Enable "Email/Password" sign-in method
4. Create a test user or use your existing authentication

## Testing in Sandbox Mode

Plaid Sandbox uses test credentials:

**Test Bank Login:**
- Username: `user_good`
- Password: `pass_good`

**Test Credit Card:**
- Username: `user_good`
- Password: `pass_good`

These will create fake transactions for testing.

## Step 9: Moving to Production

Once testing is complete:

1. Request Production access from Plaid (requires verification)
2. Update the environment in `functions/index.js`:
   ```javascript
   basePath: PlaidEnvironments.production
   ```
3. Update Firebase config with production secret:
   ```bash
   firebase functions:config:set plaid.secret="YOUR_PRODUCTION_SECRET"
   ```
4. Redeploy functions

## Costs

**Plaid Pricing:**
- Sandbox: Free (unlimited)
- Development: Free (100 connected accounts)
- Production: $0.25-$0.50 per connected account/month

**Firebase Pricing:**
- Free tier includes:
  - 125K function invocations/month
  - 40K GB-seconds compute time
  - Should be sufficient for personal use

## Troubleshooting

**Functions not deploying?**
```bash
# Check Firebase project
firebase projects:list

# Make sure you're using the right project
firebase use johnson-fam-bills
```

**Config not set?**
```bash
# View current config
firebase functions:config:get

# Reset if needed
firebase functions:config:unset plaid
```

**Test locally:**
```bash
cd functions
npm run serve
# Functions will run at http://localhost:5001
```

## Security Notes

- Access tokens are stored encrypted in Firestore
- Only authenticated users can access their own data
- Plaid uses bank-level encryption
- Never commit secrets to Git
- Use environment variables for production

## Next Steps

After setup is complete:
1. Click "Connect Bank Account" button in your app
2. Select your bank (Sam's Club Credit Card or Royal Credit Union)
3. Enter credentials
4. Transactions will sync automatically daily at 6 AM
5. Manual sync available via "Sync Transactions" button

## Support

- Plaid Docs: https://plaid.com/docs/
- Firebase Functions: https://firebase.google.com/docs/functions
- Issues? Check the Firebase Console → Functions → Logs
