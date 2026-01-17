console.log('=== SCRIPT.JS LOADED - VERSION 20250112 ===');

// Tab functionality
function showTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to clicked button
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Find and activate the correct tab button
        const tabBtn = Array.from(tabButtons).find(btn => btn.onclick.toString().includes(tabName));
        if (tabBtn) tabBtn.classList.add('active');
    }
    
    // Save current tab
    localStorage.setItem('currentTab', tabName);
}

// Periodic Bills Configuration
// frequency: 'monthly', 'quarterly', 'semi-annual', 'annual'
// monthsInCycle: how many months between payments
// dueMonth: 1-12 for the month the bill is due (for annual/semi-annual)
const periodicBillsConfig = {
    'Auto Insurance': { frequency: 'semi-annual', monthsInCycle: 6, totalAmount: 750, dueMonth: 8 },  // Aug 26
    'AAA Roadside Assistance': { frequency: 'annual', monthsInCycle: 12, totalAmount: 180, dueMonth: 5 },  // May 26
    'Jewelers Insurance': { frequency: 'annual', monthsInCycle: 12, totalAmount: 84 },
    'Earthbound Garbage': { frequency: 'quarterly', monthsInCycle: 3, totalAmount: 294, dueMonth: 1 },  // Jan 26
    'Water': { frequency: 'quarterly', monthsInCycle: 3, totalAmount: 210, dueMonth: 1 },  // Jan 26
    'YMCA Membership': { frequency: 'annual', monthsInCycle: 12, totalAmount: 420, dueMonth: 12 }  // Dec 26
};

// Bucket balances for periodic bills (accumulated savings toward next payment)
let periodicBuckets = {};

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCnpK-aY7cQdkW1MoloTHJD-GJSSswJXxE",
    authDomain: "johnson-fam-bills.firebaseapp.com",
    projectId: "johnson-fam-bills",
    storageBucket: "johnson-fam-bills.firebasestorage.app",
    messagingSenderId: "859356967572",
    appId: "1:859356967572:web:db2f34908247872ed2ba81",
    measurementId: "G-GCBWCYHHE4"
};

// Initialize Firebase
let db = null;
let isFirebaseEnabled = false;

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        isFirebaseEnabled = true;
        console.log('Firebase initialized successfully');
        
        // Set up offline persistence
        db.enablePersistence().catch((err) => {
            console.log('Persistence failed:', err);
        });
    }
} catch (error) {
    console.log('Firebase not available, using localStorage:', error);
    isFirebaseEnabled = false;
}

// User ID for data isolation
const userId = 'johnsybuddy'; // Your username

// Store transactions
let transactions = [
    { date: '2025-10-15', source: 'Target', amount: 125.50, bill: 'Groceries' },
    { date: '2025-09-20', source: 'Walmart', amount: 89.75, bill: 'Gas' }
];

// Enhanced cloud storage functions
async function saveTransactions() {
    if (isFirebaseEnabled) {
        try {
            await db.collection('users').doc(userId).set({
                transactions: transactions,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('Transactions saved to cloud');
        } catch (error) {
            console.error('Error saving to cloud:', error);
            // Fallback to localStorage
            localStorage.setItem('billsTransactions', JSON.stringify(transactions));
        }
    } else {
        // Fallback to localStorage
        localStorage.setItem('billsTransactions', JSON.stringify(transactions));
    }
}

async function loadTransactions() {
    if (isFirebaseEnabled) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists && doc.data().transactions) {
                transactions = doc.data().transactions;
                console.log('Transactions loaded from cloud:', transactions.length);
                return;
            }
        } catch (error) {
            console.error('Error loading from cloud:', error);
        }
    }
    
    // Fallback to localStorage
    const saved = localStorage.getItem('billsTransactions');
    if (saved) {
        transactions = JSON.parse(saved);
        console.log('Transactions loaded from localStorage:', transactions.length);
    }
}

async function saveMonthlyBudgets() {
    if (isFirebaseEnabled) {
        try {
            await db.collection('users').doc(userId).set({
                monthlyBudgets: monthlyBudgets,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('Monthly budgets saved to cloud');
        } catch (error) {
            console.error('Error saving budgets to cloud:', error);
            localStorage.setItem('monthlyBudgets', JSON.stringify(monthlyBudgets));
        }
    } else {
        localStorage.setItem('monthlyBudgets', JSON.stringify(monthlyBudgets));
    }
}

async function loadMonthlyBudgets() {
    if (isFirebaseEnabled) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists && doc.data().monthlyBudgets) {
                monthlyBudgets = doc.data().monthlyBudgets;
                console.log('Monthly budgets loaded from cloud');
            }
            if (doc.exists && doc.data().periodicBuckets) {
                periodicBuckets = doc.data().periodicBuckets;
                console.log('Periodic buckets loaded from cloud');
            }
        } catch (error) {
            console.error('Error loading budgets from cloud:', error);
        }
    }
    
    // Fallback to localStorage
    if (Object.keys(monthlyBudgets).every(k => Object.keys(monthlyBudgets[k]).length === 0)) {
        const saved = localStorage.getItem('monthlyBudgets');
        if (saved) {
            monthlyBudgets = JSON.parse(saved);
        }
    }
    
    const savedBuckets = localStorage.getItem('periodicBuckets');
    if (savedBuckets && Object.keys(periodicBuckets).length === 0) {
        periodicBuckets = JSON.parse(savedBuckets);
    }
}

async function savePeriodicBuckets() {
    if (isFirebaseEnabled) {
        try {
            await db.collection('users').doc(userId).set({
                periodicBuckets: periodicBuckets,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('Periodic buckets saved to cloud');
        } catch (error) {
            console.error('Error saving buckets to cloud:', error);
            localStorage.setItem('periodicBuckets', JSON.stringify(periodicBuckets));
        }
    } else {
        localStorage.setItem('periodicBuckets', JSON.stringify(periodicBuckets));
    }
}

// Calculate total reserved in periodic buckets (not real surplus yet)
function getTotalPeriodicBuckets() {
    let total = 0;
    for (const billName in periodicBuckets) {
        total += periodicBuckets[billName] || 0;
    }
    return total;
}

// Check if a bill is periodic
function isPeriodicBill(billName) {
    return periodicBillsConfig.hasOwnProperty(billName);
}

// Get monthly budget amount for a periodic bill
function getPeriodicMonthlyBudget(billName) {
    const config = periodicBillsConfig[billName];
    if (config) {
        return config.totalAmount / config.monthsInCycle;
    }
    return 0;
}

// Calculate periodic buckets based on all transactions
function calculatePeriodicBuckets() {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthNumbers = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonthIndex = currentDate.getMonth(); // 0-11
    
    // Reset buckets
    periodicBuckets = {};
    
    // For each periodic bill, calculate bucket balance
    for (const billName in periodicBillsConfig) {
        const config = periodicBillsConfig[billName];
        const monthlyBudget = config.totalAmount / config.monthsInCycle;
        
        let bucketBalance = 0;
        
        // Go through each month up to current month
        for (let i = 0; i <= currentMonthIndex; i++) {
            const month = months[i];
            const monthNum = monthNumbers[month];
            
            // Add monthly budget to bucket
            bucketBalance += monthlyBudget;
            
            // Check if there was a payment this month
            const monthPayments = transactions.filter(t => {
                const tDate = new Date(t.date);
                const tMonth = String(tDate.getMonth() + 1).padStart(2, '0');
                const tYear = tDate.getFullYear();
                return t.bill === billName && tMonth === monthNum && tYear === currentYear;
            });
            
            // Subtract payments from bucket
            monthPayments.forEach(payment => {
                bucketBalance -= payment.amount;
            });
        }
        
        // Store bucket balance (only if positive - negative means overpaid which is real surplus)
        periodicBuckets[billName] = Math.max(0, bucketBalance);
        
        console.log(`Periodic bucket for ${billName}: $${periodicBuckets[billName].toFixed(2)} (monthly budget: $${monthlyBudget.toFixed(2)})`);
    }
    
    // Save buckets
    savePeriodicBuckets();
    
    return periodicBuckets;
}

// Calculate budget totals from transactions for current month
function updateBudgetFromTransactions() {
    console.log('=== updateBudgetFromTransactions called ===');
    console.log('Current month:', currentMonth);
    console.log('Total transactions:', transactions.length);
    
    // Show ALL transactions to debug
    console.log('ALL transactions:', transactions);
    
    // Show first few transactions to debug date format
    if (transactions.length > 0) {
        console.log('Sample transactions:', transactions.slice(0, 5));
    } else {
        console.log('NO TRANSACTIONS FOUND!');
    }
    
    // Reset all actual amounts
    const actualSpans = document.querySelectorAll('.actual-amount');
    console.log('Found actual spans:', actualSpans.length);
    actualSpans.forEach(span => {
        span.textContent = '$0.00';
    });
    
    // Get current month's transactions only (excluding ignored transactions)
    const monthNumbers = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    
    const currentMonthNumber = monthNumbers[currentMonth];
    const currentMonthTransactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        const transactionMonth = String(transactionDate.getMonth() + 1).padStart(2, '0');
        const transactionYear = transactionDate.getFullYear();
        
        // Debug each transaction
        console.log(`Transaction: ${transaction.date} -> Month: ${transactionMonth}, Year: ${transactionYear}, Bill: ${transaction.bill}`);
        
        return transactionMonth === currentMonthNumber && transactionYear === 2025 && transaction.bill !== 'Ignore/Internal Transfer';
    });
    
    console.log(`Current month: ${currentMonth} (${currentMonthNumber})`);
    console.log(`Total transactions: ${transactions.length}`);
    console.log(`Current month transactions: ${currentMonthTransactions.length}`);
    console.log('Current month transactions:', currentMonthTransactions);
    
    // Calculate totals by bill for current month only
    const billTotals = {};
    currentMonthTransactions.forEach(transaction => {
        if (!billTotals[transaction.bill]) {
            billTotals[transaction.bill] = 0;
        }
        billTotals[transaction.bill] += transaction.amount;
    });
    
    // Bills that should show positive credit when under budget
    const positiveCreditBills = [
        'Gas', 'Groceries', 'Restaurants/Entertainment', 'Cat Food',
        "Dylan's Medication", "Dylan's School Lunches", 'Roku / Disney Subscriptions',
        'Miscellaneous', 'Emergency Fund', 'Travel Spending', 'Dylan Investment', 'Brooks Investment',
        'Miscellaneous Erik', 'Miscellaneous Sara'
    ];
    
    // Update actual amounts and over/under
    let totalActual = 0;
    let extraPaidAmount = (billTotals['Extra Paid Erik'] || 0) + (billTotals['Erik Paid Sara'] || 0);
    const rows = document.querySelectorAll('.budget-table tbody tr:not(.separator)');
    
    rows.forEach(row => {
        // Column indices: 0=Bill, 1=Due Date, 2=Monthly Expense, 3=Actual, 4=Over/Under
        const budgetCell = row.cells[2];
        const actualSpan = row.cells[3]?.querySelector('.actual-amount');
        const overUnderCell = row.cells[4];
        
        if (budgetCell && actualSpan && overUnderCell) {
            const billName = actualSpan.getAttribute('data-bill');
            const budget = parseFloat(budgetCell.textContent.replace(/[$,]/g, '')) || 0;
            const actual = billTotals[billName] || 0;
            
            totalActual += actual;
            actualSpan.textContent = `$${actual.toFixed(2)}`;
            
            // Remove clickable styling if amount is no longer $0.00
            if (actual === 0) {
                actualSpan.classList.add('clickable-zero');
                actualSpan.onclick = () => promptMarkPaid(billName);
            } else {
                actualSpan.classList.remove('clickable-zero');
                actualSpan.onclick = null;
                actualSpan.style.cursor = 'default';
            }
            
            if (billName === 'Extra Paid Erik' || billName === 'Erik Paid Sara') {
                // Extra Paid categories are always positive
                overUnderCell.textContent = `$${actual.toFixed(2)}`;
                overUnderCell.style.color = 'var(--success)';
            } else {
                let difference = actual - budget;
                
                // For positive credit bills, show surplus as positive
                if (positiveCreditBills.includes(billName)) {
                    difference = budget - actual; // Flip the calculation
                }
                
                // Apply extra paid adjustment
                if (extraPaidAmount > 0) {
                    difference += extraPaidAmount;
                }
                
                overUnderCell.textContent = `$${difference.toFixed(2)}`;
                overUnderCell.style.color = difference >= 0 ? 'var(--success)' : 'var(--danger)';
            }
        }
    });
    
    // Calculate total over/under by summing individual bill over/under amounts
    let totalOverUnder = 0;
    rows.forEach(row => {
        // Column 4 is Over/Under (after Due Date column was added)
        const overUnderCell = row.cells[4];
        if (overUnderCell && overUnderCell.textContent.includes('$')) {
            const overUnderValue = parseFloat(overUnderCell.textContent.replace(/[$,]/g, '')) || 0;
            totalOverUnder += overUnderValue;
        }
    });
    
    // Update totals
    document.getElementById('totalActual').textContent = `$${totalActual.toFixed(2)}`;
    document.getElementById('totalOverUnder').textContent = `$${totalOverUnder.toFixed(2)}`;
    document.getElementById('totalOverUnder').style.color = totalOverUnder >= 0 ? 'var(--success)' : 'var(--danger)';
}

// CSV Import functionality
let csvData = [];

function showImportCSV() {
    document.getElementById('importCSVModal').style.display = 'block';
}

function closeImportCSV() {
    document.getElementById('importCSVModal').style.display = 'none';
    document.getElementById('csvFileInput').value = '';
    document.getElementById('csvPreview').innerHTML = '';
    document.getElementById('confirmImport').disabled = true;
    csvData = [];
}

function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const csv = e.target.result;
        parseCSV(csv);
    };
    reader.readAsText(file);
}

function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        showNotification('CSV must have at least a header and one data row', 'error');
        return;
    }
    
    // Parse headers more carefully - handle quoted headers
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    console.log('Raw header line:', headerLine);
    console.log('Parsed headers:', headers);
    
    csvData = [];
    
    // Detect bank type and column mapping
    const bankConfig = detectBankType(headers);
    if (!bankConfig) {
        showNotification('Could not identify bank format. Please check that your CSV has Date, Description, and Amount columns. Supported: Chase, Wells Fargo, Bank of America, Capital One, or Generic CSV', 'error');
        console.log('Available headers:', headers);
        return;
    }
    
    showNotification(`Detected ${bankConfig.name} format`);
    console.log('Bank config:', bankConfig);
    
    // Parse data rows
    for (let i = 1; i < Math.min(lines.length, 101); i++) { // Preview first 100 rows
        const line = lines[i].trim();
        if (!line) continue;
        
        // Handle quoted CSV values better
        const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        console.log(`Row ${i}:`, cols);
        
        if (cols.length >= 3) {
            const transaction = parseTransaction(cols, bankConfig);
            if (transaction && !isDuplicate(transaction)) {
                console.log('Parsed transaction:', transaction);
                csvData.push(transaction);
            } else if (transaction) {
                console.log('Duplicate transaction skipped:', transaction);
            }
        }
    }
    
    console.log('Total parsed transactions:', csvData.length);
    displayCSVPreview();
}

function detectBankType(headers) {
    const headerStr = headers.join('|').toLowerCase();
    console.log('CSV Headers detected:', headers);
    console.log('Header string:', headerStr);
    
    // Chase Bank
    if (headerStr.includes('transaction date') && headerStr.includes('description') && headerStr.includes('amount')) {
        return {
            name: 'Chase Bank',
            dateCol: headers.findIndex(h => /transaction date/i.test(h)),
            descCol: headers.findIndex(h => /description/i.test(h)),
            amountCol: headers.findIndex(h => /^amount$/i.test(h)),
            typeCol: headers.findIndex(h => /type/i.test(h))
        };
    }
    
    // Wells Fargo
    if (headerStr.includes('date') && headerStr.includes('description') && headerStr.includes('amount')) {
        return {
            name: 'Wells Fargo',
            dateCol: headers.findIndex(h => /^date$/i.test(h)),
            descCol: headers.findIndex(h => /description/i.test(h)),
            amountCol: headers.findIndex(h => /amount/i.test(h))
        };
    }
    
    // Bank of America
    if (headerStr.includes('posted date') && headerStr.includes('payee') && headerStr.includes('amount')) {
        return {
            name: 'Bank of America',
            dateCol: headers.findIndex(h => /posted date/i.test(h)),
            descCol: headers.findIndex(h => /payee/i.test(h)),
            amountCol: headers.findIndex(h => /amount/i.test(h))
        };
    }
    
    // Capital One
    if (headerStr.includes('transaction date') && headerStr.includes('description') && headerStr.includes('debit')) {
        return {
            name: 'Capital One',
            dateCol: headers.findIndex(h => /transaction date/i.test(h)),
            descCol: headers.findIndex(h => /description/i.test(h)),
            debitCol: headers.findIndex(h => /debit/i.test(h)),
            creditCol: headers.findIndex(h => /credit/i.test(h))
        };
    }
    
    // Enhanced Generic fallback with better pattern matching
    const dateCol = headers.findIndex(h => /date/i.test(h));
    const descCol = headers.findIndex(h => /desc|description|name|merchant|store|payee|vendor/i.test(h));
    const amountCol = headers.findIndex(h => /amount|total|sum|debit|credit/i.test(h));
    
    console.log('Generic detection - Date col:', dateCol, 'Desc col:', descCol, 'Amount col:', amountCol);
    
    if (dateCol !== -1 && descCol !== -1 && amountCol !== -1) {
        return {
            name: 'Generic CSV',
            dateCol,
            descCol,
            amountCol
        };
    }
    
    return null;
}

function parseTransaction(cols, config) {
    let dateStr, desc, amount;
    
    // Extract date
    dateStr = cols[config.dateCol];
    if (!dateStr) return null;
    
    // Extract description
    desc = cols[config.descCol];
    if (!desc) return null;
    
    // Extract amount based on bank format
    if (config.debitCol !== undefined && config.creditCol !== undefined) {
        // Capital One format (separate debit/credit columns)
        const debit = parseFloat(cols[config.debitCol]?.replace(/[$,]/g, '')) || 0;
        const credit = parseFloat(cols[config.creditCol]?.replace(/[$,]/g, '')) || 0;
        amount = debit > 0 ? debit : credit;
    } else {
        // Single amount column
        const amountStr = cols[config.amountCol];
        amount = Math.abs(parseFloat(amountStr?.replace(/[$,]/g, '')) || 0);
    }
    
    if (amount === 0) return null;
    
    // Parse and normalize date
    const date = normalizeDate(dateStr);
    if (!date) return null;
    
    // Auto-categorize transaction
    const category = autoCategorizeBill(desc);
    
    return {
        date,
        source: cleanDescription(desc),
        amount,
        bill: category,
        account: config.name
    };
}

function normalizeDate(dateStr) {
    // Handle various date formats: MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD
    let date;
    
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // Assume MM/DD/YYYY
            const month = parts[0].padStart(2, '0');
            const day = parts[1].padStart(2, '0');
            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            date = `${year}-${month}-${day}`;
        }
    } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                // YYYY-MM-DD format
                date = dateStr;
            } else {
                // MM-DD-YYYY format
                const month = parts[0].padStart(2, '0');
                const day = parts[1].padStart(2, '0');
                const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                date = `${year}-${month}-${day}`;
            }
        }
    }
    
    // Validate date
    if (date && !isNaN(Date.parse(date))) {
        return date;
    }
    
    return null;
}

function cleanDescription(desc) {
    // Remove common bank codes and clean up description
    return desc
        .replace(/\s+/g, ' ')
        .replace(/^(DEBIT|CREDIT|ACH|POS|ATM)\s+/i, '')
        .replace(/\s+\d{4}$/, '') // Remove trailing card numbers
        .trim();
}

function autoCategorizeBill(description) {
    const desc = description.toLowerCase();
    console.log('Categorizing:', desc);
    
    // Check for internal transfers first
    if (desc.includes('transfer') || desc.includes('internal') || desc.includes('deposit') ||
        desc.includes('withdrawal') || desc.includes('payment to') || desc.includes('payment from') ||
        desc.includes('ach credit') || desc.includes('ach debit') || desc.includes('direct deposit')) {
        return 'Ignore/Internal Transfer';
    }
    
    // Mortgage and Housing
    if (desc.includes('mortgage') || desc.includes('loan') || desc.includes('escrow') ||
        desc.includes('home loan') || desc.includes('property tax')) {
        return 'Mortgage + Escrow (Ins-Taxes)';
    }
    
    // Car Payment
    if (desc.includes('auto loan') || desc.includes('car payment') || desc.includes('vehicle') ||
        desc.includes('car loan') || desc.includes('auto finance')) {
        return 'Car Payment';
    }
    
    // Insurance
    if (desc.includes('insurance') && !desc.includes('health')) {
        if (desc.includes('auto') || desc.includes('car') || desc.includes('vehicle')) {
            return 'Auto Insurance';
        }
        if (desc.includes('aaa') || desc.includes('roadside')) {
            return 'AAA Roadside Assistance';
        }
        return 'Jewelers Insurance';
    }
    
    // Utilities
    if (desc.includes('xcel') || desc.includes('excel energy') || desc.includes('electric') ||
        desc.includes('power company') || desc.includes('utility')) {
        return 'Xcel Energy';
    }
    if (desc.includes('spectrum') || desc.includes('charter') || desc.includes('internet') ||
        desc.includes('cable') || desc.includes('phone service')) {
        return 'Spectrum Phone';
    }
    if (desc.includes('water') || desc.includes('sewer') || desc.includes('water dept')) {
        return 'Water';
    }
    if (desc.includes('garbage') || desc.includes('waste') || desc.includes('earthbound') ||
        desc.includes('trash') || desc.includes('recycling')) {
        return 'Earthbound Garbage';
    }
    
    // Gas Stations - Enhanced list
    if (desc.includes('shell') || desc.includes('exxon') || desc.includes('bp ') || 
        desc.includes('chevron') || desc.includes('mobil') || desc.includes('conoco') ||
        desc.includes('phillips 66') || desc.includes('speedway') || desc.includes('casey') ||
        desc.includes('kwik trip') || desc.includes('holiday') || desc.includes('sinclair') ||
        desc.includes('valero') || desc.includes('marathon') || desc.includes('citgo') ||
        desc.includes('gas station') || desc.includes('fuel') || desc.includes('petro')) {
        return 'Gas';
    }
    
    // Groceries - Enhanced list
    if (desc.includes('walmart') || desc.includes('target') || desc.includes('hy-vee') ||
        desc.includes('kroger') || desc.includes('safeway') || desc.includes('costco') ||
        desc.includes('sams club') || desc.includes('aldi') || desc.includes('whole foods') ||
        desc.includes('trader joe') || desc.includes('grocery') || desc.includes('supermarket') ||
        desc.includes('food store') || desc.includes('market') || desc.includes('king soopers') ||
        desc.includes('city market') || desc.includes('sprouts')) {
        return 'Groceries';
    }
    
    // Restaurants - Enhanced list
    if (desc.includes('restaurant') || desc.includes('mcdonald') || desc.includes('burger') ||
        desc.includes('pizza') || desc.includes('taco') || desc.includes('subway') ||
        desc.includes('starbucks') || desc.includes('coffee') || desc.includes('cafe') ||
        desc.includes('dine') || desc.includes('grill') || desc.includes('bar ') ||
        desc.includes('kfc') || desc.includes('wendy') || desc.includes('chipotle') ||
        desc.includes('panera') || desc.includes('domino') || desc.includes('papa') ||
        desc.includes('dunkin') || desc.includes('sonic') || desc.includes('arbys') ||
        desc.includes('dairy queen') || desc.includes('chick-fil-a') || desc.includes('applebee') ||
        desc.includes('olive garden') || desc.includes('red lobster') || desc.includes('outback')) {
        return 'Restaurants/Entertainment';
    }
    
    // Daycare
    if (desc.includes('daycare') || desc.includes('childcare') || desc.includes('preschool') ||
        desc.includes('child care') || desc.includes('nursery') || desc.includes('learning center')) {
        return 'Daycare';
    }
    
    // YMCA
    if (desc.includes('ymca') || desc.includes('gym') || desc.includes('fitness') ||
        desc.includes('recreation center') || desc.includes('health club')) {
        return 'YMCA Membership';
    }
    
    // Subscriptions
    if (desc.includes('roku') || desc.includes('disney') || desc.includes('netflix') ||
        desc.includes('hulu') || desc.includes('amazon prime') || desc.includes('spotify') ||
        desc.includes('streaming') || desc.includes('subscription')) {
        return 'Roku / Disney Subscriptions';
    }
    
    // Pharmacy/Medical
    if (desc.includes('pharmacy') || desc.includes('cvs') || desc.includes('walgreens') ||
        desc.includes('medical') || desc.includes('doctor') || desc.includes('clinic') ||
        desc.includes('hospital') || desc.includes('health') || desc.includes('prescription') ||
        desc.includes('medicine') || desc.includes('drug store')) {
        return "Dylan's Medication";
    }
    
    // School related
    if (desc.includes('school') || desc.includes('lunch') || desc.includes('cafeteria') ||
        desc.includes('student') || desc.includes('education')) {
        return "Dylan's School Lunches";
    }
    
    // Pet supplies
    if (desc.includes('pet') || desc.includes('cat') || desc.includes('dog') || desc.includes('animal') ||
        desc.includes('veterinary') || desc.includes('vet') || desc.includes('petco') || desc.includes('petsmart')) {
        return 'Cat Food';
    }
    
    // Charity
    if (desc.includes('charity') || desc.includes('donation') || desc.includes('church') ||
        desc.includes('tithe') || desc.includes('offering') || desc.includes('nonprofit')) {
        return 'Charity';
    }
    
    console.log('No category match found, defaulting to Miscellaneous');
    // Default to Miscellaneous
    return 'Miscellaneous';
}

function isDuplicate(newTransaction) {
    return transactions.some(existing => 
        existing.date === newTransaction.date &&
        existing.source === newTransaction.source &&
        Math.abs(existing.amount - newTransaction.amount) < 0.01
    );
}

function displayCSVPreview() {
    const preview = document.getElementById('csvPreview');
    if (csvData.length === 0) {
        preview.innerHTML = '<p>No valid transactions found</p>';
        return;
    }
    
    // Count duplicates and new transactions
    const duplicates = csvData.filter(t => isDuplicate(t)).length;
    const newTransactions = csvData.length - duplicates;
    
    let html = `
        <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--neutral-100); border-radius: 8px;">
            <strong>Import Summary:</strong><br>
            📊 Total transactions: ${csvData.length}<br>
            ✅ New transactions: ${newTransactions}<br>
            ⚠️ Duplicates (will be skipped): ${duplicates}
        </div>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Category</th>
                    <th>Account</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    csvData.forEach(row => {
        const formattedDate = new Date(row.date).toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
        });
        const isDupe = isDuplicate(row);
        const rowClass = isDupe ? 'style="opacity: 0.5; background: #fef2f2;"' : '';
        const status = isDupe ? '🔄 Duplicate' : '✅ New';
        
        html += `
            <tr ${rowClass}>
                <td>${formattedDate}</td>
                <td>${row.source}</td>
                <td>$${row.amount.toFixed(2)}</td>
                <td>${row.bill}</td>
                <td>${row.account}</td>
                <td>${status}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    preview.innerHTML = html;
    document.getElementById('confirmImport').disabled = newTransactions === 0;
    
    if (newTransactions === 0) {
        showNotification('All transactions are duplicates - nothing to import', 'warning');
    }
}

function confirmCSVImport() {
    if (csvData.length === 0) return;
    
    // Filter out duplicates
    const newTransactions = csvData.filter(t => !isDuplicate(t));
    
    if (newTransactions.length === 0) {
        showNotification('No new transactions to import', 'warning');
        return;
    }
    
    // Add only new transactions
    transactions.push(...newTransactions);
    saveTransactions();
    
    // Update displays
    updateTransactionTable();
    updateBudgetFromTransactions();
    updateDashboard();
    closeImportCSV();
    
    showNotification(`🎉 Imported ${newTransactions.length} new transactions successfully!`);
}

// Monthly budget management
let currentMonth = 'jan';
let monthlyBudgets = {
    jan: {}, feb: {}, mar: {}, apr: {}, may: {}, jun: {},
    jul: {}, aug: {}, sep: {}, oct: {}, nov: {}, dec: {}
};

function showMonth(month) {
    currentMonth = month;
    
    // Show budget content and hide family expense content
    document.querySelector('.budget-table-container').style.display = 'block';
    document.getElementById('familyExpenseContent').style.display = 'none';
    document.getElementById('currentMonthTitle').style.display = 'block';
    document.querySelector('.add-transaction').style.display = 'flex';
    
    // Update active tab
    document.querySelectorAll('.month-tab').forEach(tab => tab.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Find and activate the correct month tab
        const monthTab = document.querySelector(`[onclick="showMonth('${month}')"]`);
        if (monthTab) monthTab.classList.add('active');
    }
    
    // Update title
    const monthNames = {
        jan: 'January', feb: 'February', mar: 'March', apr: 'April',
        may: 'May', jun: 'June', jul: 'July', aug: 'August',
        sep: 'September', oct: 'October', nov: 'November', dec: 'December'
    };
    const currentDate = new Date();
    document.getElementById('currentMonthTitle').textContent = `${monthNames[month]} ${currentDate.getFullYear()} Budget`;
    
    // Save current month
    localStorage.setItem('currentMonth', month);
    
    // Load month's budget data
    loadMonthBudget(month);
    updateBudgetFromTransactions();
}

function loadMonthBudget(month) {
    // Update the table cells with saved budget values
    const defaultBudgets = {
        'Mortgage + Escrow (Ins-Taxes)': 2272.00,
        'Car Payment': 453.00,
        'Auto Insurance': 125.00,
        'AAA Roadside Assistance': 15.00,
        'Gas': 150.00,
        'Jewelers Insurance': 7.00,
        'Earthbound Garbage': 98.00,
        'Water': 70.00,
        'Xcel Energy': 285.00,
        'Spectrum Phone': 116.00,
        'YMCA Membership': 35.00,
        'Charity': 50.00,
        'Daycare': 1100.00,
        'Groceries': 850.00,
        'Restaurants/Entertainment': 300.00,
        'Cat Food': 20.00,
        "Dylan's Medication": 90.00,
        "Dylan's School Lunches": 50.00,
        'Roku / Disney Subscriptions': 25.00,
        'Miscellaneous': 50.00,
        'Emergency Fund': 225.00,
        'Travel Spending': 100.00,
        'Dylan Investment': 35.00,
        'Brooks Investment': 25.00,
        'Extra Paid': 0.00
    };
    
    // Get all budget table rows
    const rows = document.querySelectorAll('.budget-table tbody tr');
    
    rows.forEach(row => {
        const billNameCell = row.cells[0];
        if (!billNameCell) return;
        
        const billName = billNameCell.textContent.trim();
        
        // Skip separator rows
        if (row.classList.contains('separator')) return;
        
        // Get saved value or default
        const savedValue = monthlyBudgets[month] && monthlyBudgets[month][billName];
        const displayValue = savedValue !== undefined ? savedValue : defaultBudgets[billName];
        
        if (displayValue !== undefined) {
            // Update the Monthly Expense cell (column 2, after Due Date column)
            if (row.cells[2]) {
                row.cells[2].textContent = `$${displayValue.toFixed(2)}`;
            }
            
            // Update the Edit button onclick with new value
            const editBtn = row.querySelector('.btn-edit');
            if (editBtn) {
                editBtn.setAttribute('onclick', `editBill('${billName.replace(/'/g, "\\'")}', ${displayValue})`);
            }
        }
    });
}

function updateBudget() {
    // Save current month's budget values
    const budgetInputs = document.querySelectorAll('.budget-input');
    const billNames = [
        'Mortgage + Escrow (Ins-Taxes)', 'Car Payment', 'Auto Insurance', 'AAA Roadside Assistance',
        'Gas', 'Jewelers Insurance', 'Earthbound Garbage', 'Water', 'Xcel Energy', 'Spectrum Phone',
        'YMCA Membership', 'Charity', 'Daycare', 'Groceries', 'Restaurants/Entertainment', 'Cat Food',
        "Dylan's Medication", "Dylan's School Lunches", 'Roku / Disney Subscriptions', 'Miscellaneous',
        'Emergency Fund', 'Travel Spending', 'Dylan Investment', 'Brooks Investment', 
        'Extra Paid Erik', 'Erik Paid Sara', 'Miscellaneous Erik', 'Miscellaneous Sara'
    ];
    
    budgetInputs.forEach((input, index) => {
        monthlyBudgets[currentMonth][billNames[index]] = parseFloat(input.value) || 0;
    });
    
    // Save to localStorage
    localStorage.setItem('monthlyBudgets', JSON.stringify(monthlyBudgets));
    
    updateBudgetFromTransactions();
    showNotification('Budget updated successfully!');
}

function quickPay(billName) {
    const budgetInput = Array.from(document.querySelectorAll('.budget-input')).find(input => {
        const row = input.closest('tr');
        return row.cells[0].textContent.trim() === billName;
    });
    
    if (budgetInput) {
        const amount = parseFloat(budgetInput.value) || 0;
        const monthNames = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        
        const today = new Date();
        const transactionDate = `2025-${monthNames[currentMonth]}-${String(today.getDate()).padStart(2, '0')}`;
        
        // Add transaction
        transactions.push({
            date: transactionDate,
            source: 'Quick Pay',
            amount: amount,
            bill: billName
        });
        saveTransactions();
        
        // Update displays
        updateTransactionTable();
        updateBudgetFromTransactions();
        updateDashboard();
        
        showNotification(`Quick paid $${amount.toFixed(2)} for ${billName}`);
    }
}

function promptMarkPaid(billName) {
    // Only show prompt if actual amount is $0.00
    const actualSpan = document.querySelector(`[data-bill="${billName}"]`);
    if (actualSpan && actualSpan.textContent === '$0.00') {
        // Find the budget amount for this bill
        const row = Array.from(document.querySelectorAll('.budget-table tbody tr')).find(row => {
            return row.cells[0] && row.cells[0].textContent.trim() === billName;
        });
        
        // Column 2 is Monthly Expense (after Due Date column)
        if (row && row.cells[2]) {
            const budgetText = row.cells[2].textContent.replace(/[$,]/g, '');
            const amount = parseFloat(budgetText) || 0;
            
            if (amount > 0 && confirm(`Mark ${billName} as paid for $${amount.toFixed(2)}?`)) {
                const monthNames = {
                    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
                };
                
                const today = new Date();
                const year = today.getFullYear();
                const transactionDate = `${year}-${monthNames[currentMonth]}-${String(today.getDate()).padStart(2, '0')}`;
                
                // Add transaction with budget amount
                transactions.push({
                    date: transactionDate,
                    source: 'Mark Paid',
                    amount: amount,
                    bill: billName
                });
                saveTransactions();
                
                // Update displays
                updateTransactionTable();
                updateBudgetFromTransactions();
                updateDashboard();
                
                showNotification(`Marked ${billName} as paid for $${amount.toFixed(2)}`);
            }
        }
    }
}

// Dashboard functionality
function updateDashboard() {
    // Calculate periodic buckets first
    calculatePeriodicBuckets();
    
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthNames = {
        jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', may: 'May', jun: 'Jun',
        jul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dec'
    };
    const monthNumbers = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    
    const monthlyGrid = document.getElementById('monthlyGrid');
    monthlyGrid.innerHTML = '';
    
    let overallTotal = 0; // Start surplus tracking at $0 for the year
    let totalSpent = 0;
    const totalBudget = 6546.00;
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    
    months.forEach((month, index) => {
        const monthNumber = monthNumbers[month];
        const monthIndex = index + 1; // 1-12
        
        // Only calculate for months that have transactions (not future months)
        const isCurrentOrPast = monthIndex <= currentMonth || (currentYear > 2026);
        
        let monthDifference = 0;
        let displayAmount = '$0.00';
        let amountClass = 'neutral';
        let cardClass = 'month-card';
        
        if (isCurrentOrPast) {
            const monthTransactions = transactions.filter(transaction => {
                const transactionDate = new Date(transaction.date);
                const transactionMonth = String(transactionDate.getMonth() + 1).padStart(2, '0');
                const transactionYear = transactionDate.getFullYear();
                return transactionMonth === monthNumber && transactionYear === currentYear;
            });
            
            // Calculate bill totals for this month (excluding ignored transactions)
            const billTotals = {};
            monthTransactions.forEach(transaction => {
                if (transaction.bill !== 'Ignore/Internal Transfer') {
                    if (!billTotals[transaction.bill]) {
                        billTotals[transaction.bill] = 0;
                    }
                    billTotals[transaction.bill] += transaction.amount;
                    totalSpent += transaction.amount;
                }
            });
            
            // Default bill budgets (used if no custom value saved)
            const defaultBillBudgets = {
                'Mortgage + Escrow (Ins-Taxes)': 2272.00, 'Car Payment': 453.00, 'Auto Insurance': 125.00,
                'AAA Roadside Assistance': 15.00, 'Gas': 150.00, 'Jewelers Insurance': 7.00,
                'Earthbound Garbage': 98.00, 'Water': 70.00, 'Xcel Energy': 285.00, 'Spectrum Phone': 116.00,
                'YMCA Membership': 35.00, 'Charity': 50.00, 'Daycare': 1100.00, 'Groceries': 850.00,
                'Restaurants/Entertainment': 300.00, 'Cat Food': 20.00, "Dylan's Medication": 90.00,
                "Dylan's School Lunches": 50.00, 'Roku / Disney Subscriptions': 25.00, 'Miscellaneous': 50.00,
                'Emergency Fund': 225.00, 'Travel Spending': 100.00, 'Dylan Investment': 35.00,
                'Brooks Investment': 25.00, 'Extra Paid Erik': 0.00, 'Erik Paid Sara': 0.00,
                'Miscellaneous Erik': 50.00, 'Miscellaneous Sara': 50.00
            };
            
            // Get actual budgets - use saved monthlyBudgets values if available, otherwise defaults
            const billBudgets = {};
            Object.keys(defaultBillBudgets).forEach(billName => {
                const savedValue = monthlyBudgets[month] && monthlyBudgets[month][billName];
                billBudgets[billName] = savedValue !== undefined ? savedValue : defaultBillBudgets[billName];
            });
            
            const positiveCreditBills = [
                'Gas', 'Groceries', 'Restaurants/Entertainment', 'Cat Food', "Dylan's Medication",
                "Dylan's School Lunches", 'Roku / Disney Subscriptions', 'Miscellaneous',
                'Emergency Fund', 'Travel Spending', 'Dylan Investment', 'Brooks Investment',
                'Miscellaneous Erik', 'Miscellaneous Sara'
            ];
            
            monthDifference = 0;
            
            // Apply logic for each bill - ONLY count actual net impact
            console.log('Using NEW dashboard calculation logic - should start at $0');
            Object.keys(billBudgets).forEach(billName => {
                const budget = billBudgets[billName];
                const actual = billTotals[billName] || 0;
                let billContribution = 0;
                
                if (billName === 'Extra Paid Erik' || billName === 'Erik Paid Sara') {
                    billContribution = actual; // Extra Paid categories are always positive
                } else if (actual > 0) {
                    // Only count actual spending impact - no theoretical savings
                    if (positiveCreditBills.includes(billName)) {
                        // For variable expenses, only count actual savings when under budget
                        if (actual < budget) {
                            billContribution = budget - actual; // Real savings
                        } else {
                            billContribution = budget - actual; // Overspending (negative)
                        }
                    } else {
                        // For fixed expenses, any spending is just spending (no surplus credit)
                        billContribution = 0;
                    }
                }
                // If actual === 0, contribute nothing (no theoretical credit)
                
                monthDifference += billContribution;
            });
            
            // Only add to overall total for current year
            overallTotal += monthDifference;
            
            amountClass = monthDifference > 0 ? 'positive' : monthDifference < 0 ? 'negative' : 'neutral';
            cardClass = `month-card ${monthDifference >= 0 ? 'surplus' : 'deficit'}`;
            displayAmount = monthDifference === 0 ? '$0.00' : `${monthDifference >= 0 ? '+' : ''}$${Math.abs(monthDifference).toFixed(2)}`;
        }
        
        const monthCard = document.createElement('div');
        monthCard.className = cardClass;
        
        monthCard.innerHTML = `
            <h4>${monthNames[month]}</h4>
            <div class="month-amount ${amountClass}">${displayAmount}</div>
        `;
        
        monthlyGrid.appendChild(monthCard);
    });
    
    // Update header stats
    document.getElementById('totalBudgetStat').textContent = `$${totalBudget.toLocaleString()}`;
    document.getElementById('totalSpentStat').textContent = `$${totalSpent.toLocaleString()}`;
    document.getElementById('remainingStat').textContent = `$${(totalBudget - totalSpent).toLocaleString()}`;
    
    // Update overall status
    const overallStatusCard = document.getElementById('overallStatus');
    const overallAmount = document.getElementById('overallAmount');
    const overallLabel = document.getElementById('overallLabel');
    const statusIndicator = document.getElementById('statusIndicator');
    const overallProgress = document.getElementById('overallProgress');
    const progressText = document.getElementById('progressText');
    
    console.log('FINAL overallTotal for dashboard:', overallTotal);
    
    // Calculate total reserved in periodic buckets
    const totalReserved = getTotalPeriodicBuckets();
    console.log('Total reserved in periodic buckets:', totalReserved);
    
    // Update reserved amount display
    const reservedDisplay = document.getElementById('reservedAmount');
    if (reservedDisplay) {
        reservedDisplay.textContent = `$${totalReserved.toFixed(2)}`;
    }
    
    // Financial Health shows actual surplus (buckets shown separately)
    overallAmount.textContent = `${overallTotal >= 0 ? '+' : ''}$${Math.abs(overallTotal).toFixed(2)}`;
    overallAmount.className = `status-amount ${overallTotal >= 0 ? 'positive' : 'negative'}`;
    
    // Calculate progress percentage
    const progressPercent = Math.min((totalSpent / totalBudget) * 100, 100);
    overallProgress.style.width = `${progressPercent}%`;
    progressText.textContent = `${progressPercent.toFixed(1)}% of budget used`;
    
    if (overallTotal > 0) {
        overallStatusCard.className = 'status-card surplus';
        overallLabel.textContent = 'Surplus 💰';
        overallLabel.className = 'status-label surplus';
        statusIndicator.textContent = '🟢';
        overallProgress.style.background = 'var(--success)';
    } else if (overallTotal < 0) {
        overallStatusCard.className = 'status-card deficit';
        overallLabel.textContent = 'Behind 📉';
        overallLabel.className = 'status-label deficit';
        statusIndicator.textContent = '🔴';
        overallProgress.style.background = 'var(--danger)';
    } else {
        overallStatusCard.className = 'status-card';
        overallLabel.textContent = 'On Track 🎯';
        overallLabel.className = 'status-label';
        statusIndicator.textContent = '🟡';
        overallProgress.style.background = 'var(--primary)';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Load saved data first
    await loadTransactions();
    loadFamilyExpenses();
    await loadMonthlyBudgets();
    
    // Determine which month to show (saved or current)
    const savedMonth = localStorage.getItem('currentMonth');
    let monthToShow;
    
    if (savedMonth) {
        monthToShow = savedMonth;
    } else {
        const currentDate = new Date();
        const currentMonthIndex = currentDate.getMonth(); // 0-11
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        monthToShow = months[currentMonthIndex];
    }
    
    // Set up the month first
    currentMonth = monthToShow;
    document.querySelectorAll('.month-tab').forEach(tab => tab.classList.remove('active'));
    const monthTab = document.querySelector(`[onclick="showMonth('${monthToShow}')"]`);
    if (monthTab) monthTab.classList.add('active');
    
    // Update title
    const monthNames = {
        jan: 'January', feb: 'February', mar: 'March', apr: 'April',
        may: 'May', jun: 'June', jul: 'July', aug: 'August',
        sep: 'September', oct: 'October', nov: 'November', dec: 'December'
    };
    const currentDate = new Date();
    document.getElementById('currentMonthTitle').textContent = `${monthNames[monthToShow]} ${currentDate.getFullYear()} Budget`;
    
    loadMonthBudget(monthToShow);
    updateBudgetFromTransactions();
    updateTransactionTable();
    updateDashboard();
    
    // Restore saved tab or default to dashboard (do this last)
    const savedTab = localStorage.getItem('currentTab') || 'dashboard';
    
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(savedTab).classList.add('active');
    
    // Find and activate the correct tab button
    const tabBtn = Array.from(tabButtons).find(btn => btn.onclick.toString().includes(savedTab));
    if (tabBtn) tabBtn.classList.add('active');
});

// Transaction modal functions
function showAddTransaction() {
    document.getElementById('addTransactionModal').style.display = 'block';
}

function closeAddTransaction() {
    document.getElementById('addTransactionModal').style.display = 'none';
    document.getElementById('addTransactionForm').reset();
    
    // Reset form to add mode
    document.querySelector('#addTransactionModal h2').textContent = 'Add Transaction';
    document.querySelector('#addTransactionForm button[type="submit"]').textContent = 'Add Transaction';
    delete document.getElementById('addTransactionForm').dataset.editIndex;
    
    // Remove delete button if it exists
    const deleteBtn = document.querySelector('.form-actions .btn-danger');
    if (deleteBtn) {
        deleteBtn.remove();
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('addTransactionModal');
    if (event.target === modal) {
        closeAddTransaction();
    }
}

// Update transaction table display with monthly grouping
function updateTransactionTable() {
    const tbody = document.getElementById('transactionsBody');
    tbody.innerHTML = '';
    
    // Sort transactions by date (most recent first)
    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Group by month
    const groupedByMonth = {};
    sortedTransactions.forEach((transaction, originalIndex) => {
        const date = new Date(transaction.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        
        if (!groupedByMonth[monthKey]) {
            groupedByMonth[monthKey] = {
                name: monthName,
                transactions: []
            };
        }
        
        // Find original index for editing
        const realIndex = transactions.findIndex(t => 
            t.date === transaction.date && 
            t.source === transaction.source && 
            t.amount === transaction.amount && 
            t.bill === transaction.bill
        );
        
        groupedByMonth[monthKey].transactions.push({ ...transaction, originalIndex: realIndex });
    });
    
    // Add divider before first month
    let isFirstMonth = true;
    
    // Display grouped transactions
    Object.keys(groupedByMonth).sort().reverse().forEach(monthKey => {
        const monthData = groupedByMonth[monthKey];
        
        // Add divider before first month only
        if (isFirstMonth) {
            const dividerRow = document.createElement('tr');
            dividerRow.className = 'transaction-divider-row';
            dividerRow.innerHTML = `
                <td colspan="6"><div class="transaction-divider"></div></td>
            `;
            tbody.appendChild(dividerRow);
            isFirstMonth = false;
        }
        
        // Add month header
        const monthRow = document.createElement('tr');
        monthRow.className = 'month-header';
        monthRow.innerHTML = `
            <td colspan="6"><strong>${monthData.name}</strong></td>
        `;
        tbody.appendChild(monthRow);
        
        // Add transactions for this month
        monthData.transactions.forEach(transaction => {
            const row = document.createElement('tr');
            const formattedDate = new Date(transaction.date).toLocaleDateString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric'
            });
            
            row.innerHTML = `
                <td><input type="checkbox" class="transaction-checkbox" data-index="${transaction.originalIndex}" onchange="updateBulkActions()"></td>
                <td class="editable-date" data-field="date" data-index="${transaction.originalIndex}" onclick="editField(this)">${formattedDate}</td>
                <td class="editable-text" data-field="source" data-index="${transaction.originalIndex}" onclick="editField(this)">${transaction.source}</td>
                <td class="editable-amount" data-field="amount" data-index="${transaction.originalIndex}" onclick="editField(this)">$${transaction.amount.toFixed(2)}</td>
                <td class="editable-select" data-field="bill" data-index="${transaction.originalIndex}" onclick="editField(this)">${transaction.bill}</td>
                <td>
                    <button class="btn-edit" onclick="editTransaction(${transaction.originalIndex})">Edit</button>
                    <button class="btn-delete" onclick="deleteTransaction(${transaction.originalIndex})">×</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    });
}

// Add/Edit transaction form submission
document.getElementById('addTransactionForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const date = document.getElementById('transactionDate').value;
    const source = document.getElementById('transactionSource').value;
    const amount = parseFloat(document.getElementById('transactionAmount').value);
    const bill = document.getElementById('transactionBill').value;
    
    const editIndex = this.dataset.editIndex;
    
    if (editIndex !== undefined) {
        // Update existing transaction
        transactions[editIndex] = {
            date: date,
            source: source,
            amount: amount,
            bill: bill
        };
        saveTransactions();
        showNotification('Transaction updated successfully!');
    } else {
        // Add new transaction
        transactions.push({
            date: date,
            source: source,
            amount: amount,
            bill: bill
        });
        showNotification('Transaction added successfully!');
    }
    saveTransactions();
    
    // Update displays
    updateTransactionTable();
    updateBudgetFromTransactions();
    updateDashboard();
    closeAddTransaction();
});

// Inline field editing
function editField(cell) {
    if (cell.querySelector('input') || cell.querySelector('select')) return; // Already editing
    
    const index = parseInt(cell.dataset.index);
    const field = cell.dataset.field;
    const currentValue = transactions[index][field];
    const originalText = cell.textContent;
    
    let input;
    
    if (field === 'date') {
        input = document.createElement('input');
        input.type = 'date';
        input.value = currentValue;
        input.className = 'inline-edit-input';
    } else if (field === 'amount') {
        input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.value = currentValue;
        input.className = 'inline-edit-input';
    } else if (field === 'bill') {
        input = document.createElement('select');
        input.className = 'inline-edit-select';
        const categories = [
            'Mortgage + Escrow (Ins-Taxes)', 'Car Payment', 'Auto Insurance', 'AAA Roadside Assistance',
            'Gas', 'Jewelers Insurance', 'Earthbound Garbage', 'Water', 'Xcel Energy', 'Spectrum Phone',
            'YMCA Membership', 'Charity', 'Daycare', 'Groceries', 'Restaurants/Entertainment', 'Cat Food',
            "Dylan's Medication", "Dylan's School Lunches", 'Roku / Disney Subscriptions', 'Miscellaneous',
            'Emergency Fund', 'Travel Spending', 'Dylan Investment', 'Brooks Investment', 
            'Extra Paid Erik', 'Erik Paid Sara', 'Miscellaneous Erik', 'Miscellaneous Sara', 'Ignore/Internal Transfer'
        ];
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            if (cat === currentValue) option.selected = true;
            input.appendChild(option);
        });
    } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.className = 'inline-edit-input';
    }
    
    // Save on Enter or blur
    const saveEdit = () => {
        let newValue = input.value;
        
        if (field === 'amount') {
            newValue = parseFloat(newValue) || 0;
            if (newValue <= 0) {
                showNotification('Amount must be greater than 0', 'error');
                input.focus();
                return;
            }
        }
        
        if (field === 'date' && !newValue) {
            showNotification('Date is required', 'error');
            input.focus();
            return;
        }
        
        // Update transaction
        transactions[index][field] = newValue;
        saveTransactions();
        
        // Update displays
        updateTransactionTable();
        updateBudgetFromTransactions();
        updateDashboard();
        
        showNotification('Transaction updated!');
    };
    
    const cancelEdit = () => {
        cell.textContent = originalText;
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
    
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    if (input.select) input.select();
}

// Quick delete transaction
function deleteTransaction(index) {
    if (confirm('Delete this transaction?')) {
        transactions.splice(index, 1);
        saveTransactions();
        updateTransactionTable();
        updateBudgetFromTransactions();
        updateDashboard();
        showNotification('Transaction deleted!');
    }
}

// Edit transaction (modal version - keep for complex edits)
function editTransaction(index) {
    const transaction = transactions[index];
    
    // Pre-fill the form with existing data
    document.getElementById('transactionDate').value = transaction.date;
    document.getElementById('transactionSource').value = transaction.source;
    document.getElementById('transactionAmount').value = transaction.amount;
    document.getElementById('transactionBill').value = transaction.bill;
    
    // Change form title and button
    document.querySelector('#addTransactionModal h2').textContent = 'Edit Transaction';
    const submitBtn = document.querySelector('#addTransactionForm button[type="submit"]');
    submitBtn.textContent = 'Update Transaction';
    
    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => {
        transactions.splice(index, 1);
        saveTransactions();
        updateTransactionTable();
        updateBudgetFromTransactions();
        updateDashboard();
        closeAddTransaction();
        showNotification('Transaction deleted!');
    };
    
    const formActions = document.querySelector('.form-actions');
    if (!formActions.querySelector('.btn-danger')) {
        formActions.insertBefore(deleteBtn, formActions.firstChild);
    }
    
    // Store the index for updating
    document.getElementById('addTransactionForm').dataset.editIndex = index;
    
    showAddTransaction();
}

// Notification system
function showNotification(message, type = 'success') {
    const colors = {
        success: 'var(--success)',
        error: 'var(--danger)',
        warning: 'var(--warning)',
        info: 'var(--primary)'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        z-index: 1001;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        box-shadow: var(--shadow-lg);
        max-width: 300px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, type === 'error' ? 5000 : 3000);
}

// Bill management functions
function updateBudgetTotals() {
    let totalBudget = 0;
    let totalActual = 0;
    let totalOverUnder = 0;
    
    const rows = document.querySelectorAll('.budget-table tbody tr:not(.separator)');
    rows.forEach(row => {
        // Column indices: 0=Bill, 1=Due Date, 2=Monthly Expense, 3=Actual, 4=Over/Under
        if (row.cells[2] && row.cells[3] && row.cells[4]) {
            const budget = parseFloat(row.cells[2].textContent.replace(/[$,]/g, '')) || 0;
            const actualSpan = row.cells[3].querySelector('.actual-amount');
            const actual = actualSpan ? parseFloat(actualSpan.textContent.replace(/[$,]/g, '')) || 0 : 0;
            const overUnder = parseFloat(row.cells[4].textContent.replace(/[$,]/g, '')) || 0;
            
            totalBudget += budget;
            totalActual += actual;
            totalOverUnder += overUnder;
        }
    });
    
    document.getElementById('totalBudget').textContent = `$${totalBudget.toFixed(2)}`;
    document.getElementById('totalActual').textContent = `$${totalActual.toFixed(2)}`;
    document.getElementById('totalOverUnder').textContent = `$${totalOverUnder.toFixed(2)}`;
    document.getElementById('totalOverUnder').style.color = totalOverUnder >= 0 ? 'var(--success)' : 'var(--danger)';
}

function showAddBill() {
    document.getElementById('addBillModal').style.display = 'block';
    document.getElementById('billModalTitle').textContent = 'Add Bill';
    document.getElementById('addBillForm').reset();
    document.getElementById('deleteBillBtn').style.display = 'none';
    delete document.getElementById('addBillForm').dataset.editBill;
}

function editBill(billName, amount) {
    document.getElementById('addBillModal').style.display = 'block';
    document.getElementById('billModalTitle').textContent = 'Edit Bill';
    document.getElementById('billName').value = billName;
    document.getElementById('billAmount').value = amount;
    document.getElementById('deleteBillBtn').style.display = 'inline-block';
    document.getElementById('addBillForm').dataset.editBill = billName;
}

function closeAddBill() {
    document.getElementById('addBillModal').style.display = 'none';
}

function deleteBill() {
    const billName = document.getElementById('addBillForm').dataset.editBill;
    if (billName && confirm(`Delete ${billName}?`)) {
        showNotification(`${billName} deleted!`);
        closeAddBill();
    }
}

// Add Bill form submission
document.getElementById('addBillForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const billName = document.getElementById('billName').value;
    const amount = parseFloat(document.getElementById('billAmount').value);
    const isEdit = this.dataset.editBill;
    
    if (isEdit) {
        // Update the bill amount in the table
        const rows = document.querySelectorAll('.budget-table tbody tr');
        rows.forEach(row => {
            if (row.cells[0] && row.cells[0].textContent.trim() === isEdit) {
                row.cells[2].textContent = `$${amount.toFixed(2)}`;
                // Update the over/under calculation
                const actualText = row.cells[3]?.querySelector('.actual-amount')?.textContent || '$0.00';
                const actual = parseFloat(actualText.replace(/[$,]/g, '')) || 0;
                const overUnder = actual - amount;
                if (row.cells[4]) {
                    row.cells[4].textContent = `$${overUnder.toFixed(2)}`;
                    row.cells[4].style.color = overUnder >= 0 ? 'var(--success)' : 'var(--danger)';
                }
            }
        });
        
        // Save to monthly budgets
        monthlyBudgets[currentMonth][isEdit] = amount;
        saveMonthlyBudgets();
        
        // Update totals
        updateBudgetTotals();
        updateDashboard();
        
        showNotification(`${billName} updated to $${amount.toFixed(2)}!`);
    } else {
        showNotification(`${billName} added!`);
    }
    
    closeAddBill();
});

// Family Expense Tracking
let familyExpenses = [];

function saveFamilyExpenses() {
    localStorage.setItem('familyExpenses', JSON.stringify(familyExpenses));
}

function loadFamilyExpenses() {
    const saved = localStorage.getItem('familyExpenses');
    if (saved) {
        familyExpenses = JSON.parse(saved);
    }
}

function showFamilyExpenses() {
    // Hide budget table and show family expense content
    document.querySelector('.budget-table-container').style.display = 'none';
    document.getElementById('familyExpenseContent').style.display = 'block';
    document.getElementById('currentMonthTitle').style.display = 'none';
    document.querySelector('.add-transaction').style.display = 'none';
    
    // Update active tab
    document.querySelectorAll('.month-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('.family-tab').classList.add('active');
    
    updateFamilyExpenseTable();
}

function showAddFamilyExpense() {
    document.getElementById('addFamilyExpenseModal').style.display = 'block';
    document.getElementById('familyExpenseDate').value = new Date().toISOString().split('T')[0];
}

function closeAddFamilyExpense() {
    document.getElementById('addFamilyExpenseModal').style.display = 'none';
    document.getElementById('addFamilyExpenseForm').reset();
    document.getElementById('familyExpenseModalTitle').textContent = 'Add Family Expense';
    document.querySelector('#addFamilyExpenseForm button[type="submit"]').textContent = 'Add Expense';
    document.getElementById('deleteFamilyExpenseBtn').style.display = 'none';
    delete document.getElementById('addFamilyExpenseForm').dataset.editIndex;
}

function updateFamilyExpenseTable() {
    const tbody = document.getElementById('familyExpenseBody');
    tbody.innerHTML = '';
    
    familyExpenses.forEach((expense, index) => {
        const row = document.createElement('tr');
        const formattedDate = new Date(expense.date).toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
        });
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${expense.category}</td>
            <td>$${expense.amount.toFixed(2)}</td>
            <td>${expense.location}</td>
            <td>${expense.whoPaid}</td>
            <td>$${(expense.amountToPayer || 0).toFixed(2)}</td>
            <td>
                <button class="btn-edit" onclick="editFamilyExpense(${index})">Edit</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function editFamilyExpense(index) {
    const expense = familyExpenses[index];
    
    document.getElementById('familyExpenseDate').value = expense.date;
    document.getElementById('familyExpenseCategory').value = expense.category;
    document.getElementById('familyExpenseAmount').value = expense.amount;
    document.getElementById('familyExpenseLocation').value = expense.location;
    document.getElementById('familyExpenseWhoPaid').value = expense.whoPaid;
    document.getElementById('familyExpenseAmountToPayer').value = expense.amountToPayer || '';
    
    document.getElementById('familyExpenseModalTitle').textContent = 'Edit Family Expense';
    document.querySelector('#addFamilyExpenseForm button[type="submit"]').textContent = 'Update Expense';
    document.getElementById('deleteFamilyExpenseBtn').style.display = 'inline-block';
    document.getElementById('addFamilyExpenseForm').dataset.editIndex = index;
    
    showAddFamilyExpense();
}

function deleteFamilyExpense() {
    const index = document.getElementById('addFamilyExpenseForm').dataset.editIndex;
    if (index !== undefined && confirm('Delete this family expense?')) {
        familyExpenses.splice(index, 1);
        saveFamilyExpenses();
        updateFamilyExpenseTable();
        closeAddFamilyExpense();
        showNotification('Family expense deleted!');
    }
}

// Family expense form submission
document.getElementById('addFamilyExpenseForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const date = document.getElementById('familyExpenseDate').value;
    const category = document.getElementById('familyExpenseCategory').value;
    const amount = parseFloat(document.getElementById('familyExpenseAmount').value);
    const location = document.getElementById('familyExpenseLocation').value;
    const whoPaid = document.getElementById('familyExpenseWhoPaid').value;
    const amountToPayer = parseFloat(document.getElementById('familyExpenseAmountToPayer').value) || 0;
    
    const editIndex = this.dataset.editIndex;
    
    if (editIndex !== undefined) {
        familyExpenses[editIndex] = { date, category, amount, location, whoPaid, amountToPayer };
        showNotification('Family expense updated!');
    } else {
        familyExpenses.push({ date, category, amount, location, whoPaid, amountToPayer });
        showNotification('Family expense added!');
    }
    
    saveFamilyExpenses();
    updateFamilyExpenseTable();
    closeAddFamilyExpense();
});

// Hamburger menu toggle
function toggleQuickActions() {
    const dropdown = document.getElementById('quickActionsDropdown');
    dropdown.classList.toggle('show');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const dropdown = document.getElementById('quickActionsDropdown');
    
    if (hamburgerMenu && !hamburgerMenu.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// Voice Recognition for Transaction Entry
let recognition;
let isListening = false;

function initVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript.toLowerCase();
            processVoiceInput(transcript);
        };
        
        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            stopListening();
            showNotification('Voice recognition error. Please try again.', 'error');
        };
        
        recognition.onend = function() {
            stopListening();
        };
    }
}

function startVoiceInput(fieldType) {
    if (!recognition) {
        showNotification('Voice recognition not supported in this browser', 'error');
        return;
    }
    
    if (isListening) {
        stopListening();
        return;
    }
    
    isListening = true;
    recognition.currentField = fieldType;
    
    // Update button appearance
    const button = document.querySelector(`[onclick="startVoiceInput('${fieldType}')"]`);
    if (button) {
        button.textContent = '🔴 Stop';
        button.style.background = '#ef4444';
    }
    
    recognition.start();
    showNotification(`🎤 Listening for ${fieldType}...`);
}

function stopListening() {
    if (recognition && isListening) {
        recognition.stop();
    }
    isListening = false;
    
    // Reset all voice buttons
    document.querySelectorAll('.voice-btn').forEach(btn => {
        btn.textContent = '🎤';
        btn.style.background = '';
    });
}

function processVoiceInput(transcript) {
    const fieldType = recognition.currentField;
    
    switch (fieldType) {
        case 'source':
            document.getElementById('transactionSource').value = capitalizeWords(transcript);
            break;
            
        case 'amount':
            const amount = extractAmount(transcript);
            if (amount) {
                document.getElementById('transactionAmount').value = amount;
            } else {
                showNotification('Could not understand amount. Please try again.', 'error');
            }
            break;
            
        case 'bill':
            const billCategory = matchBillCategory(transcript);
            if (billCategory) {
                document.getElementById('transactionBill').value = billCategory;
            } else {
                showNotification('Could not match bill category. Please select manually.', 'error');
            }
            break;
    }
    
    stopListening();
}

function extractAmount(transcript) {
    // Remove common words and extract numbers
    const cleaned = transcript.replace(/dollars?|bucks?|cents?/gi, '');
    
    // Look for patterns like "twenty five fifty" or "25.50" or "twenty five dollars and fifty cents"
    const numberWords = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
        'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
        'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
        'eighty': 80, 'ninety': 90, 'hundred': 100
    };
    
    // First try to find a decimal number
    const decimalMatch = cleaned.match(/\d+\.\d{2}/);
    if (decimalMatch) {
        return parseFloat(decimalMatch[0]);
    }
    
    // Try to find whole number
    const wholeMatch = cleaned.match(/\d+/);
    if (wholeMatch) {
        return parseFloat(wholeMatch[0]);
    }
    
    // Try to convert words to numbers (basic implementation)
    let total = 0;
    const words = cleaned.split(' ');
    
    for (let word of words) {
        if (numberWords[word.toLowerCase()]) {
            total += numberWords[word.toLowerCase()];
        }
    }
    
    return total > 0 ? total : null;
}

function matchBillCategory(transcript) {
    const billCategories = [
        'Mortgage + Escrow (Ins-Taxes)', 'Car Payment', 'Auto Insurance', 'AAA Roadside Assistance',
        'Gas', 'Jewelers Insurance', 'Earthbound Garbage', 'Water', 'Xcel Energy', 'Spectrum Phone',
        'YMCA Membership', 'Charity', 'Daycare', 'Groceries', 'Restaurants/Entertainment', 'Cat Food',
        "Dylan's Medication", "Dylan's School Lunches", 'Roku / Disney Subscriptions', 'Miscellaneous',
        'Emergency Fund', 'Travel Spending', 'Dylan Investment', 'Brooks Investment', 'Extra Paid'
    ];
    
    const keywords = {
        'mortgage': 'Mortgage + Escrow (Ins-Taxes)',
        'car payment': 'Car Payment',
        'auto insurance': 'Auto Insurance',
        'insurance': 'Auto Insurance',
        'aaa': 'AAA Roadside Assistance',
        'roadside': 'AAA Roadside Assistance',
        'gas': 'Gas',
        'fuel': 'Gas',
        'gasoline': 'Gas',
        'jewelers': 'Jewelers Insurance',
        'garbage': 'Earthbound Garbage',
        'trash': 'Earthbound Garbage',
        'water': 'Water',
        'excel': 'Xcel Energy',
        'energy': 'Xcel Energy',
        'electric': 'Xcel Energy',
        'electricity': 'Xcel Energy',
        'spectrum': 'Spectrum Phone',
        'phone': 'Spectrum Phone',
        'ymca': 'YMCA Membership',
        'gym': 'YMCA Membership',
        'charity': 'Charity',
        'donation': 'Charity',
        'daycare': 'Daycare',
        'groceries': 'Groceries',
        'grocery': 'Groceries',
        'food': 'Groceries',
        'restaurant': 'Restaurants/Entertainment',
        'dining': 'Restaurants/Entertainment',
        'entertainment': 'Restaurants/Entertainment',
        'cat food': 'Cat Food',
        'cat': 'Cat Food',
        'pet food': 'Cat Food',
        'dylan medication': "Dylan's Medication",
        'medication': "Dylan's Medication",
        'medicine': "Dylan's Medication",
        'school lunch': "Dylan's School Lunches",
        'lunch': "Dylan's School Lunches",
        'roku': 'Roku / Disney Subscriptions',
        'disney': 'Roku / Disney Subscriptions',
        'streaming': 'Roku / Disney Subscriptions',
        'subscription': 'Roku / Disney Subscriptions',
        'miscellaneous': 'Miscellaneous',
        'misc': 'Miscellaneous',
        'other': 'Miscellaneous',
        'emergency': 'Emergency Fund',
        'savings': 'Emergency Fund',
        'travel': 'Travel Spending',
        'vacation': 'Travel Spending',
        'dylan investment': 'Dylan Investment',
        'brooks investment': 'Brooks Investment',
        'investment': 'Dylan Investment',
        'extra paid': 'Extra Paid',
        'extra': 'Extra Paid'
    };
    
    const lowerTranscript = transcript.toLowerCase();
    
    // Check for exact keyword matches first
    for (let keyword in keywords) {
        if (lowerTranscript.includes(keyword)) {
            return keywords[keyword];
        }
    }
    
    // Fallback to partial matches
    for (let category of billCategories) {
        const categoryWords = category.toLowerCase().split(' ');
        if (categoryWords.some(word => lowerTranscript.includes(word))) {
            return category;
        }
    }
    
    return null;
}

function capitalizeWords(str) {
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

// Initialize voice recognition when page loads
document.addEventListener('DOMContentLoaded', function() {
    // ... existing DOMContentLoaded code ...
    initVoiceRecognition();
});

// Bulk delete functionality
function updateBulkActions() {
    const checkboxes = document.querySelectorAll('.transaction-checkbox');
    const checkedBoxes = document.querySelectorAll('.transaction-checkbox:checked');
    const bulkActions = document.getElementById('bulkActions');
    const selectedCount = document.getElementById('selectedCount');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    // Show/hide bulk actions
    if (checkedBoxes.length > 0) {
        bulkActions.style.display = 'block';
        selectedCount.textContent = `${checkedBoxes.length} selected`;
    } else {
        bulkActions.style.display = 'none';
    }
    
    // Update select all checkbox state
    if (checkedBoxes.length === 0) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    } else if (checkedBoxes.length === checkboxes.length) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = true;
    } else {
        selectAllCheckbox.indeterminate = true;
    }
}

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const checkboxes = document.querySelectorAll('.transaction-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    updateBulkActions();
}

function selectAllTransactions() {
    const checkboxes = document.querySelectorAll('.transaction-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    updateBulkActions();
}

function clearSelection() {
    const checkboxes = document.querySelectorAll('.transaction-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    updateBulkActions();
}

function deleteSelectedTransactions() {
    const checkedBoxes = document.querySelectorAll('.transaction-checkbox:checked');
    
    if (checkedBoxes.length === 0) {
        showNotification('No transactions selected', 'warning');
        return;
    }
    
    if (confirm(`Delete ${checkedBoxes.length} selected transaction(s)?`)) {
        // Get indices to delete (sort in descending order to avoid index shifting)
        const indicesToDelete = Array.from(checkedBoxes)
            .map(checkbox => parseInt(checkbox.dataset.index))
            .sort((a, b) => b - a);
        
        // Delete transactions from highest index to lowest
        indicesToDelete.forEach(index => {
            transactions.splice(index, 1);
        });
        
        saveTransactions();
        updateTransactionTable();
        updateBudgetFromTransactions();
        updateDashboard();
        
        showNotification(`${indicesToDelete.length} transaction(s) deleted!`);
        
        // Hide bulk actions
        document.getElementById('bulkActions').style.display = 'none';
    }
}
// Sync status functions
function showSyncStatus(message = 'Syncing...') {
    const syncStatus = document.getElementById('syncStatus');
    const syncText = syncStatus.querySelector('.sync-text');
    if (syncStatus && syncText) {
        syncText.textContent = message;
        syncStatus.style.display = 'flex';
    }
}

function hideSyncStatus() {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
        setTimeout(() => {
            syncStatus.style.display = 'none';
        }, 1000);
    }
}

// Enhanced save functions with sync status
async function saveTransactionsWithStatus() {
    showSyncStatus('Saving transactions...');
    await saveTransactions();
    hideSyncStatus();
}

async function saveBudgetsWithStatus() {
    showSyncStatus('Saving budget...');
    await saveMonthlyBudgets();
    hideSyncStatus();
}