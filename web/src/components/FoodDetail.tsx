import type { Food } from '../types/food';
import './FoodDetail.css';

interface FoodDetailProps {
  food: Food;
  onClose: () => void;
}

export function FoodDetail({ food, onClose }: FoodDetailProps) {
  return (
    <div className="food-detail-overlay" onClick={onClose}>
      <div className="food-detail" onClick={(e) => e.stopPropagation()}>
        <button className="food-detail__close" onClick={onClose}>
          ×
        </button>

        <div className={`food-detail__header food-detail__header--${food.fodmapRating}`}>
          <h2 className="food-detail__name">{food.name}</h2>
          <span className={`food-detail__badge food-detail__badge--${food.fodmapRating}`}>
            {food.fodmapRating === 'low' && '✓ Low FODMAP'}
            {food.fodmapRating === 'moderate' && '⚠ Moderate FODMAP'}
            {food.fodmapRating === 'high' && '✗ High FODMAP'}
          </span>
        </div>

        {food.aliases && food.aliases.length > 0 && (
          <p className="food-detail__aliases">
            Also known as: {food.aliases.join(', ')}
          </p>
        )}

        <section className="food-detail__section">
          <h3>Serving Sizes</h3>
          <div className="food-detail__servings">
            {food.servingSizes.low && (
              <div className="food-detail__serving food-detail__serving--low">
                <div className="food-detail__serving-header">
                  <span className="food-detail__serving-icon">✓</span>
                  <span>Safe Serving</span>
                </div>
                <div className="food-detail__serving-amount">
                  {food.servingSizes.low.grams}g
                  {food.servingSizes.low.cups && ` (${food.servingSizes.low.cups})`}
                </div>
                <p className="food-detail__serving-desc">
                  {food.servingSizes.low.description}
                </p>
              </div>
            )}

            {food.servingSizes.moderate && (
              <div className="food-detail__serving food-detail__serving--moderate">
                <div className="food-detail__serving-header">
                  <span className="food-detail__serving-icon">⚠</span>
                  <span>Moderate</span>
                </div>
                <div className="food-detail__serving-amount">
                  {food.servingSizes.moderate.grams}g
                  {food.servingSizes.moderate.cups && ` (${food.servingSizes.moderate.cups})`}
                </div>
                <p className="food-detail__serving-desc">
                  {food.servingSizes.moderate.description}
                </p>
              </div>
            )}

            {food.servingSizes.high && (
              <div className="food-detail__serving food-detail__serving--high">
                <div className="food-detail__serving-header">
                  <span className="food-detail__serving-icon">✗</span>
                  <span>Avoid</span>
                </div>
                <div className="food-detail__serving-amount">
                  {food.servingSizes.high.grams}g+
                  {food.servingSizes.high.cups && ` (${food.servingSizes.high.cups})`}
                </div>
                <p className="food-detail__serving-desc">
                  {food.servingSizes.high.description}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="food-detail__section">
          <h3>SIBO Notes</h3>
          <p className="food-detail__notes">{food.siboNotes}</p>
        </section>

        {food.fodmapTypes.length > 0 && (
          <section className="food-detail__section">
            <h3>Contains These FODMAPs</h3>
            <div className="food-detail__fodmap-list">
              {food.fodmapTypes.map((type) => (
                <span key={type} className="food-detail__fodmap-tag">
                  {formatFodmapType(type)}
                </span>
              ))}
            </div>
          </section>
        )}

        {food.preparationTips && food.preparationTips.length > 0 && (
          <section className="food-detail__section">
            <h3>Preparation Tips</h3>
            <ul className="food-detail__tips">
              {food.preparationTips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </section>
        )}

        {food.alternatives && food.alternatives.length > 0 && (
          <section className="food-detail__section">
            <h3>Safer Alternatives</h3>
            <div className="food-detail__alternatives">
              {food.alternatives.map((alt) => (
                <span key={alt} className="food-detail__alternative">
                  {formatAlternative(alt)}
                </span>
              ))}
            </div>
          </section>
        )}

        {food.pairsWellWith && food.pairsWellWith.length > 0 && (
          <section className="food-detail__section">
            <h3>Pairs Well With</h3>
            <div className="food-detail__pairings">
              {food.pairsWellWith.map((item) => (
                <span key={item} className="food-detail__pairing">
                  {item}
                </span>
              ))}
            </div>
          </section>
        )}

        {food.nutritionalHighlights && food.nutritionalHighlights.length > 0 && (
          <section className="food-detail__section">
            <h3>Nutritional Highlights</h3>
            <ul className="food-detail__nutrition">
              {food.nutritionalHighlights.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {food.source && (
          <p className="food-detail__source">
            Source: {food.source}
          </p>
        )}
      </div>
    </div>
  );
}

function formatFodmapType(type: string): string {
  const names: Record<string, string> = {
    fructose: 'Fructose',
    lactose: 'Lactose',
    fructans: 'Fructans',
    galactans: 'Galactans (GOS)',
    'polyols-sorbitol': 'Sorbitol',
    'polyols-mannitol': 'Mannitol',
  };
  return names[type] || type;
}

function formatAlternative(id: string): string {
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
