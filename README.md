# ShopFloor

A local-first CNC shop production board for tracking work orders, machine availability, and shift priorities.

## What the prototype does

- Shows active, queued, paused, and completed jobs with due dates, priority, machine assignment, operator initials, and progress.
- Adds and edits work orders from a form.
- Starts and completes jobs, and pauses or readies machines.
- Filters the queue by status and searches by job, part, material, or machine.
- Saves changes in the current browser with `localStorage`.

The included work orders and machines are sample data. This prototype does not yet have a shared database, authentication, live machine telemetry, or multi-user synchronization.

## Run locally

```sh
npm install
npm run dev
```

## Checks

```sh
npm run lint
npm run build
```
