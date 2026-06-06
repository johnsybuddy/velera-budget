#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read CSV file
const csvFile = path.join(__dirname, 'synchrony_transactions.csv');
const csvContent = fs.readFileSync(csvFile, 'utf8');

const lines = csvContent.trim().split('\n');
const headers = lines[0].split(',').map(h => h.trim());

const dateIdx = headers.indexOf('Date');
const descIdx = headers.indexOf('Description');
const amountIdx = headers.indexOf('Amount');

const transactions = [];

// Parse CSV and convert to transaction format
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  // Simple CSV parsing
  const parts = line.split(',');
  if (parts.length < 3) continue;
  
  const dateStr = parts[dateIdx].trim();
  const description = parts[descIdx].trim();
  const amountStr = parts[amountIdx].trim();
  
  // Parse date "Jun 5 2026" -> "2026-6-5"
  const date = parseDate(dateStr);
  if (!date) {
    console.warn('Could not parse date:', dateStr);
    continue;
  }
  
  // Parse amount "$47.17" -> 47.17
  const amount = parseFloat(amountStr.replace(/[$,\s]/g, ''));
  if (isNaN(amount)) {
    console.warn('Could not parse amount:', amountStr);
    continue;
  }
  
  // Clean store name
  const source = cleanStoreName(description);
  
  transactions.push({
    date: date,
    source: source,
    amount: amount,
    bill: "Sam's Club",
    account: "Sam's"
  });
}

// Write JSON
const jsonFile = path.join(__dirname, 'synchrony-transactions.json');
fs.writeFileSync(jsonFile, JSON.stringify(transactions, null, 2));

console.log(`✓ Converted ${transactions.length} transactions`);
transactions.forEach(t => {
  console.log(`${t.date} | ${t.source} | $${t.amount.toFixed(2)}`);
});

// Helper functions
function parseDate(dateStr) {
  const months = {
    'jan': 1, 'january': 1,
    'feb': 2, 'february': 2,
    'mar': 3, 'march': 3,
    'apr': 4, 'april': 4,
    'may': 5,
    'jun': 6, 'june': 6,
    'jul': 7, 'july': 7,
    'aug': 8, 'august': 8,
    'sep': 9, 'september': 9,
    'oct': 10, 'october': 10,
    'nov': 11, 'november': 11,
    'dec': 12, 'december': 12
  };
  
  const parts = dateStr.toLowerCase().split(/\s+/);
  if (parts.length !== 3) return null;
  
  const month = months[parts[0]];
  const day = parseInt(parts[1]);
  const year = parseInt(parts[2]);
  
  if (!month || !day || !year) return null;
  
  return `${year}-${month}-${day}`;
}

function cleanStoreName(description) {
  let name = description.trim();
  
  // Remove merchant codes
  name = name.replace(/^[A-Z]{2,4}\s?\*\s?/, '');
  name = name.replace(/^SQ\s\*\s?/, '');
  
  // Remove store numbers
  name = name.replace(/#\d+\s/i, '');
  
  // Remove location codes and states
  name = name.replace(/\s+(EAU\s+CLAIRE|SAINT\s+LOUIS|BENTONVILLE|GLENDALE|NEENAH|FALL\s+CREEK|BROOKLYN|BROOKLYN\s+PARK|PARKMN)(\s+[A-Z]{2})?\s*$/i, '');
  name = name.replace(/\s+[A-Z]{2}\s*$/i, '');
  
  // Remove redundant text
  name = name.replace(/\s+SAM'S\/WAL-MART\s+PURCHASE.*$/i, '');
  name = name.replace(/\s+800.*$/i, '');
  name = name.replace(/\s+-GOL\s*$/i, '');
  name = name.replace(/\s+43003\s*$/i, '');
  
  // Title case
  name = name
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
  
  return name;
}
