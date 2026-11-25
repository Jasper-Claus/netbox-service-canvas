import '@xyflow/react/dist/style.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setLanguage } from './i18n';
import type { EditorConfig } from './types';

function mount() {
  const root = document.getElementById('nsc-canvas-root');
  if (!root) return;
  const configId = root.dataset.configId ?? 'nsc-editor-config';
  const raw = document.getElementById(configId)?.textContent;
  if (!raw) {
    root.textContent = 'Service Canvas: configuration missing.';
    return;
  }
  const config = JSON.parse(raw) as EditorConfig;
  setLanguage(config.language ?? document.documentElement.lang);
  root.replaceChildren();
  createRoot(root).render(
    <StrictMode>
      <App config={config} />
    </StrictMode>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
