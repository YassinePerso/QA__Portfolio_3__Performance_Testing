import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3333';

export const options = {
  scenarios: {
    stage_150: {
      executor: 'constant-vus',
      vus: 150,
      duration: '1m',
      startTime: '0s',
      tags: { stage: '150vus' },
    },
    stage_250: {
      executor: 'constant-vus',
      vus: 250,
      duration: '1m',
      startTime: '1m',
      tags: { stage: '250vus' },
    },
    stage_400: {
      executor: 'constant-vus',
      vus: 400,
      duration: '1m',
      startTime: '2m',
      tags: { stage: '400vus' },
    },
    stage_600: {
      executor: 'constant-vus',
      vus: 600,
      duration: '1m',
      startTime: '3m',
      tags: { stage: '600vus' },
    },
    stage_800: {
      executor: 'constant-vus',
      vus: 800,
      duration: '1m',
      startTime: '4m',
      tags: { stage: '800vus' },
    },
  },
};

export default function () {
  let restrictions = {
    maxCaloriesPerSlice: 500,
    mustBeVegetarian: false,
    excludedIngredients: ["pepperoni"],
    excludedTools: ["knife"],
    maxNumberOfToppings: 6,
    minNumberOfToppings: 2
  };

  let res = http.post(`${BASE_URL}/api/pizza`, JSON.stringify(restrictions), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'token abcdef0123456789',
    },
  });

  check(res, { "status is 200": (res) => res.status === 200 });
  sleep(1);
}
