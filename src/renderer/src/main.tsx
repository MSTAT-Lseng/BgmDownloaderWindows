/**
 * @file 渲染进程入口。
 */

import { createRoot } from 'react-dom/client'
import { App } from './App'
import { NavigationProvider } from './navigation'
import { ConfirmProvider } from './services/confirm'
import { PromptProvider } from './services/prompt'
import { ToastProvider } from './services/toast'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('缺少 #root 节点')

createRoot(container).render(
  <ToastProvider>
    <ConfirmProvider>
      <PromptProvider>
        <NavigationProvider>
          <App />
        </NavigationProvider>
      </PromptProvider>
    </ConfirmProvider>
  </ToastProvider>
)
