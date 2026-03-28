import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ComboInputProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  onAddNew?: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export default function ComboInput({ value, onChange, options, onAddNew, placeholder, className = '' }: ComboInputProps) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number; direction: 'down' | 'up' }>({ top: 0, left: 0, width: 0, direction: 'down' });

  useEffect(() => { setInputVal(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const direction = spaceBelow < 200 ? 'up' : 'down';
      setDropPos({
        top: direction === 'down' ? rect.bottom + 2 : rect.top - 2,
        left: rect.left,
        width: Math.max(rect.width, 140),
        direction,
      });
    }
  }, [open, inputVal]);

  const filtered = options.filter(o => o.toLowerCase().includes(inputVal.toLowerCase()));
  const isNew = inputVal.trim() && !options.some(o => o.toLowerCase() === inputVal.trim().toLowerCase());

  const select = (val: string) => {
    onChange(val);
    setInputVal(val);
    setOpen(false);
  };

  const handleAdd = () => {
    if (isNew && onAddNew) {
      onAddNew(inputVal.trim());
      select(inputVal.trim());
    }
  };

  const dropdown = open && (filtered.length > 0 || isNew) ? createPortal(
    <div
      style={{
        position: 'fixed',
        left: dropPos.left,
        width: dropPos.width,
        ...(dropPos.direction === 'down'
          ? { top: dropPos.top }
          : { bottom: window.innerHeight - dropPos.top }),
        zIndex: 9999,
      }}
      className="max-h-[180px] overflow-y-auto bg-popover border border-border rounded-lg shadow-lg py-0.5"
      onMouseDown={e => e.preventDefault()}
    >
      {filtered.map(o => (
        <button key={o} type="button" onClick={() => select(o)}
          className={`w-full text-left px-2 py-1.5 text-xs hover:bg-accent transition-colors ${o === value ? 'bg-accent font-semibold' : ''}`}>
          {o}
        </button>
      ))}
      {isNew && onAddNew && (
        <button type="button" onClick={handleAdd}
          className="w-full text-left px-2 py-1.5 text-xs text-primary font-semibold hover:bg-accent border-t border-border flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">add</span>
          "{inputVal.trim()}" যোগ করো
        </button>
      )}
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={ref} className="relative">
      <input
        ref={inputRef}
        value={inputVal}
        onChange={e => { setInputVal(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      {dropdown}
    </div>
  );
}
