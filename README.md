# TortiWeb

Aplicación web para puntuar las tortillas que cocináis cada miércoles. Los usuarios entran con su nombre, votan del 0 al 10 (con decimales) la tortilla del día, y pueden consultar el historial completo con notas medias y fotos.

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **MongoDB** + **Mongoose** para metadatos (nombre, fecha, votos)
- **Cloudflare R2** (S3-compatible) para almacenamiento de imágenes
- **Apollo Server** sobre una API Route (`/api/graphql`) y **Apollo Client** en el frontend
- **Tailwind CSS** para los estilos
- **i18n** español + catalán con LanguageContext

## Estructura

```
src/
  app/
    api/graphql/route.ts        # Endpoint GraphQL (Apollo Server)
    api/image/[id]/route.ts     # Sirve la imagen binaria desde Mongo
    page.tsx                    # Login con nombre
    vote/page.tsx               # Votar la tortilla actual
    history/page.tsx            # Histórico con notas medias
    admin/page.tsx              # Crear nueva tortilla (solo admin)
    layout.tsx, globals.css
  components/                   # ApolloWrapper, UserContext, NavBar, VoteSlider
  graphql/                      # typeDefs, resolvers, operations cliente
  lib/                          # mongodb, apolloClient
  models/                       # Tortilla, Vote
```

## Requisitos

- Node.js ≥ 18.18
- Una instancia de MongoDB. Opciones:
  - Local: `mongod` en `mongodb://127.0.0.1:27017`
  - Cloud: cluster gratuito de [MongoDB Atlas](https://www.mongodb.com/atlas)

## Configuración

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Copia el archivo de ejemplo y rellena las variables:
   ```bash
   cp .env.local
  

## Arrancar en desarrollo

```bash
npm run dev
```

La app estará en `http://localhost:3000`. El playground de GraphQL queda expuesto en `http://localhost:3000/api/graphql` (puedes consultar el esquema con introspección).

## Cómo se usa

1. **Identificarse** en `/` introduciendo tu nombre. Se guarda en `localStorage`.
2. El **admin** entra a `/admin`, escribe el nombre de la tortilla, sube la foto desde el dispositivo e introduce la contraseña configurada en `ADMIN_PASSWORD`.
3. El resto del grupo va a `/vote` y puntúa del 0 al 10 (con decimales). Cada persona tiene un único voto por tortilla; al volver a votar se actualiza la nota.
4. En `/history` aparece la galería completa con la nota media de cada tortilla.

## Build de producción

```bash
npm run build
npm run start
```

## Notas

- Las imágenes se almacenan en un bucket **Cloudflare R2** (S3-compatible). En MongoDB solo guardamos la `imageKey` (ruta del objeto en el bucket).
- Si en el bucket has habilitado *Public Development URL* (R2.dev) o un dominio personalizado, configura `R2_PUBLIC_URL` y las imágenes se servirán **directamente desde Cloudflare** (más rápido, no consume invocaciones de Netlify). Si no, se proxean vía `/api/image/[id]` que descarga el objeto de R2.
- El tamaño máximo por imagen es **4 MB** (límite alineado con los 6 MB de payload de Netlify Functions). Cámbialo en `src/graphql/resolvers.ts` y `src/app/admin/page.tsx` si lo necesitas.
- La autenticación es deliberadamente simple (un nombre en `localStorage`); no es un sistema de seguridad real, sino una forma cómoda de identificar a cada votante. La unicidad del voto se basa en el nombre normalizado (minúsculas + trim).
- Si despliegas en Vercel u otro entorno serverless, asegúrate de usar MongoDB Atlas (o un Mongo accesible vía red) y de configurar `MONGODB_URI` y `ADMIN_PASSWORD` como variables de entorno.
