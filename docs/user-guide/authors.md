# Authors page

The authors page helps you discover researchers on Chive. Authenticated users with research fields on their profile see a personalized view; everyone else sees trending authors.

## Accessing the authors page

Click **Authors** in the main navigation to open the authors page.

## Personalized view

If you are signed in and have research fields on your profile, the page shows **Active in Your Fields**: authors who recently posted eprints in fields matching yours. Authors are sorted by recent activity.

If you are signed in but have not added research fields yet, you see a prompt to set up your profile. Click **Set Up Profile** to add fields in your dashboard settings.

### How personalization works

1. Chive reads the research fields from your profile
2. It searches for recent eprints in those fields
3. It extracts and deduplicates the authors from the results
4. Muted authors are filtered out (see below)

## Trending authors (default)

Anonymous users and users without fields see **Trending Authors**, a list of researchers with recent activity across all fields.

## Searching for authors

Use the search box at the top of the page to find a specific researcher by name or handle. Selecting an author navigates to their profile page. You can also search by DID if you know someone's AT Protocol identifier.

## Muting authors

You can mute an author to hide their content from personalized feeds and the authors page. Muting is private; the muted author is not notified.

### How to mute

1. Find the author on the authors page or on their profile
2. Click the **Mute** button (speaker icon)
3. The author's content is hidden from your personalized views immediately

### How to unmute

1. Find the muted author (via search, or on their profile page)
2. Click the **Unmute** button
3. Their content reappears in your personalized views

### What muting does

- Hides the author from your personalized authors feed
- Filters their eprints from personalized results on the browse and trending pages
- Does not affect search results (you can still find their work via search)
- Does not block the author or prevent them from seeing your work

### How muting works

Muting creates a `pub.chive.actor.mute` record in your PDS with the following fields:

| Field        | Type     | Description               |
| ------------ | -------- | ------------------------- |
| `subjectDid` | `did`    | DID of the muted author   |
| `createdAt`  | datetime | When the mute was created |

Because the mute record lives in your PDS, it persists across devices and sessions. Unmuting deletes the record from your PDS.

For unauthenticated users, mutes are stored in browser local storage and do not persist across devices.

## Next steps

- [Author profiles](./profiles): Setting up your scholarly identity
- [Searching](./searching): Finding eprints and authors
- [Tags and classification](./tags-and-classification): How fields organize content
