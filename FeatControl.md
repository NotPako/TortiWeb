# FeatControl

## [2026-05-17] - Foto de perfil subible por el usuario
**Descripción**: El usuario puede subir y reemplazar su foto de perfil desde `/profile`, mediante un control de ANTD `Upload` situado junto al avatar grande de la cabecera. La imagen se almacena en R2 (clave `users/<userId>-<uuid>.<ext>`), se sirve directamente desde `R2_PUBLIC_URL` o como fallback a través de `/api/user-image/[id]`. La nueva URL aparece automáticamente en: el avatar del NavBar (vía refresh de sesión de NextAuth), la cabecera del perfil (propio y ajeno) y los avatares del modal de votos del historial. Si el usuario es de Google y no ha subido nada, se sigue usando la URL del avatar de Google como fallback.
**Archivos principales**:
- `src/models/User.ts` (campos `imageKey`, `imageContentType`; helper `userImageUrl`)
- `src/app/api/user-image/[id]/route.ts` (proxy R2 para avatares)
- `src/graphql/typeDefs.ts` (campos `imageUrl` en `User`, `UserStats`, `Vote`; input y mutation `setProfileImage`)
- `src/graphql/resolvers.ts` (resolver `setProfileImage` con upload a R2 y limpieza del anterior; batch lookup de imágenes en `Tortilla.votes`)
- `src/graphql/operations.ts` (`SET_PROFILE_IMAGE_MUTATION`, `imageUrl` en queries)
- `src/lib/auth.ts` (`token.picture` y `session.user.image` se rellenan desde DB)
- `src/hooks/useProfileImageUpload.ts` (hook encapsula validación, base64, mutación y refresh de sesión)
- `src/views/ProfilePage.tsx` (cabecera con `Avatar` + `Upload`)
- `src/views/HistoryPage.tsx` (avatar del modal usa `vote.imageUrl`)
- `src/lib/i18n.ts` (`profile.changePhoto`, `profile.uploadSuccess`, `profile.uploadError`)
**Tecnologías**: Cloudflare R2 (AWS SDK S3), ANTD Upload/Avatar/Button, NextAuth `update()`, Apollo refetchQueries

## [2026-05-16] - Perfiles públicos reutilizables
**Descripción**: `ProfilePage` se reutiliza para mostrar el perfil de cualquier usuario, no solo el propio. Nueva ruta dinámica `/profile/[username]` que renderiza el mismo componente pasando el username como prop. En el modal de votos del historial, el avatar y el nombre de cada votante son ahora links al perfil de ese usuario (cierran el modal al navegar). Para usuarios sin cuenta (legacy votes), el resolver cae al `userName` guardado en el primer voto.
**Archivos principales**:
- `src/app/profile/[username]/page.tsx` (ruta dinámica)
- `src/views/ProfilePage.tsx` (prop `username?`, branch `myStats` vs `userStats`)
- `src/graphql/typeDefs.ts` (campo `username` en `UserStats`, query `userStats(username)`)
- `src/graphql/resolvers.ts` (helper `computeUserStats(userKey)`, resolver `userStats`)
- `src/graphql/operations.ts` (`USER_STATS_FIELDS` compartido, `USER_STATS_QUERY`)
- `src/views/HistoryPage.tsx` (avatar y nombre como `Link`)
- `src/lib/i18n.ts` (`profile.titleFor`, `profile.noVotesOther`, etiquetas neutralizadas)
**Tecnologías**: Next.js dynamic routes, GraphQL queries parametrizadas

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

## [2026-05-16] - Perfil de usuario con estadísticas personales
**Descripción**: Nueva página `/profile` accesible haciendo clic en el nombre de usuario de la navbar. Muestra el total de tortillas votadas, la nota media que da el usuario, la mejor tortilla votada y el historial completo de votos con imagen, nombre y fecha de cada tortilla.
**Archivos principales**:
- `src/app/profile/page.tsx`
- `src/views/ProfilePage.tsx`, `ProfilePage.module.css`
- `src/graphql/typeDefs.ts` (tipos `UserStats`, `PersonalVote`, `TortillaSummary`, query `myStats`)
- `src/graphql/resolvers.ts` (resolver `myStats` con populate)
- `src/graphql/operations.ts` (query `MY_STATS_QUERY`)
- `src/components/NavBar.tsx` (username → link a /profile)
- `src/lib/i18n.ts` (claves `profile.*`)
**Tecnologías**: Apollo Client + GraphQL, Mongoose populate, ANTD Statistic/List/Avatar

## [2026-05-16] - Reacciones rápidas en los votos
**Descripción**: Al votar aparecen 4 botones de reacción rápida opcionales (🔥 Perfecta, 😋 Muy rica, 😐 Normalita, 😬 Mejorable). La reacción se guarda junto al voto y se muestra en el modal de votos del historial y en el perfil de usuario.
**Archivos principales**:
- `src/models/Vote.ts` (campo `reaction` opcional, enum)
- `src/components/features/ReactionPicker.tsx`, `ReactionPicker.module.css`
- `src/graphql/typeDefs.ts` (enum `Reaction`, campo en `Vote` y `CastVoteInput`)
- `src/graphql/resolvers.ts` (castVote actualizado)
- `src/graphql/operations.ts` (mutation y queries actualizados)
- `src/views/VotePage.tsx` (integración ReactionPicker)
- `src/views/HistoryPage.tsx` (emoji en lista de votos)
- `src/lib/i18n.ts` (claves `reaction.*`)
**Tecnologías**: Mongoose enum field, ANTD Tag

## [2026-05-15] - Ordenación del historial por puntuación
**Descripción**: Control `Segmented` en la cabecera del historial para ordenar las tortillas por fecha (defecto) o por puntuación media descendente.
**Archivos principales**:
- `src/views/HistoryPage.tsx`
**Tecnologías**: ANTD Segmented, useMemo
