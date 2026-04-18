# birdybird Tickets

Lokales Ticket-System via Markdown-Files — gleiches Schema wie VogelSimulator.

## Workflow

1. Neue Tickets landen in `backlog/`
2. Beim Start der Arbeit → `in-progress/`
3. Nach Abschluss → `done/`
4. Geblockt? → `blocked/` (Verzeichnis bei Bedarf anlegen)

## Naming

`TXXX-short-title.md` (z.B. `T001-evaluate-iframe-test.md`)

## Template

```markdown
# TXXX: Title
**Priority:** P0/P1/P2 | **Phase:** 0-4 | **Size:** S/M/L/XL
**Depends on:** TXXX

## Description
Was getan werden muss.

## Acceptance Criteria
- [ ] Kriterium 1
- [ ] Kriterium 2
```
