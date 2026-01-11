@echo off
echo.
echo ========================================
echo  Bills Q Tracker - GitHub Deployment
echo ========================================
echo.
echo This script helps you deploy updates to GitHub Pages
echo.
echo Steps to deploy:
echo 1. Make sure you have Git installed
echo 2. Run these commands in this folder:
echo.
echo    git init
echo    git add .
echo    git commit -m "Update website"
echo    git branch -M main
echo    git remote add origin https://github.com/YOURUSERNAME/bills-website.git
echo    git push -u origin main
echo.
echo Replace YOURUSERNAME with your actual GitHub username
echo.
pause