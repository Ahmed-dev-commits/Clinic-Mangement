import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Pill, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClinicalMedicine } from '@/hooks/useClinicalMedicines';

interface MedicineSearchProps {
  medicines: ClinicalMedicine[];
  onSelect: (medicine: ClinicalMedicine) => void;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
}

export function MedicineSearch({
  medicines,
  onSelect,
  placeholder = "Search medicine (type 3+ characters)...",
  value = "",
  disabled = false,
}: MedicineSearchProps) {
  const [searchQuery, setSearchQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [filteredMedicines, setFilteredMedicines] = useState<ClinicalMedicine[]>([]);
  const [justSelected, setJustSelected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter medicines when search query changes (minimum 3 characters)
  useEffect(() => {
    // Skip filtering if we just selected a medicine
    if (justSelected) {
      setJustSelected(false);
      return;
    }

    if (searchQuery.length >= 3) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        const filtered = medicines.filter(item =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredMedicines(filtered);
        setIsSearching(false);
        setIsOpen(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setFilteredMedicines([]);
      setIsOpen(false);
    }
  }, [searchQuery, medicines, justSelected]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (medicine: ClinicalMedicine) => {
    setJustSelected(true);
    setIsOpen(false);
    setSearchQuery(medicine.name);
    setFilteredMedicines([]);
    onSelect(medicine);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery.length >= 3 && setIsOpen(true)}
          disabled={disabled}
          className="pl-10 pr-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Search hint */}
      {searchQuery.length > 0 && searchQuery.length < 3 && (
        <p className="text-xs text-muted-foreground mt-1">
          Type {3 - searchQuery.length} more character{3 - searchQuery.length !== 1 ? 's' : ''} to search...
        </p>
      )}

      {/* Dropdown results */}
      {isOpen && filteredMedicines.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredMedicines.map((medicine) => (
            <button
              key={medicine.id}
              type="button"
              onClick={() => handleSelect(medicine)}
              className={cn(
                "w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3 transition-colors"
              )}
            >
              <Pill className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{medicine.name}</p>
                <p className="text-xs text-muted-foreground">{medicine.category}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && searchQuery.length >= 3 && filteredMedicines.length === 0 && !isSearching && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">No medicines found for "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
}
