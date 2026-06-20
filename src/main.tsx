import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import posthog from 'posthog-js'
import { PostHogProvider } from '@posthog/react'
import App from './App.tsx'
import './index.css'

const GEETA_USER_ID_STORAGE_KEY = 'geeta_user_id'

function createUserId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `geeta_${crypto.randomUUID()}`
  }

  return `geeta_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`
}

function getOrCreateUserId() {
  try {
    const existingUserId = localStorage.getItem(GEETA_USER_ID_STORAGE_KEY)

    if (existingUserId) {
      return existingUserId
    }

    const userId = createUserId()
    localStorage.setItem(GEETA_USER_ID_STORAGE_KEY, userId)
    return userId
  } catch {
    return createUserId()
  }
}

posthog.init(import.meta.env.VITE_POSTHOG_PROJECT_TOKEN, {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  defaults: '2026-01-30',
})

const geetaUserId = getOrCreateUserId()

posthog.identify(geetaUserId, {
  app_user_id: geetaUserId,
  identity_source: 'local_storage',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </StrictMode>,
)
