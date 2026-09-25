# Graph Report - result  (2026-09-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 675 nodes · 1660 edges · 24 communities (22 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- apiClient.ts
- webhookService.ts
- adminProducts.ts
- campaignService.ts
- src/index.ts
- web/package.json
- manager.ts
- aiProviderRepository.ts
- adminRoutes.ts
- AuthContext.tsx
- compilerOptions
- compilerOptions
- package.json
- utils/auth.ts
- dependencies
- test-concurrency.ts
- devDependencies
- authRoutes.ts
- scripts
- authMiddleware.ts
- openapi.ts
- test-tenant-isolation-manual.ts

## God Nodes (most connected - your core abstractions)
1. `express` - 28 edges
2. `useApiResource()` - 26 edges
3. `formatDateTime()` - 21 edges
4. `toPersianDigits()` - 19 edges
5. `asyncHandler()` - 19 edges
6. `ErrorBanner()` - 17 edges
7. `processAiForChat()` - 17 edges
8. `react` - 16 edges
9. `compilerOptions` - 16 edges
10. `runTenantCampaign()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `signJwt()`  [EXTRACTED]
  scripts/test-auth-utils.ts → src/utils/auth.ts
- `main()` --calls--> `verifyPassword()`  [EXTRACTED]
  scripts/test-auth-utils.ts → src/utils/auth.ts
- `main()` --calls--> `performLogin()`  [EXTRACTED]
  scripts/test-login-flow.ts → src/services/loginService.ts
- `main()` --calls--> `hashPassword()`  [EXTRACTED]
  prisma/seed.ts → src/utils/auth.ts
- `main()` --calls--> `signJwt()`  [EXTRACTED]
  scripts/test-auth-middleware.ts → src/utils/auth.ts

## Import Cycles
- None detected.

## Communities (24 total, 2 thin omitted)

### Community 0 - "apiClient.ts"
Cohesion: 0.06
Nodes (75): react, react-router-dom, Button(), Field(), Modal(), TextArea(), TextInput(), Layout() (+67 more)

### Community 1 - "webhookService.ts"
Cohesion: 0.09
Nodes (49): nodemailer, main(), startMockBaleApiServer(), main(), startMockBaleApiServer(), prisma, createAdHocContactFromChat(), findContactByBaleChatId() (+41 more)

### Community 2 - "adminProducts.ts"
Cohesion: 0.06
Nodes (43): multer, uuid, xlsx, main(), buildSampleExcelBuffer(), main(), main(), countContactsForUser() (+35 more)

### Community 3 - "campaignService.ts"
Cohesion: 0.07
Nodes (42): LogEntry, main(), sleep(), startTimingMockServer(), main(), ReceivedRequest, startMockSafirServer(), logActivity() (+34 more)

### Community 4 - "src/index.ts"
Cohesion: 0.07
Nodes (40): express, ref_path, swagger-ui-express, get(), main(), testAsyncHandlerDoesNotCrash(), testWithoutToken(), testWithToken() (+32 more)

### Community 5 - "web/package.json"
Cohesion: 0.05
Nodes (40): typescript, autoprefixer, @fontsource/vazirmatn, openapi-typescript, postcss, react-dom, tailwindcss, @types/react (+32 more)

### Community 6 - "manager.ts"
Cohesion: 0.12
Nodes (24): axios, ref_http, main(), startMockOpenAIServer(), main(), startMockServerThatFailsOneModel(), main(), startEchoServer() (+16 more)

### Community 7 - "aiProviderRepository.ts"
Cohesion: 0.10
Nodes (30): main(), ref_crypto, dotenv, main(), main(), createAiProvider(), CreateAiProviderInput, deleteAiProvider() (+22 more)

### Community 8 - "adminRoutes.ts"
Cohesion: 0.10
Nodes (21): main(), main(), listActivityForOwner(), listActivityForUser(), LogActivityInput, summarizeActivityByApiKey(), createApiKeyRecord(), getApiKeyOwnedByUser() (+13 more)

### Community 9 - "AuthContext.tsx"
Cohesion: 0.13
Nodes (14): MemoryStorage, main(), startMockApiServer(), AuthContext, AuthContextValue, AuthProvider(), authApi, buildUrl() (+6 more)

### Community 10 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noUnusedLocals (+10 more)

### Community 11 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "package.json"
Cohesion: 0.12
Nodes (15): description, tsx, main, name, version, prisma, @prisma/client, @types/bcryptjs (+7 more)

### Community 13 - "utils/auth.ts"
Cohesion: 0.27
Nodes (13): bcryptjs, jsonwebtoken, main(), buildTestUser(), main(), generateApiKey(), GeneratedApiKey, getJwtSecret() (+5 more)

### Community 14 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, axios, bcryptjs, dotenv, express, express-rate-limit, jsonwebtoken, multer (+5 more)

### Community 15 - "test-concurrency.ts"
Cohesion: 0.31
Nodes (10): main(), sleep(), testMutex(), fakeProcessMessage(), testMutexDifferentKeysNotBlocked(), testRateLimiter(), queues, runExclusive() (+2 more)

### Community 16 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, prisma, tsx, @types/bcryptjs, @types/express, @types/jsonwebtoken, @types/multer, @types/node (+4 more)

### Community 17 - "authRoutes.ts"
Cohesion: 0.24
Nodes (9): express-rate-limit, countUsers(), authLimiter, router, LoginableUser, LoginResult, performLogin(), signJwt() (+1 more)

### Community 18 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, postinstall, prisma:deploy, prisma:generate, prisma:migrate, seed (+1 more)

### Community 19 - "authMiddleware.ts"
Cohesion: 0.36
Nodes (7): get(), main(), AuthContext, Express, Request, requireAuth(), requireOwner()

### Community 20 - "openapi.ts"
Cohesion: 0.33
Nodes (5): components, $defs, operations, paths, webhooks

### Community 21 - "test-tenant-isolation-manual.ts"
Cohesion: 0.83
Nodes (3): api(), main(), randomEmail()

## Knowledge Gaps
- **183 isolated node(s):** `StatCardProps`, `RequestOptions`, `SchemaAdminApiKeySummary`, `SchemaApiKey`, `SchemaDashboardStatistics` (+178 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 225 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `src/index.ts` to `webhookService.ts`, `adminProducts.ts`, `campaignService.ts`, `manager.ts`, `aiProviderRepository.ts`, `adminRoutes.ts`, `package.json`, `authRoutes.ts`, `authMiddleware.ts`?**
  _High betweenness centrality (0.215) - this node is a cross-community bridge._
- **Why does `typescript` connect `web/package.json` to `package.json`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Why does `react` connect `apiClient.ts` to `AuthContext.tsx`, `web/package.json`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `StatCardProps`, `RequestOptions`, `SchemaAdminApiKeySummary` to the rest of the system?**
  _183 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `apiClient.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06052465233881163 - nodes in this community are weakly interconnected._
- **Should `webhookService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08653846153846154 - nodes in this community are weakly interconnected._
- **Should `adminProducts.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06370543541788427 - nodes in this community are weakly interconnected._