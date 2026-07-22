console.log('=== APP.JS LOADED - VERSION 20260607 ===');

// Tab functionality
function showTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    const tabEl = document.getElementById(tabName);
    if (tabEl) tabEl.classList.add('active');
    
    // Add active class to clicked button
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        const tabBtn = Array.from(tabButtons).find(btn => btn.onclick && btn.onclick.toString().includes(tabName));
        if (tabBtn) tabBtn.classList.add('active');
    }
    
    // Refresh carryover table when switching to it
    if (tabName === 'carryover') {
        updateCarryoverTable();
    }
    
    // Refresh subscriptions/recurring table when switching to it
    if (tabName === 'subscriptions') {
        updateSubscriptionsTable();
    }
    
    // Save current tab
    localStorage.setItem('currentTab', tabName);
}

// Periodic Bills Configuration
// This defines which bills are periodic (not monthly) and their payment schedule
// The totalAmount will be calculated from the actual monthly budget
const periodicBillsConfig = {
    'Auto Insurance': { frequency: 'semi-annual', monthsInCycle: 6, dueMonth: 8, defaultMonthly: 136, initialBalance: 0 },  // Aug 26 - paid in Jan
    'AAA Roadside Assistance': { frequency: 'annual', monthsInCycle: 12, dueMonth: 5, defaultMonthly: 15, initialBalance: 135 },  // May 26 - 9 months saved as of Jan
    'Jewelers Insurance': { frequency: 'annual', monthsInCycle: 12, dueMonth: 6, defaultMonthly: 7, initialBalance: 56 },  // Jun 15 - 8 months saved as of Jan
    'Earthbound Garbage': { frequency: 'quarterly', monthsInCycle: 3, dueMonth: 1, defaultMonthly: 98, initialBalance: 0 },  // Jan 26 - paid in Jan
    'Water': { frequency: 'quarterly', monthsInCycle: 3, dueMonth: 1, defaultMonthly: 70, initialBalance: 0 },  // Jan 26 - paid in Jan
    'YMCA Membership': { frequency: 'annual', monthsInCycle: 12, dueMonth: 12, defaultMonthly: 0, initialBalance: 0 }  // Dec 26 (deleted)
};

// Get the actual total amount for a periodic bill from current month's budget
function getPeriodicBillTotal(billName) {
    const config = periodicBillsConfig[billName];
    if (!config) return 0;
    
    // Get the monthly budget amount from current month
    const monthlyAmount = monthlyBudgets[currentMonth]?.[billName] || 0;
    
    // If monthly amount is 0, this bill is not active
    if (monthlyAmount === 0) return 0;
    
    // Calculate total based on cycle
    return monthlyAmount * config.monthsInCycle;
}

// Bucket balances for periodic bills (accumulated savings toward next payment)
let periodicBuckets = {};

// Store monthly over/under values (calculated from Expenses page)
let monthlyOverUnder = {};

// Helper function to parse date as local time (not UTC)
function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD4V3DKjbRv5DgjRpZ6BzxPH8SJjJ2Nm-I",
    authDomain: "work-budget-tracker.firebaseapp.com",
    projectId: "work-budget-tracker",
    storageBucket: "work-budget-tracker.firebasestorage.app",
    messagingSenderId: "704722132019",
    appId: "1:704722132019:web:7178ac03b6e94832d85746",
    measurementId: "G-NVLR9RBVGL"
};

// Initialize Firebase
let db = null;
let functions = null;
let isFirebaseEnabled = false;

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        functions = firebase.functions();
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
const userId = 'work-user'; // Separate workspace for work budget

// ============ DEMO TRANSACTION DATA (randomized, work-safe) ============
// Generates realistic-looking transactions with controlled reconciliation:
//   Jan-Apr reconcile perfectly ($0.00), May is -$500, June is +$300
function generateDemoTransactions() {
    const YEAR = 2026;
    const monthNums = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06' };
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun'];

    // Budgeted (target) amount for each non-periodic bill
    const billBudgets = {
        'Mortgage + Escrow (Ins-Taxes)': 2272.00,
        'Car Payment': 453.00,
        'Gas': 150.00,
        'Daycare': 1100.00,
        'Xcel Energy': 285.00,
        'Phones & Internet': 116.00,
        'Charity': 50.00,
        'Groceries': 850.00,
        'Restaurants/Entertainment': 300.00,
        'Health & Wellness': 90.00,
        'Education & Training': 50.00,
        'Miscellaneous': 50.00,
        'Roku / Disney Subscriptions': 25.00,
        'Cat Food': 20.00,
        'Emergency Fund': 225.00,
        'Travel Spending': 100.00,
        'Student Investment': 35.00,
        'Child Investment': 25.00
    };

    // Realistic merchant names (no personal information)
    const merchants = {
        'Mortgage + Escrow (Ins-Taxes)': ['Summit Home Mortgage'],
        'Car Payment': ['Prime Auto Finance'],
        'Gas': ['Shell', 'BP', 'Speedway', 'Costco Gas'],
        'Daycare': ['Bright Path Learning Center'],
        'Xcel Energy': ['Xcel Energy'],
        'Phones & Internet': ['Metro Fiber & Mobile'],
        'Charity': ['United Community Fund'],
        'Groceries': ['Kroger', "Trader Joe's", 'Whole Foods', 'Aldi', 'Costco'],
        'Restaurants/Entertainment': ['Olive Garden', 'Chipotle', 'AMC Theatres', 'Local Bistro'],
        'Health & Wellness': ['CVS Pharmacy', 'Walgreens', 'GNC'],
        'Education & Training': ['Coursera', 'Udemy'],
        'Miscellaneous': ['Amazon', 'Target', 'Etsy'],
        'Roku / Disney Subscriptions': ['Disney+', 'Roku Channel'],
        'Cat Food': ['Chewy', 'PetSmart'],
        'Emergency Fund': ['Ally Savings Transfer'],
        'Travel Spending': ['Delta Airlines', 'Marriott Hotels'],
        'Student Investment': ['Vanguard 529 Plan'],
        'Child Investment': ['Fidelity Brokerage']
    };

    const accounts = ['Checking', 'Credit Card', 'Savings'];
    const splittable = ['Gas', 'Groceries', 'Restaurants/Entertainment'];
    const days = [3, 7, 11, 14, 18, 22, 26, 9, 16, 24];
    const round2 = (n) => Math.round(n * 100) / 100;

    const txns = [];
    let seed = 0;

    monthKeys.forEach((mk) => {
        Object.keys(billBudgets).forEach((bill) => {
            let target = billBudgets[bill];
            if (mk === 'may' && bill === 'Groceries') target = round2(target + 500); // May: over budget => -$500
            if (mk === 'jun' && bill === 'Groceries') target = round2(target - 300); // June: under budget => +$300

            // Split discretionary bills into two line items for realism
            let parts;
            if (splittable.includes(bill) && target >= 60) {
                const first = round2(target * 0.55);
                parts = [first, round2(target - first)];
            } else {
                parts = [target];
            }

            parts.forEach((amt, idx) => {
                const mList = merchants[bill] || [bill];
                const merch = mList[(seed + idx) % mList.length];
                const day = String(days[(seed + idx) % days.length]).padStart(2, '0');
                txns.push({
                    date: `${YEAR}-${monthNums[mk]}-${day}`,
                    source: merch,
                    amount: amt,
                    bill: bill,
                    account: accounts[(seed + idx) % accounts.length]
                });
                seed++;
            });
        });
    });

    return txns;
}

// Store transactions
let transactions = generateDemoTransactions();

// Learning system for auto-categorization
let learnedPatterns = {};
let categoryConfidence = {};

// User overrides for subscription vs recurring classification, keyed by cleaned merchant name
// Values: 'Subscription' or 'Recurring'
let subscriptionOverrides = {};

async function saveSubscriptionOverrides() {
    if (isFirebaseEnabled) {
        try {
            await db.collection('users').doc(userId).set({
                subscriptionOverrides: subscriptionOverrides,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('Subscription overrides saved to cloud');
        } catch (error) {
            console.error('Error saving subscription overrides:', error);
            localStorage.setItem('subscriptionOverrides', JSON.stringify(subscriptionOverrides));
        }
    } else {
        localStorage.setItem('subscriptionOverrides', JSON.stringify(subscriptionOverrides));
    }
}

// Enhanced cloud storage functions
async function saveTransactions() {
    // DUPLICATE PREVENTION: Remove duplicates before saving
    if (transactions && transactions.length > 0) {
        const seen = new Map();
        const cleaned = [];
        let duplicatesRemoved = 0;
        
        for (const tx of transactions) {
            const key = `${tx.date}|${(tx.source || '').toLowerCase()}|${tx.amount}|${tx.account || 'RCU'}`;
            if (!seen.has(key)) {
                seen.set(key, true);
                cleaned.push(tx);
            } else {
                duplicatesRemoved++;
            }
        }
        
        if (duplicatesRemoved > 0) {
            console.log(`⚠️ Prevented ${duplicatesRemoved} duplicates during save`);
            transactions = cleaned;
        }
    }
    
    if (isFirebaseEnabled) {
        try {
            await db.collection('users').doc(userId).set({
                transactions: transactions,
                learnedPatterns: learnedPatterns,
                categoryConfidence: categoryConfidence,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('Transactions and learned patterns saved to cloud');
        } catch (error) {
            console.error('Error saving to cloud:', error);
            // Fallback to localStorage
            localStorage.setItem('billsTransactions', JSON.stringify(transactions));
            localStorage.setItem('learnedPatterns', JSON.stringify(learnedPatterns));
            localStorage.setItem('categoryConfidence', JSON.stringify(categoryConfidence));
        }
    } else {
        // Fallback to localStorage
        localStorage.setItem('billsTransactions', JSON.stringify(transactions));
        localStorage.setItem('learnedPatterns', JSON.stringify(learnedPatterns));
        localStorage.setItem('categoryConfidence', JSON.stringify(categoryConfidence));
    }
}

async function loadTransactions() {
    if (isFirebaseEnabled) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists && doc.data().transactions) {
                transactions = doc.data().transactions;
                console.log('Transactions loaded from cloud:', transactions.length);
                
                // Load learned patterns
                if (doc.data().learnedPatterns) {
                    learnedPatterns = doc.data().learnedPatterns;
                    console.log('Learned patterns loaded from cloud:', Object.keys(learnedPatterns).length);
                }
                
                if (doc.data().categoryConfidence) {
                    categoryConfidence = doc.data().categoryConfidence;
                    console.log('Category confidence loaded from cloud');
                }

                if (doc.data().subscriptionOverrides) {
                    subscriptionOverrides = doc.data().subscriptionOverrides;
                    console.log('Subscription overrides loaded from cloud');
                }
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
    
    // Load learned patterns from localStorage
    const savedPatterns = localStorage.getItem('learnedPatterns');
    if (savedPatterns) {
        learnedPatterns = JSON.parse(savedPatterns);
        console.log('Learned patterns loaded from localStorage:', Object.keys(learnedPatterns).length);
    }
    
    const savedConfidence = localStorage.getItem('categoryConfidence');
    if (savedConfidence) {
        categoryConfidence = JSON.parse(savedConfidence);
        console.log('Category confidence loaded from localStorage');
    }

    const savedOverrides = localStorage.getItem('subscriptionOverrides');
    if (savedOverrides) {
        subscriptionOverrides = JSON.parse(savedOverrides);
        console.log('Subscription overrides loaded from localStorage');
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
        'Phones & Internet': 116.00,
        'Charity': 50.00,
        'Daycare': 1100.00,
        'Groceries': 850.00,
        'Restaurants/Entertainment': 300.00,
        'Cat Food': 20.00,
        "Health & Wellness": 90.00,
        "Education & Training": 50.00,
        'Roku / Disney Subscriptions': 25.00,
        'Miscellaneous': 50.00,
        'Emergency Fund': 225.00,
        'Travel Spending': 100.00,
        'Student Investment': 35.00,
        'Child Investment': 25.00,
        'Extra Paid': 0.00
    };
    
    if (isFirebaseEnabled) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists && doc.data().monthlyBudgets) {
                monthlyBudgets = doc.data().monthlyBudgets;
                console.log('Monthly budgets loaded from cloud');
                
                // Auto-fill missing bills with defaults
                const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                let needsSave = false;
                
                months.forEach(month => {
                    if (!monthlyBudgets[month]) {
                        monthlyBudgets[month] = {};
                    }
                    
                    // Add any missing bills from defaults
                    for (const billName in defaultBudgets) {
                        if (monthlyBudgets[month][billName] === undefined) {
                            monthlyBudgets[month][billName] = defaultBudgets[billName];
                            needsSave = true;
                            console.log(`Added missing bill to ${month}: ${billName} = ${defaultBudgets[billName]}`);
                        }
                    }
                });
                
                // Save if we added any missing bills
                if (needsSave) {
                    console.log('Saving updated budgets with missing bills filled in...');
                    await saveMonthlyBudgets();
                }
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
    // Get from current month's budget
    return monthlyBudgets[currentMonth]?.[billName] || 0;
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

    periodicBuckets = {};

    for (const billName in periodicBillsConfig) {
        const config = periodicBillsConfig[billName];

        // Get monthly budget amount
        let monthlyBudget = monthlyBudgets[months[currentMonthIndex]]?.[billName];
        if (!monthlyBudget || monthlyBudget === 0) {
            for (const m of months) {
                if (monthlyBudgets[m]?.[billName] > 0) {
                    monthlyBudget = monthlyBudgets[m][billName];
                    break;
                }
            }
        }
        if ((!monthlyBudget || monthlyBudget === 0) && config.defaultMonthly) {
            monthlyBudget = config.defaultMonthly;
        }
        if (!monthlyBudget || monthlyBudget === 0) continue;

        // Figure out the most recent due date that has already passed (0-indexed month)
        // dueMonth in config is 1-indexed
        const dueMonthIndex = config.dueMonth - 1; // convert to 0-indexed

        // Find the last due month that has passed (could be this year or previous cycle)
        // For quarterly: due months are every 3 months starting from dueMonth
        let lastDueMonthIndex = -1;

        if (config.frequency === 'quarterly') {
            // Due every 3 months: e.g. Jan(0), Apr(3), Jul(6), Oct(9)
            const dueDates = [dueMonthIndex, dueMonthIndex + 3, dueMonthIndex + 6, dueMonthIndex + 9]
                .map(m => m % 12);
            // Find the most recent one that has passed (already paid)
            for (let m = currentMonthIndex; m >= 0; m--) {
                if (dueDates.includes(m)) {
                    lastDueMonthIndex = m;
                    break;
                }
            }
        } else {
            // Annual or semi-annual: last due month that has passed in this cycle
            if (config.frequency === 'semi-annual') {
                const due1 = dueMonthIndex;
                const due2 = (dueMonthIndex + 6) % 12;
                for (let m = currentMonthIndex; m >= 0; m--) {
                    if (m === due1 || m === due2) { lastDueMonthIndex = m; break; }
                }
            } else {
                // annual
                if (dueMonthIndex <= currentMonthIndex) {
                    lastDueMonthIndex = dueMonthIndex;
                }
            }
        }

        // Start accumulating from the month AFTER the last due date (or Jan if no due date passed yet)
        const startMonthIndex = lastDueMonthIndex >= 0 ? lastDueMonthIndex + 1 : 0;

        let bucketBalance = 0;

        for (let i = startMonthIndex; i <= currentMonthIndex; i++) {
            const month = months[i];
            const monthNum = monthNumbers[month];
            const thisMonthBudget = monthlyBudgets[month]?.[billName] || monthlyBudget;

            const monthHasTransactions = transactions.some(t => {
                const tDate = parseLocalDate(t.date);
                const tMonth = String(tDate.getMonth() + 1).padStart(2, '0');
                const tYear = tDate.getFullYear();
                return tMonth === monthNum && tYear === currentYear && t.bill !== 'Ignore/Internal Transfer';
            });

            if (monthHasTransactions) {
                bucketBalance += thisMonthBudget;
            }
        }

        periodicBuckets[billName] = Math.max(0, bucketBalance);
    }

    savePeriodicBuckets();
    return periodicBuckets;
}

// Calculate budget totals from transactions for current month
function updateBudgetFromTransactions() {
    console.log('=== updateBudgetFromTransactions called ===');
    console.log('Current month:', currentMonth);
    console.log('Total transactions:', transactions.length);
    console.log('Transactions array:', transactions);
    
    // Show ALL transactions to debug
    if (transactions.length > 0) {
        console.log('First transaction:', transactions[0]);
        console.log('Sample transactions:', transactions.slice(0, 5));
    } else {
        console.log('NO TRANSACTIONS FOUND!');
        return; // Exit early if no transactions
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
    // Temporarily remove year filter to test
    const currentMonthTransactions = transactions.filter(transaction => {
        const transactionDate = parseLocalDate(transaction.date);
        const transactionMonth = String(transactionDate.getMonth() + 1).padStart(2, '0');
        const transactionYear = transactionDate.getFullYear();
        
        console.log(`Transaction: ${transaction.date} -> Month: ${transactionMonth}, Year: ${transactionYear}, Bill: ${transaction.bill}`);
        
        const monthMatch = transactionMonth === currentMonthNumber;
        const yearMatch = transactionYear === 2026; // Only count 2026 transactions
        const notIgnored = transaction.bill !== 'Ignore/Internal Transfer';
        
        console.log(`  Month match: ${monthMatch} (${transactionMonth} === ${currentMonthNumber}), Year match: ${yearMatch}, Not ignored: ${notIgnored}`);
        
        return monthMatch && yearMatch && notIgnored;
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
        "Health & Wellness", "Education & Training", 'Roku / Disney Subscriptions',
        'Miscellaneous', 'Emergency Fund', 'Travel Spending', 'Student Investment', 'Child Investment',
        'Miscellaneous', 'Miscellaneous', 'Daycare'
    ];
    
    // Update actual amounts and over/under
    let totalActual = 0;
    let extraPaidAmount = (billTotals['Extra Paid'] || 0) + (billTotals['Extra Paid'] || 0);
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
            
            if (billName === 'Extra Paid' || billName === 'Extra Paid') {
                // Extra Paid categories are always positive
                overUnderCell.textContent = `$${actual.toFixed(2)}`;
                overUnderCell.style.color = 'var(--success)';
            } else if (isPeriodicBill(billName)) {
                // Periodic bill logic
                const config = periodicBillsConfig[billName];
                const expectedFullPayment = budget * config.monthsInCycle; // Total amount due for the cycle
                
                if (actual > 0) {
                    // Check if this is a full payment (actual is close to the full cycle amount)
                    const isFullPayment = Math.abs(actual - expectedFullPayment) < (budget * 0.5); // Within half a month's budget
                    
                    if (isFullPayment) {
                        // This is a payment month - compare actual vs expected full payment
                        const difference = actual - expectedFullPayment;
                        
                        if (Math.abs(difference) < 0.01) {
                            // Paid exactly what was due - show $0.00 (green)
                            overUnderCell.textContent = '$0.00';
                            overUnderCell.style.color = 'var(--success)';
                            overUnderCell.title = 'Paid exactly $' + actual.toFixed(2) + ' as expected for ' + config.monthsInCycle + '-month cycle';
                        } else if (difference > 0) {
                            // Overpaid - show as negative (red)
                            overUnderCell.textContent = '-$' + Math.abs(difference).toFixed(2);
                            overUnderCell.style.color = 'var(--danger)';
                            overUnderCell.title = 'Overpaid by $' + Math.abs(difference).toFixed(2) + ' (expected $' + expectedFullPayment.toFixed(2) + ')';
                        } else {
                            // Underpaid - show as negative (red)
                            overUnderCell.textContent = '-$' + Math.abs(difference).toFixed(2);
                            overUnderCell.style.color = 'var(--danger)';
                            overUnderCell.title = 'Underpaid by $' + Math.abs(difference).toFixed(2) + ' (expected $' + expectedFullPayment.toFixed(2) + ')';
                        }
                    } else {
                        // This is a reserve contribution month - show $0.00 (neutral)
                        overUnderCell.textContent = '$0.00';
                        overUnderCell.style.color = '#666';
                        overUnderCell.title = 'Contributing $' + actual.toFixed(2) + ' to reserve (expected $' + budget.toFixed(2) + ')';
                    }
                } else {
                    // No payment this month - show $0.00 (neutral)
                    overUnderCell.textContent = '$0.00';
                    overUnderCell.style.color = '#666';
                    overUnderCell.title = 'No contribution this month (budget: $' + budget.toFixed(2) + ')';
                }
            } else {
                let difference = actual - budget;
                
                // For positive credit bills, show surplus as positive
                if (positiveCreditBills.includes(billName)) {
                    difference = budget - actual; // Flip the calculation
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
    
    // Store this month's over/under for dashboard
    monthlyOverUnder[currentMonth] = totalOverUnder;
    
    // Calculate responsibility subtotals
    const shareATotal = totalBudget * 0.58;
    const shareBTotal = totalBudget * 0.42;
    const shareABiweekly = shareATotal / 2;
    const shareBBiweekly = shareBTotal / 2;
    
    const shareATotalEl = document.getElementById('shareATotal');
    const shareABiweeklyEl = document.getElementById('shareABiweekly');
    const shareBTotalEl = document.getElementById('shareBTotal');
    const shareBBiweeklyEl = document.getElementById('shareBBiweekly');
    
    if (shareATotalEl) shareATotalEl.textContent = `$${shareATotal.toFixed(2)}`;
    if (shareABiweeklyEl) shareABiweeklyEl.textContent = `$${shareABiweekly.toFixed(2)}`;
    if (shareBTotalEl) shareBTotalEl.textContent = `$${shareBTotal.toFixed(2)}`;
    if (shareBBiweeklyEl) shareBBiweeklyEl.textContent = `$${shareBBiweekly.toFixed(2)}`;
}

// Helper function to calculate over/under for any specific month
function calculateMonthOverUnder(monthName) {
    const monthNumbers = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    
    const currentYear = new Date().getFullYear();
    const monthNumber = monthNumbers[monthName];
    
    // Get transactions for this specific month
    const monthTransactions = transactions.filter(transaction => {
        const transactionDate = parseLocalDate(transaction.date);
        const transactionMonth = String(transactionDate.getMonth() + 1).padStart(2, '0');
        const transactionYear = transactionDate.getFullYear();
        return transactionMonth === monthNumber && transactionYear === currentYear && transaction.bill !== 'Ignore/Internal Transfer';
    });
    
    // Calculate bill totals
    const billTotals = {};
    monthTransactions.forEach(transaction => {
        if (!billTotals[transaction.bill]) {
            billTotals[transaction.bill] = 0;
        }
        billTotals[transaction.bill] += transaction.amount;
    });
    
    // Get budgets for this month
    const budgets = monthlyBudgets[monthName] || {};
    
    const positiveCreditBills = [
        'Gas', 'Groceries', 'Restaurants/Entertainment', 'Cat Food', "Health & Wellness",
        "Education & Training", 'Roku / Disney Subscriptions', 'Miscellaneous',
        'Emergency Fund', 'Travel Spending', 'Student Investment', 'Child Investment',
        'Miscellaneous', 'Miscellaneous', 'Daycare'
    ];
    
    let totalOverUnder = 0;
    
    console.log(`=== Calculating ${monthName} over/under ===`);
    
    // Calculate over/under for each bill - EXACTLY match Expenses page
    for (const billName in budgets) {
        const budget = budgets[billName];
        if (budget === null || budget === undefined) continue; // Skip deleted bills
        
        const actual = billTotals[billName] || 0;
        let overUnder = 0;
        
        if (billName === 'Extra Paid' || billName === 'Extra Paid') {
            overUnder = actual;
        } else if (isPeriodicBill(billName)) {
            const config = periodicBillsConfig[billName];
            const expectedFullPayment = budget * config.monthsInCycle;
            
            if (actual > 0) {
                const isFullPayment = Math.abs(actual - expectedFullPayment) < (budget * 0.5);
                
                if (isFullPayment) {
                    const difference = actual - expectedFullPayment;
                    if (Math.abs(difference) < 0.01) {
                        overUnder = 0;
                    } else if (difference > 0) {
                        overUnder = -Math.abs(difference);
                    } else {
                        overUnder = -Math.abs(difference);
                    }
                } else {
                    overUnder = 0;
                }
            } else {
                overUnder = 0;
            }
        } else {
            // Match Expenses page: calculate difference, then flip for positive credit bills
            let difference = actual - budget;
            
            if (positiveCreditBills.includes(billName)) {
                difference = budget - actual; // Flip for positive credit bills
            }
            
            overUnder = difference;
        }
        
        if (overUnder !== 0) {
            console.log(`${billName}: budget=$${budget}, actual=$${actual}, overUnder=$${overUnder.toFixed(2)}`);
        }
        
        totalOverUnder += overUnder;
    }
    
    console.log(`Total over/under for ${monthName}: $${totalOverUnder.toFixed(2)}`);
    
    // Store it
    monthlyOverUnder[monthName] = totalOverUnder;
    
    return totalOverUnder;
}

// Calculate all months' over/under values
function calculateAllMonthsOverUnder() {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    // Use calculateMonthOverUnder directly - no DOM touching, no currentMonth mutation
    months.forEach(month => {
        calculateMonthOverUnder(month);
    });
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
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showNotification('File is too large. Maximum size is 10MB', 'error');
        return;
    }
    
    const fileName = file.name.toLowerCase();
    const isJSON = fileName.endsWith('.json');
    const isCSV = fileName.endsWith('.csv');
    
    if (!isJSON && !isCSV) {
        showNotification('Please upload a .csv or .json file', 'error');
        document.getElementById('csvFileInput').value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onerror = function() {
        showNotification('Error reading file', 'error');
        document.getElementById('csvFileInput').value = '';
    };
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            if (isJSON) {
                parseJSON(content);
            } else {
                parseCSV(content);
            }
        } catch (error) {
            showNotification(`Error parsing file: ${error.message}`, 'error');
            console.error('File parsing error:', error);
            document.getElementById('csvFileInput').value = '';
            csvData = [];
        }
    };
    reader.readAsText(file);
}

function parseCSV(csv) {
    // Parse as CSV
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        showNotification('File must have at least a header and one data row', 'error');
        csvData = [];
        return;
    }
    
    // Parse headers
    const headerLine = lines[0];
    const headers = headerLine.split('\t').length > 1 ? headerLine.split('\t') : headerLine.split(',');
    console.log('Raw header line:', headerLine);
    console.log('Parsed headers:', headers);
    
    csvData = [];
    
    // Detect bank type and column mapping
    const bankConfig = detectBankType(headers);
    if (!bankConfig) {
        showNotification('Could not identify CSV format. Please check that your file has Date, Description, and Amount columns.', 'error');
        console.log('Available headers:', headers);
        return;
    }
    
    showNotification(`✅ Detected ${bankConfig.name} format`);
    console.log('Bank config:', bankConfig);
    
    // Parse data rows - simple split, no complex quote handling
    let skippedRows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Try tab-delimited first, then comma
        const cols = line.split('\t').length > 1 ? line.split('\t') : line.split(',');
        const cleanCols = cols.map(c => c.trim().replace(/^["']|["']$/g, ''));
        
        // Skip rows that don't have enough columns
        if (cleanCols.length < 4) {
            console.log(`Skipping row ${i + 1} - only ${cleanCols.length} columns:`, cleanCols);
            skippedRows.push({ row: i + 1, data: cleanCols, reason: `Only ${cleanCols.length} columns` });
            continue;
        }
        
        const transaction = parseTransaction(cleanCols, bankConfig, i + 1);
        if (transaction && !isDuplicate(transaction)) {
            csvData.push(transaction);
        } else if (transaction) {
            console.log('Duplicate transaction skipped:', transaction);
        } else {
            skippedRows.push({ row: i + 1, data: cleanCols, reason: 'Failed to parse' });
        }
    }
    
    console.log(`Total parsed transactions: ${csvData.length} (from ${lines.length - 1} rows)`);
    if (skippedRows.length > 0) {
        console.warn(`⚠️ Skipped ${skippedRows.length} rows:`);
        skippedRows.forEach(skip => {
            console.warn(`  Row ${skip.row}: ${skip.reason}`, skip.data);
        });
    }
    displayCSVPreview();
}

function parseJSON(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        const items = Array.isArray(data) ? data : (data.transactions ? data.transactions : [data]);
        
        if (!Array.isArray(items) || items.length === 0) {
            showNotification('JSON file must contain an array of transactions or a "transactions" property', 'error');
            csvData = [];
            return;
        }
        
        csvData = [];
        let skippedItems = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // Validate required fields
            if (!item.date || !item.source || (item.amount === undefined || item.amount === null)) {
                skippedItems.push({
                    index: i + 1,
                    reason: `Missing required fields (date: ${item.date}, source: ${item.source}, amount: ${item.amount})`,
                    data: item
                });
                continue;
            }
            
            // Parse the JSON transaction
            const transaction = {
                date: normalizeDate(item.date),
                source: String(item.source).trim(),
                amount: Math.abs(parseFloat(item.amount)),
                bill: item.bill || autoCategorizeBill(item.source),
                account: item.account || 'RCU'
            };
            
            // Validate date parsing
            if (!transaction.date) {
                skippedItems.push({
                    index: i + 1,
                    reason: `Invalid date format: ${item.date}`,
                    data: item
                });
                continue;
            }
            
            // Validate amount
            if (isNaN(transaction.amount) || transaction.amount === 0) {
                skippedItems.push({
                    index: i + 1,
                    reason: `Invalid amount: ${item.amount}`,
                    data: item
                });
                continue;
            }
            
            // Check for duplicates
            if (!isDuplicate(transaction)) {
                csvData.push(transaction);
            } else {
                skippedItems.push({
                    index: i + 1,
                    reason: 'Duplicate transaction',
                    data: item
                });
            }
        }
        
        console.log(`JSON Import: Parsed ${csvData.length} transactions from ${items.length} items`);
        if (skippedItems.length > 0) {
            console.warn(`⚠️ Skipped ${skippedItems.length} items:`);
            skippedItems.forEach(skip => {
                console.warn(`  Item ${skip.index}: ${skip.reason}`, skip.data);
            });
        }
        
        showNotification(`✅ Loaded ${items.length} items from JSON (${csvData.length} valid, ${skippedItems.length} skipped)`);
        displayCSVPreview();
        
    } catch (error) {
        showNotification(`Invalid JSON format: ${error.message}`, 'error');
        console.error('JSON parsing error:', error);
        csvData = [];
    }
}

function detectBankType(headers) {
    const headerStr = headers.join('|').toLowerCase();
    console.log('CSV Headers detected:', headers);
    console.log('Header string:', headerStr);
    console.log('Number of columns:', headers.length);
    
    // Custom format with 5 columns: Date, Description, Amount, Category, Type (where Type is the account)
    // But header only shows 4: Date, Description, Amount, Type
    // The 5th column (actual account) has no header
    if (headers.length >= 4 && headerStr.includes('date') && headerStr.includes('description') && headerStr.includes('amount')) {
        const dateCol = headers.findIndex(h => /^date$/i.test(h));
        const descCol = headers.findIndex(h => /^description$/i.test(h));
        const amountCol = headers.findIndex(h => /^amount$/i.test(h));
        
        // Check if there's a 5th column (account) by looking at data rows
        return {
            name: 'Custom Format (Date/Description/Amount/[Category]/Account)',
            dateCol: dateCol,
            descCol: descCol,
            amountCol: amountCol,
            categoryCol: 3, // Optional category column (might be empty)
            accountCol: 4   // Actual account column (Sams/RCU)
        };
    }
    
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

function parseTransaction(cols, config, rowNum) {
    let dateStr, desc, amount, accountName;
    
    if (rowNum) console.log(`\n=== Parsing Row ${rowNum} ===`);
    console.log('Parsing row with', cols.length, 'columns:', cols);
    
    // Extract date
    dateStr = cols[config.dateCol];
    if (!dateStr || dateStr.includes('#')) {
        console.log(`❌ Row ${rowNum || '?'}: Skipping - invalid date:`, dateStr);
        return null; // Skip rows with ### (Excel overflow)
    }
    
    // Extract description
    desc = cols[config.descCol];
    if (!desc) {
        console.log(`❌ Row ${rowNum || '?'}: Skipping - no description`);
        return null;
    }
    
    // Extract amount based on bank format
    if (config.debitCol !== undefined && config.creditCol !== undefined) {
        // Capital One format (separate debit/credit columns)
        const debit = parseFloat(cols[config.debitCol]?.replace(/[$,()]/g, '')) || 0;
        const credit = parseFloat(cols[config.creditCol]?.replace(/[$,()]/g, '')) || 0;
        amount = debit > 0 ? debit : credit;
    } else {
        // Single amount column
        const amountStr = cols[config.amountCol];
        console.log(`  Amount string: "${amountStr}"`);
        
        if (!amountStr || amountStr.trim() === '' || amountStr.includes('#')) {
            console.log(`❌ Row ${rowNum || '?'}: Skipping - invalid amount:`, amountStr, 'for', desc);
            return null; // Skip ### amounts or empty
        }
        
        // Handle negative amounts in parentheses: ($100.00) or negative sign: -100.00 or bare: 100.00
        let cleanAmount = amountStr.replace(/[$,\s]/g, ''); // Remove $, commas, and spaces
        console.log(`  Cleaned amount: "${cleanAmount}"`);
        
        const isNegative = cleanAmount.includes('(') || cleanAmount.startsWith('-');
        cleanAmount = cleanAmount.replace(/[()-]/g, ''); // Remove parentheses and negative signs
        amount = parseFloat(cleanAmount);
        
        console.log(`  Parsed amount: ${amount}, isNegative: ${isNegative}`);
        
        if (isNaN(amount) || amount === 0) {
            console.log(`❌ Row ${rowNum || '?'}: Skipping - could not parse amount:`, amountStr, '(cleaned:', cleanAmount, ') for', desc);
            return null;
        }
        
        // Keep the sign (don't use Math.abs for negative amounts)
        if (isNegative) amount = -amount;
    }
    
    // Parse and normalize date
    const date = normalizeDate(dateStr);
    if (!date) {
        console.log(`❌ Row ${rowNum || '?'}: Skipping - could not parse date:`, dateStr, 'for', desc);
        return null;
    }
    
    // Extract account - check column 4 (5th column in 0-indexed array)
    if (cols.length > 4 && cols[4] && cols[4].trim()) {
        accountName = cols[4].trim();
        console.log('Found account in column 4:', accountName);
    } else if (config.accountCol !== undefined && cols[config.accountCol]) {
        accountName = cols[config.accountCol].trim();
        console.log('Found account in config.accountCol:', accountName);
    } else {
        // Default
        accountName = 'RCU';
        console.log('Using default account: RCU');
    }
    
    // Normalize account names
    if (accountName.toLowerCase().includes('sam')) accountName = 'Sam\'s';
    if (accountName.toLowerCase().includes('rcu')) accountName = 'RCU';
    
    // Auto-categorize transaction
    const category = autoCategorizeBill(desc);
    
    const transaction = {
        date,
        source: cleanDescription(desc),
        amount: Math.abs(amount), // Store as positive, we'll handle display separately
        bill: category,
        account: accountName
    };
    
    console.log(`✅ Row ${rowNum || '?'}: Parsed successfully:`, transaction);
    return transaction;
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

// Learning system functions
function learnFromCategorization(source, category) {
    const cleanSource = cleanMerchantName(source);
    
    if (!learnedPatterns[cleanSource]) {
        learnedPatterns[cleanSource] = {};
    }
    
    if (!learnedPatterns[cleanSource][category]) {
        learnedPatterns[cleanSource][category] = 0;
    }
    
    learnedPatterns[cleanSource][category]++;
    
    // Update confidence - more occurrences = higher confidence
    const totalOccurrences = Object.values(learnedPatterns[cleanSource]).reduce((sum, count) => sum + count, 0);
    const categoryOccurrences = learnedPatterns[cleanSource][category];
    const confidence = categoryOccurrences / totalOccurrences;
    
    if (!categoryConfidence[cleanSource]) {
        categoryConfidence[cleanSource] = {};
    }
    categoryConfidence[cleanSource][category] = confidence;
    
    console.log(`Learned: ${cleanSource} -> ${category} (confidence: ${(confidence * 100).toFixed(1)}%)`);
    
    // Save the learning
    saveTransactions();
}

function cleanMerchantName(source) {
    // Clean up merchant names for better pattern matching
    return source.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[#\d]+$/, '') // Remove trailing numbers
        .replace(/\s+(store|location|branch)\s*\d*$/i, '') // Remove store numbers
        .replace(/\s+inc\.?$/i, '') // Remove Inc
        .replace(/\s+llc\.?$/i, '') // Remove LLC
        .replace(/\s+corp\.?$/i, '') // Remove Corp
        .replace(/\s+co\.?$/i, '') // Remove Co
        .trim();
}

function getLearnedCategory(source) {
    const cleanSource = cleanMerchantName(source);
    
    if (learnedPatterns[cleanSource]) {
        // Find the category with the highest count
        let bestCategory = null;
        let bestCount = 0;
        let bestConfidence = 0;
        
        for (const [category, count] of Object.entries(learnedPatterns[cleanSource])) {
            if (count > bestCount) {
                bestCount = count;
                bestCategory = category;
                bestConfidence = categoryConfidence[cleanSource]?.[category] || 0;
            }
        }
        
        // Only return if we have reasonable confidence (at least 60% or 3+ occurrences)
        if (bestConfidence >= 0.6 || bestCount >= 3) {
            console.log(`Using learned pattern: ${cleanSource} -> ${bestCategory} (${bestCount} times, ${(bestConfidence * 100).toFixed(1)}% confidence)`);
            return { category: bestCategory, confidence: bestConfidence, learned: true };
        }
    }
    
    return null;
}

function autoCategorizeBill(description) {
    const desc = description.toLowerCase();
    console.log('Categorizing:', desc);
    
    // First, check learned patterns
    const learnedResult = getLearnedCategory(description);
    if (learnedResult) {
        return learnedResult.category;
    }
    
    // Check for internal transfers first
    if (desc.includes('transfer') || desc.includes('internal') || desc.includes('deposit') ||
        desc.includes('withdrawal') || desc.includes('payment to') || desc.includes('payment from') ||
        desc.includes('ach credit') || desc.includes('ach debit') || desc.includes('direct deposit')) {
        return 'Ignore/Internal Transfer';
    }
    
    // Mortgage and Housing - Enhanced matching
    if (desc.includes('mortgage') || desc.includes('loan') || desc.includes('escrow') ||
        desc.includes('home loan') || desc.includes('property tax') || desc.includes('homeowners') ||
        desc.includes('wells fargo home') || desc.includes('quicken loans') || desc.includes('rocket mortgage')) {
        return 'Mortgage + Escrow (Ins-Taxes)';
    }
    
    // Car Payment - Enhanced matching
    if (desc.includes('auto loan') || desc.includes('car payment') || desc.includes('vehicle') ||
        desc.includes('car loan') || desc.includes('auto finance') || desc.includes('toyota financial') ||
        desc.includes('honda financial') || desc.includes('ford credit') || desc.includes('gm financial') ||
        desc.includes('ally auto') || desc.includes('capital one auto')) {
        return 'Car Payment';
    }
    
    // Insurance - More specific matching
    if (desc.includes('insurance') && !desc.includes('health')) {
        if (desc.includes('auto') || desc.includes('car') || desc.includes('vehicle') || 
            desc.includes('geico') || desc.includes('state farm') || desc.includes('progressive') ||
            desc.includes('allstate') || desc.includes('farmers') || desc.includes('usaa')) {
            return 'Auto Insurance';
        }
        if (desc.includes('aaa') || desc.includes('roadside') || desc.includes('triple a')) {
            return 'AAA Roadside Assistance';
        }
        if (desc.includes('jewelers') || desc.includes('jewelry') || desc.includes('personal property')) {
            return 'Jewelers Insurance';
        }
        return 'Auto Insurance'; // Default insurance to auto
    }
    
    // Utilities - Enhanced matching
    if (desc.includes('xcel') || desc.includes('excel energy') || desc.includes('electric') ||
        desc.includes('power company') || desc.includes('utility') || desc.includes('xcel energy') ||
        desc.includes('excel') || desc.includes('electricity') || desc.includes('power bill')) {
        return 'Xcel Energy';
    }
    if (desc.includes('spectrum') || desc.includes('charter') || desc.includes('internet') ||
        desc.includes('cable') || desc.includes('phone service') || desc.includes('comcast') ||
        desc.includes('verizon') || desc.includes('at&t') || desc.includes('centurylink') ||
        desc.includes('broadband') || desc.includes('wifi')) {
        return 'Phones & Internet';
    }
    if (desc.includes('water') || desc.includes('sewer') || desc.includes('water dept') ||
        desc.includes('water district') || desc.includes('municipal water') || desc.includes('h2o')) {
        return 'Water';
    }
    if (desc.includes('garbage') || desc.includes('waste') || desc.includes('earthbound') ||
        desc.includes('trash') || desc.includes('recycling') || desc.includes('sanitation') ||
        desc.includes('refuse') || desc.includes('waste management')) {
        return 'Earthbound Garbage';
    }
    
    // Gas Stations - Enhanced with more stations
    if (desc.includes('shell') || desc.includes('exxon') || desc.includes('bp ') || 
        desc.includes('chevron') || desc.includes('mobil') || desc.includes('conoco') ||
        desc.includes('phillips 66') || desc.includes('speedway') || desc.includes('casey') ||
        desc.includes('kwik trip') || desc.includes('holiday') || desc.includes('sinclair') ||
        desc.includes('valero') || desc.includes('marathon') || desc.includes('citgo') ||
        desc.includes('gas station') || desc.includes('fuel') || desc.includes('petro') ||
        desc.includes('kum & go') || desc.includes('wawa') || desc.includes('sheetz') ||
        desc.includes('circle k') || desc.includes('7-eleven') || desc.includes('pilot') ||
        desc.includes('loves') || desc.includes('flying j') || desc.includes('gas ') ||
        desc.includes('gasoline') || desc.includes('pump')) {
        return 'Gas';
    }
    
    // Groceries - Enhanced with more stores
    if (desc.includes('walmart') || desc.includes('target') || desc.includes('hy-vee') ||
        desc.includes('kroger') || desc.includes('safeway') || desc.includes('costco') ||
        desc.includes('sams club') || desc.includes('aldi') || desc.includes('whole foods') ||
        desc.includes('trader joe') || desc.includes('grocery') || desc.includes('supermarket') ||
        desc.includes('food store') || desc.includes('market') || desc.includes('king soopers') ||
        desc.includes('city market') || desc.includes('sprouts') || desc.includes('meijer') ||
        desc.includes('publix') || desc.includes('wegmans') || desc.includes('giant') ||
        desc.includes('stop & shop') || desc.includes('food lion') || desc.includes('harris teeter') ||
        desc.includes('fresh market') || desc.includes('food 4 less') || desc.includes('ralphs') ||
        desc.includes('vons') || desc.includes('albertsons') || desc.includes('jewel') ||
        desc.includes('festival foods') || desc.includes('fareway')) {
        return 'Groceries';
    }
    
    // Restaurants - Enhanced with more chains
    if (desc.includes('restaurant') || desc.includes('mcdonald') || desc.includes('burger') ||
        desc.includes('pizza') || desc.includes('taco') || desc.includes('subway') ||
        desc.includes('starbucks') || desc.includes('coffee') || desc.includes('cafe') ||
        desc.includes('dine') || desc.includes('grill') || desc.includes('bar ') ||
        desc.includes('kfc') || desc.includes('wendy') || desc.includes('chipotle') ||
        desc.includes('panera') || desc.includes('domino') || desc.includes('papa') ||
        desc.includes('dunkin') || desc.includes('sonic') || desc.includes('arbys') ||
        desc.includes('dairy queen') || desc.includes('chick-fil-a') || desc.includes('applebee') ||
        desc.includes('olive garden') || desc.includes('red lobster') || desc.includes('outback') ||
        desc.includes('buffalo wild') || desc.includes('texas roadhouse') || desc.includes('ihop') ||
        desc.includes('denny') || desc.includes('cracker barrel') || desc.includes('chili') ||
        desc.includes('tgi friday') || desc.includes('red robin') || desc.includes('five guys') ||
        desc.includes('in-n-out') || desc.includes('whataburger') || desc.includes('culver') ||
        desc.includes('shake shack') || desc.includes('panda express') || desc.includes('qdoba') ||
        desc.includes('noodles') || desc.includes('jimmy john') || desc.includes('firehouse') ||
        desc.includes('jersey mike') || desc.includes('which wich') || desc.includes('potbelly')) {
        return 'Restaurants/Entertainment';
    }
    
    // Daycare - Enhanced matching
    if (desc.includes('daycare') || desc.includes('childcare') || desc.includes('preschool') ||
        desc.includes('child care') || desc.includes('nursery') || desc.includes('learning center') ||
        desc.includes('kindercare') || desc.includes('bright horizons') || desc.includes('goddard') ||
        desc.includes('primrose') || desc.includes('little sprouts') || desc.includes('kids academy')) {
        return 'Daycare';
    }
    
    // YMCA - Enhanced matching
    if (desc.includes('ymca') || desc.includes('gym') || desc.includes('fitness') ||
        desc.includes('recreation center') || desc.includes('health club') || desc.includes('y.m.c.a') ||
        desc.includes('young mens christian') || desc.includes('planet fitness') || desc.includes('anytime fitness') ||
        desc.includes('la fitness') || desc.includes('lifetime fitness') || desc.includes('24 hour fitness')) {
        return 'YMCA Membership';
    }
    
    // Subscriptions - Enhanced matching
    if (desc.includes('roku') || desc.includes('disney') || desc.includes('netflix') ||
        desc.includes('hulu') || desc.includes('amazon prime') || desc.includes('spotify') ||
        desc.includes('streaming') || desc.includes('subscription') || desc.includes('apple music') ||
        desc.includes('youtube premium') || desc.includes('paramount') || desc.includes('hbo') ||
        desc.includes('showtime') || desc.includes('peacock') || desc.includes('discovery') ||
        desc.includes('espn+') || desc.includes('disney+')) {
        return 'Roku / Disney Subscriptions';
    }
    
    // Pharmacy/Medical - Enhanced matching
    if (desc.includes('pharmacy') || desc.includes('cvs') || desc.includes('walgreens') ||
        desc.includes('medical') || desc.includes('doctor') || desc.includes('clinic') ||
        desc.includes('hospital') || desc.includes('health') || desc.includes('prescription') ||
        desc.includes('medicine') || desc.includes('drug store') || desc.includes('rite aid') ||
        desc.includes('meijer pharmacy') || desc.includes('walmart pharmacy') || desc.includes('target pharmacy') ||
        desc.includes('costco pharmacy') || desc.includes('kroger pharmacy') || desc.includes('safeway pharmacy')) {
        return "Health & Wellness";
    }
    
    // School related - Enhanced matching
    if (desc.includes('school') || desc.includes('lunch') || desc.includes('cafeteria') ||
        desc.includes('student') || desc.includes('education') || desc.includes('school district') ||
        desc.includes('elementary') || desc.includes('middle school') || desc.includes('high school') ||
        desc.includes('meal plan') || desc.includes('school meals')) {
        return "Education & Training";
    }
    
    // Pet supplies - Enhanced matching
    if (desc.includes('pet') || desc.includes('cat') || desc.includes('dog') || desc.includes('animal') ||
        desc.includes('veterinary') || desc.includes('vet') || desc.includes('petco') || desc.includes('petsmart') ||
        desc.includes('pet supplies') || desc.includes('animal hospital') || desc.includes('pet food') ||
        desc.includes('chewy') || desc.includes('pet store') || desc.includes('tractor supply')) {
        return 'Cat Food';
    }
    
    // Charity - Enhanced matching
    if (desc.includes('charity') || desc.includes('donation') || desc.includes('church') ||
        desc.includes('tithe') || desc.includes('offering') || desc.includes('nonprofit') ||
        desc.includes('salvation army') || desc.includes('goodwill') || desc.includes('united way') ||
        desc.includes('red cross') || desc.includes('catholic') || desc.includes('baptist') ||
        desc.includes('methodist') || desc.includes('lutheran') || desc.includes('presbyterian')) {
        return 'Charity';
    }
    
    // Investment/Savings - Enhanced matching
    if (desc.includes('investment') || desc.includes('savings') || desc.includes('401k') ||
        desc.includes('ira') || desc.includes('retirement') || desc.includes('mutual fund') ||
        desc.includes('vanguard') || desc.includes('fidelity') || desc.includes('schwab') ||
        desc.includes('edward jones') || desc.includes('ameriprise') || desc.includes('merrill lynch')) {
        if (desc.includes('student') || desc.includes('child') || desc.includes('kid')) {
            return 'Student Investment';
        } else if (desc.includes('baby') || desc.includes('baby')) {
            return 'Child Investment';
        } else {
            return 'Emergency Fund';
        }
    }
    
    console.log('No category match found, defaulting to Miscellaneous');
    // Default to Miscellaneous
    return 'Miscellaneous';
}

function isDuplicate(newTransaction) {
    // Only consider it a duplicate if ALL fields match exactly
    return transactions.some(existing => 
        existing.date === newTransaction.date &&
        existing.source === newTransaction.source &&
        existing.account === newTransaction.account &&
        existing.bill === newTransaction.bill &&
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
        <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-main); border-radius: var(--radius-md); border: 1px solid var(--border-light);">
            <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">📊 Import Summary</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; font-size: 0.875rem;">
                <div style="text-align: center; padding: 0.5rem; background: var(--bg-card); border-radius: var(--radius-sm);">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">${csvData.length}</div>
                    <div style="color: var(--text-muted); font-size: 0.75rem;">CSV Rows</div>
                </div>
                <div style="text-align: center; padding: 0.5rem; background: var(--bg-card); border-radius: var(--radius-sm);">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${newTransactions}</div>
                    <div style="color: var(--text-muted); font-size: 0.75rem;">Will Import</div>
                </div>
                <div style="text-align: center; padding: 0.5rem; background: var(--bg-card); border-radius: var(--radius-sm);">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning);">${duplicates}</div>
                    <div style="color: var(--text-muted); font-size: 0.75rem;">Duplicates</div>
                </div>
            </div>
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
    
    // Show first 50 transactions in preview (but import all)
    const previewLimit = 50;
    const transactionsToShow = csvData.slice(0, previewLimit);
    
    transactionsToShow.forEach(row => {
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
    
    if (csvData.length > previewLimit) {
        html += `
            <tr>
                <td colspan="6" style="text-align: center; padding: 1rem; color: var(--text-muted); font-style: italic;">
                    ... and ${csvData.length - previewLimit} more transactions (all will be imported)
                </td>
            </tr>
        `;
    }
    
    html += '</tbody></table>';
    preview.innerHTML = html;
    document.getElementById('confirmImport').disabled = newTransactions === 0;
    
    if (newTransactions === 0) {
        showNotification('All transactions are duplicates - nothing to import', 'warning');
    }
}

function confirmCSVImport() {
    if (csvData.length === 0) return;
    
    const totalInCSV = csvData.length;
    
    // Filter out duplicates
    const newTransactions = csvData.filter(t => !isDuplicate(t));
    const duplicateCount = totalInCSV - newTransactions.length;
    
    if (newTransactions.length === 0) {
        showNotification('No new transactions to import - all are duplicates', 'warning');
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
    
    // Show detailed import metrics
    const message = `
        ✅ Import Complete!<br>
        📊 CSV Rows: ${totalInCSV}<br>
        ✅ Imported: ${newTransactions.length}<br>
        ${duplicateCount > 0 ? `⚠️ Skipped (duplicates): ${duplicateCount}` : ''}
    `;
    
    showNotification(message, 'success');
    
    console.log(`CSV Import Summary:
    - Total rows in CSV: ${totalInCSV}
    - New transactions imported: ${newTransactions.length}
    - Duplicates skipped: ${duplicateCount}
    - Total transactions now: ${transactions.length}`);
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
    calculatePeriodicBuckets(); // Recalculate buckets when switching months
    updateBudgetFromTransactions();
}

function loadMonthBudget(month) {
    // Update the table cells with saved budget values from Firebase ONLY
    
    console.log(`=== loadMonthBudget(${month}) ===`);
    console.log('monthlyBudgets for this month:', monthlyBudgets[month]);
    
    // Get all budget table rows
    const rows = document.querySelectorAll('.budget-table tbody tr');
    
    let totalFromFirebase = 0;
    
    rows.forEach(row => {
        const billNameCell = row.cells[0];
        if (!billNameCell) return;
        
        const billName = billNameCell.textContent.trim();
        
        // Skip separator rows
        if (row.classList.contains('separator')) return;
        
        // Check if bill is marked as deleted (null value in any month)
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const isDeleted = months.some(m => monthlyBudgets[m] && monthlyBudgets[m][billName] === null);
        if (isDeleted) {
            row.style.display = 'none';
            console.log(`Bill ${billName} is marked as deleted, hiding row`);
            return;
        }
        
        // Show the row if it was previously hidden (not deleted)
        row.style.display = '';
        
        // Get saved value from Firebase (no defaults)
        const savedValue = monthlyBudgets[month] && monthlyBudgets[month][billName];
        
        console.log(`Bill: ${billName}, Firebase value: ${savedValue}`);
        
        if (savedValue !== undefined && savedValue !== null) {
            totalFromFirebase += savedValue;
            
            // Update the Monthly Expense cell (column 2, after Due Date column)
            if (row.cells[2]) {
                row.cells[2].textContent = `$${savedValue.toFixed(2)}`;
                console.log(`  Updated cell to: $${savedValue.toFixed(2)}`);
            }
            
            // Update the Edit button onclick with new value
            const editBtn = row.querySelector('.btn-edit');
            if (editBtn) {
                editBtn.setAttribute('onclick', `editBill('${billName.replace(/'/g, "\\'")}', ${savedValue})`);
            }
        } else {
            console.log(`  ⚠️ No value in Firebase for ${billName}`);
        }
    });
    
    console.log(`Total from Firebase for ${month}: $${totalFromFirebase.toFixed(2)}`);
    console.log('=== END loadMonthBudget ===');
}

function updateBudget() {
    // Save current month's budget values
    const budgetInputs = document.querySelectorAll('.budget-input');
    const billNames = [
        'Mortgage + Escrow (Ins-Taxes)', 'Car Payment', 'Auto Insurance', 'AAA Roadside Assistance',
        'Gas', 'Jewelers Insurance', 'Earthbound Garbage', 'Water', 'Xcel Energy', 'Phones & Internet',
        'YMCA Membership', 'Charity', 'Daycare', 'Groceries', 'Restaurants/Entertainment', 'Cat Food',
        "Health & Wellness", "Education & Training", 'Roku / Disney Subscriptions', 'Miscellaneous',
        'Emergency Fund', 'Travel Spending', 'Student Investment', 'Child Investment', 
        'Extra Paid', 'Extra Paid', 'Miscellaneous', 'Miscellaneous'
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
function updateBudgetCategories() {
    // Get current calendar month for dashboard display
    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth(); // 0-11
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const actualCurrentMonth = months[currentMonthIndex];
    
    // Get budgets from actual current month
    const budgets = monthlyBudgets[actualCurrentMonth] || {};
    
    // Calculate category totals
    const housingInsurance = (budgets['Mortgage + Escrow (Ins-Taxes)'] || 0) + 
                             (budgets['Car Payment'] || 0) + 
                             (budgets['Auto Insurance'] || 0) + 
                             (budgets['AAA Roadside Assistance'] || 0) + 
                             (budgets['Jewelers Insurance'] || 0);
    
    const billsUtilities = (budgets['Earthbound Garbage'] || 0) + 
                          (budgets['Water'] || 0) + 
                          (budgets['Xcel Energy'] || 0) + 
                          (budgets['Phones & Internet'] || 0) + 
                          (budgets['Charity'] || 0) + 
                          (budgets['Daycare'] || 0) + 
                          (budgets['Gas'] || 0);
    
    const familyExpenses = (budgets['Groceries'] || 0) + 
                          (budgets['Restaurants/Entertainment'] || 0) + 
                          (budgets['Cat Food'] || 0) + 
                          (budgets["Health & Wellness"] || 0) + 
                          (budgets["Education & Training"] || 0) + 
                          (budgets['Roku / Disney Subscriptions'] || 0) + 
                          (budgets['Miscellaneous'] || 0) + 
                          (budgets['Miscellaneous'] || 0) + 
                          (budgets['Miscellaneous'] || 0);
    
    const savingsInvestment = (budgets['Emergency Fund'] || 0) + 
                             (budgets['Travel Spending'] || 0) + 
                             (budgets['Student Investment'] || 0) + 
                             (budgets['Child Investment'] || 0);
    
    const totalBudget = housingInsurance + billsUtilities + familyExpenses + savingsInvestment;
    
    // Update the HTML
    const categoryItems = document.querySelectorAll('.category-item');
    if (categoryItems.length >= 4) {
        // Housing & Insurance
        categoryItems[0].querySelector('.category-amount').textContent = '$' + housingInsurance.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
        const housingPercent = totalBudget > 0 ? (housingInsurance / totalBudget * 100) : 0;
        categoryItems[0].querySelector('.category-fill').style.width = housingPercent + '%';
        
        // Bills & Utilities
        categoryItems[1].querySelector('.category-amount').textContent = '$' + billsUtilities.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
        const billsPercent = totalBudget > 0 ? (billsUtilities / totalBudget * 100) : 0;
        categoryItems[1].querySelector('.category-fill').style.width = billsPercent + '%';
        
        // Family Expenses
        categoryItems[2].querySelector('.category-amount').textContent = '$' + familyExpenses.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
        const familyPercent = totalBudget > 0 ? (familyExpenses / totalBudget * 100) : 0;
        categoryItems[2].querySelector('.category-fill').style.width = familyPercent + '%';
        
        // Savings & Investment
        categoryItems[3].querySelector('.category-amount').textContent = '$' + savingsInvestment.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
        const savingsPercent = totalBudget > 0 ? (savingsInvestment / totalBudget * 100) : 0;
        categoryItems[3].querySelector('.category-fill').style.width = savingsPercent + '%';
    }
}

function updateDashboard() {
    // Calculate periodic buckets first
    calculatePeriodicBuckets();
    
    // Calculate all months' over/under values
    calculateAllMonthsOverUnder();
    
    // Update budget categories with current month's actual budgets
    updateBudgetCategories();
    
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
    
    let overallTotal = 0; // Current month's total only
    let totalSpent = 0;
    
    // Calculate total budget dynamically from current month's budgets
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentMonthName = months[currentDate.getMonth()]; // e.g., 'feb'
    
    // Calculate ANNUAL budget by summing all 12 months individually
    let totalBudget = 0;
    months.forEach(m => {
        const mBudgets = monthlyBudgets[m] || {};
        for (const billName in mBudgets) {
            const v = mBudgets[billName];
            if (v > 0 && billName !== 'Extra Paid') {
                totalBudget += v;
            }
        }
    });

    console.log(`Dashboard - Annual budget (sum of all months): $${totalBudget.toFixed(2)}`);
    
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
                const transactionDate = parseLocalDate(transaction.date);
                const transactionMonth = String(transactionDate.getMonth() + 1).padStart(2, '0');
                const transactionYear = transactionDate.getFullYear();
                return transactionMonth === monthNumber && transactionYear === currentYear;
            });
            
            // ONLY calculate if there are actual transactions for this month
            if (monthTransactions.length === 0) {
                // No transactions - show $0.00 neutral
                displayAmount = '$0.00';
                amountClass = 'neutral';
                cardClass = 'month-card';
            } else {
                // Use the stored value from monthlyOverUnder (set by updateBudgetFromTransactions)
                monthDifference = monthlyOverUnder[month] || 0;
                
                console.log(`Dashboard ${month}: Using stored value = ${monthDifference}`);
                
                // Count total spent for this month
                monthTransactions.forEach(transaction => {
                    if (transaction.bill !== 'Ignore/Internal Transfer') {
                        totalSpent += transaction.amount;
                    }
                });
                
                // Only add to overall total if this is the CURRENT month
                if (month === currentMonthName) {
                    overallTotal += monthDifference;
                }
                
                amountClass = monthDifference > 0 ? 'positive' : monthDifference < 0 ? 'negative' : 'neutral';
                cardClass = `month-card ${monthDifference >= 0 ? 'surplus' : 'deficit'}`;
                displayAmount = monthDifference === 0 ? '$0.00' : `${monthDifference >= 0 ? '+' : ''}$${Math.abs(monthDifference).toFixed(2)}`;
            }
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
    
    // Update periodic bills breakdown
    updatePeriodicBillsBreakdown();
    
    // Update dashboard month
    updateDashboardMonth();
    
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

function updatePeriodicBillsBreakdown() {
    const breakdownDiv = document.getElementById('periodicBillsBreakdown');
    if (!breakdownDiv) return;
    
    console.log('=== updatePeriodicBillsBreakdown called ===');
    console.log('Current month:', currentMonth);
    console.log('Periodic buckets:', periodicBuckets);
    console.log('Monthly budgets:', monthlyBudgets);
    
    // Use actual current calendar month for dashboard, not the selected month in budget tab
    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth(); // 0-11
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const actualCurrentMonth = months[currentMonthIndex];
    
    let html = '';
    const monthNames = {
        1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
        7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
    };
    
    // Show all periodic bills, even if budget is $0, but skip deleted bills
    let activeBills = 0;
    for (const billName in periodicBillsConfig) {
        const config = periodicBillsConfig[billName];
        
        // Check if bill is deleted (marked as null in any month)
        const isDeleted = months.some(m => monthlyBudgets[m] && monthlyBudgets[m][billName] === null);
        if (isDeleted) {
            console.log(`Skipping ${billName} - marked as deleted`);
            continue;
        }
        
        // Get monthly budget from actual current month (for dashboard display)
        let monthlyBudget = monthlyBudgets[actualCurrentMonth]?.[billName];
        
        // If not found or $0, use default from config
        if (!monthlyBudget || monthlyBudget === 0) {
            monthlyBudget = config.defaultMonthly || 0;
        }
        
        console.log(`${billName}: monthlyBudget = $${monthlyBudget} (from ${actualCurrentMonth} or default)`);
        
        activeBills++;
        const savedAmount = periodicBuckets[billName] || 0;
        const totalNeeded = monthlyBudget > 0 ? monthlyBudget * config.monthsInCycle : 0;
        const progressPercent = totalNeeded > 0 ? (savedAmount / totalNeeded) * 100 : 0;
        
        let dueText = '';
        if (config.dueMonth) {
            // Calculate next due date dynamically
            const now = new Date();
            const nowMonth = now.getMonth() + 1; // 1-indexed
            const nowYear = now.getFullYear();
            const dueMonthNames = {
                1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'May',6:'Jun',
                7:'Jul',8:'Aug',9:'Sep',10:'Oct',11:'Nov',12:'Dec'
            };

            let nextDueMonth = config.dueMonth;
            let nextDueYear = nowYear;

            if (config.frequency === 'quarterly') {
                // Find next quarterly due date
                const dueDates = [config.dueMonth, config.dueMonth+3, config.dueMonth+6, config.dueMonth+9]
                    .map(m => ((m - 1) % 12) + 1);
                nextDueMonth = dueDates.find(m => m >= nowMonth) || dueDates[0];
                if (nextDueMonth < nowMonth) nextDueYear++;
            } else if (config.frequency === 'semi-annual') {
                const due2 = config.dueMonth + 6 > 12 ? config.dueMonth - 6 : config.dueMonth + 6;
                const options = [config.dueMonth, due2].sort((a, b) => a - b);
                nextDueMonth = options.find(m => m >= nowMonth) || options[0];
                if (nextDueMonth < nowMonth) nextDueYear++;
            } else {
                // annual
                if (config.dueMonth < nowMonth) nextDueYear++;
                nextDueMonth = config.dueMonth;
            }

            const freqLabel = config.frequency === 'quarterly' ? 'Quarterly' :
                              config.frequency === 'semi-annual' ? 'Semi-Annual' : 'Annual';
            dueText = `${freqLabel} · Next due: ${dueMonthNames[nextDueMonth]} ${nextDueYear}`;
        } else {
            dueText = config.frequency;
        }
        
        // Determine status color
        let statusColor = 'var(--text-secondary)';
        let statusText = '';
        
        if (totalNeeded > 0 && savedAmount >= totalNeeded) {
            statusColor = 'var(--success)';
            statusText = ' ✓ Ready';
        } else if (totalNeeded > 0 && progressPercent >= 75) {
            statusColor = 'var(--warning)';
            statusText = ' ⚠ Almost Ready';
        }
        
        html += `
            <div style="margin-bottom: 0.75rem; padding: 0.5rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); background: var(--bg-main);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                    <span style="font-weight: 500; font-size: 0.875rem;">${billName}</span>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: ${statusColor};">$${savedAmount.toFixed(2)} / $${totalNeeded.toFixed(2)}${statusText}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${dueText}</div>
                    </div>
                </div>
                <div style="background: var(--border-light); height: 4px; border-radius: 2px; overflow: hidden;">
                    <div style="background: ${statusColor}; height: 100%; width: ${Math.min(progressPercent, 100)}%; transition: width 0.3s ease;"></div>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                    ${progressPercent.toFixed(1)}% saved • $${monthlyBudget.toFixed(2)}/month
                </div>
            </div>
        `;
    }
    
    if (activeBills === 0) {
        html = '<div style="color: var(--text-secondary); font-style: italic;">No active periodic bills</div>';
    }
    
    breakdownDiv.innerHTML = html;
}

function updateDashboardMonth() {
    const dashboardMonth = document.getElementById('dashboardMonth');
    if (!dashboardMonth) return;
    
    const monthNames = {
        jan: 'January', feb: 'February', mar: 'March', apr: 'April',
        may: 'May', jun: 'June', jul: 'July', aug: 'August',
        sep: 'September', oct: 'October', nov: 'November', dec: 'December'
    };
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const actualCurrentMonth = months[currentDate.getMonth()]; // Use actual calendar month
    const monthName = monthNames[actualCurrentMonth] || 'January';
    
    dashboardMonth.textContent = `${monthName} ${currentYear}`;
}


// ============================================
// CARRYOVER TRACKER
// ============================================

let carryoverPayments = [];

async function saveCarryoverPayments() {
    if (isFirebaseEnabled) {
        try {
            await db.collection('users').doc(userId).set({ carryoverPayments, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } catch (e) { localStorage.setItem('carryoverPayments', JSON.stringify(carryoverPayments)); }
    } else { localStorage.setItem('carryoverPayments', JSON.stringify(carryoverPayments)); }
}

async function loadCarryoverPayments() {
    if (isFirebaseEnabled) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists && doc.data().carryoverPayments) { carryoverPayments = doc.data().carryoverPayments; return; }
        } catch (e) {}
    }
    const saved = localStorage.getItem('carryoverPayments');
    if (saved) carryoverPayments = JSON.parse(saved);
}

function showAddCarryoverPayment() {
    document.getElementById('addCarryoverPaymentModal').style.display = 'block';
    document.getElementById('carryoverPaymentDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('carryoverPaymentAmount').value = '';
    document.getElementById('carryoverPaymentPaidBy').value = '';
    document.getElementById('carryoverPaymentNote').value = '';
}

function closeAddCarryoverPayment() {
    document.getElementById('addCarryoverPaymentModal').style.display = 'none';
}

function updateCarryoverTable() {
    const tbody = document.getElementById('carryoverBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const currentMonthIndex = new Date().getMonth(); // 0-11, current month is NOT yet over
    // Only include months that are fully in the past (strictly before current month)
    const monthData = months.map((m, i) => ({ key: m, name: monthNames[i], index: i, overUnder: monthlyOverUnder[m] || 0 }))
                            .filter(m => m.index < currentMonthIndex);
    const sortedPayments = [...carryoverPayments].sort((a, b) => new Date(a.date) - new Date(b.date));
    const monthBalances = monthData.map(m => ({ ...m, remaining: m.overUnder, paymentsApplied: [] }));
    for (const payment of sortedPayments) {
        let rem = payment.amount;
        for (const mb of monthBalances) {
            if (rem <= 0) break;
            if (mb.remaining >= 0) continue;
            const applied = Math.min(rem, Math.abs(mb.remaining));
            mb.remaining += applied;
            mb.paymentsApplied.push({ ...payment, applied });
            rem -= applied;
        }
    }
    let ytdOU = 0, ytdP = 0, ytdB = 0;
    for (const mb of monthBalances) {
        if (mb.overUnder === 0 && mb.paymentsApplied.length === 0) continue;
        ytdOU += mb.overUnder;
        const totalPaid = mb.paymentsApplied.reduce((s, p) => s + p.applied, 0);
        ytdP += totalPaid; ytdB += mb.remaining;
        const balClass = mb.remaining > 0 ? 'carryover-balance-positive' : mb.remaining < 0 ? 'carryover-balance-negative' : 'carryover-balance-zero';
        const paymentsHtml = mb.paymentsApplied.length === 0 ? '<span style="color:var(--text-muted)">�</span>' :
            mb.paymentsApplied.map(p => {
                const cls = p.paidBy === 'Me' ? 'paid-by-primary' : p.paidBy === 'Team' ? 'paid-by-secondary' : 'paid-by-other';
                const d = new Date(p.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                return `<div class="carryover-payment-entry"><span class="${cls}">${p.paidBy}</span> $${p.applied.toFixed(2)} <span style="color:var(--text-muted)">(${d}${p.note ? ' � ' + p.note : ''})</span></div>`;
            }).join('');
        const row = document.createElement('tr');
        row.innerHTML = `<td><strong>${mb.name}</strong></td><td style="color:${mb.overUnder>=0?'var(--success)':'var(--danger)'}">${mb.overUnder>=0?'+':''}$${mb.overUnder.toFixed(2)}</td><td>${paymentsHtml}</td><td class="${balClass}">${mb.remaining>=0?'+':''}$${mb.remaining.toFixed(2)}</td>`;
        tbody.appendChild(row);
    }
    const fmt = (v) => `${v>=0?'+':''}$${v.toFixed(2)}`;
    document.getElementById('carryoverYTDOverUnder').textContent = fmt(ytdOU);
    document.getElementById('carryoverYTDOverUnder').style.color = ytdOU>=0?'var(--success)':'var(--danger)';
    document.getElementById('carryoverYTDPaid').textContent = `$${ytdP.toFixed(2)}`;
    document.getElementById('carryoverYTDBalance').className = ytdB>=0?'carryover-balance-positive':'carryover-balance-negative';
    document.getElementById('carryoverYTDBalance').textContent = fmt(ytdB);
}

// ============================================
// END CARRYOVER TRACKER
// ============================================

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Load saved data first
    await loadTransactions();
    loadFamilyExpenses();
    await loadMonthlyBudgets();
    await loadCarryoverPayments();
    
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
    calculatePeriodicBuckets(); // Calculate buckets before updating budget
    updateBudgetFromTransactions();
    updateBudgetTotals();
    updateTransactionTable();
    updateDashboard();
    updateCarryoverTable();
    
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

    // Refresh data for tabs that build their content dynamically
    if (savedTab === 'subscriptions') updateSubscriptionsTable();
});


// Carryover payment form handler
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('addCarryoverPaymentForm');
    if (!form) return;
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const payment = {
            date: document.getElementById('carryoverPaymentDate').value,
            amount: parseFloat(document.getElementById('carryoverPaymentAmount').value),
            paidBy: document.getElementById('carryoverPaymentPaidBy').value,
            note: document.getElementById('carryoverPaymentNote').value,
            id: Date.now()
        };
        carryoverPayments.push(payment);
        await saveCarryoverPayments();
        closeAddCarryoverPayment();
        updateCarryoverTable();
        showNotification(`Payment of $${payment.amount.toFixed(2)} by ${payment.paidBy} recorded!`);
    });
});
// Transaction modal functions
function showAddTransaction() {
    populateTransactionBillDropdown();
    document.getElementById('addTransactionModal').style.display = 'block';
}

// Populate the transaction bill dropdown from current month's budget
function populateTransactionBillDropdown() {
    const dropdown = document.getElementById('transactionBill');
    const currentBudgets = monthlyBudgets[currentMonth] || {};
    
    // Clear existing options except the first one
    dropdown.innerHTML = '<option value="">Select Bill</option>';
    
    // Add options from current month's budget (excluding deleted bills)
    for (const billName in currentBudgets) {
        if (currentBudgets[billName] !== null && currentBudgets[billName] !== undefined) {
            const option = document.createElement('option');
            option.value = billName;
            option.textContent = billName;
            dropdown.appendChild(option);
        }
    }
    
    // Always add "Ignore/Internal Transfer" option
    const ignoreOption = document.createElement('option');
    ignoreOption.value = 'Ignore/Internal Transfer';
    ignoreOption.textContent = 'Ignore/Internal Transfer';
    dropdown.appendChild(ignoreOption);
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
    const sortedTransactions = [...transactions].sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));
    
    // Group by month
    const groupedByMonth = {};
    sortedTransactions.forEach((transaction, originalIndex) => {
        const date = parseLocalDate(transaction.date);
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
                <td colspan="7"><div class="transaction-divider"></div></td>
            `;
            tbody.appendChild(dividerRow);
            isFirstMonth = false;
        }
        
        // Add month header
        const monthRow = document.createElement('tr');
        monthRow.className = 'month-header';
        monthRow.innerHTML = `
            <td colspan="7"><strong>${monthData.name}</strong></td>
        `;
        tbody.appendChild(monthRow);
        
        // Add transactions for this month
        monthData.transactions.forEach(transaction => {
            const row = document.createElement('tr');
            const date = parseLocalDate(transaction.date);
            const formattedDate = date.toLocaleDateString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric'
            });
            
            // Show green + for actual credits (negative Plaid amounts = money coming in)
            const isCredit = transaction.amount < 0;





            
            const amountClass = isCredit ? 'amount-credit' : '';
            const displayAmount = Math.abs(transaction.amount).toFixed(2);
            const amountPrefix = isCredit ? '+' : '';
            
            row.innerHTML = `
                <td><input type="checkbox" class="transaction-checkbox" data-index="${transaction.originalIndex}" onchange="updateBulkActions()"></td>
                <td class="editable-date" data-field="date" data-index="${transaction.originalIndex}" onclick="editField(this)">${formattedDate}</td>
                <td class="editable-text" data-field="source" data-index="${transaction.originalIndex}" onclick="editField(this)">${transaction.source}</td>
                <td class="editable-amount ${amountClass}" data-field="amount" data-index="${transaction.originalIndex}" onclick="editField(this)">${amountPrefix}$${displayAmount}</td>
                <td class="editable-select" data-field="account" data-index="${transaction.originalIndex}" onclick="editField(this)">${transaction.account || 'RCU'}</td>
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
    const account = document.getElementById('transactionAccount').value;
    const bill = document.getElementById('transactionBill').value;
    
    const editIndex = this.dataset.editIndex;
    
    if (editIndex !== undefined) {
        // Learn from category changes when editing
        const oldBill = transactions[editIndex].bill;
        if (oldBill !== bill) {
            learnFromCategorization(source, bill);
            console.log(`Learning from edit: ${source} -> ${bill}`);
        }
        
        // Update existing transaction
        transactions[editIndex] = {
            date: date,
            source: source,
            amount: amount,
            account: account,
            bill: bill
        };
        saveTransactions();
        showNotification('Transaction updated successfully!');
    } else {
        // Learn from manual categorization when adding
        learnFromCategorization(source, bill);
        console.log(`Learning from new transaction: ${source} -> ${bill}`);
        
        // Add new transaction
        transactions.push({
            date: date,
            source: source,
            amount: amount,
            account: account,
            bill: bill
        });
        
        // Auto-duplicate Miscellaneous transactions to Family Expense Tracking
        if (bill === 'Miscellaneous') {
            familyExpenses.push({
                date: date,
                description: source,
                amount: amount,
                paidBy: 'Joint' // Default to Joint, user can edit if needed
            });
            saveFamilyExpenses();
        }
        
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
            'Gas', 'Jewelers Insurance', 'Earthbound Garbage', 'Water', 'Xcel Energy', 'Phones & Internet',
            'YMCA Membership', 'Charity', 'Daycare', 'Groceries', 'Restaurants/Entertainment', 'Cat Food',
            "Health & Wellness", "Education & Training", 'Roku / Disney Subscriptions', 'Miscellaneous',
            'Emergency Fund', 'Travel Spending', 'Student Investment', 'Child Investment', 
            'Extra Paid', 'Extra Paid', 'Miscellaneous', 'Miscellaneous', 'Ignore/Internal Transfer'
        ];
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            if (cat === currentValue) option.selected = true;
            input.appendChild(option);
        });
    } else if (field === 'account') {
        input = document.createElement('select');
        input.className = 'inline-edit-select';
        const accounts = ['RCU', 'Sam\'s'];
        accounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc;
            option.textContent = acc;
            if (acc === currentValue) option.selected = true;
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
        
        // Learn from category changes
        if (field === 'bill' && newValue !== currentValue) {
            const source = transactions[index].source;
            learnFromCategorization(source, newValue);
            console.log(`Learning: ${source} -> ${newValue}`);
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
        if (input.tagName === 'SELECT') {
            input.remove();
            cell.style.position = '';
        } else {
            cell.textContent = originalText;
        }
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
    
    // For selects: overlay absolutely so row height doesn't change
    // For inputs: replace content normally
    if (input.tagName === 'SELECT') {
        cell.style.position = 'relative';
        cell.appendChild(input);
        input.focus();
    } else {
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();
        if (input.select) input.select();
    }
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
    document.getElementById('transactionAccount').value = transaction.account || 'RCU';
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
        max-width: 350px;
        font-size: 0.875rem;
        line-height: 1.5;
    `;
    
    // Support HTML content
    notification.innerHTML = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Longer display time for success messages with metrics
    const displayTime = message.includes('<br>') ? 5000 : (type === 'error' ? 5000 : 3000);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, displayTime);
}

// Bill management functions
function updateBudgetTotals() {
    let totalBudget = 0;
    let totalActual = 0;
    let totalOverUnder = 0;
    
    const rows = document.querySelectorAll('.budget-table tbody tr:not(.separator)');
    rows.forEach(row => {
        if (row.cells[2] && row.cells[3] && row.cells[4]) {
            const budget = parseFloat(row.cells[2].textContent.replace(/[^0-9.-]/g, '')) || 0;
            const actualSpan = row.cells[3].querySelector('.actual-amount');
            const actual = actualSpan ? parseFloat(actualSpan.textContent.replace(/[^0-9.-]/g, '')) || 0 : 0;
            const overUnder = parseFloat(row.cells[4].textContent.replace(/[^0-9.-]/g, '')) || 0;
            
            totalBudget += budget;
            totalActual += actual;
            totalOverUnder += overUnder;
        }
    });
    
    const totalBudgetEl = document.getElementById('totalBudget');
    const totalActualEl = document.getElementById('totalActual');
    const totalOverUnderEl = document.getElementById('totalOverUnder');
    
    if (totalBudgetEl) totalBudgetEl.textContent = `$${totalBudget.toFixed(2)}`;
    if (totalActualEl) totalActualEl.textContent = `$${totalActual.toFixed(2)}`;
    if (totalOverUnderEl) {
        totalOverUnderEl.textContent = `$${totalOverUnder.toFixed(2)}`;
        totalOverUnderEl.style.color = totalOverUnder >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    
    // Calculate responsibility subtotals from the clean totalBudget value
    const cleanBudget = parseFloat(totalBudget) || 0;
    const shareATotal = cleanBudget * 0.58;
    const shareBTotal = cleanBudget * 0.42;
    const shareABiweekly = shareATotal / 2;
    const shareBBiweekly = shareBTotal / 2;
    
    const shareATotalEl = document.getElementById('shareATotal');
    const shareABiweeklyEl = document.getElementById('shareABiweekly');
    const shareBTotalEl = document.getElementById('shareBTotal');
    const shareBBiweeklyEl = document.getElementById('shareBBiweekly');
    
    if (shareATotalEl) shareATotalEl.textContent = `$${shareATotal.toFixed(2)}`;
    if (shareABiweeklyEl) shareABiweeklyEl.textContent = `$${shareABiweekly.toFixed(2)}`;
    if (shareBTotalEl) shareBTotalEl.textContent = `$${shareBTotal.toFixed(2)}`;
    if (shareBBiweeklyEl) shareBBiweeklyEl.textContent = `$${shareBBiweekly.toFixed(2)}`;
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
    
    // Show month selection for editing
    document.getElementById('monthSelectionGroup').style.display = 'block';
    
    // Check current month by default
    clearAllMonths();
    document.getElementById(`month-${currentMonth}`).checked = true;
}

function showAddBill() {
    document.getElementById('addBillModal').style.display = 'block';
    document.getElementById('billModalTitle').textContent = 'Add Bill';
    document.getElementById('addBillForm').reset();
    document.getElementById('deleteBillBtn').style.display = 'none';
    delete document.getElementById('addBillForm').dataset.editBill;
    
    // Hide month selection for new bills
    document.getElementById('monthSelectionGroup').style.display = 'none';
}

function selectAllMonths() {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    months.forEach(month => {
        document.getElementById(`month-${month}`).checked = true;
    });
}

function clearAllMonths() {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    months.forEach(month => {
        document.getElementById(`month-${month}`).checked = false;
    });
}

function closeAddBill() {
    document.getElementById('addBillModal').style.display = 'none';
}

async function deleteBill() {
    const billName = document.getElementById('addBillForm').dataset.editBill;
    console.log('Deleting bill:', billName);
    if (billName && confirm(`Delete ${billName} from all months?`)) {
        // Mark as deleted by setting to null in all months
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        months.forEach(month => {
            if (!monthlyBudgets[month]) {
                monthlyBudgets[month] = {};
            }
            // Set to null to mark as deleted - persists across refreshes
            monthlyBudgets[month][billName] = null;
        });
        
        // Hide the row from the table
        const rows = document.querySelectorAll('.budget-table tbody tr');
        console.log('Found rows:', rows.length);
        let rowsHidden = 0;
        rows.forEach(row => {
            if (row.cells[0] && row.cells[0].textContent.trim() === billName) {
                console.log('Hiding row for:', billName);
                row.style.display = 'none';
                rowsHidden++;
            }
        });
        console.log('Rows hidden:', rowsHidden);
        
        // Save changes to Firebase - WAIT for completion before closing
        await saveMonthlyBudgets();
        
        // Update displays
        updateDashboard();
        updateBudgetTotals();
        
        showNotification(`✓ ${billName} deleted from all months!`);
        
        // Close modal after a brief delay
        setTimeout(() => closeAddBill(), 300);
    }
}

// Add Bill form submission
document.getElementById('addBillForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const billName = document.getElementById('billName').value;
    const amount = parseFloat(document.getElementById('billAmount').value);
    const isEdit = this.dataset.editBill;
    
    if (isEdit) {
        // EDIT MODE: Update existing bill
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const selectedMonths = months.filter(month => 
            document.getElementById(`month-${month}`).checked
        );
        
        if (selectedMonths.length === 0) {
            showNotification('Please select at least one month to apply changes to', 'error');
            return;
        }
        
        // Update the bill amount for selected months
        selectedMonths.forEach(month => {
            if (!monthlyBudgets[month]) {
                monthlyBudgets[month] = {};
            }
            monthlyBudgets[month][isEdit] = amount;
        });
        
        // Update the table display if current month is selected
        if (selectedMonths.includes(currentMonth)) {
            const rows = document.querySelectorAll('.budget-table tbody tr');
            rows.forEach(row => {
                if (row.cells[0] && row.cells[0].textContent.trim() === isEdit) {
                    row.style.display = ''; // Make sure it's visible
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
            
            // Update totals
            updateBudgetTotals();
        }
        
        // Save to cloud/localStorage - WAIT for completion
        await saveMonthlyBudgets();
        updateDashboard();
        
        const monthText = selectedMonths.length === 1 ? 
            selectedMonths[0].toUpperCase() : 
            `${selectedMonths.length} months`;
        showNotification(`✓ ${billName} updated to $${amount.toFixed(2)} for ${monthText}!`);
        
        // Close modal after a brief delay to ensure all updates complete
        setTimeout(() => closeAddBill(), 300);
    } else {
        // ADD MODE: Create new bill (currently limited - would need UI for month selection)
        // For now, add to current month only
        if (!monthlyBudgets[currentMonth]) {
            monthlyBudgets[currentMonth] = {};
        }
        monthlyBudgets[currentMonth][billName] = amount;
        
        // Save to cloud/localStorage - WAIT for completion
        await saveMonthlyBudgets();
        updateDashboard();
        
        showNotification(`✓ ${billName} added to ${currentMonth.toUpperCase()}!`);
        
        // Close modal after a brief delay
        setTimeout(() => closeAddBill(), 300);
    }
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

function showMonthlyBudget() {
    // Show budget table and hide family expense content
    document.querySelector('.budget-table-container').style.display = 'block';
    document.getElementById('familyExpenseContent').style.display = 'none';
    document.getElementById('currentMonthTitle').style.display = 'block';
    document.querySelector('.add-transaction').style.display = 'flex';
    
    // Update active tab back to current month
    document.querySelectorAll('.month-tab').forEach(tab => tab.classList.remove('active'));
    const currentMonthTab = document.querySelector(`[onclick="showMonth('${currentMonth}')"]`);
    if (currentMonthTab) currentMonthTab.classList.add('active');
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
            
            if (recognition.currentField === 'quickVoice') {
                processQuickVoiceTransaction(transcript);
            } else {
                processVoiceInput(transcript);
            }
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
        case 'date':
            const date = parseVoiceDate(transcript);
            if (date) {
                document.getElementById('transactionDate').value = date;
                showNotification(`Date set to ${date}`, 'success');
            } else {
                showNotification('Could not understand date. Try "today", "yesterday", or "MM/DD/YYYY"', 'error');
            }
            break;
            
        case 'source':
            document.getElementById('transactionSource').value = capitalizeWords(transcript);
            showNotification(`Location: ${capitalizeWords(transcript)}`, 'success');
            break;
            
        case 'amount':
            const amount = extractAmount(transcript);
            if (amount) {
                document.getElementById('transactionAmount').value = amount;
                showNotification(`Amount: $${amount}`, 'success');
            } else {
                showNotification('Could not understand amount. Please try again.', 'error');
            }
            break;
            
        case 'bill':
            const billCategory = matchBillCategory(transcript);
            if (billCategory) {
                document.getElementById('transactionBill').value = billCategory;
                showNotification(`Category: ${billCategory}`, 'success');
            } else {
                showNotification('Could not match bill category. Please select manually or say the category name.', 'error');
            }
            break;
    }
    
    stopListening();
}

// Parse voice input for dates
function parseVoiceDate(transcript) {
    const today = new Date();
    
    // Handle relative dates
    if (transcript.includes('today')) {
        return formatDateForInput(today);
    }
    if (transcript.includes('yesterday')) {
        today.setDate(today.getDate() - 1);
        return formatDateForInput(today);
    }
    
    // Try to parse MM/DD/YYYY or similar formats
    const dateMatch = transcript.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})?/);
    if (dateMatch) {
        let month = parseInt(dateMatch[1]);
        let day = parseInt(dateMatch[2]);
        let year = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear();
        
        // Handle 2-digit year
        if (year < 100) {
            year += 2000;
        }
        
        // Validate
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            return formatDateForInput(date);
        }
    }
    
    return null;
}

// Format date for HTML input[type="date"]
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
        'Gas', 'Jewelers Insurance', 'Earthbound Garbage', 'Water', 'Xcel Energy', 'Phones & Internet',
        'YMCA Membership', 'Charity', 'Daycare', 'Groceries', 'Restaurants/Entertainment', 'Cat Food',
        "Health & Wellness", "Education & Training", 'Roku / Disney Subscriptions', 'Miscellaneous',
        'Emergency Fund', 'Travel Spending', 'Student Investment', 'Child Investment', 'Extra Paid'
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
        'spectrum': 'Phones & Internet',
        'phone': 'Phones & Internet',
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
        'health wellness': "Health & Wellness",
        'medication': "Health & Wellness",
        'medicine': "Health & Wellness",
        'school lunch': "Education & Training",
        'lunch': "Education & Training",
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
        'student investment': 'Student Investment',
        'child investment': 'Child Investment',
        'investment': 'Student Investment',
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

// Learned Patterns Management
function showLearnedPatterns() {
    document.getElementById('learnedPatternsModal').style.display = 'block';
    displayLearnedPatterns();
}

function closeLearnedPatterns() {
    document.getElementById('learnedPatternsModal').style.display = 'none';
}

function displayLearnedPatterns() {
    const content = document.getElementById('learnedPatternsContent');
    
    if (Object.keys(learnedPatterns).length === 0) {
        content.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <p>No learned patterns yet.</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem;">
                    The system will learn as you categorize transactions. Try importing a CSV or manually categorizing some expenses!
                </p>
            </div>
        `;
        return;
    }
    
    // Sort merchants by total occurrences
    const sortedMerchants = Object.entries(learnedPatterns).sort((a, b) => {
        const totalA = Object.values(a[1]).reduce((sum, count) => sum + count, 0);
        const totalB = Object.values(b[1]).reduce((sum, count) => sum + count, 0);
        return totalB - totalA;
    });
    
    let html = '<div style="display: flex; flex-direction: column; gap: 0.75rem;">';
    
    sortedMerchants.forEach(([merchant, categories]) => {
        const totalOccurrences = Object.values(categories).reduce((sum, count) => sum + count, 0);
        
        // Find the primary category (highest count)
        let primaryCategory = '';
        let primaryCount = 0;
        let primaryConfidence = 0;
        
        for (const [category, count] of Object.entries(categories)) {
            if (count > primaryCount) {
                primaryCount = count;
                primaryCategory = category;
                primaryConfidence = categoryConfidence[merchant]?.[category] || 0;
            }
        }
        
        const confidencePercent = (primaryConfidence * 100).toFixed(0);
        const confidenceColor = primaryConfidence >= 0.8 ? 'var(--success)' : 
                               primaryConfidence >= 0.6 ? 'var(--warning)' : 
                               'var(--text-muted)';
        
        html += `
            <div style="background: var(--bg-main); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">${merchant}</div>
                        <div style="font-size: 0.8125rem; color: var(--text-secondary);">→ ${primaryCategory}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.75rem; color: ${confidenceColor}; font-weight: 600;">${confidencePercent}% confident</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${totalOccurrences} occurrence${totalOccurrences > 1 ? 's' : ''}</div>
                    </div>
                </div>
                ${Object.keys(categories).length > 1 ? `
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-light);">
                        Also categorized as: ${Object.entries(categories)
                            .filter(([cat]) => cat !== primaryCategory)
                            .map(([cat, count]) => `${cat} (${count}x)`)
                            .join(', ')}
                    </div>
                ` : ''}
                <button class="btn-delete" onclick="deleteLearnedPattern('${merchant.replace(/'/g, "\\'")}');" style="margin-top: 0.5rem; font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                    Forget this pattern
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    content.innerHTML = html;
}

function deleteLearnedPattern(merchant) {
    if (confirm(`Forget all learned patterns for "${merchant}"?`)) {
        delete learnedPatterns[merchant];
        delete categoryConfidence[merchant];
        saveTransactions();
        displayLearnedPatterns();
        showNotification(`Forgot patterns for ${merchant}`);
    }
}

function clearLearnedPatterns() {
    if (confirm('Clear ALL learned patterns? This cannot be undone.')) {
        learnedPatterns = {};
        categoryConfidence = {};
        saveTransactions();
        displayLearnedPatterns();
        showNotification('All learned patterns cleared');
    }
}

// Quick voice transaction entry
function quickVoiceTransaction() {
    if (!recognition) {
        showNotification('Voice recognition not supported in this browser', 'error');
        return;
    }
    
    if (isListening) {
        stopListening();
        return;
    }
    
    isListening = true;
    recognition.currentField = 'quickVoice';
    
    const button = document.querySelector('button[onclick="quickVoiceTransaction()"]');
    if (button) {
        button.textContent = '🔴 Listening...';
        button.classList.add('listening');
    }
    
    showNotification('Listening... Say your transaction details', 'info');
    recognition.start();
}

// Process quick voice transaction
function processQuickVoiceTransaction(transcript) {
    console.log('Quick voice input:', transcript);
    
    // Try to parse: "date, location, amount" format
    // e.g., "today, walmart, 45 dollars"
    
    const parts = transcript.split(',').map(p => p.trim());
    
    if (parts.length < 2) {
        showNotification('Please say: date, location, and amount', 'error');
        return;
    }
    
    // Parse date (first part)
    const dateStr = parseVoiceDate(parts[0]);
    if (!dateStr) {
        showNotification('Could not understand the date. Try "today", "yesterday", or a date like "6 5 2026"', 'error');
        return;
    }
    
    // Parse location (second part)
    const location = capitalizeWords(parts[1]);
    
    // Parse amount (third part if exists, otherwise look in the whole transcript)
    let amount = null;
    if (parts.length > 2) {
        amount = extractAmount(parts[2]);
    } else {
        amount = extractAmount(transcript);
    }
    
    if (!amount) {
        showNotification('Could not understand the amount. Please say a number like "forty five"', 'error');
        return;
    }
    
    // Fill in the form
    document.getElementById('transactionDate').value = dateStr;
    document.getElementById('transactionSource').value = location;
    document.getElementById('transactionAmount').value = amount;
    
    // Set default category to first available bill or "Miscellaneous"
    const billSelect = document.getElementById('transactionBill');
    if (billSelect.options.length > 1) {
        billSelect.value = billSelect.options[1].value;
    }
    
    showNotification(`✓ Transaction: ${location}, $${amount} on ${dateStr}`, 'success');
    stopListening();
}

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

// Cleanup function to remove all null/undefined values from monthlyBudgets
async function cleanupNullBills() {
    console.log('Starting cleanup of null bills...');
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    let removedCount = 0;
    
    months.forEach(month => {
        if (monthlyBudgets[month]) {
            const billNames = Object.keys(monthlyBudgets[month]);
            billNames.forEach(billName => {
                const value = monthlyBudgets[month][billName];
                if (value === null || value === undefined) {
                    console.log(`Removing null bill: ${billName} from ${month}`);
                    delete monthlyBudgets[month][billName];
                    removedCount++;
                }
            });
        }
    });
    
    console.log(`Cleanup complete! Removed ${removedCount} null bill entries.`);
    
    // Save the cleaned data
    await saveMonthlyBudgets();
    
    // Update displays
    updateDashboard();
    updateBudgetTotals();
    
    alert(`Database cleanup complete! Removed ${removedCount} null bill entries.`);
}

// REMOVED AUTO-CLEANUP - Run manually if needed by calling cleanupNullBills() in console



// Function to copy January budget to all other months (one-time fix)
async function copyJanuaryToAllMonths() {
    const janBudget = monthlyBudgets['jan'];
    if (!janBudget) {
        alert('January budget not found!');
        return;
    }
    
    const months = ['feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    console.log('Copying January budget to all months...');
    console.log('January budget:', janBudget);
    
    months.forEach(month => {
        // Copy all bills from January to this month
        monthlyBudgets[month] = { ...janBudget };
        console.log(`Copied to ${month}`);
    });
    
    // Save to Firebase
    await saveMonthlyBudgets();
    
    // Update displays
    updateDashboard();
    updateBudgetTotals();
    
    alert('Successfully copied January budget to all months!');
}

// Call this function once to fix your budget
console.log('To fix your budget, open console and run: copyJanuaryToAllMonths()');


// Function to initialize all months with complete default budgets
async function initializeAllMonthsWithDefaults() {
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
        'Phones & Internet': 116.00,
        'Charity': 50.00,
        'Daycare': 1100.00,
        'Groceries': 850.00,
        'Restaurants/Entertainment': 300.00,
        'Cat Food': 20.00,
        "Health & Wellness": 90.00,
        "Education & Training": 50.00,
        'Roku / Disney Subscriptions': 25.00,
        'Miscellaneous': 50.00,
        'Emergency Fund': 225.00,
        'Travel Spending': 100.00,
        'Student Investment': 35.00,
        'Child Investment': 25.00,
        'Extra Paid': 0.00
    };
    
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    console.log('Initializing all months with complete default budgets...');
    
    months.forEach(month => {
        monthlyBudgets[month] = { ...defaultBudgets };
        console.log(`Initialized ${month} with ${Object.keys(defaultBudgets).length} bills`);
    });
    
    // Save to Firebase
    await saveMonthlyBudgets();
    
    // Update displays
    updateDashboard();
    updateBudgetTotals();
    
    const total = Object.values(defaultBudgets).reduce((sum, val) => sum + val, 0);
    alert(`Successfully initialized all months with complete budgets!\nMonthly total: $${total.toFixed(2)}\nAnnual total: $${(total * 12).toFixed(2)}`);
}

console.log('To initialize all months with complete budgets, run: initializeAllMonthsWithDefaults()');


// Function to rename Spectrum entries to "Phones & Internet"
async function fixSpectrumBill() {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    months.forEach(month => {
        if (monthlyBudgets[month]) {
            let newValue = 116; // Default value
            
            // Check if either old name exists and get the value
            if (monthlyBudgets[month]['Spectrum Phone']) {
                newValue = monthlyBudgets[month]['Spectrum Phone'];
                delete monthlyBudgets[month]['Spectrum Phone'];
                console.log(`Removed "Spectrum Phone" from ${month}`);
            }
            
            if (monthlyBudgets[month]['Phones & Internet']) {
                newValue = monthlyBudgets[month]['Phones & Internet'];
                delete monthlyBudgets[month]['Phones & Internet'];
                console.log(`Removed "Phones & Internet" from ${month}`);
            }
            
            // Add the new name
            monthlyBudgets[month]['Phones & Internet'] = newValue;
            console.log(`Added "Phones & Internet" to ${month} with value ${newValue}`);
        }
    });
    
    await saveMonthlyBudgets();
    
    // Reload the current month
    loadMonthBudget(currentMonth);
    updateBudgetFromTransactions();
    updateBudgetTotals();
    updateDashboard();
    
    alert('Renamed to "Phones & Internet" for all months!');
}

console.log('To fix Spectrum bill mismatch, run: fixSpectrumBill()');



/**
 * Clean up duplicate transactions - UI wrapper
 */
async function cleanupDuplicatesUI() {
    const result = confirm(
        '🧹 Remove Duplicate Transactions?\n\n' +
        'This will remove any transactions with identical:\n' +
        '• Date\n' +
        '• Source/Merchant\n' +
        '• Amount\n' +
        '• Account\n\n' +
        'WARNING: This cannot be undone!'
    );
    
    if (!result) {
        console.log('Cleanup cancelled');
        return;
    }
    
    console.log('Starting duplicate cleanup...');
    
    try {
        const seen = new Map();
        const toKeep = [];
        let duplicatesFound = 0;
        
        for (const tx of transactions) {
            const key = `${tx.date}|${(tx.source || '').toLowerCase()}|${tx.amount}|${tx.account || 'RCU'}`;
            if (seen.has(key)) {
                duplicatesFound++;
            } else {
                seen.set(key, tx);
                toKeep.push(tx);
            }
        }
        
        if (duplicatesFound === 0) {
            showNotification('✅ No duplicates found!', 'success');
            console.log('No duplicates found');
            return;
        }
        
        transactions = toKeep;
        await saveTransactions();
        updateTransactionTable();
        updateBudgetFromTransactions();
        updateDashboard();
        
        const message = `✅ Cleanup Complete!\n🗑️ Removed: ${duplicatesFound}\n✓ Kept: ${transactions.length}`;
        showNotification(message, 'success');
        
        console.log(`
╔════════════════════════════════════════╗
║   DUPLICATE CLEANUP COMPLETE          ║
╠════════════════════════════════════════╣
║ Duplicates Removed: ${duplicatesFound.toString().padStart(19)}│
║ Transactions Kept:  ${transactions.length.toString().padStart(19)}│
╚════════════════════════════════════════╝`);
        
    } catch (error) {
        console.error('Error during cleanup:', error);
        showNotification('❌ Error during cleanup: ' + error.message, 'error');
    }
}


// ============================================
// RECURRING / SUBSCRIPTIONS
// Detects merchants charged across 2+ different months from transaction history,
// splits them into "Subscriptions" (streaming/software/memberships) and general
// "Recurring" spend, and lets you reclassify any merchant manually.
// ============================================

// Everyday / variable-spend categories that clutter the Recurring list.
// These are hidden from the Recurring side (unless you manually move an item there),
// so the section focuses on real recurring bills and subscriptions.
const EVERYDAY_CATEGORIES = [
    'Gas', 'Groceries', 'Restaurants/Entertainment', 'Cat Food', 'Miscellaneous',
    'Health & Wellness', 'Education & Training', 'Travel Spending'
];

// Known subscription/streaming/service merchants used for auto-classification
const SUBSCRIPTION_KEYWORDS = [
    'netflix', 'hulu', 'disney', 'disney+', 'spotify', 'roku', 'hbo', 'max ', 'paramount', 'peacock',
    'apple tv', 'apple.com', 'apple music', 'itunes', 'youtube', 'youtube premium', 'prime video',
    'amazon prime', 'audible', 'sirius', 'pandora', 'adobe', 'microsoft', 'microsoft 365', 'office 365',
    'google storage', 'google one', 'dropbox', 'icloud', 'patreon', 'nyt', 'wall street journal',
    'espn+', 'dazn', 'crunchyroll', 'playstation', 'ps plus', 'xbox', 'xbox premium', 'game pass',
    'nintendo', 'twitch', 'notion', 'canva', 'grammarly', 'linkedin', 'peloton', 'planet fitness',
    'anytime fitness', 'membership', 'helium mobile', 'spectrum mobile'
];

// Build the list of recurring merchants with classification applied (overrides respected)
function computeRecurringMerchants() {
    const median = (arr) => {
        const s = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };
    const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (!transactions || transactions.length === 0) return [];

    // Group transactions by normalized merchant name (skip internal transfers/ignored)
    const groups = {};
    transactions.forEach(t => {
        if (!t.source || !t.date) return;
        if (t.bill === 'Ignore/Internal Transfer') return;
        const d = parseLocalDate(String(t.date));
        if (!d || isNaN(d.getTime())) return;
        const key = cleanMerchantName(t.source);
        if (!key) return;
        if (!groups[key]) {
            groups[key] = { key, display: t.source, category: t.bill, dates: [], amounts: [], latest: d };
        }
        groups[key].dates.push(d);
        groups[key].amounts.push(Math.abs(parseFloat(t.amount) || 0));
        if (d >= groups[key].latest) {
            groups[key].latest = d;
            groups[key].display = t.source;
            groups[key].category = t.bill;
        }
    });

    // Auto-classify a merchant as a "Subscription" ONLY when it clearly is a
    // streaming/software/membership service (by known merchant keyword or a
    // "Subscription" category). Everything else defaults to general "Recurring"
    // spend; the user can move items manually.
    const autoClassify = (name, category) => {
        const n = (name || '').toLowerCase();
        const cat = (category || '').toLowerCase();
        if (cat.includes('subscription')) return 'Subscription';
        if (SUBSCRIPTION_KEYWORDS.some(k => n.includes(k))) return 'Subscription';
        return 'Recurring';
    };

    const results = [];
    Object.values(groups).forEach(g => {
        const distinctMonths = new Set(g.dates.map(monthKey));
        if (distinctMonths.size < 2) return; // need 2+ different months to count as recurring

        const sortedDates = [...g.dates].sort((a, b) => a - b);
        const first = sortedDates[0];
        const last = sortedDates[sortedDates.length - 1];
        const spanMonths = (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1;
        const totalSpent = g.amounts.reduce((a, b) => a + b, 0);
        const estMonthly = totalSpent / Math.max(spanMonths, 1);

        // Estimate frequency from the average gap between consecutive charges
        let freq = 'Recurring';
        if (sortedDates.length >= 2) {
            let totalGap = 0;
            for (let i = 1; i < sortedDates.length; i++) {
                totalGap += (sortedDates[i] - sortedDates[i - 1]) / 86400000;
            }
            const avgGap = totalGap / (sortedDates.length - 1);
            if (avgGap <= 10) freq = 'Weekly';
            else if (avgGap <= 24) freq = 'Biweekly';
            else if (avgGap <= 45) freq = 'Monthly';
            else if (avgGap <= 100) freq = 'Quarterly';
            else freq = 'Occasional';
        }

        const autoType = autoClassify(g.display, g.category);
        // Manual override takes precedence
        const type = subscriptionOverrides[g.key] || autoType;

        results.push({
            key: g.key,
            display: g.display,
            category: g.category || 'Uncategorized',
            type,
            autoType,
            overridden: !!subscriptionOverrides[g.key],
            typical: median(g.amounts),
            freq,
            count: g.dates.length,
            last: last,
            estMonthly,
            estYearly: estMonthly * 12
        });
    });

    return results;
}

// Render one merchant list into a tbody. moveTo = the type the "Move" button switches to.
function renderRecurringList(tbodyId, items, moveTo) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.25rem; color:var(--text-muted);">None detected yet</td></tr>`;
        return;
    }

    const moveLabel = moveTo === 'Subscription' ? '→ Subscription' : '→ Recurring';

    items.forEach(r => {
        const row = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.textContent = r.display;
        if (r.overridden) {
            const mark = document.createElement('span');
            mark.title = 'Manually set';
            mark.style.color = 'var(--primary)';
            mark.textContent = ' ✎';
            nameTd.appendChild(mark);
        }

        const catTd = document.createElement('td');
        catTd.textContent = r.category;

        const typTd = document.createElement('td');
        typTd.textContent = '$' + r.typical.toFixed(2);

        const freqTd = document.createElement('td');
        freqTd.textContent = r.freq;

        const monTd = document.createElement('td');
        monTd.textContent = '$' + r.estMonthly.toFixed(2);

        const actTd = document.createElement('td');
        const btn = document.createElement('button');
        btn.className = 'btn-edit';
        btn.textContent = moveLabel;
        // Attach handler directly - avoids any string-escaping issues with merchant keys
        btn.addEventListener('click', () => reclassifyMerchant(r.key, moveTo));
        actTd.appendChild(btn);

        row.appendChild(nameTd);
        row.appendChild(catTd);
        row.appendChild(typTd);
        row.appendChild(freqTd);
        row.appendChild(monTd);
        row.appendChild(actTd);
        tbody.appendChild(row);
    });
}

function updateSubscriptionsTable() {
    const subBody = document.getElementById('subscriptionsBody');
    const recBody = document.getElementById('recurringBody');
    if (!subBody && !recBody) return;

    const data = computeRecurringMerchants();
    const subs = data.filter(r => r.type === 'Subscription').sort((a, b) => b.estMonthly - a.estMonthly);
    // Recurring side: hide everyday/variable spend (groceries, gas, restaurants, etc.)
    // unless the user has explicitly moved that merchant into Recurring.
    const recs = data
        .filter(r => r.type === 'Recurring' && (r.overridden || !EVERYDAY_CATEGORIES.includes(r.category)))
        .sort((a, b) => b.estMonthly - a.estMonthly);

    renderRecurringList('subscriptionsBody', subs, 'Recurring');
    renderRecurringList('recurringBody', recs, 'Subscription');

    // Per-side summaries (monthly + yearly + count)
    const subMonthly = subs.reduce((a, r) => a + r.estMonthly, 0);
    const recMonthly = recs.reduce((a, r) => a + r.estMonthly, 0);

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('subsSubMonthly', '$' + subMonthly.toFixed(2));
    setText('subsSubYearly', '$' + (subMonthly * 12).toFixed(2));
    setText('subsSubCount', String(subs.length));
    setText('subsRecMonthly', '$' + recMonthly.toFixed(2));
    setText('subsRecYearly', '$' + (recMonthly * 12).toFixed(2));
    setText('subsRecCount', String(recs.length));
}

// Manually move a merchant between Subscription and Recurring; persists the choice.
async function reclassifyMerchant(key, newType) {
    subscriptionOverrides[key] = newType;
    await saveSubscriptionOverrides();
    updateSubscriptionsTable();
    showNotification(`✓ Moved to ${newType}`);
}
