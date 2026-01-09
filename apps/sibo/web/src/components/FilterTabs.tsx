import type { FodmapRating } from '../types/food';
import './FilterTabs.css';

type FilterOption = 'all' | FodmapRating;

interface FilterTabsProps {
  selected: FilterOption;
  onChange: (filter: FilterOption) => void;
  counts: {
    all: number;
    low: number;
    moderate: number;
    high: number;
  };
}

export function FilterTabs({ selected, onChange, counts }: FilterTabsProps) {
  const tabs: { value: FilterOption; label: string; emoji: string }[] = [
    { value: 'all', label: 'All', emoji: '📋' },
    { value: 'low', label: 'Safe', emoji: '✓' },
    { value: 'moderate', label: 'Caution', emoji: '⚠' },
    { value: 'high', label: 'Avoid', emoji: '✗' },
  ];

  return (
    <div className="filter-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          className={`filter-tabs__tab filter-tabs__tab--${tab.value} ${
            selected === tab.value ? 'filter-tabs__tab--active' : ''
          }`}
          onClick={() => onChange(tab.value)}
        >
          <span className="filter-tabs__emoji">{tab.emoji}</span>
          <span className="filter-tabs__label">{tab.label}</span>
          <span className="filter-tabs__count">{counts[tab.value]}</span>
        </button>
      ))}
    </div>
  );
}

export type { FilterOption };
