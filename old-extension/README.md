# Salesonator Chrome Extension

This Chrome extension automates Facebook Marketplace vehicle listings by communicating with your Salesonator web application.

## Installation & Testing

### 1. Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder from your project
5. The extension should now appear in your Chrome toolbar

### 2. Testing the Extension
1. **Login to Facebook**: Make sure you're logged into Facebook
2. **Navigate to Marketplace**: Go to `https://www.facebook.com/marketplace`
3. **Click Extension Icon**: Click the Salesonator extension icon in your toolbar
4. **Authenticate**: You'll need to implement auth flow in the web app
5. **Fetch Vehicles**: Click "Fetch Pending Vehicles" to load vehicles from Salesonator
6. **Start Posting**: Click "Start Auto-Posting" to begin automation

## How It Works

### Architecture
- **Popup (`popup.html/js`)**: Main interface for controlling the extension
- **Content Script (`content.js`)**: Runs on Facebook pages, handles DOM manipulation
- **Background Script (`background.js`)**: Handles API communication and storage
- **Manifest (`manifest.json`)**: Extension configuration and permissions

### Communication Flow
1. Extension fetches vehicles from Salesonator API
2. User starts posting process from popup
3. Content script receives vehicle data
4. Content script navigates to Facebook Marketplace create page
5. Content script fills out form with vehicle details
6. Content script submits the form
7. Process repeats for next vehicle with delay

## Development Notes

### Current State
- Basic extension structure is complete
- Facebook DOM selectors may need adjustment based on current FB interface
- Authentication flow needs implementation in main web app
- Error handling and retry logic can be enhanced

### Next Steps
1. **Implement Auth**: Add login flow in Salesonator web app for extension
2. **Test Selectors**: Facebook changes their DOM frequently, selectors may need updates
3. **Add Image Upload**: Implement vehicle image handling
4. **Enhanced Error Handling**: Better error reporting and recovery
5. **Rate Limiting**: Implement smart delays to avoid detection

### Debugging
- Open Chrome DevTools on Facebook page to see console logs
- Check extension popup for status messages
- Use Chrome extension developer tools for debugging

## Security Notes
- Extension only works on Facebook domains (security restriction)
- User must be logged into Facebook manually
- No credentials are stored, only auth tokens
- All communication uses HTTPS

## Facebook Marketplace Automation
The extension simulates human behavior by:
- Adding random delays between actions
- Typing character by character with realistic speeds
- Using proper event dispatching for form interactions
- Respecting Facebook's rate limits with configurable delays