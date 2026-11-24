import { useState } from 'react';
import { colorSlots, customHairColor, hairPickerValue, type AvatarPalette, type ColorSlot } from './avatar-palette';
import './avatar-colors.css';

const clothingColors = [
  ['سفید', '#f0eee8'], ['مشکی', '#22252a'], ['سرمه‌ای', '#243b66'], ['سبز', '#4e6549'],
  ['آجری', '#ab503b'], ['بنفش', '#885db1'], ['کرم', '#c6aa80'],
];
const hairColors = [
  ['مشکی', '#151515'], ['ذغالی', '#393939'], ['قهوه‌ای تیره', '#4d3022'], ['قهوه‌ای', '#906245'],
  ['قهوه‌ای روشن', '#b7825e'], ['نقره‌ای', '#b7b7b7'], ['سفید', '#ececec'],
];

function HairPicker({ color, onChange }: { color?: string; onChange: (color: string) => void }) {
  const [value, setValue] = useState(() => hairPickerValue(color));
  const update = (change: Partial<typeof value>) => {
    const next = { ...value, ...change };
    setValue(next);
    onChange(customHairColor(next.family, next.shade, next.warmth));
  };
  return <>
    <label className="studio-select">طیف مو
      <select value={value.family} onChange={event => update({ family: event.target.value === 'brown' ? 'brown' : 'neutral' })}>
        <option value="neutral">سیاه تا سفید</option>
        <option value="brown">قهوه‌ای</option>
      </select>
    </label>
    <label className="studio-range">روشنی مو
      <input type="range" min="0" max="100" value={value.shade} onChange={event => update({ shade: +event.target.value })} />
    </label>
    {value.family === 'brown' && <label className="studio-range">گرمی قهوه‌ای
      <input type="range" min="0" max="100" value={value.warmth} onChange={event => update({ warmth: +event.target.value })} />
    </label>}
  </>;
}

export function AvatarColorPanel({ palette, ready, paused, onPause, onChange }: {
  palette: AvatarPalette;
  ready: boolean;
  paused: boolean;
  onPause: () => void;
  onChange: (palette: AvatarPalette) => void;
}) {
  const [slot, setSlot] = useState<ColorSlot>('shirt');
  const [hairPickerRevision, resetHairPicker] = useState(0);
  const color = palette[slot];
  const presets = slot === 'hair' ? hairColors : clothingColors;
  const choose = (value?: string) => {
    const next = { ...palette };
    if (value) next[slot] = value;
    else delete next[slot];
    onChange(next);
  };

  return <fieldset className="avatar-color-panel" disabled={!ready}>
    <legend>رنگ ظاهری</legend>
    <div className="avatar-color-slots" aria-label="بخش آواتار">
      {(Object.keys(colorSlots) as ColorSlot[]).map(part =>
        <button key={part} aria-pressed={slot === part} onClick={() => setSlot(part)}>{colorSlots[part]}</button>)}
    </div>
    <div className="avatar-swatches" role="group" aria-label={`رنگ‌های منتخب ${colorSlots[slot]}`}>
      {presets.map(([name, hex]) => <button key={hex} className="avatar-swatch" aria-label={name} title={name}
        aria-pressed={color === hex} style={{ backgroundColor: hex }}
        onClick={() => { choose(hex); resetHairPicker(value => value + 1); }} />)}
    </div>
    <div className="avatar-color-selection">
      <span className="avatar-current-color" style={{ backgroundColor: color }} aria-hidden="true" />
      <output dir={color ? 'ltr' : 'rtl'}>{color ?? 'رنگ اصلی'}</output>
      <button disabled={!color} onClick={() => { choose(); resetHairPicker(value => value + 1); }}>بازنشانی {colorSlots[slot]}</button>
    </div>
    {slot === 'hair' ? <HairPicker key={hairPickerRevision} color={color} onChange={choose} />
      : <label className="avatar-custom-color">رنگ دلخواه {colorSlots[slot]}
        <input type="color" value={color ?? '#7c8280'} onInput={event => choose(event.currentTarget.value)} />
      </label>}
    <div className="avatar-color-actions">
      <button onClick={onPause}>{paused ? 'ادامهٔ چرخش' : 'توقف چرخش'}</button>
      <button disabled={!Object.keys(palette).length} onClick={() => { onChange({}); resetHairPicker(value => value + 1); }}>بازنشانی همهٔ رنگ‌ها</button>
    </div>
  </fieldset>;
}
