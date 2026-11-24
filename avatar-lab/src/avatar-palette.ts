export const colorSlots = {
  shirt: 'لباس',
  trousers: 'شلوار',
  shoes: 'کفش',
  hair: 'مو',
} as const;

export type ColorSlot = keyof typeof colorSlots;
export type AvatarPalette = Partial<Record<ColorSlot, string>>;

const hexColor = /^#[0-9a-f]{6}$/i;
const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
const toHex = (channels: number[]) => '#' + channels.map(channel =>
  Math.round(channel).toString(16).padStart(2, '0')).join('');

export function normalizePalette(value: unknown): AvatarPalette {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const palette: AvatarPalette = {};
  for (const slot of Object.keys(colorSlots) as ColorSlot[]) {
    const color = source[slot];
    if (typeof color !== 'string' || !hexColor.test(color)) continue;
    if (slot === 'hair') {
      const [r, g, b] = rgb(color);
      if (r < g || g < b || r - b > Math.min(115, r * .71, (255 - b) * .83)) continue;
    }
    palette[slot] = color.toLowerCase();
  }
  return palette;
}

export function customHairColor(family: 'neutral' | 'brown', shade: number, warmth: number) {
  if (family === 'neutral') return toHex(Array(3).fill(shade * 2.55));
  const center = 26 + shade * 1.77;
  const spread = Math.min(center * .57, (255 - center) * .57, 75) * (.42 + .58 * warmth / 100);
  return toHex([center + spread * .49, center, center - spread * .51]);
}

export function hairPickerValue(color?: string) {
  const [r, g, b] = rgb(color ?? '#202020');
  const family = r === b ? 'neutral' : 'brown';
  const shade = family === 'neutral' ? g / 2.55 : (g - 26) / 1.77;
  const spread = Math.min(g * .57, (255 - g) * .57, 75);
  const warmth = spread > 0 ? ((r - b) / spread - .42) / .58 * 100 : 65;
  const slider = (value: number) => Math.round(Math.max(0, Math.min(100, value)));
  return { family, shade: slider(shade), warmth: slider(warmth) } as const;
}
