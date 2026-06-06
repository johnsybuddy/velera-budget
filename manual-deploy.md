# Manual Firebase Functions Deployment

Since Firebase CLI authentication isn't working, follow these steps to redeploy from Google Cloud Console:

## Step 1: Go to Google Cloud Console
1. Open https://console.cloud.google.com
2. Select project: **johnson-fam-bills**
3. Go to **Cloud Functions** (search at top)

## Step 2: Edit the createLinkToken Function
1. Find function named **createLinkToken**
2. Click on it
3. Click **Edit** button
4. In the code editor (Source code tab), replace the content with this:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const cors = require('cors')({ origin: true });

admin.initializeApp();

// Plaid credentials (hardcoded)
const PLAID_CLIENT_ID = '69926fbd4c01cb002166c96c3a3371e9e327e41eed0d59a5568d8bd';
const PLAID_SECRET = '3a3371e9e327e41eed0d59a5568d8b';

// Plaid configuration
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

exports.createLinkToken = functions.https.onCall(async (data, context) => {
  const userId = 'johnsybuddy';
  try {
    console.log('Creating link token...');
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Buddy Budget Tracker',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    return { link_token: response.data.link_token };
  } catch (error) {
    console.error('Error creating link token:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create link token');
  }
});
```

5. Scroll down to **package.json** tab
6. Make sure it has:
```json
{
  "name": "bills-website-functions",
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^7.0.0",
    "plaid": "^18.0.0",
    "cors": "^2.8.5"
  }
}
```

7. Click **Deploy** button (bottom right)
8. Wait 2-3 minutes for deployment

## Step 3: Test

1. Hard refresh your Bills Website: `Ctrl+Shift+R`
2. Go to Expenses
3. Click "Connect Bank Account"
4. It should work now!

If you need help finding these in the console, let me know!
