/**
 * Simple Express server for Plaid integration
 * Run with: node plaid-server.js
 * Then update plaid-integration.js to use http://localhost:3000 instead of Cloud Functions
 */

const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Plaid configuration
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

// Store access tokens in memory (use database in production)
const accessTokens = {};

/**
 * Create Plaid Link Token
 */
app.post('/api/plaid/createLinkToken', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'johnsybuddy' },
      client_name: 'Buddy Budget Tracker',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      webhook: `${process.env.WEBHOOK_URL || 'http://localhost:3000'}/api/plaid/webhook`,
    });

    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

/**
 * Exchange Public Token for Access Token
 */
app.post('/api/plaid/exchangeToken', async (req, res) => {
  try {
    const { public_token, metadata } = req.body;

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Store token
    accessTokens[itemId] = {
      accessToken,
      itemId,
      institutionId: metadata.institution.institution_id,
      institutionName: metadata.institution.name,
      accounts: metadata.accounts,
    };

    // In production, save to database
    console.log(`Stored access token for ${metadata.institution.name}`);

    res.json({ success: true, institutionName: metadata.institution.name });
  } catch (error) {
    console.error('Error exchanging token:', error);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

/**
 * Fetch Transactions
 */
app.post('/api/plaid/fetchTransactions', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    let allTransactions = [];

    // Fetch from all stored accounts
    for (const [itemId, account] of Object.entries(accessTokens)) {
      try {
        const response = await plaidClient.transactionsGet({
          access_token: account.accessToken,
          start_date: startDate,
          end_date: endDate,
        });

        const transactions = response.data.transactions.map(t => ({
          id: t.transaction_id,
          date: t.date,
          name: t.name,
          merchant: t.merchant_name || t.name,
          amount: t.amount,
          category: t.category ? t.category[0] : 'Uncategorized',
          pending: t.pending,
          institutionName: account.institutionName,
        }));

        allTransactions = allTransactions.concat(transactions);
      } catch (error) {
        console.error(`Error fetching from ${account.institutionName}:`, error);
      }
    }

    res.json({ transactions: allTransactions, count: allTransactions.length });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * Webhook Handler
 */
app.post('/api/plaid/webhook', (req, res) => {
  const { webhook_type, webhook_code } = req.body;
  console.log(`Webhook: ${webhook_type} - ${webhook_code}`);
  res.json({ received: true });
});

/**
 * Health Check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Plaid server running on http://localhost:${PORT}`);
  console.log('PLAID_CLIENT_ID:', process.env.PLAID_CLIENT_ID ? '✓' : '✗');
  console.log('PLAID_SECRET:', process.env.PLAID_SECRET ? '✓' : '✗');
});
