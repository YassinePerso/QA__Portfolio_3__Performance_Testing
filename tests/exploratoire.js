import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3333';

// J'utilise "stages" pour simuler une montée en charge progressive, de manière réaliste.
export const options = {
  stages: [
    { duration: '1m', target: 5 },
    { duration: '1m', target: 10 },
    { duration: '1m', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },
  ],
};

// Ici on peut définir des restrictions pour la pizza que l'utilisateur souhaiterait commander.
export default function () {
  let restrictions = {
    maxCaloriesPerSlice: 500,
    mustBeVegetarian: false,
    excludedIngredients: ["pepperoni"],
    excludedTools: ["knife"],
    maxNumberOfToppings: 6,
    minNumberOfToppings: 2
  };

  // "res" va storer la réponse de l'API après avoir envoyé les restrictions pour la pizza.
  let res = http.post(`${BASE_URL}/api/pizza`, JSON.stringify(restrictions), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'token abcdef0123456789',
    },
  });

  // check permet de vérifier que la réponse de l'API est bien un succès (status 200).
  check(res, { "status is 200": (res) => res.status === 200 });
  sleep(1);
}
