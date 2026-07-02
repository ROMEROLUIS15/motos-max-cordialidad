#!/bin/bash

# Setup environment files for MotoWorkshop SaaS

echo "Setting up environment files for MotoWorkshop SaaS..."
echo "=================================================="

# Create .env.local from .env.local.example if it doesn't exist
if [ ! -f .env.local ]; then
    echo "Creating .env.local from .env.local.example..."
    cp .env.local.example .env.local
    echo "✓ Created .env.local"
else
    echo "✓ .env.local already exists"
fi

# Create API environment files
if [ ! -f apps/api/.env ]; then
    echo "Creating apps/api/.env from apps/api/.env.example..."
    cp apps/api/.env.example apps/api/.env
    echo "✓ Created apps/api/.env"
else
    echo "✓ apps/api/.env already exists"
fi

# Create Web environment files
if [ ! -f apps/web/.env.local ]; then
    echo "Creating apps/web/.env.local from apps/web/.env.example..."
    cp apps/web/.env.example apps/web/.env.local
    echo "✓ Created apps/web/.env.local"
else
    echo "✓ apps/web/.env.local already exists"
fi

# Create Agents environment files
if [ ! -f apps/agents/.env ]; then
    echo "Creating apps/agents/.env from apps/agents/.env.example..."
    cp apps/agents/.env.example apps/agents/.env
    echo "✓ Created apps/agents/.env"
else
    echo "✓ apps/agents/.env already exists"
fi

echo ""
echo "=================================================="
echo "Environment files setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local and fill in your configuration"
echo "2. Edit apps/api/.env with your specific API settings"
echo "3. Edit apps/web/.env.local with your frontend settings"
echo "4. Edit apps/agents/.env with your Python agents settings"
echo ""
echo "For production, set environment variables in your hosting provider."
echo "=================================================="