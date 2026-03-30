import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
  size?: number;
  className?: string;
}

export default function InfoTooltip({ text, size = 13, className = '' }: InfoTooltipProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Close on outside click
  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [show]);

  const handleMouseEnter = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(true), 200);
  };

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), 300);
  };

  return (
    <div ref={ref} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => { e.stopPropagation(); setShow(prev => !prev); }}
        className="text-pos-on-surface-variant/50 hover:text-pos-secondary transition-colors focus:outline-none"
        aria-label="Info"
      >
        <Info size={size} strokeWidth={2.2} />
      </button>
      {show && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 animate-in fade-in-0 zoom-in-95 duration-150"
          onMouseEnter={() => clearTimeout(timerRef.current)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="bg-pos-surface-lowest dark:bg-gray-800 border border-pos-surface-container shadow-lg rounded-lg px-3 py-2 text-[11px] leading-relaxed text-pos-on-surface max-w-[220px] min-w-[140px] whitespace-normal">
            {text}
          </div>
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-pos-surface-container" />
        </div>
      )}
    </div>
  );
}
