# SubShield Dashboard

Build a privacy-focused subscription and free-trial tracker dashboard web app called "SubShield". 

Create a modern, clean, and premium UI with a dark/light mode toggle. The app needs the following key pages and components:

1. Landing/Dashboard Page:

- A clean overview showing "Total Monthly Spend", "Active Subscriptions", and "Upcoming Renewals (Next 7 Days)".

- A dynamic timeline/calendar view highlighting upcoming payment dates.

- A main list of tracked subscriptions showing: Service Name/Logo, Cost, Renewal Date, Category, and a toggle for "Shared Plan".

- Next to each subscription, include a prominent "Cancel Subscription" button that links to a placeholder external URL.

2. "Add Subscription" Modal/Form:

- Fields for: Service Name, Cost, Billing Cycle (Monthly/Weekly/Annual), Next Renewal Date, and Category.

- A toggle option for "Connect Email Sync" with a mock "Sign in with Google/Outlook" secure button layout.

3. Shared Account Splitter Feature:

- When a subscription is tagged as "Shared", expand a sub-menu to add "Roommate/Partner Emails" and split percentages.

- Show a breakdown of what each person owes and mock integration buttons for "Send Venmo Request" or "Splitwise".

4. Notification Settings:

- A settings area to configure "Usage Vibe Checks" (e.g., alert me 3 days before renewal if inactive).

Use clean mockup data for the initial state so the dashboard looks fully functional immediately.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f447a15d-d724-4eff-b3da-ac5755af9bb2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
