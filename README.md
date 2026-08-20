# atlassian-first-app-test

A minimal Atlassian Forge **Jira issue-panel** app built with **UI Kit**. It
renders `Hello World!` in the Apps menu of a Jira issue.

## Prerequisites

- Node.js 22 or 24 (this project uses Node.js 22)
- A Forge CLI installation
- An Atlassian Cloud developer site with Jira
- `FORGE_EMAIL` and `FORGE_API_TOKEN` stored as environment secrets

Never commit or copy the credentials into this repository. The CLI reads them
from the environment; do not run `forge login` when using these secrets.

## First deployment

1. Create the Forge app using the CLI, selecting **Jira → UI Kit →
   jira-issue-panel**, with the name `atlassian-first-app-test`.
2. Copy the generated app ID into `manifest.yml`, replacing
   `REPLACE_WITH_FORGE_APP_ID`.
3. Run `forge lint`.
4. Run `forge deploy` and select the `development` environment.
5. Run `forge install`, then select Jira and enter the URL of your developer
   site (for example, `your-site.atlassian.net`).
6. Open a Jira issue, select **Apps**, and open **Hello World**.

The first `forge install` can prompt for the Jira site and permission approval.
Re-run `forge install` only for a new site or after a permission change.