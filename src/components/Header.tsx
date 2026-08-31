import React from 'react';
import { RotateCcw } from 'lucide-react';

interface HeaderProps {
  totalCoursesCount: number;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalCoursesCount,
  onReset,
}) => {
  return (
    <header className="border-b border-neutral-200 bg-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 h-20 flex items-center justify-between">
        {/* Left Side: Brand Identity */}
        <div className="flex items-center gap-3.5">
          <div
            onClick={onReset}
            className="cursor-pointer flex items-center gap-3.5 group"
            title="Register: Schedule Optimizer"
          >
            <div className="w-9 h-9 rounded-full border border-black flex items-center justify-center font-luxury-brand text-sm font-bold tracking-widest text-black group-hover:bg-black group-hover:text-white transition-all select-none">
              R
            </div>
            <div className="flex flex-col">
              <span className="font-luxury-brand text-lg sm:text-xl font-bold tracking-[0.2em] text-black leading-none uppercase">
                REGISTER
              </span>
              <span className="text-[9px] text-neutral-500 tracking-[0.25em] uppercase font-semibold mt-1">
                Schedule Optimizer
              </span>
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Reset / New Catalog */}
          {totalCoursesCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium uppercase tracking-wider text-neutral-600 hover:text-black border border-neutral-200 hover:border-black rounded-full transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Start Over</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
