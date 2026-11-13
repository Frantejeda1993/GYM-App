## graphify (obligatorio)

Este proyecto tiene un grafo de conocimiento en `graphify-out/` (god nodes, comunidades y relaciones entre archivos).

### Si graphify no está instalado
Comprobar con `graphify --version`. Si no existe:
1. Instalar `uv` si falta: `winget install --id=astral-sh.uv -e` (Windows) o `curl -LsSf https://astral.sh/uv/install.sh | sh` (macOS/Linux).
2. Instalar graphify (el paquete se llama `graphifyy`, con doble y): `uv tool install graphifyy` (alternativas: `pipx install graphifyy` o `pip install graphifyy`).
3. Instalar la skill para Claude Code: `graphify install --platform claude`.
4. Verificar con `graphify --version` y regenerar el grafo con `graphify update .`.

No ejecutar `graphify claude install` en este proyecto: reescribiría esta sección. Los hooks ya están en `.claude/settings.json`.

### Antes de trabajar: consultar SIEMPRE el grafo
- Al empezar cualquier tarea sobre el código (pregunta, bug, feature, refactor), ejecutar primero `graphify query "<pregunta>"` antes de cualquier grep, búsqueda o lectura de archivos fuente.
- Usar `graphify path "<A>" "<B>"` para relaciones entre conceptos y `graphify explain "<concepto>"` para un concepto puntual.
- Leer archivos fuente solo en las líneas que el grafo (o una lectura previa) ya ubicó.
- Si existe `graphify-out/wiki/index.md`, usarlo para navegar en general.
- Leer `graphify-out/GRAPH_REPORT.md` solo para revisiones de arquitectura amplias o si query/path/explain no alcanzan.
- Incluir esta regla en el prompt de cada subagente que explore código.

### Al terminar: actualizar SIEMPRE el grafo
- Después de finalizar cualquier modificación de código, ejecutar `graphify update .` (solo AST, sin costo de API).
- Hacerlo antes de cada commit, e incluir `graphify-out/` actualizado en ese mismo commit.

### Notas
- `graphify-out/graph.json` se reescribe entero en cada build: un diff grande en un PR es esperado. No marcarlo como ruido ni sugerir saltear la reconstrucción o sus hooks.
- Las carpetas con fecha y `graphify-out/cache/` son locales y están en `.gitignore`.
