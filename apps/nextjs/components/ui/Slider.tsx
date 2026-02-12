'use client';

import { useRef, useCallback } from 'react';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
}

export default function Slider({
  value,
  onChange,
  min = 0,
  max = 2,
  step = 0.1,
  label,
  disabled = false,
}: SliderProps): React.ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);

  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)) / step) * step;

  const getValueFromX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return clamp(min + ratio * (max - min));
    },
    [min, max, step, value],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      onChange(getValueFromX(e.clientX));
    },
    [disabled, getValueFromX, onChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      const el = e.currentTarget as HTMLElement;
      if (!el.hasPointerCapture(e.pointerId)) return;
      onChange(getValueFromX(e.clientX));
    },
    [disabled, getValueFromX, onChange],
  );

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={`slider${disabled ? ' slider--disabled' : ''}`}>
      {label && <span className="slider__label">{label}</span>}
      <div className="slider__row">
        <div
          ref={trackRef}
          className="slider__track"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          <div className="slider__fill" style={{ width: `${pct}%` }} />
          <div className="slider__thumb" style={{ left: `${pct}%` }} />
        </div>
        <span className="slider__value">{value.toFixed(1)}</span>
      </div>
    </div>
  );
}
