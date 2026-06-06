# Emergency Duplicate Cleanup - Manual Instructions

Since the UI button isn't showing, use this manual approach:

## Option 1: Console Command (Easiest - 30 seconds)

1. **Open your browser** (Chrome, Firefox, Safari, Edge)
2. Press **F12** to open Developer Tools
3. Click the **"Console"** tab
4. **Copy and paste this entire command:**

```javascript
(async function() {
    if (!transactions || transactions.length === 0) { alert('No transactions found'); return; }
    const seen = new Map();
    const toKeep = [];
    let duplicatesFound = 0;
    for (const tx of transactions) {
        const key = `${tx.date}|${(tx.source || '').toLowerCase()}|${tx.amount}|${tx.account || 'RCU'}`;
        if (seen.has(key)) {
            duplicatesFound++;
            console.log(`Duplicate removed: ${key}`);
        } else {
            seen.set(key, tx);
            toKeep.push(tx);
        }
    }
    transactions = toKeep;
    await saveTransactions();
    console.log(`✅ DONE: Removed ${duplicatesFound} duplicates! Kept ${transactions.length} transactions.`);
    updateTransactionTable();
    updateBudgetFromTransactions();
    updateDashboard();
    alert(`✅ Cleanup Complete!\nDuplicates removed: ${duplicatesFound}\nTransactions remaining: ${transactions.length}`);
})();
```

5. Press **Enter**
6. Wait for the alert saying "✅ Cleanup Complete!"
7. Your duplicates are gone! ✅

---

## What This Does

- Scans all your transactions
- Identifies duplicates (same date + source + amount + account)
- Removes duplicates (keeps first occurrence)
- Saves to Firebase
- Updates your transaction display

---

## Option 2: Step by Step (If you prefer to see progress)

Open Console (F12 → Console) and run these one at a time:

```javascript
// 1. Check how many you have
console.log('Total transactions:', transactions.length);
```

```javascript
// 2. Find duplicates
const seen = new Map();
let duplicatesFound = 0;
for (const tx of transactions) {
    const key = `${tx.date}|${(tx.source || '').toLowerCase()}|${tx.amount}|${tx.account || 'RCU'}`;
    if (seen.has(key)) {
        duplicatesFound++;
    } else {
        seen.set(key, tx);
    }
}
console.log('Duplicates found:', duplicatesFound);
```

```javascript
// 3. Remove duplicates
const seen = new Map();
const toKeep = [];
let duplicatesFound = 0;
for (const tx of transactions) {
    const key = `${tx.date}|${(tx.source || '').toLowerCase()}|${tx.amount}|${tx.account || 'RCU'}`;
    if (!seen.has(key)) {
        seen.set(key, tx);
        toKeep.push(tx);
    } else {
        duplicatesFound++;
    }
}
transactions = toKeep;
console.log(`Removed ${duplicatesFound} duplicates. Kept ${transactions.length}`);
```

```javascript
// 4. Save and refresh
await saveTransactions();
updateTransactionTable();
updateBudgetFromTransactions();
updateDashboard();
console.log('✅ Done!');
```

---

## Expected Console Output

```
✅ DONE: Removed 144 duplicates! Kept 456 transactions.
```

(The numbers will show your actual counts)

---

## After Cleanup

- ✅ Your duplicates are gone
- ✅ Transactions updated in database
- ✅ UI refreshed
- ✅ Budget recalculated

The duplicate detection code is now in place, so future syncs won't add more duplicates.

---

## Troubleshooting

**"ReferenceError: transactions is not defined"**
- The app hasn't loaded yet
- Wait a few seconds for the page to fully load
- Try again

**"No transactions found"**
- Your database is empty
- Try importing some transactions first

**Nothing happens**
- Check the console for error messages
- Make sure you're in the Console tab (not Elements)
- Hard refresh the page (Ctrl+Shift+R)

---

## Why the UI button isn't showing

The modal might be loading from a cached version. The console command is faster anyway and works regardless of caching.

**Once you run the cleanup:**
- Hard refresh (Ctrl+Shift+R)
- Future syncs will NOT create duplicates
- The duplicate detection is now active

---

**That's it! Run the command above and you're done.** 🎉
