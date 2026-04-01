import type { Command } from '../../commands.js'

const buddy = {
  type: 'local',
  name: 'buddy',
  description: 'Hatch, pet, and manage your companion pet',
  argumentHint: '[pet|status|rename <name>|mute|unmute|help]',
  supportsNonInteractive: true,
  load: () => import('./buddy.js'),
} satisfies Command

export default buddy
