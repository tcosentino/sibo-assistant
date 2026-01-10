import type { Food } from '../types/food';
import './FoodCard.css';

interface FoodCardProps {
  food: Food;
  onClick: (food: Food) => void;
}

export function FoodCard({ food, onClick }: FoodCardProps) {
  const safeServing = food.servingSizes.low;

  return (
    <div
      className={`food-card food-card--${food.fodmapRating}`}
      onClick={() => onClick(food)}
    >
      <div className="food-card__header">
        <h3 className="food-card__name">{food.name}</h3>
        <span className={`food-card__badge food-card__badge--${food.fodmapRating}`}>
          {food.fodmapRating === 'low' && '✓ Safe'}
          {food.fodmapRating === 'moderate' && '⚠ Caution'}
          {food.fodmapRating === 'high' && '✗ Avoid'}
        </span>
      </div>

      {safeServing && food.fodmapRating !== 'high' && (
        <div className="food-card__serving">
          <span className="food-card__serving-label">Safe portion:</span>
          <span className="food-card__serving-value">
            {safeServing.grams}g {safeServing.cups && `(${safeServing.cups})`}
          </span>
        </div>
      )}

      {food.fodmapRating === 'high' && (
        <div className="food-card__warning">
          Avoid during elimination phase
        </div>
      )}

      {food.fodmapTypes.length > 0 && (
        <div className="food-card__fodmaps">
          {food.fodmapTypes.map((type) => (
            <span key={type} className="food-card__fodmap-tag">
              {type.replace('polyols-', '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
