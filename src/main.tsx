import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { logger } from './lib/logger'

// Setup global error handlers for better logging
window.addEventListener('error', (event) => {
  logger.error('Global error caught', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', {
    reason: event.reason,
    promise: event.promise
  });
});

// Log app startup
logger.info('Salesonator app starting...')

createRoot(document.getElementById("root")!).render(<App />);
