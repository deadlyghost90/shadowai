/**
 * Provider factory — the only place the app decides how to reach a model.
 *
 * Adding a new backend means writing one object that satisfies `AIProvider`
 * and registering it below. No component, hook, or store changes.
 */

import type { AIProvider } from './types'
import type { ProviderConfig } from './config'
import { createOpenAICompatibleProvider } from './providers/openaiCompatible'
import { createServerProvider } from './providers/serverTransport'
import { createShadowSpaceProvider } from './providers/shadowSpace'

export type Transport = 'direct' | 'server' | 'space'

export const API_BASE: string = (import.meta.env?.VITE_SHADOWAI_API as string) || ''

export function createProvider(cfg: ProviderConfig): AIProvider {
  if (cfg.transport === 'server') return createServerProvider(cfg, API_BASE)
  if (cfg.transport === 'space') return createShadowSpaceProvider(cfg)
  return createOpenAICompatibleProvider(cfg)
}

/** True when the user has given ShadowAI enough information to make a call. */
export function isConfigured(cfg: ProviderConfig): boolean {
  if (cfg.transport === 'server') return true
  if (cfg.transport === 'space') return Boolean(cfg.baseUrl.trim() && cfg.selectedModel.trim())
  return Boolean(cfg.baseUrl.trim() && cfg.selectedModel.trim())
}

/**
 * How the model is described in the UI. Never names a vendor unless the user
 * named it themselves.
 */
export function transportLabel(cfg: ProviderConfig): string {
  if (!isConfigured(cfg)) return 'Not connected'
  if (cfg.transport === 'server') return 'ShadowAI backend'
  if (cfg.transport === 'space') {
    try {
      return new URL(cfg.baseUrl).hostname.replace(/\.hf\.space$/, '')
    } catch {
      return 'ShadowAI Space'
    }
  }
  try {
    return new URL(cfg.baseUrl).host
  } catch {
    return 'Custom endpoint'
  }
}
