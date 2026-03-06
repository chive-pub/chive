# Peer review

Chive supports open peer review through threaded comments on eprints.

## Review types

### Inline annotations

Readers can annotate specific text in an eprint's PDF:

1. Select text in the PDF viewer
2. A selection tip appears on your first highlight to guide you
3. Click "Add Annotation" in the selection popover
4. Write your annotation using the rich text editor
5. Submit

The system captures the exact position of your selection using W3C Web Annotation selectors, including page number and bounding coordinates, so readers can navigate directly to the annotated text.

Annotations are stored as `pub.chive.annotation.comment` records in your AT Protocol PDS and indexed by Chive.

### Document-level reviews

For broader feedback not tied to a specific passage:

1. Open an eprint
2. Scroll to the discussion section
3. Click "Add Review"
4. Write your review
5. Submit

Reviews are stored as `pub.chive.review.comment` records and appear in the discussion section below the eprint.

## Threaded discussions

Comments support unlimited-depth threading:

- Reply to any comment to create a thread
- Threads can be collapsed/expanded
- Authors and reviewers can have back-and-forth discussions

## Writing a review

1. Open an eprint
2. Click "Add Comment" or select text for inline comments
3. Write your feedback
4. Submit

Your comment is stored in your PDS and indexed by Chive.

## Responding to comments

Authors can respond to comments:

1. Open the comment
2. Click "Reply"
3. Write your response
4. Submit

Responses appear threaded under the original comment.

## Review guidelines

### Be constructive

Focus on how the work can be improved. Avoid personal attacks.

### Be specific

Reference specific sections, figures, or claims. Use inline comments to point to exact text.

### Be timely

Engage promptly when authors respond to your feedback.

### Declare conflicts

Disclose any conflicts of interest in your comments.

## Review visibility

All comments on Chive are public and signed with your AT Protocol identity. This promotes accountability and reduces anonymous attacks.

## Deleting your reviews

You can delete reviews you have written:

1. Open the review you want to delete
2. Click the delete icon (visible only on your own reviews)
3. Confirm the deletion in the dialog

Deleted reviews are soft-deleted: they remain in the thread structure to preserve context, but their content is hidden. This maintains reply chain integrity while removing your content.

## Document location context

When viewing inline annotations on PDF text, the system shows a document location card indicating:

- Page number
- Excerpt of the selected text
- Quick navigation to the annotation location

Click the location card to scroll to that position in the document.

## Deleting comments

Authors can delete their own comments. Deleted comments display a tombstone message in the thread to preserve context for replies.
