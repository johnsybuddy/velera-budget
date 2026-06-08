// Plaid Server URLs (Google Cloud Run endpoints)
const PLAID_SERVER_BASE = 'https://us-central1-johnson-fam-bills.cloudfunctions.net';

// Helper to call Cloud Run functions via HTTP
async function callCloudFunction(functionName, data = {}) {
    try {
        console.log(`Calling ${functionName} at ${PLAID_SERVER_BASE}/${functionName}`);
        
        const response = await fetch(`${PLAID_SERVER_BASE}/${functionName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`HTTP ${response.status}:`, errorBody);
            throw new Error(`HTTP ${response.status}: ${errorBody}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error(`Error calling ${functionName}:`, error);
        throw error;
    }
}

let plaidLinkHandler = null;

/**
 * Initialize Plaid Link
 */
async function initializePlaidLink() {
    try {
        showNotification('Initializing bank connection...', 'info');
        
        console.log('Requesting link token from Firebase...');
        
        // Get link token from Firebase Cloud Function
        const result = await callCloudFunction('createLinkToken', {});
        
        console.log('Link token received:', result);
        const linkToken = result.link_token;
        
        // Initialize Plaid Link
        plaidLinkHandler = Plaid.create({
            token: linkToken,
            onSuccess: async (public_token, metadata) => {
                console.log('Plaid Link success!');
                console.log('public_token:', public_token);
                console.log('public_token type:', typeof public_token);
                console.log('metadata:', JSON.stringify(metadata));
                await handlePlaidSuccess(public_token, metadata);
            },
            onExit: (err, metadata) => {
                if (err) {
                    console.error('Plaid Link error:', err);
                    showNotification('Failed to connect bank account', 'error');
                }
            },
            onEvent: (eventName, metadata) => {
                console.log('Plaid event:', eventName, metadata);
            },
        });
        
        // Open Plaid Link
        plaidLinkHandler.open();
        
    } catch (error) {
        console.error('Error initializing Plaid Link:', error);
        showNotification('Failed to initialize bank connection: ' + error.message, 'error');
    }
}

/**
 * Handle successful Plaid Link connection
 */
async function handlePlaidSuccess(public_token, metadata) {
    try {
        showNotification('Connecting to your bank...', 'info');
        
        console.log('Exchanging public token...', { public_token, metadata });
        
        // Exchange public token for access token via Firebase
        const payload = { 
            public_token: public_token,
            metadata: {
                institution: metadata.institution,
                accounts: metadata.accounts
            }
        };
        const result = await callCloudFunction('exchangePublicToken', payload);
        
        console.log('Exchange result:', result);
        
        if (result.success) {
            showNotification(`Successfully connected ${result.institutionName}!`, 'success');
            
            // Refresh connected accounts list
            await loadConnectedAccounts();
            
            // Automatically fetch transactions
            await syncTransactions();
        }
    } catch (error) {
        console.error('Error exchanging token:', error);
        showNotification('Failed to save bank connection: ' + error.message, 'error');
    }
}

/**
 * Sync transactions from all connected accounts
 */
async function syncTransactions() {
    try {
        showNotification('Syncing transactions...', 'info');
        
        console.log('🔄 Starting Plaid sync...');
        
        const result = await callCloudFunction('fetchTransactions', {
            startDate: getDateDaysAgo(90), // Last 90 days
            endDate: getTodayDateString()
        });
        
        console.log('📥 Fetch result:', result);
        
        if (result.transactions) {
            const plaidTransactions = result.transactions;
            const totalFromPlaid = plaidTransactions.length;
            
            // CLIENT-SIDE DUPLICATE PREVENTION
            // Filter out any transactions that already exist locally
            const newTransactions = [];
            let duplicatesFiltered = 0;
            
            for (const plaidTx of plaidTransactions) {
                const isDuplicate = transactions.some(t => 
                    t.date === plaidTx.date &&
                    (t.source || '').toLowerCase() === (plaidTx.merchant || plaidTx.name || '').toLowerCase() &&
                    Math.abs(t.amount - Math.abs(plaidTx.amount)) < 0.01 &&
                    t.account === ((plaidTx.institutionName || '').includes('Sam') ? 'Sam\'s' : 'RCU')
                );
                
                if (!isDuplicate) {
                    newTransactions.push(plaidTx);
                } else {
                    duplicatesFiltered++;
                }
            }
            
            console.log(`
╔════════════════════════════════════════╗
║   PLAID SYNC - FILTERING STAGE          ║
╠════════════════════════════════════════╣
║ 📤 Transactions from Plaid: ${totalFromPlaid.toString().padEnd(21)} ║
║ ❌ Duplicates filtered out: ${duplicatesFiltered.toString().padEnd(22)} ║
║ ✅ New to import: ${newTransactions.length.toString().padEnd(32)} ║
╚════════════════════════════════════════╝`);
            
            // Import only the new transactions
            if (newTransactions.length > 0) {
                await importPlaidTransactions(newTransactions);
                showNotification(`✅ Synced ${newTransactions.length} new transactions!`, 'success');
            } else {
                showNotification('✅ Sync complete - no new transactions', 'success');
            }
            
            // Refresh the transaction table
            updateTransactionTable();
            updateBudgetFromTransactions();
            updateDashboard();
        }
    } catch (error) {
        console.error('❌ Error syncing transactions:', error);
        showNotification('Failed to sync transactions: ' + error.message, 'error');
    }
}

/**
 * Import Plaid transactions into your existing transaction system
 * WITH TRIPLE-CHECK duplicate prevention
 */
async function importPlaidTransactions(plaidTransactions) {
    let importedCount = 0;
    let skippedCount = 0;
    
    for (const plaidTx of plaidTransactions) {
        // FIRST CHECK: Exact Plaid ID match (server already filtered these, but double-check)
        const plaidIdExists = transactions.some(t => t.plaidId === plaidTx.id);
        if (plaidIdExists) {
            skippedCount++;
            console.log(`DUPLICATE (by Plaid ID): ${plaidTx.id}`);
            continue;
        }
        
        // SECOND CHECK: Match by date + merchant + amount + account
        // This catches any stragglers from manual imports or older data
        const isDuplicate = transactions.some(t => 
            t.date === plaidTx.date &&
            (t.source || '').toLowerCase() === (plaidTx.merchant || plaidTx.name || '').toLowerCase() &&
            Math.abs(t.amount - Math.abs(plaidTx.amount)) < 0.01 && // Allow for rounding
            t.account === ((plaidTx.institutionName || '').includes('Sam') ? 'Sam\'s' : 'RCU')
        );
        
        if (isDuplicate) {
            skippedCount++;
            console.log(`DUPLICATE (by details): ${plaidTx.date} | ${plaidTx.merchant} | $${Math.abs(plaidTx.amount)}`);
            continue;
        }
        
        // THIRD CHECK: Final safety check - look for ANY transaction with same date/amount
        // (broader check in case merchant name varies slightly)
        const fuzzyMatch = transactions.some(t =>
            t.date === plaidTx.date &&
            Math.abs(t.amount - Math.abs(plaidTx.amount)) < 0.01 &&
            t.account === ((plaidTx.institutionName || '').includes('Sam') ? 'Sam\'s' : 'RCU')
        );
        
        if (fuzzyMatch) {
            console.log(`⚠️ POTENTIAL DUPLICATE (fuzzy match, importing anyway): ${plaidTx.date} | $${Math.abs(plaidTx.amount)}`);
            // Log but still import - user can manually review or cleanup
        }
        
        // Map Plaid transaction to your format
        const transaction = {
            date: plaidTx.date,
            source: plaidTx.merchant || plaidTx.name,
            amount: Math.abs(plaidTx.amount), // Plaid uses negative for debits
            bill: categorizePlaidTransaction(plaidTx), // Auto-categorize
            account: (plaidTx.institutionName || '').includes('Sam') ? 'Sam\'s' : 'RCU',
            plaidId: plaidTx.id, // Store Plaid ID to prevent duplicates
            pending: plaidTx.pending,
            category: plaidTx.category
        };
        
        transactions.push(transaction);
        importedCount++;
    }
    
    // Save to Firebase (which also does duplicate removal as a final safety net)
    await saveTransactions();
    
    console.log(`
╔════════════════════════════════════════╗
║   PLAID SYNC SUMMARY                   ║
╠════════════════════════════════════════╣
║ ✅ New transactions imported: ${importedCount.toString().padEnd(18)} ║
║ ⏭️  Duplicates skipped: ${skippedCount.toString().padEnd(25)} ║
║ 📊 Total transactions now: ${transactions.length.toString().padEnd(23)} ║
╚════════════════════════════════════════╝`);
    
    return importedCount;
}

/**
 * Auto-categorize Plaid transactions based on category and merchant
 */
function categorizePlaidTransaction(plaidTx) {
    const category = plaidTx.category?.toLowerCase() || '';
    const merchant = plaidTx.merchant?.toLowerCase() || plaidTx.name?.toLowerCase() || '';
    
    // Use your existing learned patterns first
    for (const pattern in learnedPatterns) {
        if (merchant.includes(pattern.toLowerCase())) {
            return learnedPatterns[pattern];
        }
    }
    
    // Fallback to Plaid category mapping
    if (category.includes('food') || category.includes('restaurant')) {
        if (merchant.includes('grocery') || merchant.includes('walmart') || merchant.includes('target')) {
            return 'Groceries';
        }
        return 'Restaurants/Entertainment';
    }
    
    if (category.includes('gas') || merchant.includes('shell') || merchant.includes('chevron')) {
        return 'Gas';
    }
    
    if (category.includes('mortgage') || merchant.includes('mortgage')) {
        return 'Mortgage + Escrow (Ins-Taxes)';
    }
    
    if (category.includes('auto') && category.includes('payment')) {
        return 'Car Payment';
    }
    
    if (category.includes('utilities')) {
        if (merchant.includes('xcel') || merchant.includes('electric')) return 'Xcel Energy';
        if (merchant.includes('water')) return 'Water';
        if (merchant.includes('garbage') || merchant.includes('waste')) return 'Earthbound Garbage';
        if (merchant.includes('spectrum') || merchant.includes('phone')) return 'Spectrum Phone';
    }
    
    if (category.includes('childcare') || merchant.includes('daycare')) {
        return 'Daycare';
    }
    
    if (category.includes('insurance')) {
        if (merchant.includes('auto')) return 'Auto Insurance';
        if (merchant.includes('aaa')) return 'AAA Roadside Assistance';
        return 'Jewelers Insurance';
    }
    
    // Default to Miscellaneous
    return 'Miscellaneous';
}

/**
 * Load and display connected bank accounts
 */
async function loadConnectedAccounts() {
    try {
        const accountsList = document.getElementById('connectedAccountsList');
        if (!accountsList) return;
        
        // For now, show a simple message since we're using in-memory storage
        // In production, this would load from a database
        accountsList.innerHTML = `
            <div style="padding: 1rem; background: var(--surface-secondary); border-radius: 0.5rem; color: var(--text-secondary);">
                <p>Connected accounts are stored locally on this session.</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem;">
                    For persistent storage, deploy the Plaid server to a production backend or use Firebase Functions.
                </p>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading connected accounts:', error);
    }
}

/**
 * Remove a connected bank account
 */
async function removeConnectedAccount(accountId, institutionName) {
    if (!confirm(`Disconnect ${institutionName}? This will stop syncing transactions from this account.`)) {
        return;
    }
    
    try {
        const removeAccount = firebase.functions().httpsCallable('removeAccount');
        await removeAccount({ accountId });
        
        showNotification(`Disconnected ${institutionName}`, 'success');
        await loadConnectedAccounts();
    } catch (error) {
        console.error('Error removing account:', error);
        showNotification('Failed to disconnect account', 'error');
    }
}

/**
 * Show Bank Connections Modal
 */
function showBankConnectionsModal() {
    const modal = document.getElementById('bankConnectionsModal');
    if (modal) {
        modal.style.display = 'block';
        loadConnectedAccounts();
    }
}

/**
 * Close Bank Connections Modal
 */
function closeBankConnectionsModal() {
    const modal = document.getElementById('bankConnectionsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Helper functions
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

function getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
}

// ============================================
// END PLAID INTEGRATION
// ============================================


/**
 * CLEANUP: Remove duplicate transactions from your existing data
 * Call this once to clean up old duplicates, then future syncs will prevent them
 */
async function removeDuplicateTransactions() {
    if (!transactions || transactions.length === 0) return 0;
    
    console.log('Starting duplicate cleanup...');
    console.log(`Initial transaction count: ${transactions.length}`);
    
    const seen = new Map(); // Map of "date|source|amount|account" -> transaction
    const toKeep = [];
    let duplicatesFound = 0;
    
    for (const tx of transactions) {
        // Create a unique key for this transaction
        const key = `${tx.date}|${(tx.source || '').toLowerCase()}|${tx.amount}|${tx.account || 'RCU'}`;
        
        if (seen.has(key)) {
            // This is a duplicate - skip it
            duplicatesFound++;
            console.log(`Duplicate found and removed: ${key}`);
        } else {
            // First occurrence - keep it
            seen.set(key, tx);
            toKeep.push(tx);
        }
    }
    
    // Replace transactions array with cleaned data
    transactions = toKeep;
    
    // Save to Firebase
    if (duplicatesFound > 0) {
        await saveTransactions();
    }
    
    console.log(`Duplicate Cleanup Summary:
    - Duplicates removed: ${duplicatesFound}
    - Transactions kept: ${transactions.length}
    - Saved to database: ${duplicatesFound > 0 ? 'Yes' : 'No'}`);
    
    showNotification(`✅ Removed ${duplicatesFound} duplicate transactions!`, 'success');
    
    // Refresh UI
    updateTransactionTable();
    updateBudgetFromTransactions();
    updateDashboard();
    
    return duplicatesFound;
}

/**
 * Show option to clean up existing duplicates
 */
function showDuplicateCleanupOption() {
    const result = confirm(
        'Found duplicate transactions in your database.\n\n' +
        'Click OK to remove all duplicates now.\n' +
        'This will clean up your existing data and prevent future duplicates.\n\n' +
        'WARNING: This cannot be undone!'
    );
    
    if (result) {
        removeDuplicateTransactions();
    }
}
