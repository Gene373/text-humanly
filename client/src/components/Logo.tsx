import { FileText } from 'lucide-react';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-white"
        aria-hidden
      >
        <FileText size={18} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="text-[17px] font-semibold tracking-[-0.01em]">Текст по-человечески</span>
      )}
    </div>
  );
}
