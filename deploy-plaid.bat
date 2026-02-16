@echo off
echo ========================================
echo Plaid Integration Deployment Script
echo ========================================
echo.

echo Step 1: Installing Firebase Functions dependencies...
cd functions
call npm install
cd ..
echo.

echo Step 2: Deploying Firebase Functions...
call firebase deploy --only functions
echo.

echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Set your Plaid credentials:
echo    firebase functions:config:set plaid.client_id="YOUR_CLIENT_ID"
echo    firebase functions:config:set plaid.secret="YOUR_SANDBOX_SECRET"
echo.
echo 2. Add the Plaid UI to your index.html (see plaid-ui.html)
echo 3. Add the Plaid integration code to your app.js (see plaid-integration.js)
echo.
echo 4. Test with Plaid Sandbox credentials:
echo    Username: user_good
echo    Password: pass_good
echo.
pause
