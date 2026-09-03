# Planeación Académica

Aplicativo web para que los decanos diligencien la planeación del siguiente
ciclo de formación (sede, jornada, días/horas, docente, Moodle/Teams, etc.)
y para que un administrador cargue el catálogo base de cada ciclo y descargue
el Excel final consolidado, con la misma estructura de la plantilla
`PLANEACIÓN` que ya usa la institución.

- **Frontend + backend:** Next.js 14 (App Router), una sola app.
- **Base de datos:** PostgreSQL (pensado para [Neon](https://neon.tech), que
  tiene capa gratuita e integración nativa con Vercel).
- **Autenticación:** usuario/contraseña propio (sin servicios externos),
  cookie de sesión firmada con JWT.
- **Excel:** se lee y se genera con [ExcelJS](https://github.com/exceljs/exceljs).
- **Costo:** $0 — Vercel (plan Hobby) + Neon (plan gratuito) cubren este uso.

## 1. Cómo está organizada la información

- **Catálogo** (`catalogo`): lo carga el administrador desde un Excel al
  inicio de cada ciclo. Trae las columnas que ya vienen definidas
  (facultad, programa, plan, asignatura, ciclo, créditos).
- **Planeación** (`planeacion` + `planeacion_horario`): lo diligencia cada
  decano — crea uno o más "grupos" por cada asignatura del catálogo de su
  facultad, con sede, jornada, días/horas, capacidad, docente,
  Moodle/Teams, estado y observaciones.
- **Exportación**: el administrador descarga un Excel con la hoja
  `PLANEACION` completa (mismos encabezados que la plantilla original) más
  las hojas `DOCENTES`, `REFLEJOS` y `CERRADOS` para conservar la misma
  estructura de pestañas del archivo original. Cada decano también puede
  descargar únicamente el avance de su propia facultad.

### Decisiones de diseño que debes conocer

1. **Roles**: `admin` (carga catálogo, crea usuarios de decanos, ve el
   avance y exporta el consolidado) y `decano` (ve y diligencia solo su
   propia facultad). Esto se decidió contigo al inicio de la construcción.
2. **Sedes/jornadas**: los valores de "Modalidad" (sede) y "Jornada" están
   tomados de los valores reales que ya usa la institución en su archivo
   (`CALLE 73`, `NORTE`, `SUR`, `ASISTIDA POR TECNOLOGIA` para sedes;
   `DIURNA`, `ESPECIAL`, `NOCHE`, `SABADO` para jornadas). Si necesitas
   agregar o cambiar alguno, están centralizados en `lib/constants.js`.
3. **La plantilla no tiene columna propia para Sábado.** La hoja
   `PLANEACION` original sólo trae columnas de horario para Lunes a
   Viernes, aunque la jornada "Sabatina" sí existe en los datos reales de
   la institución. Por eso, al exportar: un horario de Lunes a Viernes
   siempre va a su columna real (Miércoles → columnas "MCL", nunca otra);
   un horario de Sábado ocupa el primer bloque de día que haya quedado
   libre en esa fila; y si un mismo grupo llegara a tener horario los 6
   días (caso extremo), el que no cabe se anota en "OBSERVACIONES" en vez
   de perderse. Ver `lib/excelExport.js` (función `ubicarHorariosEnSlots`).
4. **El código de "Grupo" se escribe a mano.** No se intentó adivinar la
   regla interna con la que la institución arma códigos como
   `SEON1-3TS`, porque no hay forma de confirmarla sin datos adicionales;
   el decano simplemente escribe el código del grupo como texto libre.
5. **"Estado" por grupo** tiene 3 valores (`Sin reportar`, `Reportado`,
   `No aplica`), tomados también de los valores reales vistos en el
   archivo de la institución.
6. **Catálogo de docentes**: si el Excel que subes trae la hoja
   `DOCENTES`, se carga para ofrecer autocompletar al buscar un docente en
   el formulario (no es obligatorio: si no existe esa hoja, el decano
   simplemente escribe el nombre/documento a mano).
7. **Recuperación de contraseña**: cada usuario decano puede tener un
   correo asociado (lo define el admin al crearlo, o lo edita después).
   Desde el login, "¿Olvidaste tu contraseña?" envía un enlace de un solo
   uso, válido 30 minutos, a ese correo. El envío usa SMTP genérico
   (`lib/email.js`) — funciona con el correo de tu institución, Gmail,
   Outlook, etc. Si no configuras las variables `SMTP_*`, la aplicación
   sigue funcionando con normalidad: el enlace simplemente no se envía
   por correo (queda registrado en la base de datos y en los logs del
   servidor), para que el administrador pueda restablecer la clave a
   mano mientras tanto.
8. **Hojas `REFLEJOS` y `CERRADOS`** se conservan en el Excel exportado
   con los mismos encabezados de la plantilla, pero vacías: no forman
   parte de este aplicativo de planeación (pertenecen al flujo de
   reflejos/cierres que ya maneja el sistema de Consulta de Horarios
   existente).

9. **Mantenimiento de la base de datos** (backup y eliminación): en el
   panel de administración, sección "6. Mantenimiento de la base de
   datos". El admin puede descargar en cualquier momento una copia de
   seguridad completa (`GET /api/admin/backup`, ver `lib/dbBackup.js`) en
   un archivo `.sql` con un `INSERT` por tabla listo para pegar en el
   editor SQL de Neon si hay que restaurar. También puede eliminar todos
   los datos de un período puntual (catálogo, planeación con sus
   horarios, y estudiantes cargados para ese período — no toca usuarios,
   sedes, salones ni docentes) desde `DELETE /api/admin/eliminar-periodo`.
   Esa eliminación exige rol admin, corre en una sola transacción
   (todo-o-nada) y solo se ejecuta si el texto de confirmación coincide
   exactamente con el período, para evitar un borrado accidental.

Si alguno de estos supuestos no encaja con cómo trabaja realmente tu
institución, son fáciles de ajustar — dímelo y los cambiamos.

> ¿Quieres primero correrlo en tu propio computador y subirlo a GitHub
> usando VS Code, paso a paso? Ve directo a **`GUIA_LOCAL_VSCODE.md`** —
> cubre exactamente eso, desde instalar lo necesario hasta publicar el
> repositorio, antes de llegar a Vercel.

## 2. Requisitos antes de desplegar

1. Una cuenta gratuita en [vercel.com](https://vercel.com) (puedes crearla
   con tu cuenta de GitHub, GitLab o correo).
2. Una cuenta gratuita en [neon.tech](https://neon.tech) — o puedes crear
   la base de datos Neon directamente desde el panel de Vercel (paso 4).
3. Este proyecto en un repositorio de GitHub (recomendado, más simple de
   mantener) **o** el CLI de Vercel instalado en tu computador (alternativa
   sin GitHub, ver 3.B).

## 3. Publicar en Vercel

### Opción A (recomendada): con GitHub

1. Crea un repositorio nuevo y vacío en GitHub (por ejemplo
   `planeacion-academica`).
2. En tu computador, dentro de la carpeta del proyecto:
   ```bash
   git init
   git add .
   git commit -m "Primera versión de Planeación Académica"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/planeacion-academica.git
   git push -u origin main
   ```
3. Entra a [vercel.com/new](https://vercel.com/new), elige "Import Git
   Repository" y selecciona ese repositorio. Vercel detecta que es un
   proyecto Next.js automáticamente — no cambies nada en "Build settings".
4. **Antes de darle "Deploy"**, ve a la pestaña **Storage** del proyecto en
   Vercel → **Create Database** → elige **Neon (Postgres)** → sigue el
   asistente (puedes dejar el plan gratuito). Al conectarla, Vercel agrega
   automáticamente las variables de conexión (`DATABASE_URL` o similar) al
   proyecto — no necesitas copiarlas a mano.
5. Ve a **Settings → Environment Variables** del proyecto y agrega:
   - `JWT_SECRET`: un valor largo y aleatorio. Puedes generarlo en tu
     computador con:
     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
6. Dale **Deploy**. Cuando termine, Vercel te da una URL pública
   (`https://tu-proyecto.vercel.app`).
7. **Crea las tablas** en la base de datos Neon (una sola vez). La forma
   más simple es usando el editor SQL que trae Neon:
   - Entra a tu proyecto en [neon.tech](https://neon.tech) → **SQL Editor**.
   - Copia y pega todo el contenido del archivo `db/schema.sql` de este
     proyecto y ejecútalo.
8. **Crea el usuario administrador** (una sola vez). Desde tu computador,
   con Node.js instalado y dentro de la carpeta del proyecto:
   ```bash
   npm install
   DATABASE_URL="pega-aquí-la-cadena-de-conexión-de-Neon" \
   ADMIN_USERNAME="admin" \
   ADMIN_PASSWORD="una-clave-segura" \
   node scripts/seed.js
   ```
   La cadena de conexión de Neon la copias desde su panel (**Connection
   Details**, usa la que incluye `sslmode=require`).
9. Entra a `https://tu-proyecto.vercel.app`, inicia sesión con
   `admin` / la clave que definiste, y ya puedes cargar el primer catálogo
   y crear los usuarios de los decanos desde el panel de administración.

### Opción B: sin GitHub, con el CLI de Vercel

1. Instala el CLI (una sola vez): `npm install -g vercel`
2. Dentro de la carpeta del proyecto: `vercel login` y luego `vercel` — te
   hace preguntas simples (nombre del proyecto, etc.) y publica una
   versión de vista previa.
3. Sigue los pasos 4 a 9 de la Opción A (la base de datos, las variables de
   entorno y la creación del administrador funcionan igual desde el panel
   web de Vercel), y luego corre `vercel --prod` para publicar la versión
   definitiva.

## 4. Cada nuevo ciclo de formación

1. El administrador entra al panel (`/admin`) y sube el Excel base del
   nuevo ciclo (con la hoja `PLANEACION` y, si la tienes, `DOCENTES`),
   indicando el período (por ejemplo `2026-2T`).
2. Si hay facultades nuevas o decanos nuevos, el administrador los crea
   en la sección de usuarios.
3. Cada decano entra a `/decano`, elige el período y diligencia sus
   grupos.
4. El administrador exporta el Excel consolidado desde `/admin` cuando lo
   necesite (se puede exportar varias veces, por ejemplo para ver avances
   parciales).

## 5. Probar en tu computador antes de tocar producción (opcional)

```bash
npm install
# Necesitas un PostgreSQL accesible; puedes usar la misma base de Neon
# de pruebas, o uno local.
export DATABASE_URL="postgres://usuario:clave@localhost:5432/planeacion_academica"
export JWT_SECRET="cualquier-valor-para-pruebas"
psql "$DATABASE_URL" -f db/schema.sql
ADMIN_PASSWORD="admin123" node scripts/seed.js
npm run dev
```

Abre `http://localhost:3000`, inicia sesión con `admin` / `admin123`.

Si quieres probar también la recuperación de contraseña por correo, agrega
además a tus variables de entorno `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS`
(ver `.env.example`). Sin esas variables, el enlace de recuperación no se
envía por correo pero sí queda impreso en la terminal donde corre
`npm run dev`, así puedes seguir probando el flujo completo.

## 6. Si ya habías desplegado una versión anterior (sin recuperación de contraseña)

Solo necesitas correr una vez, sobre tu base de datos ya existente, el
archivo `db/migracion_recuperar_password.sql` (agrega las columnas
`email`, `reset_token` y `reset_token_expira` a la tabla `usuarios`; es
segura de ejecutar más de una vez). Si vas a crear la base de datos desde
cero, no necesitas este paso — ya está incluido en `db/schema.sql`.

## 7. Notas y limitaciones conocidas

- `npm audit` reporta vulnerabilidades en dos dependencias transitivas:
  `postcss` (usado internamente por Next.js en tiempo de compilación, no en
  producción) y `uuid` (usado internamente por ExcelJS). Corregirlas de
  raíz implica subir a Next.js 15 o a ExcelJS 5 — cambios mayores que
  preferí no meter en este mismo paquete sin volver a probar todo el flujo
  contigo. `nodemailer`, que sí es nuevo en esta versión, se dejó en su
  última versión estable y sin vulnerabilidades conocidas. Si quieres que
  aborde la actualización de Next.js/ExcelJS como una tarea aparte
  (con su propia ronda de pruebas), lo hacemos con gusto.
- Este proyecto fue probado de punta a punta (login, carga de catálogo,
  creación/edición/eliminación de grupos, permisos por facultad, cambio de
  contraseña obligatorio, recuperación de contraseña por correo —incluido
  el caso sin SMTP configurado— y exportación) usando el archivo Excel que
  compartiste como catálogo de prueba.
