import { useState, useMemo } from 'react';
import { allFoods } from './data/foods';
import type { Food, FoodCategory } from './types/food';
import { SearchBar } from './components/SearchBar';
import { FilterTabs, type FilterOption } from './components/FilterTabs';
import { FoodCard } from './components/FoodCard';
import { FoodDetail } from './components/FoodDetail';
import { ChatWindow } from './components/ChatWindow';
import { UserMenu } from './components/UserMenu';
import './App.css';

type CategoryFilter = 'all' | FoodCategory;

const CATEGORY_CONFIG: { value: CategoryFilter; label: string; emoji: string }[] = [
  { value: 'all', label: 'All', emoji: '🍽️' },
  { value: 'vegetable', label: 'Veggies', emoji: '🥬' },
  { value: 'fruit', label: 'Fruits', emoji: '🍓' },
  { value: 'protein', label: 'Protein', emoji: '🍗' },
  { value: 'grain', label: 'Grains', emoji: '🍚' },
  { value: 'dairy', label: 'Dairy', emoji: '🧀' },
  { value: 'condiment', label: 'Spices', emoji: '🌿' },
  { value: 'fat', label: 'Oils', emoji: '🫒' },
  { value: 'beverage', label: 'Drinks', emoji: '☕' },
];

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [fodmapFilter, setFodmapFilter] = useState<FilterOption>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);

  const filteredFoods = useMemo(() => {
    let foods = allFoods;

    // Apply category filter
    if (categoryFilter !== 'all') {
      foods = foods.filter((food) => food.category === categoryFilter);
    }

    // Apply FODMAP filter
    if (fodmapFilter !== 'all') {
      foods = foods.filter((food) => food.fodmapRating === fodmapFilter);
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

    // Sort: low first, then moderate, then high, then by name
    const order = { low: 0, moderate: 1, high: 2 };
    return foods.sort((a, b) => {
      if (order[a.fodmapRating] !== order[b.fodmapRating]) {
        return order[a.fodmapRating] - order[b.fodmapRating];
      }
      return a.name.localeCompare(b.name);
    });
  }, [searchQuery, fodmapFilter, categoryFilter]);

  const counts = useMemo(() => {
    let base = allFoods;

    // Apply category filter for counts
    if (categoryFilter !== 'all') {
      base = base.filter((food) => food.category === categoryFilter);
    }

    // Apply search filter for counts
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      base = base.filter(
        (food) =>
          food.name.toLowerCase().includes(query) ||
          food.aliases?.some((alias) => alias.toLowerCase().includes(query))
      );
    }

    return {
      all: base.length,
      low: base.filter((f) => f.fodmapRating === 'low').length,
      moderate: base.filter((f) => f.fodmapRating === 'moderate').length,
      high: base.filter((f) => f.fodmapRating === 'high').length,
    };
  }, [searchQuery, categoryFilter]);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-content">
          <h1 className="app__title"><span className="app__mascot">🐵</span> Bebo the SIBO Assistant</h1>
          <p className="app__subtitle">
            Find what's safe to eat during your SIBO journey
          </p>
        </div>
        <UserMenu />
      </header>

      <div className="app__controls">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search foods, ingredients..."
        />

        {/* Category Filter */}
        <div className="app__categories">
          {CATEGORY_CONFIG.map((cat) => (
            <button
              key={cat.value}
              className={`app__category-btn ${categoryFilter === cat.value ? 'app__category-btn--active' : ''}`}
              onClick={() => setCategoryFilter(cat.value)}
            >
              <span className="app__category-emoji">{cat.emoji}</span>
              <span className="app__category-label">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* FODMAP Safety Filter */}
        <FilterTabs selected={fodmapFilter} onChange={setFodmapFilter} counts={counts} />
      </div>

      <main className="app__content">
        <div className="app__results-count">
          {filteredFoods.length} {filteredFoods.length === 1 ? 'result' : 'results'}
        </div>

        {filteredFoods.length === 0 ? (
          <div className="app__empty">
            <p>No foods found matching your filters.</p>
            <button onClick={() => {
              setSearchQuery('');
              setFodmapFilter('all');
              setCategoryFilter('all');
            }}>
              Clear all filters
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
          Data sourced from Monash University FODMAP App.<br />
          Always consult with your healthcare provider.
        </p>
      </footer>

      {selectedFood && (
        <FoodDetail
          food={selectedFood}
          onClose={() => setSelectedFood(null)}
          allFoods={allFoods}
          onFoodClick={setSelectedFood}
        />
      )}

      <ChatWindow onFoodClick={setSelectedFood} />
    </div>
  );
}

export default App;
