@echo off
echo ========================================
echo  Pushing Updates to GitHub
echo ========================================
echo.

REM Check if there are changes to commit
git status --porcelain > nul
if %errorlevel% equ 0 (
    echo No changes to commit.
    goto :end
)

REM Add all changes
echo Adding files...
git add .

REM Commit with timestamp
echo Committing changes...
git commit -m "Website updates - %date% %time%"

REM Push to GitHub
echo Pushing to GitHub...
git push origin master

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo  Updates Pushed Successfully!
    echo ========================================
    echo Your website will update in 1-2 minutes at:
    echo https://johnsybuddy.github.io/bills-website
) else (
    echo.
    echo ========================================
    echo  Error: Push failed!
    echo ========================================
    echo Please check your internet connection and try again.
)

:end
echo.
pause