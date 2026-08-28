# Guía paso a paso: correrlo en tu computador y subirlo a GitHub con VS Code

Esta guía es para tu computador (donde tienes VS Code instalado), no para
ningún servidor. Al final vas a tener: la aplicación corriendo en
`http://localhost:3000` en tu máquina, y el código subido a un repositorio
en tu cuenta de GitHub, listo para conectarlo a Vercel (ver `README.md`,
sección 3).

Está escrita para Windows (como el equipo donde la vas a correr), pero los
mismos pasos aplican en Mac/Linux salvo donde se indique.

## Paso 0 — Qué vas a necesitar (una sola vez)

1. **Node.js** (versión 18 o superior). Descárgalo de
   [nodejs.org](https://nodejs.org/) (botón "LTS") e instálalo con las
   opciones por defecto.
2. **Git**. Descárgalo de [git-scm.com](https://git-scm.com/downloads) e
   instálalo con las opciones por defecto.
3. **Visual Studio Code** — ya lo tienes instalado.
4. Una cuenta gratuita en [GitHub](https://github.com) y otra en
   [Neon](https://neon.tech) (base de datos PostgreSQL gratuita en la
   nube — así te ahorras instalar PostgreSQL en tu computador).

Para confirmar que Node y Git quedaron bien instalados, abre una terminal
(en Windows: busca "PowerShell" o "cmd" en el menú de inicio) y escribe:

```bash
node -v
git --version
```

Ambos deben mostrar un número de versión (no un error).

## Paso 1 — Descomprimir el proyecto y abrirlo en VS Code

1. Descomprime el archivo `planeacion-academica.zip` que te compartí, en
   una carpeta fácil de encontrar (por ejemplo `Documentos\planeacion-academica`).
2. Abre VS Code.
3. Menú **Archivo → Abrir carpeta...** (`File → Open Folder...`) y elige la
   carpeta `planeacion-academica` que acabas de descomprimir.
4. Abre la terminal integrada de VS Code: menú **Terminal → Nueva Terminal**
   (o el atajo `` Ctrl+` ``). Todos los comandos de esta guía se escriben
   ahí.

## Paso 2 — Crear la base de datos (gratis, en Neon)

1. Entra a [neon.tech](https://neon.tech) y crea una cuenta gratuita.
2. Crea un proyecto nuevo (el asistente te deja escoger nombre y región;
   cualquiera sirve).
3. En el panel del proyecto, busca **Connection Details** / **Connection
   String** y copia la cadena que empieza por `postgres://...` — asegúrate
   de que sea la que incluye `?sslmode=require` al final.
4. En el mismo panel de Neon busca **SQL Editor**, pega ahí todo el
   contenido del archivo `db/schema.sql` de este proyecto, y ejecútalo
   (botón "Run"). Esto crea las tablas necesarias.

## Paso 3 — Configurar las variables de entorno

1. Dentro de VS Code, crea un archivo nuevo en la raíz del proyecto
   llamado exactamente `.env.local` (con el punto al inicio).
2. Pega este contenido, reemplazando los valores:

   ```env
   DATABASE_URL=postgres://usuario:clave@ep-xxxx.neon.tech/neondb?sslmode=require
   JWT_SECRET=escribe-aqui-un-texto-largo-y-aleatorio
   ```

   Para generar un `JWT_SECRET` aleatorio, en la terminal de VS Code
   ejecuta:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   y copia el resultado como valor de `JWT_SECRET`.

3. Guarda el archivo (`Ctrl+S`). Este archivo nunca se sube a GitHub (ya
   está excluido en `.gitignore`), porque contiene datos sensibles.

## Paso 4 — Instalar dependencias y crear el usuario administrador

En la terminal de VS Code, dentro de la carpeta del proyecto:

```bash
npm install
```

Esto descarga las librerías del proyecto (toma uno o dos minutos).

Luego crea el usuario administrador (cambia el usuario/clave por los que
quieras usar):

```bash
# En Windows (PowerShell):
$env:DATABASE_URL="pega-aqui-tu-cadena-de-neon"; $env:ADMIN_USERNAME="admin"; $env:ADMIN_PASSWORD="una-clave-segura"; node scripts/seed.js

# En Mac/Linux (o Git Bash en Windows):
DATABASE_URL="pega-aqui-tu-cadena-de-neon" ADMIN_USERNAME="admin" ADMIN_PASSWORD="una-clave-segura" node scripts/seed.js
```

Debe imprimir: `Usuario admin "admin" listo.`

## Paso 5 — Ejecutarlo localmente

```bash
npm run dev
```

Deja esa terminal abierta (ahí corre el servidor). Abre tu navegador en
[http://localhost:3000](http://localhost:3000) — deberías ver la pantalla
de inicio de sesión. Entra con el usuario y la clave que definiste en el
Paso 4.

Para detenerlo, vuelve a la terminal y presiona `Ctrl+C`.

> Correo de "olvidé mi contraseña": si no configuras `SMTP_HOST` /
> `SMTP_USER` / `SMTP_PASS` en `.env.local` (ver `.env.example`), la
> aplicación sigue funcionando, pero el enlace de recuperación no se envía
> por correo — queda anotado en la terminal donde corre `npm run dev`
> (búscalo como `[email] SMTP no configurado...`) para que puedas
> copiarlo y probarlo manualmente mientras configuras el correo real.

## Paso 6 — Subir el proyecto a GitHub con VS Code (sin usar la línea de comandos de Git)

VS Code trae integración directa con GitHub — no necesitas escribir
comandos de `git` a mano.

1. En la barra lateral izquierda de VS Code, haz clic en el ícono de
   **Control de código fuente** (Source Control — parece una rama con
   puntos; atajo `Ctrl+Shift+G`).
2. Verás un botón **"Publicar en GitHub"** / **"Publish to GitHub"**.
   Haz clic ahí.
3. Si es la primera vez, VS Code te pedirá iniciar sesión en GitHub — se
   abre tu navegador, autorizas el acceso, y vuelves a VS Code.
4. Te preguntará el nombre del repositorio (por ejemplo
   `planeacion-academica`) y si quieres que sea **público** o
   **privado** — para este proyecto (tiene lógica de negocio de tu
   institución) se recomienda **privado**.
5. VS Code sube automáticamente todos los archivos (respetando el
   `.gitignore`, así que `.env.local`, `node_modules` y `.next` **no** se
   suben — no hace falta que te preocupes por eso).
6. Cuando termine, arriba a la derecha del panel de Control de código
   fuente aparece un botón para **abrir el repositorio en GitHub** —
   ahí puedes confirmar que quedó publicado.

### Si prefieres hacerlo por comandos (alternativa)

Si te sientes más cómodo con la terminal, en vez del botón puedes hacer:

```bash
git init
git add .
git commit -m "Primera versión de Planeación Académica"
```

Luego crea un repositorio vacío en [github.com/new](https://github.com/new)
(sin marcar "Add a README") y copia los tres comandos que GitHub te
muestra ahí mismo bajo *"...or push an existing repository from the
command line"* (algo como):

```bash
git remote add origin https://github.com/TU-USUARIO/planeacion-academica.git
git branch -M main
git push -u origin main
```

## Paso 7 — De ahí en adelante: cambios y actualizaciones

Cada vez que modifiques algo del proyecto en VS Code:

1. Ve al panel de Control de código fuente (`Ctrl+Shift+G`).
2. Escribe un mensaje corto describiendo el cambio, en el cuadro de texto
   de arriba.
3. Haz clic en el botón de marca de verificación (**Commit**), y luego en
   **"Sincronizar cambios" / "Sync Changes"** para subirlo a GitHub.

Si conectaste el repositorio a Vercel (README, sección 3), cada vez que
subas cambios a la rama `main`, Vercel publica automáticamente una nueva
versión.

## Resumen del orden completo

1. Instalar Node.js, Git (VS Code ya lo tienes).
2. Descomprimir el proyecto y abrirlo en VS Code.
3. Crear la base de datos en Neon y correr `db/schema.sql`.
4. Crear `.env.local` con `DATABASE_URL` y `JWT_SECRET`.
5. `npm install` → `node scripts/seed.js` → `npm run dev` → probar en
   `http://localhost:3000`.
6. Publicar en GitHub desde el panel de Control de código fuente de
   VS Code.
7. (Opcional) Conectar ese repositorio a Vercel siguiendo el `README.md`.
