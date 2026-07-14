import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SpotifyProvider } from './context/SpotifyContext'
import { ToastProvider } from './store/ToastProvider'
import { ToastContainer } from './components/Toast'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <SpotifyProvider>
        <App />
        <ToastContainer />
      </SpotifyProvider>
    </ToastProvider>
  </React.StrictMode>,
)
