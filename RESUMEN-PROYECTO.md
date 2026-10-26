# Mi Coach Fitness — Resumen del proyecto

> Documento de traspaso para arrancar una nueva versión.
> Actualizado: 26 de octubre de 2026.

---

## 1. Qué es

App personal de Roberto para sus rutinas de ejercicio (entrena de noche). Es una
**web app** que se usa desde el iPhone como si fuera una app nativa (icono en la
pantalla de inicio). No hay servidor ni cuentas: todo vive en el navegador.

| | |
|---|---|
| **Carpeta local** | `/Users/robertovaldes/fitness-coach` |
| **URL en vivo** | https://robertovaldes2332-dot.github.io/fitness-coach/ |
| **Repositorio** | `robertovaldes2332-dot/fitness-coach` (GitHub Pages, rama `main`, raíz `/`) |
| **Datos** | `localStorage`, clave `fitcoach` (se mantuvo entre versiones) |
| **Vista previa local** | config `fitness-coach` → `python3 -m http.server 4599` |

**Publicar un cambio:** editar → `git add -A && git commit && git push`.
GitHub Pages redespliega solo en ~1 minuto.

---

## 2. ⚠️ Estado del repositorio (leer antes de tocar código)

El checkout local **no coincide** con lo que está publicado:

- `main` local está **4 commits atrás** de `origin/main`.
- Los archivos de la v2 están en el disco pero **sin registrar en git** desde este clon.
- `index.html` figura como modificado.
- `improvements.js` (29 KB) existe en local pero **no** está en el remoto → archivo
  huérfano de una iteración intermedia.

**Primer paso de la nueva versión:**

```bash
cd ~/fitness-coach && git stash -u && git pull && git log --oneline -1
```

✅ Hecho el 26-oct-2026: repo sincronizado e `improvements.js` borrado (queda en `git stash`).

---

## 3. Historia: dos versiones

### v1 — "Coach con plan semanal" (archivo único)
Commits `266396e`, `acfacf0`, `1997543`. Un solo `index.html` de ~1.200 líneas.

Lo que tenía:
- Plan semanal fijo (Lun–Dom), objetivo (bajar grasa/definir), inventario de equipo.
- Calentamiento de cardio insertado automáticamente al inicio de cada rutina.
- Coach que **generaba** rutinas y las **evaluaba** con puntuación 0–100.
- Imágenes de cada ejercicio (inicio/final) desde free-exercise-db.
- Favoritos (priorizados) y lista de evitar (excluidos).
- Registro de peso por serie + "última vez" + gráfica de barras de progreso.
- Modo Entrenando: un ejercicio a pantalla completa con temporizador de descanso.
- Colores por grupo muscular.
- Exportar/importar respaldo.
- Selector de idioma Español/English (traducción automática del DOM).
- Botón 🔄 Cambiar: sustituir un ejercicio por una variante del mismo grupo.

### v2 — "Guía visual de ejercicios libres" (actual, en vivo)
Commits `cfa9b2c` → `e23f1cd`. Reescritura completa a multi-archivo.

**Cambio de filosofía:** se eliminó el calendario obligatorio. Ahora la app pregunta
*qué quieres entrenar hoy*; faltar un día ya no desordena nada.

Arquitectura:

| Archivo | Qué hace |
|---|---|
| `index.html` | Cascarón mínimo (12 líneas) |
| `modern.js` | 44 KB — toda la lógica y el catálogo |
| `modern.css` | 11 KB — tema claro (`#f4f4f0`) |
| `sw.js` | Service worker, caché `mi-coach-v5-2` (**subir la versión en cada cambio**, el SW sirve primero lo cacheado) → funciona sin internet |
| `manifest.webmanifest` + iconos | Instalable como PWA |
| `assets/muscles/*.webp` | 9 ilustraciones anatómicas a color |

Funcionalidad:
- Navegación: **Explorar · Sesión · Historial · Equipo**.
- 9 grupos: bíceps, tríceps, pecho, espalda, hombros, piernas, glúteos, core, cardio.
- **84 ejercicios** (5–12 por grupo), de los cuales **21 son calistenia**.
- Ficha de cada ejercicio con 2 fotos + indicaciones de técnica, con enlace a ACE.
- Constructor: eliges ejercicios → "Empezar" → sesión con series y pesos.
- Equipo marcable como **ocupado** para ocultar temporalmente sus ejercicios.
- Historial de sesiones y exportar respaldo.

---

## 4. Funciones de la v1 que el rediseño eliminó

Si alguna hace falta, hay que reimplementarla (el código está en el historial de git):

- ❌ **Idioma inglés** — el selector ES/EN desapareció por completo.
- ❌ **Cambiar por variante** (botón 🔄).
- ✅ **Importar respaldo** — recuperado en v2.1 (Historial → Respaldo). Fusiona por `id`: no borra nada local.
- ❌ **Racha de días** y evaluación de rutina 0–100.
- ❌ **Coach generador/evaluador de rutinas**.
- ⚠️ **Favoritos / evitar** — quedan rastros en los datos, pero ya no tienen interfaz.
- ⚠️ **Calentamiento de cardio automático** — ya no se inserta solo; Roberto siempre
  empieza con cardio (bici, corredora o remo), así que conviene recuperarlo de alguna forma.

---

## 5. Contexto de Roberto (preferencias confirmadas)

- **Entrena de noche.** Objetivo declarado: **bajar grasa / definir**.
- **Siempre empieza con cardio** (bicicleta estática, corredora o remo).
- Hace pesas, cardio y peso corporal.
- **Gym (inventario v2, tomado de fotos reales):** mancuernas, 2 bancos ajustables,
  poleas dobles con agarres, TRX, kettlebells, balones medicinales, pelota de
  estabilidad, barra de dominadas, 2 caminadoras, elíptica, bicicleta estática.
  *(En la v1 el inventario incluía prensa de piernas y no tenía TRX ni dominadas —
  el de la v2 es el bueno.)* Hay una máquina sin identificar que no genera recomendaciones.
- Es gym pequeño: **no hay barra con discos ni máquinas guiadas**.

---

## 6. Lecciones aprendidas (no repetir errores)

1. **iOS: solo Safari** puede "Agregar a pantalla de inicio". Edge y Chrome en iPhone
   no tienen esa opción.
2. **No se pueden abrir archivos `.html` locales** desde la app Archivos del iPhone →
   por eso hay que publicarlo en una URL.
3. **tiiny.host (plan gratis) metía un anuncio flotante abajo** que tapó primero la
   barra de navegación y después el botón de cerrar de los modales. Por eso:
   - la barra de navegación se movió **arriba**,
   - los modales se centraron y se les puso una **✕ arriba a la derecha**.
   Al migrar a GitHub Pages el anuncio desapareció, pero esos cambios de diseño
   se quedaron (y funcionan bien).
4. **Imágenes de ejercicios:** se sirven desde `raw.githubusercontent.com`
   (free-exercise-db) e ImageKit. El service worker ya las cachea. Verificar siempre
   que el ID exista en el catálogo antes de usarlo — se validaron una por una.
5. **Riesgo real:** los datos viven en `localStorage`. Si Safari limpia los datos del
   sitio, se pierde todo. Ya existe importar respaldo (v2.1).
6. **GitHub CLI** quedó autenticado en esta Mac (`gh auth status` → cuenta
   `robertovaldes2332-dot`). El login se hizo por *device flow* porque el flujo web
   de `gh auth login` no funcionó; requiere scope `read:org` además de `repo,workflow`.

---

## 7. Ideas pendientes para la nueva versión

Propuestas que quedaron sin implementar:

- **Evaluación semanal** (no solo del día): detectar dos días seguidos de empuje,
  piernas una sola vez, cero descanso.
- ~~Importar respaldo + recordatorio~~ → hecho en v2.1 (aviso si el último respaldo tiene ≥14 días).
- **Gráfica de progreso de peso** por ejercicio (existía en v1; confirmar si el
  seguimiento de series de la v2 ya la cubre).
- **Recuperar el idioma inglés** — útil porque los nombres de los ejercicios en el
  gym están en inglés.
- **Modo "Entrenando"** a pantalla completa con descanso automático (existía en v1).

---

## 8. Cómo arrancar la nueva versión

```bash
cd ~/fitness-coach
git stash -u          # guarda el estado local desincronizado
git pull              # traer la v2 real
rm -f improvements.js # archivo huérfano
python3 -m http.server 4599   # vista previa local
```

Luego abrir `http://localhost:4599` y comparar con el teléfono antes de cambiar nada.
