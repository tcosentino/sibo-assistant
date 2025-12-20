import { useState, useMemo } from 'react';
import { allFoods } from './data/foods';
import type { Food } from './types/food';
import { SearchBar } from './components/SearchBar';
import { FilterTabs, type FilterOption } from './components/FilterTabs';
import { FoodCard } from './components/FoodCard';
import { FoodDetail } from './components/FoodDetail';
import { ChatWindow } from './components/ChatWindow';
import './App.css';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);

  const filteredFoods = useMemo(() => {
    let foods = allFoods;

    // Apply FODMAP filter
    if (filter !== 'all') {
      foods = foods.filter((food) => food.fodmapRating === filter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      foods = foods.filter(
        (food) =>
          food.name.toLowerCase().includes(query) ||
          food.aliases?.some((alias) => alias.toLowerCase().includes(query)) ||
          food.subcategory?.toLowerCase().includes(query)
      );
    }

    // Sort: low first, then moderate, then high
    const order = { low: 0, moderate: 1, high: 2 };
    return foods.sort((a, b) => {
      if (order[a.fodmapRating] !== order[b.fodmapRating]) {
        return order[a.fodmapRating] - order[b.fodmapRating];
      }
      return a.name.localeCompare(b.name);
    });
  }, [searchQuery, filter]);

  const counts = useMemo(() => {
    const base = searchQuery.trim()
      ? allFoods.filter(
          (food) =>
            food.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            food.aliases?.some((alias) =>
              alias.toLowerCase().includes(searchQuery.toLowerCase())
            )
        )
      : allFoods;

    return {
      all: base.length,
      low: base.filter((f) => f.fodmapRating === 'low').length,
      moderate: base.filter((f) => f.fodmapRating === 'moderate').length,
      high: base.filter((f) => f.fodmapRating === 'high').length,
    };
  }, [searchQuery]);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">SIBO Food Guide</h1>
        <p className="app__subtitle">
          Find what's safe to eat during your SIBO journey
        </p>
      </header>

      <div className="app__controls">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search vegetables..."
        />
        <FilterTabs selected={filter} onChange={setFilter} counts={counts} />
      </div>

      <main className="app__content">
        {filteredFoods.length === 0 ? (
          <div className="app__empty">
            <p>No foods found matching your search.</p>
            <button onClick={() => { setSearchQuery(''); setFilter('all'); }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="app__grid">
            {filteredFoods.map((food) => (
              <FoodCard
                key={food.id}
                food={food}
                onClick={setSelectedFood}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="app__footer">
        <p>
          Data sourced from Monash University FODMAP App. Always consult with
          your healthcare provider.
        </p>
      </footer>

      {selectedFood && (
        <FoodDetail
          food={selectedFood}
          onClose={() => setSelectedFood(null)}
        />
      )}

      <ChatWindow onFoodClick={setSelectedFood} />
    </div>
  );
}

export default App;
