# GYM App

PWA para planificar rutinas de gimnasio y registrar entrenos serie a serie. Funciona en iPhone y Android, sin tiendas y sin coste.

**App:** https://frantejeda1993.github.io/GYM-App/

## Instalar en el móvil

- **iPhone (Safari):** abrir la URL → Compartir → *Añadir a pantalla de inicio*. Iniciar sesión desde el icono instalado (la app instalada no comparte sesión con Safari).
- **Android (Chrome):** abrir la URL → menú ⋮ → *Instalar aplicación*.

## Stack

React + Vite · vite-plugin-pwa · Firebase Auth (Google) · Firestore con caché offline · GitHub Pages.

## Desarrollo

```bash
npm install
npm run dev        # contra Firebase real
npm run dev:mock   # Firebase simulado en el navegador, para probar la interfaz sin cuenta
npm test           # tests de la lógica (Vitest); también se ejecutan al publicar
npm run build
```

Cada push a `main` se publica automáticamente (`.github/workflows/deploy.yml`).

## Invitar a alguien

El acceso lo controla `firestore.rules`. Añade el email a la lista de `invited()` y publica las reglas en
Firebase → Firestore Database → Reglas (copiar y pegar el archivo completo).

## Catálogo de ejercicios

El catálogo base (739 ejercicios, sin estiramientos ni cardio) se genera desde
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público) y va empaquetado en la app:

```bash
node scripts/build-catalog.mjs ruta/a/free-exercise-db/dist/exercises.json
```

Los ejercicios que crean los usuarios se guardan en Firestore (`exercises`) y se comparten entre todos.

## Seguridad

- La configuración web de Firebase en `src/firebase.js` es pública por diseño.
- Nunca subir claves privadas de cuentas de servicio (`*adminsdk*.json`); `.gitignore` las excluye.
