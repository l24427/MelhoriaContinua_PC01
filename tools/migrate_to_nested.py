"""
Migra machinesData.json do formato plano (flat) para o aninhado.

Formato de ENTRADA (legado):
    { "AC20": [ { "categoria": "EHS", "href": "...", "texto": "..." }, ... ], ... }
    (o campo "categoria" do legado e, na verdade, a AREA)

Formato de SAIDA (novo):
    {
      "areas": ["EHS", "QUALIDADE", "PRODUTIVIDADE", "PESSOAS", "CUSTOS"],
      "categorias": {
        "<Linha de produto>": {
          "<Maquina>": {
            "<Area>": [ { "texto": "...", "href": "..." }, ... ]
          }
        }
      }
    }

O mapa categoria(linha de produto) -> [maquinas] vem de tools/categoria_map.json.
Maquinas que nao estiverem em nenhuma categoria caem em "Sem categoria".

Uso:
    python tools/migrate_to_nested.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "machinesData.json")
BACKUP = os.path.join(ROOT, "machinesData.flat.bak.json")
MAP = os.path.join(ROOT, "tools", "categoria_map.json")

# Ordem canonica de exibicao das colunas (areas). Areas fora desta lista
# sao anexadas ao final na ordem de aparicao.
AREA_ORDER = ["EHS", "QUALIDADE", "PRODUTIVIDADE", "PESSOAS", "CUSTOS"]


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def is_already_nested(data):
    return isinstance(data, dict) and "categorias" in data and "areas" in data


def build_machine_to_categoria(cat_map, machines):
    """Inverte o mapa categoria->[maquinas] para maquina->categoria."""
    m2c = {}
    for categoria, maqs in cat_map.items():
        for maq in maqs:
            if maq in m2c:
                print(f"AVISO: maquina {maq} aparece em mais de uma categoria "
                      f"({m2c[maq]} e {categoria}). Mantendo {m2c[maq]}.")
                continue
            m2c[maq] = categoria
    sem_cat = [m for m in machines if m not in m2c]
    for m in sem_cat:
        m2c[m] = "Sem categoria"
    if sem_cat:
        print(f"AVISO: {len(sem_cat)} maquina(s) sem categoria -> 'Sem categoria': "
              f"{sorted(sem_cat)}")
    return m2c


def derive_area_order(flat):
    seen = []
    for maq in flat:
        for b in flat[maq]:
            a = b["categoria"]
            if a not in seen:
                seen.append(a)
    # respeita AREA_ORDER primeiro, depois o resto
    ordered = [a for a in AREA_ORDER if a in seen]
    ordered += [a for a in seen if a not in ordered]
    return ordered


def migrate(flat, cat_map):
    machines = sorted(flat.keys())
    m2c = build_machine_to_categoria(cat_map, machines)
    areas = derive_area_order(flat)

    categorias = {}
    total_in = 0
    for maq in machines:
        categoria = m2c[maq]
        categorias.setdefault(categoria, {})
        # cada maquina tem TODAS as areas (padronizadas), mesmo que vazias
        maq_node = {a: [] for a in areas}
        for b in flat[maq]:
            total_in += 1
            area = b["categoria"]
            maq_node.setdefault(area, [])
            maq_node[area].append({"texto": b["texto"], "href": b["href"]})
        categorias[categoria][maq] = maq_node

    out = {"areas": areas, "categorias": categorias}

    # validacao: contagem de botoes deve bater
    total_out = sum(
        len(btns)
        for cat in out["categorias"].values()
        for maq in cat.values()
        for btns in maq.values()
    )
    if total_in != total_out:
        raise SystemExit(f"ERRO: contagem divergente! entrada={total_in} saida={total_out}")

    return out, total_in


def main():
    current = load_json(SRC)
    if is_already_nested(current):
        # Re-execucao: usa o backup plano como fonte de verdade para
        # reaplicar o mapa de categorias (ex.: o mapa mudou).
        if os.path.exists(BACKUP):
            print(f"machinesData.json ja aninhado; reaplicando a partir de {os.path.basename(BACKUP)}.")
            flat = load_json(BACKUP)
        else:
            print("machinesData.json ja aninhado e sem backup plano. Nada a fazer.")
            return
    else:
        flat = current

    if os.path.exists(MAP):
        cat_map = load_json(MAP)
    else:
        cat_map = {}
        print(f"AVISO: {MAP} nao encontrado; todas as maquinas irao para 'Sem categoria'.")

    out, total = migrate(flat, cat_map)

    # backup do flat original (so na primeira vez)
    if not os.path.exists(BACKUP):
        with open(BACKUP, "w", encoding="utf-8") as f:
            json.dump(flat, f, ensure_ascii=False, indent=2)
        print(f"Backup salvo em {BACKUP}")

    with open(SRC, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"OK: migracao concluida. {total} botoes, "
          f"{len(out['categorias'])} categoria(s), {len(out['areas'])} area(s).")
    print("Categorias:", list(out["categorias"].keys()))


if __name__ == "__main__":
    main()
