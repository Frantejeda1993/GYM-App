# CLAUDE.md — GYM App

Contexto para Claude Code. Léelo entero antes de tocar código. Detalle del dominio en
`docs/DOMINIO.md`; estado, deuda y siguientes pasos en `docs/ESTADO.md`.

## Qué es

PWA personal para planificar rutinas de gimnasio y registrar entrenos serie a serie, con
progresión de cargas, dashboard muscular semanal y composición corporal.

- **Producción:** https://frantejeda1993.github.io/GYM-App/ (GitHub Pages)
- **Usuarios:** Francisco (dueño y único mantenedor del código) + 1 persona más, quizá algún amigo.
  Acceso por lista blanca de emails en `firestore.rules`.
- **Idioma:** interfaz, comentarios, mensajes de commit y documentación en **español**.
  Claves de datos del catálogo (músculos, equipamiento, nombres semilla) en **inglés**.

## Restricciones no negociables

1. **Coste cero.** Plan gratuito de Firebase (Spark) + GitHub Pages. Nada de Cloud Functions,
   Storage, servidores ni servicios de pago. Las fotos van como data URL dentro del documento.
2. **Sin tiendas de apps.** Solo PWA instalable (iPhone vía Safari, Android vía Chrome).
3. **Funciona sin conexión.** Firestore con caché persistente; nunca bloquear la UI esperando red.
4. **Cargas solo en kg.** Sin conversión a libras.
5. **Sin alarmas ni notificaciones push.** Solo el aviso en "Hoy" si pasan X días sin registrar peso.
6. **Mediciones corporales manuales**; solo se comparan entre sí las del mismo método y unidad.
7. **Mantenible por una persona** que no es desarrollador a tiempo completo: preferir código
   simple y explícito a abstracciones; no añadir dependencias sin una razón fuerte.

## Stack

React 18 · Vite 5 · vite-plugin-pwa (Workbox, `autoUpdate`) · react-router-dom 6 con
**`HashRouter`** (obligatorio en GitHub Pages) · Firebase 11 (Auth con Google + Firestore).
Sin TypeScript, sin librería de estado, sin librería de gráficos (SVG propio), sin tests (ver `docs/ESTADO.md`).

## Comandos

```bash
npm install
npm run dev        # contra Firebase REAL (datos reales del usuario: cuidado)
npm run dev:mock   # Firebase simulado en localStorage — usar este para desarrollar y probar
npm run build      # debe pasar antes de cualquier commit
npm run preview
node scripts/build-catalog.mjs <free-exercise-db/dist/exercises.json>   # regenerar catálogo
python3 scripts/build-thumbs.py <free-exercise-db/exercises>            # regenerar miniaturas
```

- Simular otra fecha (solo en dev): añadir `?hoy=AAAA-MM-DD` a la URL. Imprescindible para probar
  días perdidos, reorganización de semana, sesiones de otro día y el aviso de peso.
- **Push a `main` = despliegue a producción** (`.github/workflows/deploy.yml`). No hagas push a
  `main` sin que Francisco lo pida explícitamente. Trabaja en rama si el cambio no es trivial.
- `firestore.rules` **no** se despliega con el workflow: se publica a mano en la consola de Firebase
  (o `firebase deploy --only firestore:rules`). Si cambias reglas, dilo claramente al terminar.

## Arquitectura

```
src/
  main.jsx        HashRouter > AuthProvider > DataProvider > App
  firebase.js     config web (pública por diseño) + Firestore con caché persistente multi-pestaña
  auth.jsx        estado: loading | signedOut | denied | needsProfile | ready
  data.jsx        suscripciones onSnapshot + catálogo combinado (semilla + usuario + apodos)
  App.jsx         rutas (en español: /rutinas, /ejercicios, /sesion/:id, /progreso, /cuerpo/:id, /perfil)
  lib/            LÓGICA PURA (sin React; solo db.js toca Firestore)
    db.js           todas las escrituras a Firestore
    sessions.js     plan semanal, días perdidos, construir sesión, cambios al finalizar, reorganizar
    progression.js  doble progresión y 1RM (Epley)
    load.js         tipos de carga y conversión entrada ↔ valor guardado
    muscleLoad.js   series semanales por músculo y niveles del dashboard
    body.js         métricas corporales, combinaciones comparables, media móvil 7 días
    progress.js     historial por ejercicio
    dates.js        fechas locales YYYY-MM-DD, semanas lunes–domingo, ?hoy=
  pages/          una pantalla por archivo
  components/     UI reutilizable (ui.jsx tiene Header, Modal, Stepper, Empty…)
  data/           exercises.json (739 semilla, formato compacto), body.json (siluetas, MIT)
dev/mocks/        Firebase falso para dev:mock
public/ex/        1.472 miniaturas WebP (~10 MB), cacheadas en runtime, NO precargadas
```

**Regla de capas:** la lógica de negocio va en `src/lib/` como funciones puras y testeables.
Las páginas orquestan; no metas reglas de negocio nuevas dentro de componentes JSX.

## Convenciones que el código ya sigue (respétalas)

- **Escrituras "fire-and-forget"** (`db.js`): no se hace `await`; la caché offline aplica el cambio
  al instante y sincroniza después. Los ids se generan en cliente (`doc(col)`) para poder navegar
  ya. Excepción: el alta de perfil en onboarding sí se espera.
- **Fechas** como string `YYYY-MM-DD` en hora local; semana lunes (0) a domingo (6); clave de semana
  ISO `2026-W42`. Usa siempre `now()` de `lib/dates.js`, nunca `new Date()` directo (rompe `?hoy=`).
- **Cargas guardadas como valor "real"**: barra = total (por lado × 2 + barra), mancuerna = por mano,
  máquina/polea = total, peso corporal = lastre. La UI convierte con `inputToStored`/`storedToInput`.
- **Números en UI** con coma decimal y `es-ES`.
- `serverTimestamp()` para `createdAt/updatedAt`; no reenviar timestamps leídos de Firestore.
- `ignoreUndefinedProperties: true` está activo: `undefined` se descarta, usa `null` si quieres borrar.
- Ids internos de ítems/entradas con `uid()` de `lib/text.js`.

## Invariantes — no romper

- Una sesión con `status: 'done'` es **inmutable** (lo imponen las reglas).
- Las entradas de sesión **copian** nombre, tipo de carga y músculos del ejercicio: el historial no
  cambia si se edita el catálogo. No "arregles" esto leyendo del catálogo.
- Los ejercicios de usuario **no se borran**, se archivan (`archived: true`). Rutinas: borrado lógico (`deleted`).
- **Una sola rutina activa** (`setActiveRoutine` en batch).
- Catálogo semilla empaquetado en la app (cero lecturas); solo los ejercicios de usuario viven en
  Firestore (`exercises`, compartidos entre todos los usuarios invitados).
- Fotos de ejercicio de usuario: `imageData` / `imageData2` < 150 KB cada una (reglas).
- Si cambias el modelo de datos: actualiza `firestore.rules`, `dev/mocks/firebase-firestore.js`
  (si usas una API nueva de Firestore) y `docs/DOMINIO.md` en el mismo cambio.

## Cómo trabajar en este repo

1. Antes de cambiar lógica en `lib/sessions.js` o `lib/progression.js`, lee la sección
   correspondiente de `docs/DOMINIO.md`. Son las reglas que más fácil se rompen sin darse cuenta.
2. Prueba en `npm run dev:mock` en anchura de móvil (~390 px) y con `?hoy=` cuando haya fechas.
   Recuerda que el mock **no aplica reglas de seguridad**: un fallo de reglas solo aparece en producción.
3. `npm run build` sin errores.
4. Commits en español: título corto + viñetas de qué cambia para el usuario (ver `git log`).
5. Al terminar, resume en una línea qué cambió y avisa si hay que publicar reglas a mano.

## Seguridad

- La config web de Firebase en `src/firebase.js` es pública por diseño; la seguridad está en las reglas.
- Nunca subir claves de cuentas de servicio (`*adminsdk*.json`, `service-account*.json`).
- Para invitar a alguien: añadir su email a `invited()` en `firestore.rules` y publicar las reglas.
