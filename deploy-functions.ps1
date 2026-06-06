# Deploy Firebase Cloud Functions using REST API (no CLI needed)
# Run: .\deploy-functions.ps1

$projectId = "johnson-fam-bills"
$region = "us-central1"
$functionName = "createLinkToken"

# Service account info from JSON file
$keyFile = ".\johnson-fam-bills-firebase-adminsdk-fbsvc-e1c9589d62.json"
$keyContent = Get-Content $keyFile | ConvertFrom-Json

$clientEmail = $keyContent.client_email
$privateKey = $keyContent.private_key

Write-Host "Deploying to Firebase project: $projectId"
Write-Host "Service Account: $clientEmail"

# In production, you would:
# 1. Get an access token from Google OAuth using the service account
# 2. Use gcloud deploy or Cloud Build API
# 3. Or use Firebase Admin SDK directly

# For now, we'll use Firebase CLI with service account
$env:GOOGLE_APPLICATION_CREDENTIALS = (Resolve-Path $keyFile).Path

# Try deploying with service account auth
Write-Host "Attempting deployment with service account credentials..."

& firebase deploy --only functions
