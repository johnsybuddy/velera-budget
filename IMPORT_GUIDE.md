# Import Guide - JSON & CSV Upload

## Overview
The Bills Website now supports importing transactions from both JSON and CSV files. This allows you to bulk upload transactions from your bank exports or other data sources.

## 📥 How to Import

1. Click the **"Import CSV/JSON"** button in the Expenses tab
2. Select a `.csv` or `.json` file from your computer
3. Preview the transactions that will be imported
4. Click **"Import Transactions"** to complete the import

## JSON Format

The JSON format is the most flexible and recommended for custom data sources.

### Basic Structure
```json
[
  {
    "date": "2026-06-01",
    "source": "Target",
    "amount": 45.99,
    "bill": "Groceries",
    "account": "RCU"
  },
  {
    "date": "2026-06-02",
    "source": "Shell Gas Station",
    "amount": 52.00,
    "bill": "Gas",
    "account": "RCU"
  }
]
```

### Field Reference
- **date** (required): Transaction date in format `YYYY-MM-DD` or `MM/DD/YYYY`
- **source** (required): Store/merchant name (e.g., "Target", "Chipotle")
- **amount** (required): Transaction amount as a number (e.g., `45.99`)
- **bill** (optional): Bill category name. If omitted, will be auto-categorized
- **account** (optional): Account name. Defaults to "RCU" if omitted. Supported: "RCU", "Sam's"

### Alternative Structure with transactions Property
```json
{
  "transactions": [
    { "date": "2026-06-01", "source": "Target", "amount": 45.99, "bill": "Groceries", "account": "RCU" }
  ]
}
```

## CSV Format

CSV files should have a header row followed by data rows. The app auto-detects common bank formats.

### Supported Bank Formats

#### Generic CSV (Most Common)
```csv
Date,Description,Amount
06/01/2026,Target,45.99
06/02/2026,Shell Gas Station,52.00
```

#### Chase Bank
```csv
Transaction Date,Description,Amount
06/01/2026,Target,45.99
06/02/2026,Shell Gas Station,52.00
```

#### Wells Fargo
```csv
Date,Description,Amount
06/01/2026,Target,45.99
06/02/2026,Shell Gas Station,52.00
```

#### Bank of America
```csv
Posted Date,Payee,Amount
06/01/2026,Target,45.99
06/02/2026,Shell Gas Station,52.00
```

#### Capital One
```csv
Transaction Date,Description,Debit,Credit
06/01/2026,Target,45.99,
06/02/2026,Gas Station,,52.00
```

### CSV Headers
The system looks for these column names (case-insensitive):
- **Date columns**: "date", "transaction date", "posted date"
- **Description columns**: "description", "payee", "name", "merchant", "store", "vendor"
- **Amount columns**: "amount", "total", "sum", "debit", "credit"

### Date Formats in CSV
Any of these formats work:
- `YYYY-MM-DD` (e.g., 2026-06-01)
- `MM/DD/YYYY` (e.g., 06/01/2026)
- `MM-DD-YYYY` (e.g., 06-01-2026)

### CSV with Tab or Comma Delimiters
The system auto-detects whether your CSV uses tabs or commas as delimiters.

## Import Preview

Before importing, you'll see a summary showing:
- **CSV Rows**: Total rows in the file
- **Will Import**: Number of new transactions
- **Duplicates**: Number of duplicate transactions (skipped automatically)

The preview table shows:
- Date
- Description
- Amount
- Category
- Account
- Status (✅ New or 🔄 Duplicate)

Duplicate detection checks if a transaction with the same:
- Date
- Source
- Amount
- Account
- Bill Category

## Auto-Categorization

If you don't provide a `bill` field in JSON, or if the CSV doesn't have category info, the system will auto-categorize based on:
- Merchant name matching
- Learned patterns from previous transactions
- Common keywords (e.g., "gas" → Gas, "grocery" → Groceries)

You can adjust categories after import by editing transactions.

## Features

✅ **Batch Import** - Import hundreds of transactions at once  
✅ **Duplicate Detection** - Skips duplicate transactions automatically  
✅ **Auto-Categorization** - Automatically assigns bill categories  
✅ **Preview Before Import** - See exactly what will be imported  
✅ **Flexible Date Formats** - Accepts multiple date formats  
✅ **Bank Format Detection** - Auto-detects bank CSV exports  
✅ **Tab & Comma Delimiters** - Supports both TSV and CSV  
✅ **Detailed Logging** - Console logs show exactly what was imported  
✅ **Large File Support** - Can import up to 10MB files  

## Troubleshooting

### "File is too large"
The file exceeds 10MB. Try splitting it into smaller files.

### "Could not identify CSV format"
The CSV headers don't match any known bank format. Make sure your CSV has:
- A header row with Date, Description/Payee, and Amount columns
- Data rows below the header

### "No valid transactions found"
Check that:
- The file has at least a header and one data row
- Date format is YYYY-MM-DD or MM/DD/YYYY
- Amount is a valid number
- All three required fields (date, source, amount) are present

### Transactions imported but categories are wrong
Categories are auto-assigned based on merchant names. You can:
1. Edit transactions individually to fix categories
2. Add merchant patterns to the learned patterns (click "View Learned Patterns")

### All transactions marked as duplicates
This means identical transactions (same date, source, amount, account) already exist in the database. This is normal if you've already imported these transactions. Check the transaction log to verify.

## Sample Files

Sample files are included in the project:
- `sample-import.json` - Example JSON format
- `sample-import.csv` - Example CSV format

## Tips

💡 **Export from Your Bank**: Most banks let you export transactions as CSV. Simply download and import!

💡 **Use JSON for Custom Data**: If you have your own data, JSON is more flexible and allows you to specify categories upfront.

💡 **Check the Console**: Open Developer Tools (F12) and check the Console tab to see detailed import logs including which rows were skipped and why.

💡 **Edit After Import**: Don't worry if categories aren't perfect. You can edit individual transactions after importing.

💡 **Regular Imports**: You can import the same export multiple times - duplicates are automatically detected and skipped.
