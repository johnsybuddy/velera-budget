const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

admin.initializeApp();

const CORS_ORIGINS = ['https://johnsybuddy.github.io'];

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

exports.createLinkToken = onCall({ cors: CORS_ORIGINS }, async (request) => {
  const userId = 'johnsybuddy';
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Buddy Budget Tracker',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      account_filters: { depository: { account_subtypes: ['checking'] } },
    });
    return { link_token: response.data.link_token };
  } catch (error) {
    console.error('createLinkToken error:', error.response?.data || error.message);
    throw new Error('Failed to create link token: ' + (error.response?.data?.error_message || error.message));
  }
});

exports.exchangePublicToken = onCall({ cors: CORS_ORIGINS }, async (request) => {
  const userId = 'johnsybuddy';
  const { public_token, metadata } = request.data;
  if (!public_token) throw new Error('public_token is required');
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    await admin.firestore().collection('users').doc(userId).collection('plaidAccounts').add({
      accessToken, itemId,
      institutionId: metadata?.institution?.institution_id || 'unknown',
      institutionName: metadata?.institution?.name || 'Unknown Bank',
      accounts: metadata?.accounts || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, institutionName: metadata?.institution?.name || 'Bank' };
  } catch (error) {
    console.error('exchangePublicToken error:', error.message);
    throw new Error('Failed to exchange token: ' + (error.response?.data?.error_message || error.message));
  }
});

exports.fetchTransactions = onCall({ cors: CORS_ORIGINS }, async (request) => {
  const userId = 'johnsybuddy';
  const { startDate, endDate } = request.data;
  const ALLOWED_ACCOUNT_SUFFIX = '1916';
  try {
    const accountsSnapshot = await admin.firestore()
      .collection('users').doc(userId).collection('plaidAccounts').get();
    if (accountsSnapshot.empty) return { transactions: [], count: 0 };
    let allTransactions = [];
    for (const doc of accountsSnapshot.docs) {
      const { accessToken, accounts } = doc.data();
      const targetAccount = accounts?.find(a => a.mask === ALLOWED_ACCOUNT_SUFFIX);
      if (!targetAccount) continue;
      try {
        const response = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          options: { account_ids: [targetAccount.id] },
        });
        allTransactions = allTransactions.concat(response.data.transactions.map(t => ({
          id: t.transaction_id,
          date: t.date,
          name: t.name,
          merchant: t.merchant_name,
          amount: t.amount,
          category: t.personal_finance_category?.primary || (t.category ? t.category[0] : null),
          pending: t.pending,
          account_id: t.account_id,
          institutionName: doc.data().institutionName || '',
        })));
      } catch (e) {
        console.error('fetchTransactions inner error:', e.message);
      }
    }
    return { transactions: allTransactions, count: allTransactions.length };
  } catch (error) {
    console.error('fetchTransactions error:', error.message);
    throw new Error('Failed to fetch transactions: ' + error.message);
  }
});

exports.getConnectedAccounts = onCall({ cors: CORS_ORIGINS }, async (request) => {
  const userId = 'johnsybuddy';
  try {
    const snap = await admin.firestore()
      .collection('users').doc(userId).collection('plaidAccounts').get();
    return { accounts: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    throw new Error('Failed to get accounts: ' + error.message);
  }
});

exports.removeAccount = onCall({ cors: CORS_ORIGINS }, async (request) => {
  const userId = 'johnsybuddy';
  const { accountId } = request.data;
  try {
    const docRef = admin.firestore()
      .collection('users').doc(userId).collection('plaidAccounts').doc(accountId);
    const doc = await docRef.get();
    if (doc.exists) {
      try {
        await plaidClient.itemRemove({ access_token: doc.data().accessToken });
      } catch (e) {
        console.log('Could not revoke Plaid token:', e.message);
      }
    }
    await docRef.delete();
    return { success: true };
  } catch (error) {
    throw new Error('Failed to remove account: ' + error.message);
  }
});
