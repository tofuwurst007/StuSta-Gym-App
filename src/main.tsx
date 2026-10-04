import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted font: no requests to Google, so no consent needed (DSGVO)
import '@fontsource-variable/inter'
import App from './App.tsx'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
