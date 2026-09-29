/** Small stroke icons (24px grid, Lucide-style) so the UI doesn't depend on emoji or an icon font. */
const PATHS = {
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35',
  walk: 'M13 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM9 21l2.5-6.5L14 17v4M7 12l2-4 4-1 2 4 3 1M11.5 14.5 10 9',
  bike: 'M5.5 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm13 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-3 11.5V14l-3-3 4-3 2 3h2',
  car: 'M5 17h14M5 17a2 2 0 1 1-4 0v-5l2-5h14l2 5v5a2 2 0 1 1-4 0M5 17a2 2 0 1 0 4 0m6 0a2 2 0 1 0 4 0M3 12h18',
  share: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4m4-4v13',
  navigate: 'm3 11 19-9-9 19-2-8-8-2Z',
  sparkle: 'M12 3v4m0 10v4M3 12h4m10 0h4M6.3 6.3l2.8 2.8m5.8 5.8 2.8 2.8m0-11.4-2.8 2.8m-5.8 5.8-2.8 2.8',
  flag: 'M4 22V4m0 0h13l-2 4 2 4H4',
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3 2',
  plus: 'M12 5v14m-7-7h14',
  x: 'M18 6 6 18M6 6l12 12',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="icon"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
