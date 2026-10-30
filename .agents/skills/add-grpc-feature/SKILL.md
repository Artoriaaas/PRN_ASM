---
name: add-grpc-feature
description: >-
  End-to-end runbook for adding or modifying a gRPC API method, domain event, or
  vertical feature across Protobuf, .NET 8 microservice layers, Envoy Gateway,
  and React ConnectRPC frontend in PRN_ASM. Activate whenever the user asks to
  create, change, or wire up an API endpoint, RPC, or cross-service event.
---

# Add or Modify a gRPC Feature (End-to-End Runbook)

Follow these 6 steps in order. Never skip Step 1 (Contract-First).

## Step 1 — Define the Contract in `proto/`
1. Open or create `proto/sudoku/<domain>/v1/<domain>.proto` (`syntax = "proto3"`).
   - Keep `csharp_namespace = "Sudoku.<Domain>.V1"`.
   - **Security rule**: Never add `user_id` to client Request messages for authenticated actions; the backend must read the caller's Firebase UID from JWT claim `"sub"`.
2. If the feature emits or consumes a cross-service Kafka event, define the event message in `proto/sudoku/events/v1/events.proto`.

## Step 2 — Generate Stubs (Backend & Frontend)
1. **Backend (`.csproj`)**: Ensure the target service's `.csproj` declares `<Protobuf>` items with `ProtoRoot="../../../proto"`:
   - `GrpcServices="Server"` for the service's own `.proto`.
   - `GrpcServices="Client"` for another service's `.proto` it calls synchronously.
   - `GrpcServices="None"` for `events.proto`.
   - Run `dotnet build PRN_ASM.sln` so `Grpc.Tools` generates the C# classes.
2. **Frontend (`web/`)**: Run `npm run gen` inside `web/` to regenerate `web/src/gen/**` via Buf.
   - Note: `@bufbuild/protoc-gen-es` v2 generates both message schemas and the `GenService` descriptor inside `*_pb.ts` (there is no `*_connect.ts`).

## Step 3 — Implement Data Layer (`services/<Svc>/<Svc>.Api/Data/`)
*(Skip if the RPC does not touch PostgreSQL.)*
1. Add/update Entity in `Domain/Entities/` and EF Fluent configuration in `Data/Configurations/`.
2. Add composite or partial indexes for every new `WHERE` + `ORDER BY` pattern (see `docs/OPTIMIZATION.md` §2.3).
3. Add repository methods in `Data/Repositories/`:
   - **Read**: `.AsNoTracking()` + `.Select(...)` directly to Protobuf/Read DTO + `.Take(limit)` + `CancellationToken ct`.
   - **Write**: mutate aggregate root only; **do not** call `SaveChangesAsync()` inside the repository.

## Step 4 — Implement Domain Logic & Messaging (`Domain/`, `Messaging/`)
1. Implement the use-case in `Domain/Services/`, propagating `CancellationToken ct`.
2. For writes: stage all entity changes + any `OutboxMessage` (`Topic = "sudoku.events"`, `Type = nameof(EventMsg)`, `UserId = userId`, `Payload = eventMsg.ToByteArray()`), then call `await uow.SaveChangesAsync(ct)` **once**.
3. If consuming a Kafka event in another service: check & insert `InboxMessage` (`EventId`, `HandlerName`) in the same DB transaction before applying side effects.
4. If calling another microservice via gRPC client: read URL from `Configuration["Services:<Name>"]`, set `deadline: DateTime.UtcNow.AddSeconds(3)`, pass `ct`, and catch `RpcException`.

## Step 5 — Expose gRPC Endpoint & Check Envoy (`Grpc/`, `Program.cs`, `gateway/envoy.yaml`)
1. Override the RPC method in `Grpc/*GrpcService.cs`:
   - Apply `[Authorize]` (or `[AllowAnonymous]` if public) and `[Authorize(Policy = "Admin")]` for admin-only RPCs.
   - Extract caller UID via `context.GetHttpContext().User.FindFirst("sub")?.Value`.
   - Pass `context.CancellationToken` down to the Domain service.
   - Translate domain validation/not-found errors to `RpcException` with standard `StatusCode`.
2. Register new services/repositories/clients in `Program.cs`.
3. **Check `gateway/envoy.yaml`**:
   - Existing package prefixes (`/sudoku.{game,user,support,multi}.v1.`) are already routed. Add a new route + cluster if introducing a new package.
   - **Public RPC check**: `envoy.yaml` enforces Firebase JWT on catch-all prefix `'/'` and only bypasses JWT for explicit prefixes listed **above** `'/'` (e.g., `GetRules`, `ListTutorials`, `ListNotices`). If the new RPC is public/anonymous, add its full path `/sudoku.<pkg>.v1.<Service>/<Method>` above the `'/'` rule in `jwt_authn.rules`.

## Step 6 — Wire Frontend (`web/src/`) & Verify
1. Import the service from `../gen/sudoku/<domain>/v1/<domain>_pb` and call it through the Envoy Gateway client (`http://localhost:8080`).
2. Follow `web/AGENTS.md`: pass `AbortController` `signal` in `useEffect`, use `getCachedSync`/`fetchDeduped` for repeatable reads, update state directly from mutation responses, and guard submit buttons against double-clicks.
3. **Verify everything builds cleanly**:
   - `dotnet build PRN_ASM.sln`
   - `cd web && npm run lint && npm run build`
