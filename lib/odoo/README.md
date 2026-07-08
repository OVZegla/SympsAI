# lib/odoo — Odoo integration (Phase 9, later / out of V1 scope)

The cahier des charges places Odoo explicitly **later, via MCP** and marks it as
NOT part of V1 (spec §4, §9, §58 Phase 9). This directory holds the seam so the
integration can be added without touching the rest of the app — there is
deliberately no live implementation yet.

## Intended flow (spec §58 Phase 9, §67)

```
Symp's AI → Odoo client (via MCP) → sold machine → serial number → history
```

A client calls, the operator selects the client, and the machine (with its
serial number and configuration) is retrieved from Odoo, then matched to a local
`machines` row — enriching diagnosis with sales/maintenance context.

## Why MCP

Anthropic's Model Context Protocol is the intended standard for connecting the
assistant to external systems (spec §58). An Odoo MCP server would expose
read tools (lookup client, lookup machine by serial) that plug into the existing
tool framework in `lib/ai/tools.ts` — the same "explicit tools, never arbitrary
access" rule applies (CLAUDE.md).

## Seam

- `clients.odoo_external_id` and `machines` already exist to hold the mapping to
  Odoo records (see supabase/migrations/0002_catalog.sql).
- When implemented: add `lib/odoo/client.ts` (MCP client), read-only tools in
  `lib/ai/tools.ts`, and a sync/lookup action. Keep all Odoo credentials
  server-side (spec §47) and audit any write-back.
