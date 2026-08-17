import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

// Food/nutrition estimation runs on Gemini (cloud). This is NOT finance data, so cloud is fine.
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
const model = () => google(process.env.GEMINI_MODEL || 'gemini-flash-latest');

const FoodSchema = z.object({
  items: z.array(z.object({
    name:     z.string().describe('short food name, e.g. "Roti", "Chicken curry"'),
    qty:      z.string().describe('quantity as understood, e.g. "2 pcs", "1 bowl", "200 g"'),
    calories: z.number().describe('kcal for this quantity'),
    protein:  z.number().describe('grams of protein'),
    carbs:    z.number().describe('grams of carbohydrate'),
    fat:      z.number().describe('grams of fat'),
  })),
});

// Parse a free-text meal ("2 rotis, dal, black coffee") into itemised macros.
export async function parseFood(text) {
  const { object } = await generateObject({
    model: model(),
    schema: FoodSchema,
    prompt:
      `You are a nutrition estimator. The user logs meals in casual text, often Indian food. ` +
      `Break the meal into individual items. For the stated (or reasonably assumed) quantity of each, ` +
      `estimate calories (kcal), protein (g), carbs (g) and fat (g). Use typical real-world values; ` +
      `if a quantity is vague, assume one normal serving. Do not add items that were not mentioned.\n\n` +
      `Meal: """${text}"""`,
  });
  // round to keep the UI + totals clean
  return object.items.map(i => ({
    name: i.name, qty: i.qty,
    calories: Math.round(i.calories),
    protein: Math.round(i.protein),
    carbs: Math.round(i.carbs),
    fat: Math.round(i.fat),
  }));
}

const BurnSchema = z.object({
  calories: z.number().describe('estimated total kcal burned in this exercise session'),
});

// Estimate calories burned for a logged resistance/workout session.
export async function estimateBurn({ exercise, sets, day }) {
  const setDesc = Array.isArray(sets) && sets.length
    ? sets.map(s => `${s.reps ?? '?'} reps${s.weight ? ` @ ${s.weight}${s.unit || 'kg'}` : ''}`).join(', ')
    : 'no sets recorded';
  const { object } = await generateObject({
    model: model(),
    schema: BurnSchema,
    prompt:
      `Estimate the calories burned by an average adult (~70 kg) performing this exercise as part of a ${day || 'workout'} session. ` +
      `Account for the work done and typical rest between sets. Give one realistic total kcal number, not a range.\n\n` +
      `Exercise: ${exercise}\nSets: ${setDesc}`,
  });
  return Math.max(0, Math.round(object.calories));
}
