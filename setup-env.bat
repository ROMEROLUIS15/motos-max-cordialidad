@echo off
echo Setting up environment files for MotoWorkshop SaaS...
echo ==================================================

REM Create .env.local from .env.local.example if it doesn't exist
if not exist ".env.local" (
    echo Creating .env.local from .env.local.example...
    copy .env.local.example .env.local
    echo ✓ Created .env.local
) else (
    echo ✓ .env.local already exists
)

REM Create API environment files
if not exist "apps\api\.env" (
    echo Creating apps\api\.env from apps\api\.env.example...
    copy apps\api\.env.example apps\api\.env
    echo ✓ Created apps\api\.env
) else (
    echo ✓ apps\api\.env already exists
)

REM Create Web environment files
if not exist "apps\web\.env.local" (
    echo Creating apps\web\.env.local from apps\web\.env.example...
    copy apps\web\.env.example apps\web\.env.local
    echo ✓ Created apps\web\.env.local
) else (
    echo ✓ apps\web\.env.local already exists
)

REM Create Agents environment files
if not exist "apps\agents\.env" (
    echo Creating apps\agents\.env from apps\agents\.env.example...
    copy apps\agents\.env.example apps\agents\.env
    echo ✓ Created apps\agents\.env
) else (
    echo ✓ apps\agents\.env already exists
)

echo.
echo ==================================================
echo Environment files setup complete!
echo.
echo Next steps:
echo 1. Edit .env.local and fill in your configuration
echo 2. Edit apps\api\.env with your specific API settings
echo 3. Edit apps\web\.env.local with your frontend settings
echo 4. Edit apps\agents\.env with your Python agents settings
echo.
echo For production, set environment variables in your hosting provider.
echo ==================================================
pause