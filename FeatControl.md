# FeatControl

## [2026-05-15] - Login con usuario+contraseña y Google
**Descripción**: Migración del login simple por nombre (localStorage) a autenticación real con NextAuth. Soporta credenciales (usuario+contraseña+email) y Google OAuth. Los usuarios de Google eligen su username en `/auth/setup-username`. Los votos antiguos se asocian automáticamente al registrarse con el mismo username gracias a `Vote.userKey`.
**Archivos principales**:
- `src/models/User.ts`
- `src/lib/auth.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/views/LoginPage.tsx`, `RegisterPage.tsx`, `SetupUsernamePage.tsx`
- `src/graphql/typeDefs.ts`, `resolvers.ts`, `operations.ts`
**Tecnologías**: NextAuth v4, bcryptjs, Google OAuth, Mongoose
**Notas**: Vars de entorno nuevas: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (ver `.env.example`).

## [2026-05-15] - Ordenación del historial por puntuación
**Descripción**: Control `Segmented` en la cabecera del historial para ordenar las tortillas por fecha (defecto) o por puntuación media descendente.
**Archivos principales**:
- `src/views/HistoryPage.tsx`
**Tecnologías**: ANTD Segmented, useMemo
