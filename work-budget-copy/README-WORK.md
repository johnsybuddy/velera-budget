# Work Budget Tracker

This is your WORK instance with a separate Firebase database.

## Setup Instructions

### 1. Set Firestore Rules
Go to: https://console.firebase.google.com/project/work-budget-tracker/firestore/rules

Paste these rules and click "Publish":
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 2. Deploy to Work
Copy these files to your work computer:
- index.html
- app.js
- styles.css

### 3. Open index.html
Just open index.html in a browser - it will use the work Firebase database!

## Configuration
- **Firebase Project**: work-budget-tracker
- **User ID**: work-user
- **Database**: Completely separate from home

## Important Notes
- This uses a DIFFERENT Firebase project than your home instance
- Data will NOT sync between home and work
- Each instance has its own transactions and budgets
- No more conflicts!

## Home vs Work
- **Home**: johnson-fam-bills project, user: johnsybuddy
- **Work**: work-budget-tracker project, user: work-user
