# Backed

Build a new standalone web application called Backed.

DOMAIN

backedit.co

PRODUCT

Backed is a crowdfunding marketplace for things people want to exist.

The core idea is simple:

Creators, founders and builders launch a specific project or product.

People back it with money.

Each project has a funding goal and deadline.

If enough people back it, it gets funded.

Backed should initially focus on products and projects from internet creators, founders and builders, but the brand should NOT be positioned narrowly as "creator crowdfunding."

Think of this as a modern, extremely simple crowdfunding network.

CORE BRAND

Name: Backed

Primary tagline:

"Back things you want to exist."

The product language should naturally use:

Back it

Back this project

Backers

Amount backed

Fully backed

Get backed

Do NOT call the company "Backed It."

Backed It is only related to the domain backedit.co.

The visible brand everywhere should be BACKED / Backed.

DESIGN DIRECTION

Design this from scratch.

Do NOT make it look like:

- a generic SaaS dashboard

- an AI startup

- a crypto product

- a financial trading platform

- a corporate crowdfunding platform

I want Backed to feel like a major consumer internet marketplace.

Reference the product simplicity and visual confidence of companies like:

- Airbnb

- Kickstarter

- Stripe

- Linear

- early Dropbox

Do not copy their branding or layouts.

Characteristics:

- extremely clean

- lots of whitespace

- large product/project imagery

- strong typography

- simple navigation

- minimal borders

- subtle rounded corners

- restrained use of shadows

- mobile-first responsive design

- projects should be the visual focus

Avoid gradients, glassmorphism, excessive cards, giant decorative blobs, AI imagery and generic startup illustrations.

The interface should feel credible enough that someone would comfortably pledge $500 to a project.

Do not over-design it.

NAVIGATION

Desktop header:

Backed logo/text on left

Center/left navigation:

Discover

Right:

Search

Start a project

Sign in

Keep the navigation extremely simple.

HOMEPAGE

Hero:

"Back things you want to exist."

Supporting copy:

"Discover products and projects from people building what's next."

Primary CTA:

Explore projects

Secondary CTA:

Start a project

Below the hero, immediately show real-looking project cards.

SECTION:

"Projects worth backing"

Use a responsive marketplace grid.

Each project card should show:

- large 16:10 project image

- project title

- creator name/avatar

- short description

- amount backed

- funding goal

- progress bar

- percentage funded

- days remaining

Example:

Roach Founder Jacket

A limited-run jacket made for people building things on the internet.

by Alex MacGregor

$48,723 backed

65% funded

12 days left

Do not fill the homepage with marketing sections explaining every feature.

The PRODUCT is the marketing.

After the main project grid, include:

"New & noteworthy"

Another project grid.

Then a very simple creator CTA:

"Have something you want to make?"

Start a project →

PROJECT PAGE

This is the most important screen.

Route:

/projects/[slug]

Large project hero image.

Project title.

One-sentence description.

Creator identity:

avatar

name

username if available

Funding module should prominently display:

$48,723

backed of $75,000 goal

327 backers

12 days to go

Progress bar

Large primary CTA:

"Back this project"

Below:

Story

Updates

Backers

The Story tab should support:

- large images

- headings

- paragraphs

- embedded media later

Create a sticky backing module on desktop where appropriate.

On mobile, make the Back button highly accessible.

Backing should feel like buying something, not donating to charity.

BACKING UI

For now create the UI only.

When someone clicks "Back this project", open a clean backing flow.

Example reward/product:

Founder Jacket

$149

Includes:

- 1 Founder Jacket

- Worldwide shipping calculated later

- Estimated delivery: March 2027

CTA:

Back this project — $149

Do NOT implement real Stripe payment yet unless payment infrastructure is already configured.

AUTHENTICATION

Use X as the primary authentication method.

Button:

"Continue with X"

The initial target users are creators/builders with existing internet identities.

Request only the minimum read-only permissions required for authentication and identity.

We do NOT need permission to:

- post

- edit X profiles

- send DMs

- follow accounts

Store basic identity where available:

- X user ID

- username

- display name

- avatar

IMPORTANT:

Do not fabricate an email address if X does not provide one.

Architect users so additional authentication methods such as Google/email can be added later without requiring a completely different user model.

If Supabase is used, implement authentication and database architecture securely using Supabase.

CREATOR DASHBOARD

Route:

/dashboard

Keep this extremely simple.

Header:

"Your projects"

Show project cards with:

- project

- status

- amount backed

- backers

- days remaining

Primary CTA:

"Start a project"

Do NOT create analytics dashboards full of graphs.

CREATE PROJECT

Route:

/start

Create a simple multi-step form.

STEP 1 — Project

Project name

Short description

Category

Cover image

STEP 2 — Funding

Funding goal

Deadline

STEP 3 — What backers get

Product/reward name

Price

Description

Estimated delivery

STEP 4 — Story

Long-form project story

Additional images

STEP 5 — Preview

Show exactly how the public campaign will appear.

CTA:

Launch project

For V1, one primary product/reward per campaign is enough.

Do NOT build complicated reward tiers yet.

DISCOVERY

Route:

/discover

Marketplace grid of projects.

Basic categories can include:

Technology

Design

Fashion

Games

Publishing

Food

Other

Include simple search and category filtering.

Do not build complicated recommendation algorithms.

DATA MODEL

Create a sensible minimal schema for:

users/profiles

projects

project rewards/products

backings

project updates

A project should have statuses such as:

draft

live

funded

unsuccessful

completed

A backing should be associated with:

- project

- backer

- amount

- reward/product

- payment status

Do not create unnecessary tables.

IMPORTANT PRODUCT RULES

Backed is NOT:

- equity crowdfunding

- investment crowdfunding

- donations

- Patreon

- a creator social feed

- a generic ecommerce store

- an AI product generator

Backers are supporting a specific project/product they want to see made.

The initial model is reward/preorder crowdfunding.

Do not use language suggesting buyers receive equity, securities, ownership or financial returns.

TECHNICAL QUALITY

Use a clean, maintainable architecture.

Use reusable components for:

- project cards

- creator identity

- progress indicators

- buttons

- project funding module

Ensure:

- responsive mobile layout

- accessible controls

- sensible loading states

- empty states

- error states

- secure authentication

- database access controls/RLS where applicable

Do not add features beyond this specification.

PRIORITY ORDER

1. Brand/visual identity

2. Homepage/discovery

3. Project page

4. Authentication

5. Creator dashboard

6. Create-project flow

7. Data architecture

For the initial build, prioritize making the public marketplace feel polished and real.

I should be able to open the generated app and immediately understand:

"This is where I discover and back things I want to exist."

Do not add extra features simply because they are common in crowdfunding products.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/49a03029-56ff-4675-b5c8-3af8ef0eede4).

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
