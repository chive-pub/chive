# Collections

Collections let you organize eprints, reviews, endorsements, and knowledge graph nodes into curated groups. Collections are stored in your PDS and are fully portable. You control their visibility: listed or unlisted. Since collections are AT Protocol records in your PDS, they are always accessible to anyone who resolves the URI directly. The visibility setting controls whether Chive surfaces them in listings and search.

## What is a collection?

A collection is a user-owned container for grouping related items. Each item you add to a collection is wrapped as a personal graph node in your PDS, keeping your organizational choices independent of the original content.

Collections support nesting (subcollections), inter-item relationships (edges), and optional Cosmik mirroring for cross-platform integration.

## Creating a collection

1. Click **Create Collection** from the dashboard or navigate to `/collections/new`
2. **Basics**: enter a label, description, visibility (listed or unlisted), and optional tags
3. **Items**: add eprints, authors, graph nodes, or other items by searching
4. **Edges**: define relationships between items (optional)
5. **Structure**: set up subcollection hierarchy (optional)
6. **Cosmik**: enable Cosmik mirroring (optional)
7. **Review**: confirm your choices and create the collection

## Adding items to a collection

An **Add to Collection** button appears on eprint cards, review cards, endorsement panels, and node cards throughout Chive. Clicking it opens a dialog listing your collections. Select a collection to add the item. If the item is already in a collection, a checkmark indicates that.

To start a new collection with the item pre-populated, click **Create new collection** at the bottom of the dialog.

### Item types

| Item type   | Description             |
| ----------- | ----------------------- |
| Eprint      | Research paper          |
| Author      | Researcher profile      |
| Review      | Document-level review   |
| Endorsement | Formal endorsement      |
| Graph node  | Knowledge graph concept |

When you add an item to a subcollection, it is automatically propagated to all ancestor collections in the hierarchy.

## Subcollections and hierarchy

A subcollection belongs to a parent collection. You can nest collections to build reading lists, topic groups, or multi-level curricula.

```text
Machine Learning Reading List
  |-- NLP Papers
  |-- Computer Vision
```

Adding an item to a subcollection automatically adds it to all ancestors. Removing an item from a collection removes it from ancestors and descendants that contain the same item.

## Viewing collections

The collection detail page shows:

- Header with label, description, visibility, and owner
- Subcollections section with a tree of child collections
- Items list grouped by type (eprints, people, concepts, etc.)
- Inter-item edges
- Activity feed

When a collection has subcollections, a toggle lets you switch between:

- **All items**: items from this collection plus all subcollections
- **Direct only**: only items directly in this collection, excluding subcollection items

## Managing collection items

- **Edit** an item's label or note by clicking the item card to open the detail modal
- **Remove** an item by clicking the remove icon on the item card; removal propagates through the parent chain and subcollections
- **Reorder** items by dragging within a type group (owner only)

## Inter-item edges

You can create relationships between items in a collection. For example, you might link "Paper A cites Paper B" or "Dataset X supports Method Y."

Edges are defined during collection creation (in the Edges step of the wizard) or added later from the collection detail page by opening an item's detail modal. Delete edges from the edge list on the detail page.

## Collection dashboard

Access from **Dashboard > Collections**. The dashboard shows a hierarchical list with depth-based indentation. Each row displays:

- Collection label and description
- Item count
- Visibility badge (listed or unlisted)
- Tags
- Creation date

Use the **Show all / Top-level only** toggle to expand or collapse subcollections in the list.

## Deleting a collection

1. Open the collection detail page
2. Click the settings menu in the header
3. Select **Delete**

Subcollections of a deleted collection are re-linked to the deleted collection's parent. Items in the deleted collection are removed (not promoted to the parent).

## Visibility levels

| Level    | Behavior                                                        |
| -------- | --------------------------------------------------------------- |
| Listed   | Surfaced in public listings, search results, and tag filtering  |
| Unlisted | Accessible by direct link only, not shown in listings or search |

Since all collections are AT Protocol records in your PDS, they are always technically accessible to anyone who resolves the AT-URI directly. The visibility setting controls what Chive's AppView surfaces, not what exists.

## Next steps

- [Tags and classification](./tags-and-classification): Organizing eprints with fields and tags
- [Endorsements](./endorsements): Public signals of support for eprints
- [Searching](./searching): Finding eprints, collections, and authors
