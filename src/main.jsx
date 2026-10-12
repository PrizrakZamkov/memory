import { createRoot } from 'react-dom/client';
import { App } from './app/App.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

createRoot(document.getElementById('root')).render(<App />);
