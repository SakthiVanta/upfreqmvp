'use client';

import { useEffect, useState } from 'react';

interface NumberInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** When true, clearing the field commits `undefined` (for fields where
   * blank is a real, meaningful state — e.g. mass/inertia, "omit this").
   * When false (default), an empty/incomplete field just doesn't commit
   * anything until a full number is typed, and reverts to the last
   * committed value on blur — for fields that always need a real number
   * (origin, scale). */
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
}

// Plain <input type="number"> fights the user while typing a negative or
// decimal value: an onChange handler that does `parseFloat(e.target.value)
// || 0` treats every intermediate state ("-", "-0", "0.") as invalid and
// collapses the field back to "0", stripping the minus sign or decimal
// point out from under the cursor mid-keystroke. This keeps its own local
// text buffer while focused — nothing overwrites what the user is actively
// typing — and only syncs from the real numeric value when unfocused (an
// external update, e.g. AI Generate, or on blur to normalize the display).
export function NumberInput({ value, onChange, allowEmpty, placeholder, className, onClick }: NumberInputProps) {
  const [text, setText] = useState(() => (value === undefined ? '' : String(value)));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value === undefined ? '' : String(value));
  }, [value, focused]);

  const commitFromText = (raw: string) => {
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
      if (allowEmpty) onChange(undefined);
      return;
    }
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) onChange(parsed);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onClick={onClick}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(value === undefined ? '' : String(value));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^-?\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        commitFromText(raw);
      }}
      className={className}
    />
  );
}
