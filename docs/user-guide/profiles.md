# Author profiles

Your Chive profile displays your scholarly identity and work.

## Profile components

### Basic information

- Display name
- Bio (Markdown supported)
- Avatar image
- Location (optional)
- Website URL (optional)

### Identifiers

Link external identifiers to verify your identity:

| Identifier          | Description                          |
| ------------------- | ------------------------------------ |
| ORCID               | Connects to your ORCID profile       |
| AT Protocol DID     | Your unique decentralized identifier |
| Institutional email | Verifies affiliation                 |

### Activity summary

- Eprints authored
- Reviews written
- Endorsements given
- Fields of expertise

## Setting up your profile

### Initial setup

Your profile is created automatically when you sign in. Basic information is pulled from your PDS profile.

### Adding ORCID

1. Go to Settings > Identifiers
2. Click "Link ORCID"
3. Authenticate with ORCID
4. Confirm the connection

ORCID linking is optional but recommended for identity verification.

### Updating information

1. Go to Settings > Profile
2. Edit fields as needed
3. Click "Save"

Changes sync to your PDS and appear immediately on Chive.

## Profile visibility

Profiles are public by default. The following information is always visible:

- Display name
- Bio
- Eprints authored
- Reviews and endorsements

The following can be hidden in settings:

- Email address
- Location
- Activity statistics

## Authors page

The `/authors` page shows a personalized list of authors relevant to your research. What you see depends on your profile configuration:

- **With research fields set**: Authors who recently posted eprints in your fields, sorted by activity. This helps you discover active researchers in your areas.
- **Without research fields**: Authors from trending eprints across all fields.
- **Anonymous visitors**: Authors from globally trending eprints.

Muted authors (see below) are excluded from this page.

## Muting authors

You can mute authors to hide their papers from feeds, discovery, and the authors page.

### How to mute

1. Visit an author's profile page
2. Click the **Mute** button (bell icon with a slash)
3. The author's papers are hidden immediately

### Where mutes apply

Muted authors are filtered from:

- The `/eprints` feed (New in Your Fields, trending)
- Related paper suggestions on eprint pages
- The `/authors` page
- Trending feeds

Mutes do not affect search results. Searching for a muted author or their papers still returns results.

### How mutes are stored

For authenticated users, mute records are stored in your PDS as `pub.chive.actor.mute` records. This makes your mute list portable across clients. A localStorage backup is maintained for offline access.

For unauthenticated users, mutes are stored in localStorage only and do not persist across devices.

### Unmuting

1. Visit the muted author's profile page
2. Click the **Unmute** button
3. Their papers reappear in feeds immediately

## Claiming eprints

If eprints were imported from external sources (e.g., arXiv) before you joined Chive, you can claim them:

1. Go to **Dashboard** > **Import Your Papers**
2. Review suggested papers or search for your paper
3. Click **Start Claim** to begin the import process
4. Your Chive client creates a record in your PDS

Claims with strong evidence (e.g., ORCID match) are processed automatically. Others may require co-author confirmation. See [Claiming authorship](./claiming-authorship) for details.

## Deleting your profile

You can delete your Chive profile at any time:

1. Go to Settings > Account
2. Click "Delete Account"
3. Confirm deletion

Deletion removes your profile from Chive but does not affect data in your PDS. Your eprints remain accessible via their AT URIs.
