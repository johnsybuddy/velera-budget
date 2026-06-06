@echo off
REM Deploy Firebase functions with service account
set GOOGLE_APPLICATION_CREDENTIALS=johnson-fam-bills-firebase-adminsdk-fbsvc-e1c9589d62.json

REM Change to functions directory
cd functions

REM Deploy
firebase deploy --only functions

echo.
echo Deployment complete!
pause
