/**
 * 🟢 GREEN (packet 11b) — the HAND-AUTHORED meal library (§4.2, FR-LIB-06). Meals are authored,
 * not sourced from a dataset, so there is no FR-LIB-10 licence question and no runtime read.
 *
 * The library is two layers:
 *
 *   1. A calorie BACKBONE (FR-LIB-07). Each backbone meal carries ALL FIVE dietary flags, so — a
 *      dietary query being a SUBSET check — one backbone meal satisfies EVERY one of the 32 dietary
 *      combinations at once. The backbone calories are spaced at a ~1.15 ratio across 450–1,400 kcal
 *      so that every FR-REC-08 slot target (a 0.30/0.35/0.35 split of a 1,500–4,000 kcal day) has a
 *      backbone meal within the closed ±10% band. Every calorie appears as a BREAKFAST, a LUNCH, and
 *      a DINNER dish, so a day plan assembles for any combination WITHOUT relaxing the meal type.
 *
 *   2. VARIETY meals — realistic, less-restricted dishes for a richer demo. They are only ever
 *      selected ADDITIONALLY (a query returns the closest in-band meal; a within-band backbone meal
 *      always exists, so the closest is always in band), so variety can never break a combination.
 *
 * Every all-five-flag dish is deliberately built from naturally compliant ingredients — rice,
 * quinoa, buckwheat, gluten-free oats, legumes, tofu/tempeh, seeds — never wheat, dairy, or tree
 * nuts/peanuts, so the flags are honest, not decorative (FR-REC-05 is a hard constraint).
 */
import type { DietaryFlag, Meal, MealType } from '@capstone/shared';

const ALL_FIVE: readonly DietaryFlag[] = [
  'VEGETARIAN',
  'VEGAN',
  'GLUTEN_FREE',
  'DAIRY_FREE',
  'NUT_FREE',
];

/** One backbone calorie value with an authored dish name per meal slot — all five flags each. */
interface BackboneRow {
  readonly calories: number;
  readonly breakfast: string;
  readonly lunch: string;
  readonly dinner: string;
}

const BACKBONE: readonly BackboneRow[] = [
  { calories: 450, breakfast: 'Berry & chia overnight oats', lunch: 'Quinoa tabbouleh salad', dinner: 'Miso vegetable & rice soup' },
  { calories: 520, breakfast: 'Banana buckwheat porridge', lunch: 'Brown rice & edamame bowl', dinner: 'Roasted vegetable & lentil salad' },
  { calories: 600, breakfast: 'Coconut yogurt & oat granola bowl', lunch: 'Chickpea & avocado rice bowl', dinner: 'Sweet potato & black bean chili' },
  { calories: 690, breakfast: 'Tofu scramble with potato hash', lunch: 'Falafel & tabbouleh plate', dinner: 'Vegetable curry with brown rice' },
  { calories: 795, breakfast: 'Seed granola & fruit bowl', lunch: 'Grilled tofu & quinoa bowl', dinner: 'Mushroom & wild rice pilaf' },
  { calories: 915, breakfast: 'Sweet potato & tofu breakfast bowl', lunch: 'Rice noodle & vegetable stir-fry', dinner: 'Lentil dhal with basmati rice' },
  { calories: 1055, breakfast: 'Hearty oat & seed porridge', lunch: 'Burrito bowl with rice & beans', dinner: 'Tempeh & vegetable rice bowl' },
  { calories: 1215, breakfast: 'Loaded tofu & potato skillet', lunch: 'Double bean & quinoa power bowl', dinner: 'Jackfruit curry with rice' },
  { calories: 1400, breakfast: 'Hearty vegan breakfast platter', lunch: 'Grain & roasted vegetable feast bowl', dinner: 'Vegetable & chickpea biryani' },
];

function backboneMeals(): Meal[] {
  const out: Meal[] = [];
  for (const row of BACKBONE) {
    const slots: readonly (readonly [MealType, string])[] = [
      ['BREAKFAST', row.breakfast],
      ['LUNCH', row.lunch],
      ['DINNER', row.dinner],
    ];
    for (const [mealType, name] of slots) {
      out.push({
        id: `backbone-${row.calories}-${mealType.toLowerCase()}`,
        name,
        mealType,
        calories: row.calories,
        dietaryFlags: ALL_FIVE,
      });
    }
  }
  return out;
}

/** Realistic, less-restricted dishes — additive richness for the demo (never load-bearing). */
const VARIETY: readonly Meal[] = [
  { id: 'var-greek-yogurt-parfait', name: 'Greek yogurt & berry parfait', mealType: 'BREAKFAST', calories: 360, dietaryFlags: ['VEGETARIAN', 'GLUTEN_FREE', 'NUT_FREE'] },
  { id: 'var-eggs-and-toast', name: 'Scrambled eggs on toast', mealType: 'BREAKFAST', calories: 470, dietaryFlags: ['VEGETARIAN'] },
  { id: 'var-cheese-omelette', name: 'Cheese & mushroom omelette', mealType: 'BREAKFAST', calories: 520, dietaryFlags: ['VEGETARIAN', 'GLUTEN_FREE', 'NUT_FREE'] },
  { id: 'var-almond-smoothie', name: 'Almond butter & banana smoothie', mealType: 'BREAKFAST', calories: 410, dietaryFlags: ['VEGETARIAN', 'VEGAN', 'GLUTEN_FREE', 'DAIRY_FREE'] },
  { id: 'var-chicken-caesar', name: 'Grilled chicken Caesar salad', mealType: 'LUNCH', calories: 620, dietaryFlags: [] },
  { id: 'var-turkey-sandwich', name: 'Turkey & salad sandwich', mealType: 'LUNCH', calories: 540, dietaryFlags: ['NUT_FREE'] },
  { id: 'var-tuna-poke', name: 'Tuna poke bowl', mealType: 'LUNCH', calories: 640, dietaryFlags: ['GLUTEN_FREE', 'DAIRY_FREE', 'NUT_FREE'] },
  { id: 'var-caprese-bowl', name: 'Caprese & farro bowl', mealType: 'LUNCH', calories: 700, dietaryFlags: ['VEGETARIAN', 'NUT_FREE'] },
  { id: 'var-salmon-quinoa', name: 'Salmon & quinoa bowl', mealType: 'DINNER', calories: 720, dietaryFlags: ['GLUTEN_FREE', 'DAIRY_FREE', 'NUT_FREE'] },
  { id: 'var-beef-stir-fry', name: 'Beef & vegetable stir-fry with rice', mealType: 'DINNER', calories: 860, dietaryFlags: ['DAIRY_FREE', 'NUT_FREE'] },
  { id: 'var-rice-pizza', name: 'Rice-crust margherita pizza', mealType: 'DINNER', calories: 780, dietaryFlags: ['VEGETARIAN', 'GLUTEN_FREE', 'NUT_FREE'] },
  { id: 'var-chicken-pasta', name: 'Chicken & tomato pasta', mealType: 'DINNER', calories: 820, dietaryFlags: ['NUT_FREE'] },
  { id: 'var-hummus-veg-snack', name: 'Hummus & vegetable sticks', mealType: 'SNACK', calories: 200, dietaryFlags: ['VEGETARIAN', 'VEGAN', 'GLUTEN_FREE', 'DAIRY_FREE', 'NUT_FREE'] },
  { id: 'var-rice-cakes-seed-butter', name: 'Rice cakes with sunflower-seed butter', mealType: 'SNACK', calories: 190, dietaryFlags: ['VEGETARIAN', 'VEGAN', 'GLUTEN_FREE', 'DAIRY_FREE', 'NUT_FREE'] },
  { id: 'var-apple-mixed-nuts', name: 'Apple & mixed nuts', mealType: 'SNACK', calories: 250, dietaryFlags: ['VEGETARIAN', 'VEGAN', 'GLUTEN_FREE', 'DAIRY_FREE'] },
  { id: 'var-whey-protein-shake', name: 'Whey protein shake', mealType: 'SNACK', calories: 220, dietaryFlags: ['VEGETARIAN', 'GLUTEN_FREE', 'NUT_FREE'] },
];

/** The full hand-authored meal library — backbone (FR-LIB-07 coverage) plus variety. */
export const MEAL_LIBRARY: readonly Meal[] = (() => {
  const meals = [...backboneMeals(), ...VARIETY];
  // Defensive: ids must be unique (a duplicate would silently shrink the library).
  const ids = new Set(meals.map((m) => m.id));
  if (ids.size !== meals.length) {
    throw new Error('meal library has duplicate ids');
  }
  return meals;
})();
