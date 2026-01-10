import { useState } from 'react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'recipes' | 'daily' | 'targets'>('recipes');

  return (
    <div className="app">
      <header className="app-header">
        <h1>MacroMeal</h1>
        <p className="tagline">Structure without surveillance</p>
      </header>

      <nav className="app-nav">
        <button
          className={activeTab === 'recipes' ? 'active' : ''}
          onClick={() => setActiveTab('recipes')}
        >
          Recipes
        </button>
        <button
          className={activeTab === 'daily' ? 'active' : ''}
          onClick={() => setActiveTab('daily')}
        >
          Daily Balance
        </button>
        <button
          className={activeTab === 'targets' ? 'active' : ''}
          onClick={() => setActiveTab('targets')}
        >
          Targets
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'recipes' && (
          <section className="recipes-section">
            <h2>Your Recipes</h2>
            <p className="empty-state">
              No recipes yet. Add your first recipe or paste a social media link!
            </p>
            {/* TODO: Add recipe list, search, and add button */}
          </section>
        )}

        {activeTab === 'daily' && (
          <section className="daily-section">
            <h2>Daily Balance</h2>
            <p className="empty-state">
              Track what you've eaten today and find recipes to hit your targets.
            </p>
            {/* TODO: Add daily log and macro progress */}
          </section>
        )}

        {activeTab === 'targets' && (
          <section className="targets-section">
            <h2>Macro Targets</h2>
            <p className="empty-state">
              Set your daily macro targets. All recipes will auto-calculate portions.
            </p>
            {/* TODO: Add macro target form */}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
