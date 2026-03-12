const fs = require('fs');

const envPath = 'd:\\dev\\BookProject\\.env.local';
let content = fs.readFileSync(envPath, 'utf8');

// The Vercel CLI incorrectly writes unescaped double quotes in FIREBASE_SERVICE_ACCOUNT
// We will replace the outer wrapping double quotes with single quotes.
// Allowing \r?\n for Windows line endings.
let fixed = content.replace(/FIREBASE_SERVICE_ACCOUNT="([\\s\\S]*?)"\\r?\\nSTRIPE_WEBHOOK_SECRET/g, "FIREBASE_SERVICE_ACCOUNT='$1'\nSTRIPE_WEBHOOK_SECRET");

fs.writeFileSync(envPath, fixed);
console.log('Fixed .env.local!');
