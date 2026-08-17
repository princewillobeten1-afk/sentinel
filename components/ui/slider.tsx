import React from 'react';
import { clsx } from 'clsx';

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function Slider({ value = [0], onValueChange, min = 0, max = 100, step = 1, className, ...props }: SliderProps) {
  const currentValue = Array.isArray(value) ? value[0] : value;

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={currentValue}
      onChange={(e) => onValueChange && onValueChange([parseFloat(e.target.value)])}
      className={clsx('w-full accent-sky-500 bg-sentinel-950 rounded-lg cursor-pointer h-2 border border-sentinel-750', className)}
      {...props}
    />
  );
}
