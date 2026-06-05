const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const cors = require('cors')({ origin: true });

admin.initializeApp();

// Plaid credentials (hardcoded for now - in production use Firebase Secrets)
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

/**
 * Create Plaid Link Token
 * This is called when user wants to connect their bank account
 */
exports.createLinkToken = functions.https.onCall(async (data, context) => {
  // Use hardcoded userId for personal use (not recommended for production)
  const userId = 'johnsybuddy';

  try {
    console.log('Creating link token with client_id:', PLAID_CLIENT_ID.substring(0, 10) + '...');
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: 'Buddy Budget Tracker',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      webhook: 'https://us-central1-johnson-fam-bills.cloudfunctions.net/plaidWebhook',
    });

    return { link_token: response.data.link_token };
  } catch (error) {
    console.error('Error creating link token:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create link token: ' + error.message);
  }
});

/**
 * Exchange Public Token for Access Token
 * Called after user successfully connects their bank
 */
exports.exchangePublicToken = functions.https.onCall(async (data, context) => {
  const { public_token, metadata } = data;
  const userId = 'johnsybuddy';

  try {
    // Exchange public token for access token
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Store access token securely in Firestore
    await admin.firestore().collection('users').doc(userId).collection('plaidAccounts').add({
      accessToken: accessToken,
      itemId: itemId,
      institutionId: metadata.institution.institution_id,
      institutionName: metadata.institution.name,
      accounts: metadata.accounts,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, institutionName: metadata.institution.name };
  } catch (error) {
    console.error('Error exchanging public token:', error);
    throw new functions.https.HttpsError('internal', 'Failed to exchange token');
  }
});

/**
 * Fetch Transactions
 * Manually triggered or scheduled to sync transactions
 */
exports.fetchTransactions = functions.https.onCall(async (data, context) => {
  const userId = 'johnsybuddy';
  const { startDate, endDate } = data;

  try {
    // Get all connected accounts for this user
    const accountsSnapshot = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('plaidAccounts')
      .get();

    if (accountsSnapshot.empty) {
      return { transactions: [], message: 'No accounts connected' };
    }

    let allTransactions = [];

    // Fetch transactions from each connected account
    for (const doc of accountsSnapshot.docs) {
      const accountData = doc.data();
      const accessToken = accountData.accessToken;

      try {
        const response = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate || getDateDaysAgo(30),
          end_date: endDate || getTodayDate(),
        });

        const transactions = response.data.transactions.map(t => ({
          id: t.transaction_id,
          date: t.date,
          name: t.name,
          merchant: t.merchant_name || t.name,
          amount: t.amount,
          category: t.category ? t.category[0] : 'Uncategorized',
          pending: t.pending,
          accountId: t.account_id,
          institutionName: accountData.institutionName,
        }));

        allTransactions = allTransactions.concat(transactions);
      } catch (error) {
        console.error(`Error fetching transactions for account ${doc.id}:`, error);
      }
    }

    // Store transactions in Firestore
    const batch = admin.firestore().batch();
    allTransactions.forEach(transaction => {
      const docRef = admin.firestore()
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .doc(transaction.id);
      batch.set(docRef, transaction, { merge: true });
    });
    await batch.commit();

    return { 
      transactions: allTransactions,
      count: allTransactions.length,
      message: `Synced ${allTransactions.length} transactions`
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw new functions.https.HttpsError('internal', 'Failed to fetch transactions');
  }
});

/**
 * Scheduled function to auto-sync transactions daily
 * Runs every day at 6 AM
 */
exports.scheduledTransactionSync = functions.pubsub
  .schedule('0 6 * * *')
  .timeZone('America/Chicago')
  .onRun(async (context) => {
    console.log('Starting scheduled transaction sync...');

    try {
      // Get all users with connected accounts
      const usersSnapshot = await admin.firestore().collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const accountsSnapshot = await userDoc.ref.collection('plaidAccounts').get();

        if (accountsSnapshot.empty) continue;

        let syncedCount = 0;

        for (const accountDoc of accountsSnapshot.docs) {
          const accountData = accountDoc.data();
          const accessToken = accountData.accessToken;

          try {
            const response = await plaidClient.transactionsGet({
              access_token: accessToken,
              start_date: getDateDaysAgo(7), // Last 7 days
              end_date: getTodayDate(),
            });

            const transactions = response.data.transactions.map(t => ({
              id: t.transaction_id,
              date: t.date,
              name: t.name,
              merchant: t.merchant_name || t.name,
              amount: t.amount,
              category: t.category ? t.category[0] : 'Uncategorized',
              pending: t.pending,
              accountId: t.account_id,
              institutionName: accountData.institutionName,
              syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            }));

            // Store in Firestore
            const batch = admin.firestore().batch();
            transactions.forEach(transaction => {
              const docRef = userDoc.ref.collection('transactions').doc(transaction.id);
              batch.set(docRef, transaction, { merge: true });
            });
            await batch.commit();

            syncedCount += transactions.length;
          } catch (error) {
            console.error(`Error syncing account ${accountDoc.id}:`, error);
          }
        }

        console.log(`Synced ${syncedCount} transactions for user ${userId}`);
      }

      return null;
    } catch (error) {
      console.error('Error in scheduled sync:', error);
      return null;
    }
  });

/**
 * Plaid Webhook Handler
 * Receives notifications from Plaid about account changes
 */
exports.plaidWebhook = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const { webhook_type, webhook_code, item_id } = req.body;

    console.log('Webhook received:', webhook_type, webhook_code);

    // Handle different webhook types
    if (webhook_type === 'TRANSACTIONS') {
      if (webhook_code === 'DEFAULT_UPDATE') {
        // New transactions available - trigger sync
        console.log(`New transactions available for item ${item_id}`);
        // You could trigger fetchTransactions here
      }
    }

    res.json({ received: true });
  });
});

/**
 * Get Connected Accounts
 * Returns list of all connected bank accounts
 */
exports.getConnectedAccounts = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;

  try {
    const accountsSnapshot = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('plaidAccounts')
      .get();

    const accounts = accountsSnapshot.docs.map(doc => ({
      id: doc.id,
      institutionName: doc.data().institutionName,
      accounts: doc.data().accounts,
      createdAt: doc.data().createdAt,
    }));

    return { accounts };
  } catch (error) {
    console.error('Error getting connected accounts:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get accounts');
  }
});

/**
 * Remove Connected Account
 * Disconnects a bank account
 */
exports.removeAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;
  const { accountId } = data;

  try {
    await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('plaidAccounts')
      .doc(accountId)
      .delete();

    return { success: true };
  } catch (error) {
    console.error('Error removing account:', error);
    throw new functions.https.HttpsError('internal', 'Failed to remove account');
  }
});

// Helper functions
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}
