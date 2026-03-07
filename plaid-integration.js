// ============================================
// PLAID BANK INTEGRATION
// ============================================

let plaidLinkHandler = null;

/**
 * Initialize Plaid Link
 */
async function initializePlaidLink() {
    try {
        showNotification('Initializing bank connection...', 'info');
        
        // Get link token from Firebase Function
        const createLinkToken = firebase.functions().httpsCallable('createLinkToken');
        const result = await createLinkToken();
        const linkToken = result.data.link_token;
        
        // Initialize Plaid Link
        plaidLinkHandler = Plaid.create({
            token: linkToken,
            onSuccess: async (public_token, metadata) => {
                console.log('Plaid Link success!', metadata);
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
        
        // Exchange public token for access token
        const exchangeToken = firebase.functions().httpsCallable('exchangePublicToken');
        const result = await exchangeToken({ 
            public_token: public_token,
            metadata: metadata 
        });
        
        if (result.data.success) {
            showNotification(`Successfully connected ${result.data.institutionName}!`, 'success');
            
            // Refresh connected accounts list
            await loadConnectedAccounts();
            
            // Automatically fetch transactions
            await syncTransactions();
        }
    } catch (error) {
        console.error('Error exchanging token:', error);
        showNotification('Failed to save bank connection', 'error');
    }
}

/**
 * Sync transactions from all connected accounts
 */
async function syncTransactions() {
    try {
        showNotification('Syncing transactions...', 'info');
        
        const fetchTransactions = firebase.functions().httpsCallable('fetchTransactions');
        const result = await fetchTransactions({
            startDate: getDateDaysAgo(90), // Last 90 days
            endDate: getTodayDateString()
        });
        
        if (result.data.transactions) {
            // Import transactions into your existing system
            await importPlaidTransactions(result.data.transactions);
            showNotification(`Synced ${result.data.count} transactions!`, 'success');
            
            // Refresh the transaction table
            updateTransactionTable();
            updateBudgetFromTransactions();
            updateDashboard();
        }
    } catch (error) {
        console.error('Error syncing transactions:', error);
        showNotification('Failed to sync transactions', 'error');
    }
}

/**
 * Import Plaid transactions into your existing transaction system
 */
async function importPlaidTransactions(plaidTransactions) {
    let importedCount = 0;
    
    for (const plaidTx of plaidTransactions) {
        // Check if transaction already exists
        const exists = transactions.some(t => t.plaidId === plaidTx.id);
        if (exists) continue;
        
        // Map Plaid transaction to your format
        const transaction = {
            date: plaidTx.date,
            source: plaidTx.merchant || plaidTx.name,
            amount: Math.abs(plaidTx.amount), // Plaid uses negative for debits
            bill: categorizePlaidTransaction(plaidTx), // Auto-categorize
            account: plaidTx.institutionName.includes('Sam') ? 'Sam\'s' : 'RCU',
            plaidId: plaidTx.id, // Store Plaid ID to prevent duplicates
            pending: plaidTx.pending,
            category: plaidTx.category
        };
        
        transactions.push(transaction);
        importedCount++;
    }
    
    // Save to Firebase
    await saveTransactions();
    
    console.log(`Imported ${importedCount} new transactions`);
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
        // Load accounts directly from Firestore
        const accountsSnapshot = await db.collection('users').doc(userId).collection('plaidAccounts').get();
        
        const accountsList = document.getElementById('connectedAccountsList');
        if (!accountsList) return;
        
        if (accountsSnapshot.empty) {
            accountsList.innerHTML = '<p style="color: var(--text-secondary);">No accounts connected</p>';
            return;
        }
        
        const accounts = accountsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        accountsList.innerHTML = accounts.map(account => `
            <div class="connected-account-item">
                <div class="account-info">
                    <strong>${account.institutionName}</strong>
                    <span style="font-size: 0.875rem; color: var(--text-secondary);">
                        ${account.accounts ? account.accounts.length : 0} account(s) connected
                    </span>
                </div>
                <button class="btn-danger" onclick="removeConnectedAccount('${account.id}', '${account.institutionName}')">
                    Disconnect
                </button>
            </div>
        `).join('');
        
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
