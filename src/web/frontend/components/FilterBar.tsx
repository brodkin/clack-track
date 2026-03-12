import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/web/frontend/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/web/frontend/components/ui/select';
import { cn } from '@/web/frontend/lib/utils';

export type SortOrder = 'newest' | 'oldest';

export interface FilterBarProps {
  /** Available provider options for the dropdown */
  providers: string[];
  /** Available model options for the dropdown */
  models: string[];
  /** Available generator options for the dropdown */
  generators: string[];
  /** Currently selected provider (empty string = all) */
  selectedProvider: string;
  /** Currently selected model (empty string = all) */
  selectedModel: string;
  /** Currently selected generator (empty string = all) */
  selectedGenerator: string;
  /** Current search query value */
  searchQuery: string;
  /** Current sort order */
  sortOrder: SortOrder;
  /** Called when provider selection changes */
  onProviderChange: (value: string) => void;
  /** Called when model selection changes */
  onModelChange: (value: string) => void;
  /** Called when generator selection changes */
  onGeneratorChange: (value: string) => void;
  /** Called when search query changes (after debounce) */
  onSearchChange: (value: string) => void;
  /** Called when sort order changes */
  onSortChange: (value: SortOrder) => void;
  /** Optional additional className */
  className?: string;
}

const DEBOUNCE_MS = 300;

/**
 * A reusable filter bar with dropdown filters, debounced search, and sort controls.
 * Renders responsively: stacks vertically on mobile, horizontal on desktop.
 */
export function FilterBar({
  providers,
  models,
  generators,
  selectedProvider,
  selectedModel,
  selectedGenerator,
  searchQuery,
  sortOrder,
  onProviderChange,
  onModelChange,
  onGeneratorChange,
  onSearchChange,
  onSortChange,
  className,
}: FilterBarProps): React.JSX.Element {
  const [localSearch, setLocalSearch] = React.useState(searchQuery);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync localSearch when searchQuery prop changes externally (e.g., clear from parent)
  React.useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalSearch(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        onSearchChange(value);
      }, DEBOUNCE_MS);
    },
    [onSearchChange]
  );

  const handleClearSearch = React.useCallback(() => {
    setLocalSearch('');
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onSearchChange('');
  }, [onSearchChange]);

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className={cn('flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center', className)}>
      {/* Search input with icon and clear button */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search content..."
          value={localSearch}
          onChange={handleSearchChange}
          className="pl-9 pr-8 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        {localSearch && (
          <button
            type="button"
            onClick={handleClearSearch}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      <FilterDropdown
        label="Provider"
        options={providers}
        value={selectedProvider}
        onValueChange={onProviderChange}
      />

      <FilterDropdown
        label="Model"
        options={models}
        value={selectedModel}
        onValueChange={onModelChange}
      />

      <FilterDropdown
        label="Generator"
        options={generators}
        value={selectedGenerator}
        onValueChange={onGeneratorChange}
      />

      {/* Sort dropdown */}
      <div className="min-w-[160px]">
        <Select value={sortOrder} onValueChange={v => onSortChange(v as SortOrder)}>
          <SelectTrigger aria-label="Sort order">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface FilterDropdownProps {
  label: string;
  options: string[];
  value: string;
  onValueChange: (value: string) => void;
}

function FilterDropdown({
  label,
  options,
  value,
  onValueChange,
}: FilterDropdownProps): React.JSX.Element {
  const disabled = options.length === 0;

  return (
    <div className="min-w-[140px]">
      <Select
        value={value || '__all__'}
        onValueChange={v => onValueChange(v === '__all__' ? '' : v)}
        disabled={disabled}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder={`All ${label.toLowerCase()}s`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All</SelectItem>
          {options.map(option => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
