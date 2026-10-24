import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LabApp } from './gallery/LabApp'
import './lab.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LabApp />
  </StrictMode>,
)
