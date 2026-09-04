# Test de performance sur QuickPizza (k6)

Portfolio #3 pour progresser sur les tests de charge/perf avec k6, sur l'app de démo [QuickPizza](https://github.com/grafana/quickpizza) (l'app officielle de Grafana pour s'entraîner au perf testing).

Les scripts et l'analyse sont dans `tests/` et `analysis/` → le reste du repo, c'est le code de QuickPizza lui-même (pas mon code propre).

## Objectif

Au départ, une question simple : est-ce que tous les endpoints d'une API se comportent pareil sous charge ? J'avais l'intuition que `/api/users/token/login` (qui fait du hashing de mot de passe) allait craquer avant `/api/pizza` (une simple lecture/génération). Le but du projet, c'était de vérifier ça avec des vrais chiffres plutôt que de le supposer.

## Stack

- **k6** pour les tests de charge
- **Docker / Docker Compose** pour faire tourner QuickPizza + Postgres
- **Grafana / Prometheus** pour l'observabilité (avec des limites, voir plus bas)
- **Python** pour analyser les résultats bruts par palier de charge

## Méthodologie

Je suis parti sans seuils prédéfinis arbitraires → l'idée était de d'abord observer, puis de fixer des critères basés sur des données réelles.

**1. Smoke test** → vérifier que l'app répond correctement à faible charge (5 VUs).

**2. Test exploratoire** → montée progressive de 5 à 100 VUs, pour avoir une première idée du comportement de l'app. Résultat : aucune dégradation notable sur cette plage, donc il fallait pousser plus loin.

**3. Load test** → une fois qu'on a vu que l'app tenait large sur la plage explorée, j'ai fixé des seuils clairs à l'avance (`p95 < 500ms`, `error rate < 1%`) et testé à 200 VUs (charge jugée "normale" au vu des observations précédentes). Résultat : **PASSED** sur les deux seuils.

**4. Stress test avec tags par palier** → montée par paliers nets (150 → 250 → 400 → 600 → 800 VUs), chaque palier taggé individuellement dans k6, pour pouvoir analyser l'évolution des métriques palier par palier (pas juste un résumé global qui cache la progression).

**5. Comparaison ciblée** → même méthode appliquée à `/api/users/token/login`, pour comparer directement aux résultats de `/api/pizza`.

## Résultats

### `/api/pizza`

| Stage | Requêtes | Avg (ms) | p95 (ms) | p99 (ms) | Taux d'erreur |
|-------|----------|----------|----------|----------|---------------|
| 150 VUs | 7 888 | 152.3 | 368.3 | 508.6 | 0.00% |
| 250 VUs | 12 479 | 213.1 | 547.4 | 991.3 | 0.00% |
| 400 VUs | 15 774 | 536.0 | 1069.2 | 1345.6 | 0.00% |
| 600 VUs | 15 852 | 1317.1 | 1968.3 | 2314.2 | 0.09% |
| 800 VUs | 15 335 | 2190.7 | 3225.7 | 3666.9 | 2.65% |

### `/api/users/token/login`

| Stage | Requêtes | Avg (ms) | p95 (ms) | p99 (ms) | Taux d'erreur |
|-------|----------|----------|----------|----------|---------------|
| 150 VUs | 8 433 | 75.7 | 106.2 | 383.5 | 0.00% |
| 250 VUs | 11 935 | 269.3 | 494.6 | 1147.1 | 0.00% |
| 400 VUs | 12 155 | 1010.1 | 1477.1 | 1953.5 | 0.00% |
| 600 VUs | 12 347 | 2042.5 | 3109.4 | 4127.9 | 0.00% |
| 800 VUs | 12 413 | 3014.2 | 5236.5 | 6750.4 | 0.00% |

## Ce que ça donne

Mon hypothèse de départ était à moitié vraie, et c'est ça le plus intéressant.

`/api/pizza` reste plus rapide en dessous de 400 VUs, mais commence à générer de vraies erreurs (401/500) à partir de 600 VUs, avec 2.65% d'échecs à 800 VUs.

`/api/users/token/login`, à l'inverse, ne génère **aucune erreur** sur toute la plage testée → mais sa latence explose beaucoup plus vite (p95 à 5.2s contre 3.2s pour pizza, à 800 VUs).

Donc "le point faible" dépend de la métrique qu'on regarde : login est plus fiable mais plus lent sous charge, pizza est plus rapide mais moins fiable au-delà d'un certain seuil. Le point de rupture global de l'app se situe quelque part entre 400 et 600 VUs, c'est là que les deux comportements commencent à se dégrader nettement.

## Limites (à prendre en compte)

- Pour le test sur `/login`, j'ai utilisé un seul utilisateur de test pour toute la charge. En usage réel, ce serait plusieurs utilisateurs différents → ça peut changer le comportement observé (contention possible sur une seule ligne en base plutôt qu'un vrai coût de calcul répété).
- Les seuils du load test (p95 < 500ms, erreur < 1%) sont basés sur des conventions générales du secteur, pas sur un vrai SLA métier (on n'en a pas ici, vu que c'est une app de démo).
- Je voulais visualiser tout ça dans Grafana en temps réel, mais je n'ai pas réussi à faire fonctionner les dashboards préconfigurés (métriques bien envoyées à Prometheus, mais panels vides). J'ai contourné en exportant les résultats bruts en JSON et en les analysant avec un petit script Python (`analysis/analyze_stages.py`).
- Le test tourne en local sur ma machine → les chiffres absolus ne sont pas transférables à un environnement de prod, seule la tendance relative (où ça commence à dégrader) est intéressante ici.

## Reproduire le test

```bash
# Cloner QuickPizza et lancer le stack
git clone https://github.com/grafana/quickpizza.git
cd quickpizza
docker compose -f compose.grafana-local-stack.monolithic.yaml up -d

# Copier les scripts de ce repo dans tests/
k6 run tests/exploratoire.js
k6 run tests/load-test.js
k6 run --out json=full-results.json tests/stress-test-tagged.js

# Analyser les résultats du stress test par palier
python3 analysis/analyze_stages.py full-results.json
```
