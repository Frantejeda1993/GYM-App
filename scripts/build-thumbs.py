"""Genera las miniaturas WebP del catálogo en public/ex/<id>-<frame>.webp.

Uso: python3 scripts/build-thumbs.py <ruta a free-exercise-db/exercises>
Fuente de las imágenes: https://github.com/yuhonas/free-exercise-db (dominio público).
Ejecutar después de build-catalog.mjs y antes de volver a ejecutarlo (marca qué ejercicios tienen imagen).
"""
import json
import os
import sys

from PIL import Image

src_dir = sys.argv[1]
ids = [x["id"] for x in json.load(open("src/data/exercises.json"))]
os.makedirs("public/ex", exist_ok=True)
for ex_id in ids:
    for frame in ("0", "1"):
        src = os.path.join(src_dir, ex_id, frame + ".jpg")
        if not os.path.exists(src):
            continue
        im = Image.open(src).convert("RGB")
        im.thumbnail((360, 240))
        im.save(f"public/ex/{ex_id}-{frame}.webp", "WEBP", quality=55, method=6)
print("Miniaturas en public/ex:", len(os.listdir("public/ex")))
