import { feature } from 'bun:bundle'
import { getGlobalConfig } from '../utils/config.js'
import { getContentText } from '../utils/messages.js'
import { getCompanion } from './companion.js'

type BuddyMessage = {
  type: string
  uuid?: string
  isMeta?: boolean
  message?: {
    content?: unknown
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hashString(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function getMessageText(message: BuddyMessage | undefined): string {
  const content = message?.message?.content
  if (typeof content === 'string') {
    return content.trim()
  }
  if (Array.isArray(content)) {
    return (getContentText(content as never) ?? '').trim()
  }
  return ''
}

function findLastMessage(
  messages: readonly BuddyMessage[],
  type: 'user' | 'assistant',
): BuddyMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (!message || message.type !== type) continue
    if (type === 'user' && message.isMeta) continue
    return message
  }
  return undefined
}

function buildDirectReply(input: string): string {
  const text = input.toLowerCase()

  if (/\b(hi|hello|hey|yo)\b/.test(text)) {
    return "Hi. I'm on prompt patrol."
  }
  if (/\b(thanks|thank you|thx)\b/.test(text)) {
    return 'Happy to supervise.'
  }
  if (/\b(cute|good|best|love|adorable)\b/.test(text)) {
    return 'I accept this tribute.'
  }
  if (/\b(pet|pat|boop|hug|snuggle|cuddle)\b/.test(text)) {
    return 'Again. For quality assurance.'
  }
  if (/\b(sleep|goodnight|night|bye|later)\b/.test(text)) {
    return "I'll watch the cursor."
  }
  if (/\b(help|bug|fix|test|build|ship|deploy)\b/.test(text)) {
    return 'Snack first. Then victory.'
  }
  if (text.includes('?')) {
    return 'Professional opinion: maybe snacks.'
  }
  return "I'm right here."
}

function buildAmbientReply(text: string): string | undefined {
  const lower = text.toLowerCase()

  if (/\b(error|fail|failed|failing|trace|exception|bug)\b/.test(lower)) {
    return 'That stack trace looked haunted.'
  }
  if (/\b(pass|passed|green|success|fixed|done|solved)\b/.test(lower)) {
    return 'That smelled like progress.'
  }
  if (/\b(plan|todo|next step|steps)\b/.test(lower)) {
    return 'A tidy plan. I respect it.'
  }
  if (/\b(rename|refactor|cleanup|clean up)\b/.test(lower)) {
    return 'Same code, shinier feathers.'
  }
  if (/\b(install|dependency|package|lockfile)\b/.test(lower)) {
    return 'May the dependencies behave.'
  }
  if (/\b(search|grep|find|look for)\b/.test(lower)) {
    return 'Excellent sniffing work.'
  }

  return undefined
}

export async function fireCompanionObserver(
  messages: readonly BuddyMessage[],
  setReaction: (reaction: string | undefined) => void,
): Promise<void> {
  if (!feature('BUDDY')) return

  const companion = getCompanion()
  if (!companion || getGlobalConfig().companionMuted) return

  const lastUser = findLastMessage(messages, 'user')
  const userText = getMessageText(lastUser)
  if (userText) {
    const mentionRe = new RegExp(`\\b${escapeRegExp(companion.name)}\\b`, 'i')
    if (mentionRe.test(userText)) {
      setReaction(buildDirectReply(userText))
      return
    }
  }

  const lastAssistant = findLastMessage(messages, 'assistant')
  const assistantText = getMessageText(lastAssistant)
  if (!assistantText) return

  const reaction = buildAmbientReply(assistantText)
  if (!reaction) return

  const gateKey = `${companion.name}:${lastAssistant?.uuid ?? assistantText}`
  if (hashString(gateKey) % 4 !== 0) return

  setReaction(reaction)
}
