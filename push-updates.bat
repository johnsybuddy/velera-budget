@echo off
echo ========================================
echo  Pushing Updates to GitHub
echo ========================================
echo.

REM Add all changes
git add .

REM Commit with timestamp
git commit -m "Website updates - %date% %time%"

REM Push to GitHub
git push

echo.
echo ========================================
echo  Updates Pushed Successfully!
echo ========================================
echo Your website will update in 1-2 minutes at:
echo https://johnsybuddy.github.io/bills-website
echo.
pause