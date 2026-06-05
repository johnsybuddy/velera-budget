/**
 * Minimal Plaid Server for Bills Website
 * This is a lightweight alternative when npm has network issues
 * 
 * Usage: node plaid-server-minimal.js
 * Then visit: http://localhost:3000
 * 
 * This server will be replaced with a deployed version (Render, Heroku, etc.)
 */

const http = require('http');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file (for local development)
// OR from Render/system environment variables (for production)
const envPath = path.join(__dirname, '.env');
let PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || '';
let PLAID_SECRET = process.env.PLAID_SECRET || '';

// If running locally and .env exists, load from file
if (fs.existsSync(envPath) && !process.env.PLAID_CLIENT_ID) {
  console.log('Loading from .env file (local development)...');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key.trim() === 'PLAID_CLIENT_ID') {
        PLAID_CLIENT_ID = value;
        console.log(`Loaded PLAID_CLIENT_ID from .env: ${value.substring(0, 10)}...`);
      }
      if (key.trim() === 'PLAID_SECRET') {
        PLAID_SECRET = value;
        console.log(`Loaded PLAID_SECRET from .env: ${value.substring(0, 10)}...`);
      }
    }
  });
} else if (process.env.PLAID_CLIENT_ID) {
  console.log('Using environment variables (production)...');
  PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
  PLAID_SECRET = process.env.PLAID_SECRET;
  console.log(`Loaded PLAID_CLIENT_ID from env: ${PLAID_CLIENT_ID.substring(0, 10)}...`);
  console.log(`Loaded PLAID_SECRET from env: ${PLAID_SECRET.substring(0, 10)}...`);
}

const PORT = 3000;

// In-memory storage for access tokens (in production, use a database)
const accessTokens = {};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Create link token
async function createLinkToken(req, res) {
  try {
    // Call Plaid API to create link token
    const plaidRequest = {
      user: { client_user_id: 'johnsybuddy' },
      client_name: 'Buddy Budget Tracker',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    };

    const https = require('https');
    const options = {
      hostname: 'sandbox.plaid.com',
      port: 443,
      path: '/link/token/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false  // Disable SSL verification for corporate proxies
    };

    const httpsReq = require('https').request(options, (plaidRes) => {
      let data = '';
      plaidRes.on('data', chunk => { data += chunk; });
      plaidRes.on('end', () => {
        try {
          console.log('Plaid Response:', plaidRes.statusCode, data);
          const responseData = JSON.parse(data);
          
          if (responseData.error_code) {
            console.error('Plaid Error:', responseData.error_message);
            res.writeHead(400, corsHeaders);
            res.end(JSON.stringify({
              error: responseData.error_message || 'Plaid API error'
            }));
          } else {
            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify({
              link_token: responseData.link_token
            }));
          }
        } catch (e) {
          console.error('Parse Error:', e.message);
          res.writeHead(500, corsHeaders);
          res.end(JSON.stringify({ error: 'Failed to parse Plaid response' }));
        }
      });
    });

    httpsReq.on('error', (error) => {
      console.error('Plaid API error:', error.message);
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ error: 'Plaid API error: ' + error.message }));
    });

    // Plaid requires client_id and secret in the request body
    const body = JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      user: { client_user_id: 'johnsybuddy' },
      client_name: 'Buddy Budget Tracker',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    });

    console.log('Sending to Plaid full body:', body);
    console.log('PLAID_CLIENT_ID value:', PLAID_CLIENT_ID);
    console.log('PLAID_SECRET value:', PLAID_SECRET);
    httpsReq.write(body);
    httpsReq.end();

  } catch (error) {
    console.error('Error creating link token:', error);
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: 'Failed to create link token' }));
  }
}

// Exchange public token for access token
async function exchangePublicToken(body, req, res) {
  try {
    const { public_token, metadata } = JSON.parse(body);

    const plaidRequest = {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      public_token: public_token
    };

    const https = require('https');
    const options = {
      hostname: 'sandbox.plaid.com',
      port: 443,
      path: '/item/public_token/exchange',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false  // Disable SSL verification for corporate proxies
    };

    const httpsReq = require('https').request(options, (plaidRes) => {
      let data = '';
      plaidRes.on('data', chunk => { data += chunk; });
      plaidRes.on('end', () => {
        try {
          const responseData = JSON.parse(data);
          
          if (responseData.error_code) {
            res.writeHead(400, corsHeaders);
            res.end(JSON.stringify({
              error: responseData.error_message
            }));
          } else {
            // Store the access token
            accessTokens[responseData.item_id] = {
              accessToken: responseData.access_token,
              institutionName: metadata?.institution?.name || 'Unknown Bank'
            };

            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify({
              success: true,
              institutionName: metadata?.institution?.name
            }));
          }
        } catch (e) {
          res.writeHead(500, corsHeaders);
          res.end(JSON.stringify({ error: 'Failed to parse Plaid response' }));
        }
      });
    });

    httpsReq.on('error', (error) => {
      console.error('Plaid API error:', error);
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ error: 'Plaid API error' }));
    });

    httpsReq.write(JSON.stringify(plaidRequest));
    httpsReq.end();

  } catch (error) {
    console.error('Error exchanging token:', error);
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: 'Failed to exchange token' }));
  }
}

// Fetch transactions
async function fetchTransactions(body, req, res) {
  try {
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({
      transactions: [],
      count: 0,
      message: 'Transaction syncing not yet implemented'
    }));
  } catch (error) {
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: 'Failed to fetch transactions' }));
  }
}

// HTTP Server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // Routes
  if (pathname === '/api/plaid/createLinkToken' && req.method === 'POST') {
    createLinkToken(req, res);
  } else if (pathname === '/api/plaid/exchangeToken' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => exchangePublicToken(body, req, res));
  } else if (pathname === '/api/plaid/fetchTransactions' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => fetchTransactions(body, req, res));
  } else if (pathname === '/health') {
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({
      status: 'ok',
      PLAID_CLIENT_ID: PLAID_CLIENT_ID ? '✓' : '✗',
      PLAID_SECRET: PLAID_SECRET ? '✓' : '✗'
    }));
  } else {
    res.writeHead(404, corsHeaders);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`\nPlaid Server running on http://localhost:${PORT}`);
  console.log(`Environment check:`);
  console.log(`  PLAID_CLIENT_ID: ${PLAID_CLIENT_ID ? '✓ Loaded' : '✗ Missing'}`);
  console.log(`  PLAID_SECRET: ${PLAID_SECRET ? '✓ Loaded' : '✗ Missing'}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /api/plaid/createLinkToken`);
  console.log(`  POST /api/plaid/exchangeToken`);
  console.log(`  POST /api/plaid/fetchTransactions`);
  console.log(`  GET  /health`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
