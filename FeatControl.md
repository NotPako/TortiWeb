# FeatControl

## [2026-05-17] - Cierre manual de votación por el admin
**Descripción**: El admin puede cerrar la votación de la tortilla actual en cualquier momento desde `/vote`. La tortilla guarda un timestamp `closedAt`; mientras está abierta se muestran los controles habituales y un enlace discreto "Cerrar votación" al pie de la tarjeta de voto; al pulsarlo, `window.prompt` pide la contraseña (misma UX que el borrado en `TortillaManager`). Una vez cerrada, **la tortilla desaparece de `/vote`** (la vista vuelve al estado "aún no hay tortilla") pero permanece en el histórico con todos sus datos, comentarios y reacciones. El backend rechaza nuevos votos en tortillas con `closedAt`. La mutation es idempotente. `votingOpen` queda definido sólo en función de `closedAt` (no de la fecha), coherente con el modelo "última subida = abierta hasta cerrar manualmente o subir otra" ya existente.
**Archivos principales**:
- `src/models/Tortilla.ts` (campo opcional `closedAt: Date`)
- `src/graphql/typeDefs.ts` (campos `closedAt`, `votingOpen` en `Tortilla`; mutation `closeTortillaVoting`)
- `src/graphql/resolvers.ts` (resolver `closeTortillaVoting` con check de contraseña, guard en `castVote`, `votingOpen` calculado en `tortillaPayload`)
- `src/graphql/operations.ts` (campos en `TORTILLA_FIELDS`, `CLOSE_TORTILLA_VOTING_MUTATION`)
- `src/views/VotePage.tsx` (controles condicionados a `votingOpen`, botón de cierre, aviso de cerrado)
- `src/views/VotePage.module.css` (estilos `.closeLink` y `.closedNotice`)
- `src/lib/i18n.ts` (claves `vote.close.*`, ES + CA)
**Tecnologías**: Mongoose, Apollo `refetchQueries`, `window.prompt` (siguiendo convención de `TortillaManager`)
## [2026-05-17] - Sistema de logros en el perfil
**Descripción**: Cada perfil (propio y ajeno) muestra una rejilla de logros con emoji + título. Los desbloqueados van en color, los pendientes en gris con tooltip "Aún no desbloqueado". Lista inicial de 10 logros: hitos de votos (1/10/50), rachas (3/5/10), 10 perfecto, 0 implacable, primera vez siendo el voto más bajo de una tortilla, primera vez siendo el más alto. Los logros se calculan en cada request a partir de votos del usuario y agregaciones de min/max por tortilla — no requieren persistencia adicional.
**Archivos principales**:
- `src/lib/achievements.ts` (definiciones + función `computeAchievements`)
- `src/graphql/typeDefs.ts` (tipo `Achievement`, campo `UserStats.achievements`)
- `src/graphql/resolvers.ts` (cálculo en `computeUserStats` con batch query de votos relevantes)
- `src/graphql/operations.ts` (campo en `USER_STATS_FIELDS`)
- `src/components/features/AchievementsGrid.tsx` + `.module.css` (rejilla con ANTD Tooltip)
- `src/views/ProfilePage.tsx` (integración entre stats y best tortilla)
- `src/lib/i18n.ts` (claves `profile.achievements*` y `achievement.<id>.title|description` × 10, ES + CA)
**Tecnologías**: ANTD Tooltip, Mongoose batch queries

## [2026-05-17] - Comentarios por tortilla
**Descripción**: Cada tortilla tiene un hilo de comentarios libres (máx 500 caracteres). Visible y editable desde la página de votación (tortilla del día) y desde el modal del histórico. Los autores pueden borrar sus propios comentarios (con `Popconfirm`); resto sólo lectura. El avatar y el nombre del autor enlazan a su perfil público. Cuando se borra una tortilla, también se borran sus comentarios.
**Archivos principales**:
- `src/models/Comment.ts` (Mongoose schema: tortilla ref, userKey, userName, text, timestamps; índice `tortilla + createdAt`)
- `src/graphql/typeDefs.ts` (tipo `Comment`, `AddCommentInput`, `Tortilla.comments`, mutations `addComment`/`deleteComment`)
- `src/graphql/resolvers.ts` (resolvers de mutations + `Tortilla.comments` con batch lookup de avatares; limpieza en `deleteTortilla`)
- `src/graphql/operations.ts` (`COMMENT_FIELDS`, `ADD_COMMENT_MUTATION`, `DELETE_COMMENT_MUTATION`, campo en queries de tortilla)
- `src/components/features/CommentsSection.tsx` + `.module.css` (ANTD List + TextArea + Button + Popconfirm)
- `src/views/VotePage.tsx`, `src/views/HistoryPage.tsx` (integración + refetch)
- `src/lib/i18n.ts` (claves `comments.*`, ES + CA)
**Tecnologías**: ANTD List/TextArea/Popconfirm, Apollo `refetch`, Mongoose índice compuesto

## [2026-05-17] - Fix: avatar de NavBar no mostraba la foto en sesiones antiguas
**Descripción**: El avatar del NavBar (visible en móvil) leía la imagen de `session.user.image`, que se rellena desde `token.picture` en el JWT callback. Como ese callback sólo recarga de DB en login, `update()` o sesiones sin `usernameKey`, las sesiones creadas antes de la feature de foto de perfil tenían `token.picture` indefinido y se quedaban mostrando la inicial. Ahora el NavBar consulta `me` por GraphQL (con `cache-and-network`) como fuente de verdad para la imagen, con fallback a la sesión durante la primera carga. Tras subir una foto, también se refresca esta query además de las existentes.
**Archivos principales**:
- `src/graphql/operations.ts` (nueva `ME_QUERY`)
- `src/components/NavBar.tsx` (usa `me.imageUrl` para el avatar)
- `src/hooks/useProfileImageUpload.ts` (refetchea también `ME_QUERY`)
**Tecnologías**: Apollo Client `cache-and-network`

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
