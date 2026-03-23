import { useState, useRef, useEffect, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import { fr } from 'react-day-picker/locale';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';

// ─── Quick-select options ───────────────────────────────────────────────────
// These are the preset date filters shown as pill buttons at the top
// of the dropdown. "Choisir une date" toggles the calendar picker.

const QUICK_OPTIONS = ["Aujourd'hui", 'Demain', 'Cette semaine'] as const;
type QuickOption = (typeof QUICK_OPTIONS)[number];

// ─── Component ──────────────────────────────────────────────────────────────

interface WhenDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * "Quand ?" dropdown for the hero search bar.
 * Shows three quick-select pill buttons (Aujourd'hui, Demain, Cette semaine)
 * plus a calendar date picker (react-day-picker) that appears when the user
 * clicks "Choisir une date" or picks a specific day.
 *
 * The selected value is stored as:
 * - A quick option label ("Aujourd'hui", "Demain", "Cette semaine")
 * - Or a formatted date string ("lun. 11 oct. 2024") when a specific date is picked
 *
 * Keyboard-accessible: Escape closes the dropdown.
 */
export default function WhenDropdown({ value, onChange }: WhenDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowCalendar(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectQuickOption = useCallback(
    (option: QuickOption) => {
      onChange(option);
      setSelectedDate(undefined);
      setShowCalendar(false);
      setIsOpen(false);
    },
    [onChange],
  );

  const selectDate = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      setSelectedDate(date);
      // Format: "lun. 11 oct. 2024" — human-readable French date
      const formatted = format(date, 'EEE dd MMM yyyy', { locale: undefined });
      onChange(formatted);
      setShowCalendar(false);
      setIsOpen(false);
    },
    [onChange],
  );

  /**
   * Checks if a quick option is currently active.
   * Used for highlighting the selected pill button.
   */
  function isQuickOptionActive(option: QuickOption): boolean {
    return value === option;
  }

  /**
   * The display text shown in the search bar input area.
   * Shows the quick option label or the formatted date.
   */
  const displayText = value || QUICK_OPTIONS[0];

  // Disable past dates in the calendar — users can't book appointments in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Default month for the calendar: show the selected date's month, or current month
  const defaultMonth = selectedDate ?? today;

  // For "Cette semaine" highlighting: compute the current week range
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  return (
    <div ref={containerRef} className="relative flex-1 w-full z-50">
      {/* Trigger — same layout as other search bar fields */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center px-6 gap-3 cursor-pointer focus:outline-none focus:ring-0"
      >
        <span className="material-symbols-outlined text-primary">calendar_today</span>
        <div className="flex flex-col items-start w-full">
          <span className="text-[10px] uppercase font-bold text-outline">Quand ?</span>
          <span className="text-on-surface font-semibold text-sm text-left">{displayText}</span>
        </div>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-2 bg-surface-container-lowest rounded-xl shadow-[0_4px_40px_rgba(25,28,32,0.10)] overflow-hidden border border-outline-variant/10 z-50 min-w-[320px]"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              setShowCalendar(false);
            }
          }}
        >
          <div className="p-4 space-y-4">
            {/* Quick-select pill buttons */}
            <div className="flex flex-wrap gap-2">
              {QUICK_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectQuickOption(option)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    isQuickOptionActive(option)
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface hover:bg-primary/10'
                  }`}
                >
                  {option}
                </button>
              ))}

              {/* "Choisir une date" toggle — opens/closes the calendar */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowCalendar(!showCalendar)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  showCalendar || (!QUICK_OPTIONS.includes(value as QuickOption) && value)
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface hover:bg-primary/10'
                }`}
              >
                Choisir une date
              </button>
            </div>

            {/* Calendar — only visible when "Choisir une date" is active */}
            {showCalendar && (
              <div className="when-calendar">
                <DayPicker
                  mode="single"
                  locale={fr}
                  selected={selectedDate}
                  onSelect={selectDate}
                  defaultMonth={defaultMonth}
                  disabled={{ before: today }}
                  weekStartsOn={1}
                  modifiers={{
                    thisWeek: { from: weekStart, to: weekEnd },
                  }}
                  modifiersClassNames={{
                    thisWeek: 'rdp-day_this-week',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
