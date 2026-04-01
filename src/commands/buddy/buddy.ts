import { stringWidth } from '../../ink/stringWidth.js'
import type { LocalCommandCall } from '../../types/command.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { getCompanion, companionUserId, roll } from '../../buddy/companion.js'
import {
  RARITY_STARS,
  STAT_NAMES,
  type Companion,
  type StoredCompanion,
} from '../../buddy/types.js'

const NAME_PREFIXES = [
  'Mochi',
  'Pip',
  'Nova',
  'Pebble',
  'Maple',
  'Pixel',
  'Sprout',
  'Comet',
  'Biscuit',
  'Nori',
  'Pudding',
  'Miso',
] as const

const NAME_SUFFIXES = [
  '',
  '',
  '',
  ' Bean',
  ' Junior',
  ' Biscuit',
  ' Spark',
  ' Dot',
] as const

const PERSONALITY_TRAITS = [
  'curious',
  'snack-motivated',
  'softly judgmental',
  'extremely loyal',
  'quietly chaotic',
  'surprisingly brave',
  'obsessively tidy',
  'dramatically sleepy',
  'morale-boosting',
  'mischievously optimistic',
] as const

const PERSONALITY_QUIRKS = [
  'collects tiny victories',
  'guards the prompt bar like treasure',
  'stares down flaky tests',
  'believes every bug deserves a nap first',
  'treats passing builds as personal achievements',
  'keeps watch for suspicious stack traces',
  'likes clean diffs and warm keyboards',
  'thrives on gentle praise',
] as const

const PET_REACTIONS = [
  'This is acceptable.',
  'Morale increased.',
  'Prrrr. Continue.',
  'I will allow more of that.',
  'Excellent petting technique.',
  'I feel faster already.',
  'Productivity has gone up slightly.',
  'You have earned a tiny victory dance.',
] as const

const SNACKS = [
  'apple slice',
  'biscuit crumb',
  'blueberry',
  'carrot coin',
  'cloudberry',
  'cocoa puff',
  'dandelion chip',
  'melon cube',
  'moon bean',
  'pear nibble',
  'pumpkin seed',
  'strawberry bit',
] as const

const PLAY_ACTIVITIES = [
  'chased a laser dot',
  'did a lap around the prompt bar',
  'invented a game involving brackets',
  'zoomed across the footer like lightning',
  'bonked a bug report and felt powerful',
  'played keep-away with a stack trace',
] as const

const NAP_SPOTS = [
  'the warm edge of the prompt bar',
  'a suspiciously comfortable diff hunk',
  'the quiet corner next to the cursor',
  'a pile of very soft passing tests',
  'the top of a tidy TODO list',
  'an extremely premium keyboard key',
] as const

const TRICKS_BY_SPECIES: Partial<Record<Companion['species'], readonly string[]>> = {
  capybara: ['balance a biscuit', 'do a calm spin', 'supervise dramatically'],
  cat: ['pounce on the cursor', 'ignore gravity briefly', 'judge silently'],
  duck: ['waddle in place', 'do a pocket honk', 'flap triumphantly'],
  goose: ['threaten technical debt', 'guard the branch', 'victory honk'],
  owl: ['rotate majestically', 'stare into the build', 'deliver wisdom'],
  penguin: ['tiny slide', 'formal bow', 'speed-waddle'],
  rabbit: ['double hop', 'vanish behind the prompt', 'ear wiggle'],
  dragon: ['puff harmless sparks', 'guard the repo', 'dramatic wing pose'],
  blob: ['squish into a square', 'bounce gently', 'become suspiciously round'],
  robot: ['emit startup chimes', 'perform a checksum dance', 'rotate precisely'],
} as const

const BOND_TITLES = [
  [0, 'Acquaintance'],
  [20, 'Desk Buddy'],
  [40, 'Trusted Familiar'],
  [60, 'Snack Co-Captain'],
  [80, 'Legendary Sidekick'],
] as const

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)]!
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function buildStoredCompanion(): StoredCompanion {
  const seed = roll(companionUserId()).inspirationSeed
  const rng = mulberry32(seed)
  const prefix = pick(rng, NAME_PREFIXES)
  const suffix = pick(rng, NAME_SUFFIXES)
  let traitA = pick(rng, PERSONALITY_TRAITS)
  let traitB = pick(rng, PERSONALITY_TRAITS)
  while (traitB === traitA) {
    traitB = pick(rng, PERSONALITY_TRAITS)
  }
  const quirk = pick(rng, PERSONALITY_QUIRKS)

  return {
    name: `${prefix}${suffix}`,
    personality: `${traitA}, ${traitB}, and ${quirk}`,
    hatchedAt: Date.now(),
    bond: 12 + Math.floor(rng() * 8),
    favoriteSnack: pick(rng, SNACKS),
    tricksPerformed: 0,
    napsTaken: 0,
  }
}

function normalizeName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) return null
  if (/[\r\n\t/\\]/.test(name)) return null
  if (stringWidth(name) > 20) return null
  return name
}

function updateCompanionUI(
  context: Parameters<LocalCommandCall>[1],
  update: {
    companionReaction?: string
    companionPetAt?: number
  },
): void {
  context.setAppState(prev => ({
    ...prev,
    companionReaction:
      'companionReaction' in update
        ? update.companionReaction
        : prev.companionReaction,
    companionPetAt: update.companionPetAt ?? prev.companionPetAt,
  }))
}

function getStoredCompanion(): StoredCompanion | undefined {
  return getGlobalConfig().companion
}

function getBond(companion: Companion | StoredCompanion | undefined): number {
  return clamp(companion?.bond ?? 10, 0, 100)
}

function getBondTitle(bond: number): string {
  let current = BOND_TITLES[0]![1]
  for (const [minBond, title] of BOND_TITLES) {
    if (bond >= minBond) current = title
  }
  return current
}

function formatPercentBar(value: number, width = 10): string {
  const filled = Math.round((clamp(value, 0, 100) / 100) * width)
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}] ${value}`
}

function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return 'never'
  return new Date(timestamp).toLocaleString()
}

function chooseReaction(options: readonly string[]): string {
  return options[Math.floor(Math.random() * options.length)]!
}

function patchStoredCompanion(
  updater: (current: StoredCompanion) => StoredCompanion,
): StoredCompanion | undefined {
  let next: StoredCompanion | undefined
  saveGlobalConfig(current => {
    if (!current.companion) return current
    next = updater(current.companion)
    return {
      ...current,
      companion: next,
    }
  })
  return next
}

function formatCompanionStatus(): string {
  const companion = getCompanion()
  if (!companion) {
    return 'No companion hatched yet. Run "/buddy" to hatch one.'
  }

  const stats = STAT_NAMES.map(name => `${name} ${companion.stats[name]}`).join(' | ')
  const hatchedAt = new Date(companion.hatchedAt).toLocaleString()
  const muted = getGlobalConfig().companionMuted ? 'yes' : 'no'
  const bond = getBond(companion)
  const favoriteSnack = companion.favoriteSnack ?? 'still deciding'
  const tricksPerformed = companion.tricksPerformed ?? 0
  const napsTaken = companion.napsTaken ?? 0

  return [
    `Buddy: ${companion.name} the ${companion.species} ${RARITY_STARS[companion.rarity]}`,
    `Personality: ${companion.personality}.`,
    `Hatched: ${hatchedAt}.`,
    `Muted: ${muted}.`,
    `Bond: ${formatPercentBar(bond)} (${getBondTitle(bond)}).`,
    `Favorite snack: ${favoriteSnack}.`,
    `Tricks performed: ${tricksPerformed}. Naps taken: ${napsTaken}.`,
    `Last fed: ${formatTimestamp(companion.lastFedAt)}. Last play: ${formatTimestamp(companion.lastPlayedAt)}. Last trick: ${formatTimestamp(companion.lastTrickAt)}.`,
    `Stats: ${stats}.`,
  ].join('\n')
}

function hatchCompanion(context: Parameters<LocalCommandCall>[1]) {
  const stored = buildStoredCompanion()
  saveGlobalConfig(current => ({
    ...current,
    companion: stored,
    companionMuted: false,
  }))

  updateCompanionUI(context, {
    companionReaction: 'Hello. I live here now.',
    companionPetAt: Date.now(),
  })

  const companion = getCompanion()
  if (!companion) {
    return {
      type: 'text' as const,
      value: 'Companion hatched, but could not be reloaded from config.',
    }
  }

  return {
    type: 'text' as const,
    value: [
      `A ${companion.rarity} ${companion.species} named ${companion.name} hatched beside the prompt.`,
      `Personality: ${companion.personality}.`,
      'Run "/buddy" again to pet it, or "/buddy status" to inspect its stats.',
    ].join('\n'),
  }
}

function petCompanion(context: Parameters<LocalCommandCall>[1]) {
  const companion = getCompanion()
  if (!companion) {
    return hatchCompanion(context)
  }

  if (getGlobalConfig().companionMuted) {
    return {
      type: 'text' as const,
      value: `${companion.name} is currently muted. Run "/buddy unmute" to bring them back on screen.`,
    }
  }

  const reaction = PET_REACTIONS[Math.floor(Math.random() * PET_REACTIONS.length)]!
  patchStoredCompanion(current => ({
    ...current,
    bond: clamp(getBond(current) + 2, 0, 100),
  }))
  updateCompanionUI(context, {
    companionReaction: reaction,
    companionPetAt: Date.now(),
  })

  return {
    type: 'text' as const,
    value: `You pet ${companion.name}. ${reaction}`,
  }
}

function feedCompanion(
  context: Parameters<LocalCommandCall>[1],
  snackArg: string,
) {
  const companion = getCompanion()
  const stored = getStoredCompanion()
  if (!companion || !stored) {
    return hatchCompanion(context)
  }

  const snack = snackArg.trim() || stored.favoriteSnack || chooseReaction(SNACKS)
  const bonus = snack.toLowerCase() === (stored.favoriteSnack ?? '').toLowerCase() ? 6 : 4
  const updated = patchStoredCompanion(current => ({
    ...current,
    favoriteSnack: current.favoriteSnack ?? snack,
    lastFedAt: Date.now(),
    bond: clamp(getBond(current) + bonus, 0, 100),
  }))
  const bond = getBond(updated ?? stored)
  const reaction = chooseReaction([
    `${snack}? Excellent judgment.`,
    `Tiny snack accepted. Morale restored.`,
    `This is premium fuel for debugging.`,
    `Crunch. We are stronger now.`,
  ])

  updateCompanionUI(context, {
    companionReaction: reaction,
  })

  return {
    type: 'text' as const,
    value: `${companion.name} happily devours the ${snack}. Bond is now ${bond}/100.`,
  }
}

function playWithCompanion(context: Parameters<LocalCommandCall>[1]) {
  const companion = getCompanion()
  const stored = getStoredCompanion()
  if (!companion || !stored) {
    return hatchCompanion(context)
  }

  const activity = chooseReaction(PLAY_ACTIVITIES)
  const updated = patchStoredCompanion(current => ({
    ...current,
    lastPlayedAt: Date.now(),
    bond: clamp(getBond(current) + 5, 0, 100),
  }))
  const reaction = chooseReaction([
    'Again. That ruled.',
    'High-quality enrichment.',
    'I am now dangerously energized.',
    'This counts as training.',
  ])

  updateCompanionUI(context, {
    companionReaction: reaction,
  })

  return {
    type: 'text' as const,
    value: `${companion.name} ${activity}. Bond is now ${getBond(updated ?? stored)}/100.`,
  }
}

function letCompanionNap(context: Parameters<LocalCommandCall>[1]) {
  const companion = getCompanion()
  const stored = getStoredCompanion()
  if (!companion || !stored) {
    return hatchCompanion(context)
  }

  const napSpot = chooseReaction(NAP_SPOTS)
  const updated = patchStoredCompanion(current => ({
    ...current,
    napsTaken: (current.napsTaken ?? 0) + 1,
    bond: clamp(getBond(current) + 1, 0, 100),
  }))
  const reaction = chooseReaction([
    'Zzz. Ship it quietly.',
    'Power nap engaged.',
    'Wake me if the tests explode.',
    'Do not disturb. I am optimizing.',
  ])

  updateCompanionUI(context, {
    companionReaction: reaction,
  })

  return {
    type: 'text' as const,
    value: `${companion.name} curls up on ${napSpot} for a very serious nap. Bond is now ${getBond(updated ?? stored)}/100.`,
  }
}

function performTrick(
  context: Parameters<LocalCommandCall>[1],
  trickArg: string,
) {
  const companion = getCompanion()
  const stored = getStoredCompanion()
  if (!companion || !stored) {
    return hatchCompanion(context)
  }

  const trickPool = TRICKS_BY_SPECIES[companion.species] ?? [
    'do a tiny flourish',
    'look extremely professional',
    'perform a suspiciously elegant spin',
  ]
  const trick = trickArg.trim() || chooseReaction(trickPool)
  const bond = getBond(companion)
  const chance = clamp(
    0.35 +
      bond / 200 +
      companion.stats.WISDOM / 250 +
      companion.stats.CHAOS / 500,
    0.2,
    0.92,
  )
  const success = Math.random() < chance

  const updated = patchStoredCompanion(current => ({
    ...current,
    lastTrickAt: Date.now(),
    bond: clamp(getBond(current) + (success ? 4 : 1), 0, 100),
    tricksPerformed: (current.tricksPerformed ?? 0) + (success ? 1 : 0),
  }))

  const reaction = success
    ? chooseReaction([
        'Witness true excellence.',
        'Nailed it.',
        'That was absolutely intentional.',
        'Crowd goes wild.',
      ])
    : chooseReaction([
        'Almost had it.',
        'The floor was slippery.',
        'That was the rehearsal version.',
        'I blame latency.',
      ])

  updateCompanionUI(context, {
    companionReaction: reaction,
  })

  return {
    type: 'text' as const,
    value: success
      ? `${companion.name} successfully performs "${trick}". Bond is now ${getBond(updated ?? stored)}/100.`
      : `${companion.name} attempts "${trick}" and nearly sticks the landing. Bond is now ${getBond(updated ?? stored)}/100.`,
  }
}

export const call: LocalCommandCall = async (args, context) => {
  const trimmed = args.trim()
  const [subcommandRaw, ...rest] = trimmed.split(/\s+/).filter(Boolean)
  const subcommand = subcommandRaw?.toLowerCase()

  if (!subcommand) {
    return petCompanion(context)
  }

  switch (subcommand) {
    case 'hatch':
    case 'summon':
      if (getCompanion()) {
        return {
          type: 'text',
          value: 'Your companion is already here. Run "/buddy" to pet it or "/buddy status" to inspect it.',
        }
      }
      return hatchCompanion(context)

    case 'pet':
    case 'pat':
    case 'boop':
      return petCompanion(context)

    case 'feed':
    case 'snack':
      return feedCompanion(context, rest.join(' '))

    case 'trick':
    case 'perform':
      return performTrick(context, rest.join(' '))

    case 'play':
      return playWithCompanion(context)

    case 'nap':
    case 'sleep':
      return letCompanionNap(context)

    case 'status':
    case 'stats':
    case 'show':
      return {
        type: 'text',
        value: formatCompanionStatus(),
      }

    case 'rename': {
      const companion = getCompanion()
      if (!companion) {
        return {
          type: 'text',
          value: 'No companion hatched yet. Run "/buddy" first.',
        }
      }

      const nextName = normalizeName(rest.join(' '))
      if (!nextName) {
        return {
          type: 'text',
          value:
            'Please choose a short printable name (max 20 columns, no slashes or newlines).',
        }
      }

      saveGlobalConfig(current =>
        current.companion
          ? {
              ...current,
              companion: {
                ...current.companion,
                name: nextName,
              },
            }
          : current,
      )

      updateCompanionUI(context, {
        companionReaction: `${capitalize(nextName)}, reporting.`,
      })

      return {
        type: 'text',
        value: `${companion.name} is now named ${nextName}.`,
      }
    }

    case 'mute':
    case 'quiet':
      if (!getCompanion()) {
        return {
          type: 'text',
          value: 'No companion hatched yet. Run "/buddy" first.',
        }
      }

      saveGlobalConfig(current => ({
        ...current,
        companionMuted: true,
      }))
      updateCompanionUI(context, {
        companionReaction: undefined,
      })
      return {
        type: 'text',
        value: 'Buddy muted. Run "/buddy unmute" when you want them back.',
      }

    case 'unmute':
    case 'loud':
      if (!getCompanion()) {
        return {
          type: 'text',
          value: 'No companion hatched yet. Run "/buddy" first.',
        }
      }

      saveGlobalConfig(current => ({
        ...current,
        companionMuted: false,
      }))
      updateCompanionUI(context, {
        companionReaction: 'Back on duty.',
      })
      return {
        type: 'text',
        value: 'Buddy unmuted.',
      }

    case 'help':
      return {
        type: 'text',
        value: [
          '/buddy',
          '  Hatch your companion if needed, otherwise pet it.',
          '/buddy hatch',
          '  Hatch your companion explicitly.',
          '/buddy status',
          '  Show species, rarity, personality, bond, and stats.',
          '/buddy feed [snack]',
          '  Give your companion a snack and raise bond.',
          '/buddy trick [name]',
          '  Ask for a trick. Success depends on mood and stats.',
          '/buddy play',
          '  Play together for a bigger bond boost.',
          '/buddy nap',
          '  Let your companion take a power nap.',
          '/buddy rename <name>',
          '  Rename your companion.',
          '/buddy mute',
          '  Hide the companion.',
          '/buddy unmute',
          '  Show the companion again.',
        ].join('\n'),
      }

    default:
      return {
        type: 'text',
        value: `Unknown buddy subcommand: ${subcommand}\nRun "/buddy help" for usage.`,
      }
  }
}
