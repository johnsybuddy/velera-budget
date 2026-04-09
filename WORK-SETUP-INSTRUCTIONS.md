# Work Instance Setup Instructions

## Step 1: Create New Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Name: `work-budget-tracker` (or your preferred name)
4. Disable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Firestore
1. In your new project, go to "Firestore Database"
2. Click "Create database"
3. Start in "production mode"
4. Choose a location (us-central1 recommended)

## Step 3: Set Firestore Rules
Go to Firestore → Rules and paste:
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

## Step 4: Get Firebase Config
1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Web" icon (</>)
4. Register app (name: "Work Budget")
5. Copy the firebaseConfig object

## Step 5: Update Work Copy
In your work copy's `index.html`, find the Firebase config section and replace with your new config:

```javascript
const firebaseConfig = {
    apiKey: "YOUR-NEW-API-KEY",
    authDomain: "YOUR-NEW-PROJECT.firebaseapp.com",
    projectId: "YOUR-NEW-PROJECT",
    storageBucket: "YOUR-NEW-PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR-NEW-ID",
    appId: "YOUR-NEW-APP-ID"
};
```

## Step 6: Deploy Work Copy
Your work copy will now use its own separate database!

## Current Setup
- **Home**: johnson-fam-bills (existing project)
- **Work**: [NEW PROJECT] (separate database)

No more conflicts!
