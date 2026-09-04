import json
import sys
from collections import defaultdict

def percentile(values, p):
    values = sorted(values)
    k = (len(values) - 1) * (p / 100)
    f = int(k)
    c = min(f + 1, len(values) - 1)
    if f == c:
        return values[f]
    return values[f] + (values[c] - values[f]) * (k - f)

def analyze(filepath):
    durations_by_stage = defaultdict(list)
    failed_by_stage = defaultdict(lambda: {"pass": 0, "fail": 0})

    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            if obj.get("type") != "Point":
                continue

            metric = obj.get("metric")
            data = obj.get("data", {})
            tags = data.get("tags", {})
            stage = tags.get("stage")
            if not stage:
                continue

            if metric == "http_req_duration":
                durations_by_stage[stage].append(data["value"])

            if metric == "http_req_failed":
                if data["value"] == 1:
                    failed_by_stage[stage]["fail"] += 1
                else:
                    failed_by_stage[stage]["pass"] += 1

    # Ordre logique des stages (ajuste si besoin)
    stage_order = ["150vus", "250vus", "400vus", "600vus", "800vus"]

    print(f"{'Stage':<10} {'Requests':<10} {'Avg(ms)':<10} {'p95(ms)':<10} {'p99(ms)':<10} {'Error rate':<12}")
    print("-" * 65)

    for stage in stage_order:
        durations = durations_by_stage.get(stage, [])
        if not durations:
            print(f"{stage:<10} no data")
            continue

        avg = sum(durations) / len(durations)
        p95 = percentile(durations, 95)
        p99 = percentile(durations, 99)

        fails = failed_by_stage[stage]["fail"]
        passes = failed_by_stage[stage]["pass"]
        total = fails + passes
        error_rate = (fails / total * 100) if total > 0 else 0

        print(f"{stage:<10} {len(durations):<10} {avg:<10.1f} {p95:<10.1f} {p99:<10.1f} {error_rate:<12.2f}%")

if __name__ == "__main__":
    filepath = sys.argv[1] if len(sys.argv) > 1 else "full-results.json"
    analyze(filepath)
