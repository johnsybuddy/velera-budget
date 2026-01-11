@echo off
echo ========================================
echo  Git Setup for Bills Q Tracker
echo ========================================
echo.

REM Configure Git with your details
git config --global user.name "johnsybuddy"
git config --global user.email "johnsybuddy@gmail.com"

REM Initialize repository
git init

REM Add GitHub remote
git remote add origin https://github.com/johnsybuddy/bills-website.git

REM Pull existing files from GitHub
git pull origin main

REM Add all files
git add .

REM Commit changes
git commit -m "Sync local files with GitHub"

REM Push to GitHub
git push -u origin main

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo Your website will update at:
echo https://johnsybuddy.github.io/bills-website
echo.
pause