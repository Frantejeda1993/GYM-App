# Estado del proyecto, deuda técnica y siguientes pasos

Revisado el 18-10-2026 sobre el commit `357f0e2`. Actualiza este archivo cuando cierres o descubras algo.

## Hecho (fases 1–5, todo en producción)

1. Login con Google, lista blanca, perfil, catálogo de 739 ejercicios + ejercicios de usuario
   compartidos con detección de duplicados, editor de rutinas por día y secuencial.
2. Sesión activa serie a serie, temporizador de descanso (sonido + vibración, robusto en segundo
   plano), ejercicios añadidos "solo hoy" o "fijos", días perdidos, reorganización de semana,
   sesiones sin finalizar de otro día.
3. Peso fijo/progresivo, doble progresión, pestaña Progreso con 1RM estimado, volumen e historial.
4. Dashboard muscular semanal (planificado vs realizado) con siluetas hombre/mujer.
5. Peso y composición corporal con media móvil y aviso por falta de registros.

Extras: apodos y notas por ejercicio, fotos inicio/final, animación, enlace a vídeos de técnica,
copiar sesiones dentro de la rutina, crear ejercicio desde el selector.

Verificado: `npm ci && npm run build` pasa (precache ~1 MB, miniaturas fuera del precache).

## Deuda técnica y riesgos (por prioridad)

### Alta
1. **Cero tests.** Toda la lógica crítica (`lib/sessions.js`, `lib/progression.js`, `lib/load.js`,
   `lib/body.js`, `lib/muscleLoad.js`) es pura y fácil de testear, pero no hay ni un test. Un cambio
   en `computeChanges`/`applyChanges` puede corromper plantillas en silencio, y una sesión `done`
   no se puede corregir después (es inmutable). **Primer paso recomendado:** Vitest + tests de esas
   funciones antes de añadir más funcionalidad.
2. **Errores de sincronización invisibles.** `fireAndForget` solo hace `console.error`. Si Firestore
   rechaza una escritura (reglas, tamaño de foto, documento >1 MB), la caché local la revierte y el
   usuario no se entera: cree que guardó y no guardó. Mínimo: un aviso visible cuando una escritura falla.
3. **Reglas desplegadas a mano.** `firestore.rules` no está en el workflow; el archivo del repo y las
   reglas publicadas pueden divergir sin que nadie lo note. Además el mock no aplica reglas, así que
   ningún cambio de reglas se prueba antes de producción. `firebase.json` ya define emuladores pero el
   código no los usa (`connectAuthEmulator` / `connectFirestoreEmulator`).

### Media
4. **Lectura completa de todas las sesiones** en cada arranque (`onSnapshot` sin filtro). Con ~4
   sesiones/semana son ~200 documentos/año por usuario: aguanta años dentro del plan gratuito
   (50 000 lecturas/día), pero el arranque y la memoria crecen sin límite. Cuando moleste: limitar
   por fecha y cargar historial bajo demanda en Progreso.
5. **El "planificado" de semanas pasadas se reconstruye con la rutina activa de hoy.** Si cambias de
   rutina o editas la plantilla, el dashboard de semanas anteriores muestra un plan que no era el de
   entonces (y las reorganizaciones de semanas pasadas no se tienen en cuenta). Para corregirlo habría
   que guardar una foto del plan semanal.
6. **`weekOverride` se suscribe a la semana del momento de arranque.** Si la app queda abierta del
   domingo al lunes, sigue escuchando la semana anterior hasta recargar.
7. **Sin validación de esquema en reglas** para datos de usuario: aceptable con 2 usuarios de
   confianza, a revisar antes de abrirla a más gente.
8. **Push a `main` despliega directamente**, sin CI de build/tests en ramas ni PR. Un commit roto llega
   a los móviles en minutos (PWA `autoUpdate`).

### Baja
9. Mock incompleto: `writeBatch` sin `delete`, `onSnapshot` de colecciones sin `metadata`.
10. Sin linter configurado (hay comentarios `eslint-disable` pero no hay ESLint en el proyecto).
11. Componentes grandes: `Session.jsx` (~480 líneas), `RoutineEditor.jsx` (~320), `Today.jsx` (~300).
    No es urgente; dividir solo cuando se toquen.
12. Ids con `Math.random` (8 caracteres): suficiente para ids locales dentro de un documento.

## Siguientes pasos propuestos

En este orden, porque cada uno reduce el riesgo del siguiente:

1. Vitest + tests de `lib/` (progresión, cambios al finalizar, días perdidos, reorganización,
   conversión de cargas, media móvil). Añadir `npm test` al workflow antes del build.
2. Aviso visible de error de sincronización.
3. Desplegar `firestore.rules` desde el workflow (o al menos un check que avise si difieren) y
   conectar emuladores en `dev` para probar reglas.
4. Workflow de build en ramas/PR; dejar `main` solo para lo probado.
5. Funcionalidad nueva (pendiente de que Francisco la defina).

## Preguntas abiertas para Francisco

- ¿La segunda usuaria/o ya está invitada? Hoy solo está su email en `invited()`.
- ¿Exportar/importar datos (copia de seguridad en JSON)? Hoy, si se pierde la cuenta de Firebase,
  se pierde todo el historial.
