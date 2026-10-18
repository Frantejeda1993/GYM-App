# Dominio y modelo de datos

Referencia de las reglas de negocio de GYM App. Si el código y este documento discrepan,
el código manda: corrige el documento en el mismo cambio.

## 1. Modelo de datos en Firestore

```
users/{uid}                         perfil
  routines/{routineId}              rutinas (plantillas)
  sessions/{sessionId}              entrenos realizados / en curso / no realizados
  weekOverrides/{AAAA-Www}          reorganización "solo esta semana"
  bodyMetrics/{id}                  peso y composición corporal
  exerciseNotes/{exerciseId}        apodo y notas personales por ejercicio
exercises/{id}                      ejercicios creados por usuarios (compartidos)
```

El catálogo semilla (739 ejercicios de free-exercise-db, sin estiramientos ni cardio) está en
`src/data/exercises.json` con claves compactas (`n` nombre, `p`/`s` músculos principales/secundarios,
`e` equipamiento, `l` tipo de carga, `b` barra por defecto, `i` nº de imágenes). `data.jsx` lo
normaliza al mismo formato que los ejercicios de Firestore y los combina.

### Perfil (`users/{uid}`)
`name`, `email`, `bodySex` (`male`|`female`, solo para la silueta), `defaultBarKg` (20),
`weighReminderDays` (14), `createdAt`, `updatedAt`.

### Ejercicio
`name`, `nameNormalized`, `primaryMuscles[]`, `secondaryMuscles[]`, `equipment`, `loadType`,
`defaultBarKg`, `source` (`seed`|`user`), `archived`, `createdBy`, `createdByName`,
`imageData`, `imageData2` (data URL JPEG ≤360×240), timestamps.

### Rutina
`name`, `mode` (`weekly` = por día de la semana | `sequential` = A, B, C… en bucle),
`active`, `activatedAt`, `deleted`, `restDays[]`, `nextSequenceIndex` (solo secuencial),
`templateSessions[]`:

```
{ id, name, weekday (0=lunes…6, modo weekly) | order (modo sequential), items[] }
item fuerza:  { id, kind:'strength', exerciseId, sets, repMin, repMax, reps?, loadKg, barKg,
                restSec, loadMode:'fixed'|'progressive', setLoads[]|null, incrementKg }
item cardio:  { id, kind:'cardio', cardioType, minutes, steps, kcal }
```

`reps` es la repetición "actual" dentro del rango (opcional). `setLoads` solo en modo progresivo
(un peso por serie); en ese caso `loadKg` = máximo de `setLoads`.

### Sesión
`date`, `isoWeek`, `routineId`, `templateSessionId`, `sessionName`,
`status` (`in_progress` | `done` | `skipped`), `entries[]`, `cardio[]`, `startedAt`, `finishedAt`.

Cada entrada de fuerza copia del ejercicio y del ítem: `name`, `loadType`, `barKg`, músculos,
`repMin/repMax`, `restSec`, `incrementKg`, `loadMode`, y `sets[]` con
`{ plannedKg, plannedReps, kg, reps, done }`. Las añadidas durante la sesión llevan `adhoc: true`
y, si se marcaron como "fijas", `fixed: true` + `newItem` (el ítem a añadir a la plantilla).

### Métrica corporal
`date`, `weightKg`, `method` (`bia`|`caliper`|`dexa`|`other`), y `fat`/`muscle`/`water`
como `{ value, unit: 'pct'|'kg' }`.

## 2. Tipos de carga (`lib/load.js`)

| Tipo | Usuario introduce | Se guarda | Incremento por defecto |
|---|---|---|---|
| `barbell` | kg por lado | total = lado × 2 + barra | 2,5 |
| `dumbbell` | kg por mano | kg por mano | 2 |
| `total` | kg total | kg total | 5 |
| `bodyweight` | lastre | lastre | 2,5 |

Barra por defecto: 20 kg (barra Z: 10 kg). El tipo se sugiere a partir del equipamiento (`lib/equipment.js`).

## 3. Qué sesión toca hoy (`lib/sessions.js`)

- **Por día (`weekly`):** la sesión cuyo `weekday` es hoy, salvo que `weekOverrides/{semana}` reasigne la fecha.
- **Secuencial:** `templateSessions` ordenadas por `order`, índice `nextSequenceIndex % n`.
  Solo avanza al **finalizar**; descartar no avanza.
- El usuario siempre puede elegir otra sesión en vez de la propuesta.

### Días perdidos (solo modo `weekly`)
Días de entreno de la semana actual anteriores a hoy, posteriores a la activación de la rutina,
sin sesión registrada. Una sesión de la misma plantilla hecha otro día de la semana cuenta como hecha.
Opciones del usuario:
- **Eliminar ese día:** se crea una sesión `skipped`.
- **Reorganizar la semana:** propuesta inicial = cola (perdidas primero + pendientes) repartida en los
  días que quedan (hoy incluido). Lo que no cabe se registra como `skipped`.
  - *Solo esta semana:* se escribe `weekOverrides/{AAAA-Www}`.
  - *Permanente:* además mueve los `weekday` de la plantilla y recalcula `restDays`.

### Sesión sin finalizar de otro día
Se ofrece finalizar con lo marcado, revisar o descartar (`skipped`).

## 4. Finalizar una sesión: cambios a la plantilla

`computeChanges` → el usuario revisa → `applyChanges` → `finalizeSession` (batch: sesión `done` +
plantilla + avance de secuencia).

- **Peso fijo:** la plantilla toma el **mayor** peso de las series hechas.
- **Peso progresivo:** se actualiza el peso de **cada** serie hecha.
- **Reps:** la moda de las reps hechas (en empate, la mayor).
- **Nº de series:** si se añadieron o quitaron series.
- **Cardio:** minutos, pasos, kcal si cambian.
- **Ejercicios/cardio "fijos" añadidos** durante la sesión se añaden a la plantilla.
- **Regla de aceptación:** lo que **sube** se aplica siempre; lo que **baja** y las **progresiones**
  se preguntan (por defecto: subidas aceptadas, bajadas desmarcadas).

### Doble progresión (`lib/progression.js`)
- **Subir** `incrementKg` (en cada serie si es progresivo) cuando **todas** las series están hechas
  y llegan a `repMax` o más. Tras subir, `reps` vuelve a `repMin`.
- **Bajar** `incrementKg` cuando alguna serie queda por debajo de `repMin` en esta sesión **y** en
  la anterior finalizada del mismo ítem. No baja por debajo de la barra vacía (barbell) ni de 0.
- La sesión anterior se busca por `itemId` (mismo ítem de plantilla), no por ejercicio: una sesión
  copiada tiene ids nuevos y su progresión es independiente.

## 5. Progreso

- **1RM estimado (Epley):** `kg × (1 + reps/30)`; `null` si reps > 12, reps < 1, o peso corporal sin lastre.
- Por ejercicio y sesión: mejor 1RM, mejor serie, volumen (Σ kg × reps), reps y kg máximos.
- El historial se calcula con `exerciseId`, solo sesiones `done` y series `done`.

## 6. Dashboard muscular semanal (`lib/muscleLoad.js`)

- Series por músculo: principal = 1, secundario = 0,5.
- **Planificado:** sesiones de la semana según plan (en secuencial, un ciclo completo).
  **Realizado:** series marcadas en sesiones `done` de esa semana, con los músculos copiados en la sesión.
- Niveles 0–4. Normales: 1–4 · 5–9 · 10–20 · >20. Pequeños (antebrazos, gemelos, abdominales,
  cuello, abductores, aductores): 1–2 · 3–5 · 6–10 · >10.
- Regiones de la silueta → músculos en `REGION_MUSCLES`; una región toma el nivel de su músculo más trabajado.
- Siluetas adaptadas de react-native-body-highlighter (MIT, `src/data/BODY-LICENSE.txt`).

## 7. Composición corporal (`lib/body.js`)

- Peso siempre comparable. Grasa/músculo/agua solo se comparan dentro de la misma combinación
  **método + unidad**.
- Gráfico con mediciones y media móvil de 7 días (medición + 6 días previos); cambio a ~30 días sobre la media.
- Aviso en "Hoy" si no hay peso registrado o han pasado más de `weighReminderDays` días; ocultable por hoy.

## 8. Catálogo, apodos y duplicados

- Búsqueda normalizada (sin tildes, minúsculas) por nombre original o apodo.
- Al crear un ejercicio se detectan nombres parecidos (`similarity` en `lib/text.js`) y se ofrece usar el existente.
- Apodo y notas son por usuario (`exerciseNotes`); `displayName` = apodo o nombre.
- Vídeos de técnica: enlace a una búsqueda de YouTube (no se alojan vídeos).
- Imágenes semilla en `public/ex/<id>-<0|1>.webp`, cacheadas al verlas (CacheFirst, máx. 1600).

## 9. Reglas de seguridad (`firestore.rules`)

- `invited()`: email verificado y en la lista blanca.
- `users/{uid}/**`: solo el propio usuario. Sesiones `done`: sin update ni delete.
- `exercises`: lectura para invitados; crear/editar solo el autor, `source == 'user'`, fotos < 150 KB;
  borrar nunca.
- Las reglas **no validan el esquema** de los documentos de usuario: la integridad depende del cliente.
