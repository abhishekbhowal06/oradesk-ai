import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

console.log('Initializing application (main.tsx)...');

const rootEl = document.getElementById('root');
if (!rootEl) {
    console.error('Fatal Error: Root element not found!');
} else {
    try {
        const root = createRoot(rootEl);
        root.render(
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        );
        console.log('React Root rendered.');
    } catch (e) {
        console.error('Failed to create/render root:', e);
        rootEl.innerHTML = `<div style="color:red; padding:20px"><h1>Fatal Error</h1><pre>${e}</pre></div>`;
    }
}

