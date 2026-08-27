# Project Health Report

Forge module key: `project-health-report-page`  
Surface: **Jira project page**  
Forge app: legacy root app

## Code locations

- UI: `src/frontend/project-report.jsx`
- Resolver: `src/resolvers/project-report.js`
- Shared metrics: `src/report/`

## Constraint

Only one `jira:projectPage` per Forge app. Delivery Intelligence uses its own
Forge app for its project page.
