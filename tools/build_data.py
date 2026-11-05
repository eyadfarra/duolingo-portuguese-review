"""Convert duolingo_portuguese_words.xlsx into data.js (lessons + word rows)."""
import json, sys
import openpyxl

src = sys.argv[1] if len(sys.argv) > 1 else "duolingo_portuguese_words.xlsx"
wb = openpyxl.load_workbook(src, data_only=False)

lessons = {}
rows = []
for r in wb["الكلمات"].iter_rows(min_row=2, values_only=True):
    _, n, name, desc, pt, ar = r[:6]
    if not pt:
        continue
    n = int(n)
    lessons.setdefault(n, [name, desc])
    items = []
    for t in (ar or "").split(","):
        t = t.strip()
        if t and t not in items:
            items.append(t)
    rows.append([n, pt.strip(), ", ".join(items[:10])])

L = [[n, *lessons[n]] for n in sorted(lessons)]
with open("data.js", "w", encoding="utf-8") as f:
    f.write("window.LESSONS=" + json.dumps(L, ensure_ascii=False, separators=(",", ":")) + ";\n")
    f.write("window.ROWS=" + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(len(L), "lessons,", len(rows), "rows")
