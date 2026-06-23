import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(ROOT, "machinesData.json"), encoding="utf-8"))

machines = sorted(d.keys())
print("MAQUINAS:", machines)

total = 0
areas = {}
for m in d:
    for b in d[m]:
        total += 1
        areas[b["categoria"]] = areas.get(b["categoria"], 0) + 1

print("TOTAL BOTOES:", total)
print("AREAS (contagem):")
for a, c in sorted(areas.items(), key=lambda x: -x[1]):
    print("  ", repr(a), c)
print("BOTOES POR MAQUINA:")
for m in machines:
    print("  ", m, len(d[m]))
