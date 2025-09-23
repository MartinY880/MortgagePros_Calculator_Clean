# Version Management System

## 📋 Overview

This application uses a centralized version management system to keep all version references in sync across the entire application.

## 🎯 How to Update the Version

### Step 1: Update the Master Version

Edit `src/version.js` and change the `APP_VERSION` constant:

```javascript
// Change this line to your new version
const APP_VERSION = "11.1.0"; // ← Update this!
```

### Step 2: Update Version Metadata (Optional)

You can also update the release information in the same file:

```javascript
const VERSION_INFO = {
  version: APP_VERSION,
  name: "MortgagePros Calculator",
  codename: "Enhanced Edition", // ← Update for major releases
  releaseDate: "2025-09-23", // ← Update release date
  buildType: "Production", // ← "Production", "Beta", "Alpha", "Development"
  releaseNotes: [
    // ← Add your new features/fixes
    "New feature 1",
    "Bug fix 2",
    "Performance improvement 3",
  ],
};
```

### Step 3: Sync Package.json

Run the sync script to update package.json automatically:

```bash
npm run sync-version
```

## 🔄 What Gets Updated

When you change the version in `src/version.js`, the following will be automatically updated:

1. **UI Display**: Version badge in the top-right corner
2. **Package.json**: When you run `npm run sync-version`
3. **About Dialog**: When users click the version badge
4. **Release Notes**: Displayed in the about dialog

## 📱 Version Display Features

- **Version Badge**: Shows current version in the UI header
- **Click for Details**: Users can click the version badge to see:
  - Full version info
  - Release codename
  - Release date
  - What's new in this version

## 🚀 Version Types

Set the `buildType` in `version.js`:

- **"Production"**: Final release version (displays as "11.0.0")
- **"Beta"**: Beta testing version (displays as "11.0.0-beta")
- **"Alpha"**: Alpha testing version (displays as "11.0.0-alpha")
- **"Development"**: Development version (displays as "11.0.0-development")

## 📝 Best Practices

1. **Semantic Versioning**: Use major.minor.patch format (e.g., 11.2.1)

   - **Major**: Breaking changes or major new features
   - **Minor**: New features, backwards compatible
   - **Patch**: Bug fixes and small improvements

2. **Update Release Notes**: Always update the releaseNotes array with what's new

3. **Sync Before Building**: Always run `npm run sync-version` before building releases

4. **Git Tagging**: Consider creating git tags for releases:
   ```bash
   git tag -a v11.0.0 -m "Release version 11.0.0"
   git push origin v11.0.0
   ```

## 🛠️ Files in the Version System

- `src/version.js` - Master version configuration
- `sync-version.js` - Script to sync package.json
- `package.json` - NPM package version (synced automatically)
- `src/index.html` - UI version display and click handler

## 💡 Example Workflow

```bash
# 1. Edit src/version.js with new version
# 2. Sync package.json
npm run sync-version

# 3. Test the application
npm start

# 4. Commit changes
git add .
git commit -m "Bump version to 11.1.0"

# 5. Create release tag
git tag -a v11.1.0 -m "Release version 11.1.0"

# 6. Push to repository
git push origin main --tags
```

This system ensures your version is always consistent across all parts of your application! 🎉
