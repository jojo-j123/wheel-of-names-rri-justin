import type { EventData, EventTemplate } from '../../types'
import { DEFAULT_BRANDING } from '../branding'
import { DEFAULT_ANIMATION_SETTINGS, DEFAULT_WHEEL_SETTINGS, createEmptyEvent } from './defaults'
import { addParticipants, addPrize } from './operations'

export const DEMO_NAMES = [
  'Sarah Hassan', 'Omar Khalil', 'Emily Carter', 'Ahmed Ali', 'Laura Martínez', 'Youssef Nabil',
  'Daniel Kim', 'Mona Farouk', 'James O’Connor', 'Nour El-Din', 'Priya Sharma', 'Karim Mansour',
  'Olivia Bennett', 'Hana Tanaka', 'Mohamed Samir', 'Sophie Laurent', 'Lucas Oliveira', 'Rania Adel',
  'Michael Brown', 'Aisha Rahman', 'Tomás Rivera', 'Fatma Yilmaz', 'Chris Walker', 'Salma Ibrahim',
  'Noah Fischer', 'Layla Haddad', 'Ethan Clarke', 'Mariam Youssef', 'Julia Novak', 'Hassan Mostafa',
]

export function createDemoEvent(): EventData {
  let e = createEmptyEvent('RRI Annual Gala — Demo')
  e = {
    ...e,
    isDemo: true,
    description: 'Demo event with sample names and prizes. Replace them with your own in Admin.',
  }
  e = addParticipants(
    e,
    DEMO_NAMES.map((name) => ({
      name,
      email: `${name.toLowerCase().normalize('NFKD').replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')}@example.com`,
    })),
    { preventDuplicates: true },
  ).event
  const prizes = [
    { name: 'iPhone 17 Pro', description: 'Grand prize', image: '/demo/phone.svg', quantity: 1, sponsor: 'RRI', value: '$1,199' },
    { name: 'Weekend Getaway', description: 'Two nights for two', image: '/demo/travel.svg', quantity: 1, value: '$900' },
    { name: 'Smart Watch', description: 'Latest generation', image: '/demo/watch.svg', quantity: 2, value: '$399' },
    { name: 'Wireless Headphones', description: 'Noise cancelling', image: '/demo/headphones.svg', quantity: 3, value: '$249' },
    { name: 'Smart Speaker', image: '/demo/speaker.svg', quantity: 3, value: '$99' },
    { name: 'Gift Card', description: '$50 voucher', image: '/demo/giftcard.svg', quantity: 5, value: '$50' },
  ]
  for (const p of prizes) e = addPrize(e, p).event
  // Start with a smaller prize so the grand prize is saved for last.
  e.activePrizeId = e.prizes[e.prizes.length - 1].id
  return e
}

const t = (
  id: string,
  name: string,
  description: string,
  prizes: EventTemplate['prizes'],
  overrides: Partial<Pick<EventTemplate, 'branding' | 'animationSettings' | 'wheelSettings'>> = {},
): EventTemplate => ({
  id,
  name,
  description,
  builtIn: true,
  branding: { ...DEFAULT_BRANDING, ...overrides.branding },
  wheelSettings: { ...DEFAULT_WHEEL_SETTINGS, ...overrides.wheelSettings },
  animationSettings: { ...DEFAULT_ANIMATION_SETTINGS, ...overrides.animationSettings },
  prizes,
  createdAt: 0,
})

const prize = (name: string, quantity: number, description?: string) => ({ name, quantity, description, enabled: true })

export const BUILT_IN_TEMPLATES: EventTemplate[] = [
  t('builtin_annual', 'Corporate Annual Meeting', 'Dramatic spins, RRI branding, a few premium prizes.', [
    prize('Grand Prize', 1), prize('Runner-up Prize', 2), prize('Gift Card', 5),
  ]),
  t('builtin_christmas', 'Christmas Giveaway', 'Festive colours and lots of small gifts.', [
    prize('Holiday Hamper', 3), prize('Gift Card', 10), prize('Grand Holiday Prize', 1),
  ], { branding: { ...DEFAULT_BRANDING, primaryColor: '#C8243A', secondaryColor: '#0F3D2E', accentColor: '#F4D27A', backgroundColor: '#0A100D' } }),
  t('builtin_conference', 'Conference Giveaway', 'Quick standard spins for booth visitors.', [
    prize('Swag Bag', 20), prize('Headphones', 3), prize('Tablet', 1),
  ], { animationSettings: { ...DEFAULT_ANIMATION_SETTINGS, mode: 'standard' } }),
  t('builtin_launch', 'Product Launch', 'One big reveal with the grand-prize animation.', [prize('Launch Edition Product', 1, 'Grand prize')], {
    animationSettings: { ...DEFAULT_ANIMATION_SETTINGS, mode: 'grand' },
  }),
  t('builtin_awards', 'Employee Awards', 'Winners stay eligible so everyone keeps a chance.', [
    prize('Recognition Award', 5), prize('Extra Day Off', 3),
  ], { wheelSettings: { ...DEFAULT_WHEEL_SETTINGS, removeWinners: false } }),
]
