export const op = {
  bg: 'bg-[oklch(0.15_0.008_260)]',
  bgMain: 'bg-[oklch(0.17_0.008_260)]',
  bgElev: 'bg-[oklch(0.205_0.01_260)]',
  bgElev2: 'bg-[oklch(0.235_0.012_260)]',
  hover: 'hover:bg-[oklch(0.26_0.014_260)]',
  border: 'border-[oklch(0.30_0.012_260)]',
  borderSoft: 'border-[oklch(0.26_0.01_260)]',
  text: 'text-[oklch(0.96_0.005_260)]',
  dim: 'text-[oklch(0.72_0.01_260)]',
  mute: 'text-[oklch(0.55_0.01_260)]',
  accent: 'text-[oklch(0.72_0.15_25)]',
  accentBg: 'bg-[oklch(0.72_0.15_25_/_0.14)]',
  ok: 'text-[oklch(0.78_0.14_155)]',
  okBg: 'bg-[oklch(0.78_0.14_155_/_0.14)]',
  warn: 'text-[oklch(0.82_0.14_80)]',
  warnBg: 'bg-[oklch(0.82_0.14_80_/_0.14)]',
  bad: 'text-[oklch(0.70_0.19_25)]',
  badBg: 'bg-[oklch(0.70_0.19_25_/_0.14)]',
  scrollbar: '[scrollbar-width:thin] [scrollbar-color:oklch(0.38_0.012_260)_oklch(0.18_0.008_260)] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[oklch(0.18_0.008_260)] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-[oklch(0.18_0.008_260)] [&::-webkit-scrollbar-thumb]:bg-[oklch(0.36_0.012_260)] hover:[&::-webkit-scrollbar-thumb]:bg-[oklch(0.46_0.014_260)]',
}

export function avatarGradient(hue) {
  return {
    background: `linear-gradient(135deg, oklch(0.60 0.14 ${hue}), oklch(0.35 0.12 ${(hue + 70) % 360}))`,
  }
}
