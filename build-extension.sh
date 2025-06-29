#!/bin/bash

echo "🚀 Building YouSaid Chrome Extension..."

# Clean previous build
rm -rf dist

# Build with Vite
npm run build

# Copy manifest to dist
cp manifest.json dist/

# Copy main icon for action (use the 48px version as the default)
cp public/icons/icon48.png dist/icon.png

# Create icons directory and copy all icon sizes
mkdir -p dist/icons
cp public/icons/icon16.png dist/icons/icon16.png
cp public/icons/icon32.png dist/icons/icon32.png  
cp public/icons/icon48.png dist/icons/icon48.png
cp public/icons/icon128.png dist/icons/icon128.png

# Copy popup HTML to correct location
cp dist/src/popup/index.html dist/popup.html

# Fix CSS and JS paths in popup.html (remove leading slashes)
sed -i '' 's|src="/popup.js"|src="popup.js"|g' dist/popup.html
sed -i '' 's|href="/popup.css"|href="popup.css"|g' dist/popup.html

# Remove the src directory (not needed)
rm -rf dist/src

echo "✅ Build complete! Extension files are ready in the 'dist' folder."
echo "📁 Files generated:"
ls -la dist/
echo ""
echo "🔧 To install: Open Chrome -> Extensions -> Enable Developer Mode -> Load Unpacked -> Select 'dist' folder" 