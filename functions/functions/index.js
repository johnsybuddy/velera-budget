const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

admin.initializeApp();

// Plaid configuration - PRODUCTION MODE
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.production,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': '69926fbd4c01cb002166c96c',
      'PLAID-SECRET': '8a461d3a91b81a71a78e7ad4e609c4',
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

/**
 * Create Plaid Link Token
 */
exports.createLinkToken = functions.https.onCall(async (data, context) => {
  const userId = 'johnsybuddy';

  try {
    console.log('Creating link token for user:', userId);
    
    const request = {
      user: {
        client_user_id: userId,
      },
      client_name: 'Buddy Budget Tracker',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      account_filters: {
        depository: {
          account_subtypes: ['checking'],
        },
      },
    };
    
    console.log('Link token request:', JSON.stringify(request, null, 2));
    
    const response = await plaidClient.linkTokenCreate(request);
    
    console.log('Link token created successfully');
    return { link_token: response.data.link_token };
  } catch (error) {
    console.error('Error creating link token:', error.response?.data || error.message);
    throw new functions.https.HttpsError('internal', 'Failed to create link token: ' + (error.response?.data?.error_message || error.message));
  }
});

/**
 * Exchange Public Token for Access Token
 */
exports.exchangePublicToken = functions.https.onCall(async (data, context) => {
  const userId = 'johnsybuddy';

  try {
    console.log('Exchange function called');
    console.log('Data keys received:', Object.keys(data || {}));
    
    // Firebase v2 callable functions wrap payload in data.data
    const payload = data.data || data;
    const public_token = payload.public_token;
    const metadata = payload.metadata;
    
    console.log('Has public_token:', !!public_token);
    
    if (!public_token) {
      throw new functions.https.HttpsError('invalid-argument', 'public_token is required');
    }
    
    console.log('Calling Plaid API...');
    
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    
    console.log('Token exchange successful');

    await admin.firestore().collection('users').doc(userId).collection('plaidAccounts').add({
      accessToken: accessToken,
      itemId: itemId,
      institutionId: metadata?.institution?.institution_id || 'unknown',
      institutionName: metadata?.institution?.name || 'Unknown Bank',
      accounts: metadata?.accounts || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('Account saved');

    return { success: true, institutionName: metadata?.institution?.name || 'Bank' };
  } catch (error) {
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    if (error.response?.data) {
      console.error('Plaid API error:', JSON.stringify(error.response.data));
    }
    const errorMessage = error.response?.data?.error_message || error.message || 'Unknown error';
    throw new functions.https.HttpsError('internal', 'Failed to exchange token: ' + errorMessage);
  }
});

/**
 * Fetch Transactions - only from RCU checking account ending in 1916
 */
exports.fetchTransactions = functions.https.onCall(async (data, context) => {
  const userId = 'johnsybuddy';
  const payload = data.data || data;
  const { startDate, endDate } = payload;

  // Only sync from this specific account
  const ALLOWED_ACCOUNT_SUFFIX = '1916';

  try {
    const accountsSnapshot = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('plaidAccounts')
      .get();

    if (accountsSnapshot.empty) {
      return { transactions: [], count: 0, message: 'No accounts connected' };
    }

    let allTransactions = [];

    for (const doc of accountsSnapshot.docs) {
      const accountData = doc.data();
      const accessToken = accountData.accessToken;

      // Find the account_id for the account ending in 1916
      const targetAccount = accountData.accounts?.find(a => a.mask === ALLOWED_ACCOUNT_SUFFIX);
      if (!targetAccount) {
        console.log('Account ending in 1916 not found in this connection, skipping');
        continue;
      }
      
      console.log('Found target account:', targetAccount.id);

      try {
        const response = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          options: {
            account_ids: [targetAccount.id], // Only fetch from account ending in 1916
          }
        });

        const transactions = response.data.transactions.map(t => ({
          id: t.transaction_id,
          date: t.date,
          name: t.name,
          merchant: t.merchant_name,
          amount: t.amount,
          category: t.personal_finance_category?.primary || (t.category ? t.category[0] : null),
          pending: t.pending,
          account_id: t.account_id,
        }));

        console.log(`Fetched ${transactions.length} transactions from account ending in 1916`);
        allTransactions = allTransactions.concat(transactions);
      } catch (error) {
        console.error('Error fetching transactions:', error.response?.data || error.message);
      }
    }

    return { transactions: allTransactions, count: allTransactions.length };
  } catch (error) {
    console.error('Error in fetchTransactions:', error);
    throw new functions.https.HttpsError('internal', 'Failed to fetch transactions: ' + error.message);
  }
});

/**
 * Get Connected Accounts
 */
exports.getConnectedAccounts = functions.https.onCall(async (data, context) => {
  const userId = 'johnsybuddy';

  try {
    const accountsSnapshot = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('plaidAccounts')
      .get();

    const accounts = accountsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { accounts };
  } catch (error) {
    console.error('Error getting accounts:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get accounts: ' + error.message);
  }
});

/**
 * Remove Connected Account
 */
exports.removeAccount = functions.https.onCall(async (data, context) => {
  const userId = 'johnsybuddy';
  const payload = data.data || data;
  const { accountId } = payload;

  try {
    console.log('Removing account:', accountId);
    
    // Get the access token first to revoke it with Plaid
    const docRef = admin.firestore()
      .collection('users').doc(userId)
      .collection('plaidAccounts').doc(accountId);
    
    const doc = await docRef.get();
    if (doc.exists) {
      const accessToken = doc.data().accessToken;
      // Revoke access token with Plaid
      try {
        await plaidClient.itemRemove({ access_token: accessToken });
        console.log('Plaid item removed');
      } catch (e) {
        console.log('Could not revoke Plaid token (may already be invalid):', e.message);
      }
    }
    
    // Delete from Firestore regardless
    await docRef.delete();
    console.log('Account removed from Firestore');
    
    return { success: true };
  } catch (error) {
    console.error('Error removing account:', error);
    throw new functions.https.HttpsError('internal', 'Failed to remove account: ' + error.message);
  }
});
