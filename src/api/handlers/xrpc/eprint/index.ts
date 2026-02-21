/**
 * XRPC eprint handler exports.
 *
 * @packageDocumentation
 * @public
 */

export { deleteSubmission } from './deleteSubmission.js';
export { getChangelog } from './getChangelog.js';
export { getSubmission } from './getSubmission.js';
export { listByAuthor } from './listByAuthor.js';
export { listChangelogs } from './listChangelogs.js';
export { listCitations } from './listCitations.js';
export { listRelatedWorks } from './listRelatedWorks.js';
export { searchSubmissions } from './searchSubmissions.js';
export { updateSubmission } from './updateSubmission.js';

import { deleteSubmission } from './deleteSubmission.js';
import { getChangelog } from './getChangelog.js';
import { getSubmission } from './getSubmission.js';
import { listByAuthor } from './listByAuthor.js';
import { listChangelogs } from './listChangelogs.js';
import { listCitations } from './listCitations.js';
import { listRelatedWorks } from './listRelatedWorks.js';
import { searchSubmissions } from './searchSubmissions.js';
import { updateSubmission } from './updateSubmission.js';

/**
 * All eprint XRPC methods keyed by NSID.
 */
export const eprintMethods = {
  'pub.chive.eprint.deleteSubmission': deleteSubmission,
  'pub.chive.eprint.getChangelog': getChangelog,
  'pub.chive.eprint.getSubmission': getSubmission,
  'pub.chive.eprint.listByAuthor': listByAuthor,
  'pub.chive.eprint.listChangelogs': listChangelogs,
  'pub.chive.eprint.listCitations': listCitations,
  'pub.chive.eprint.listRelatedWorks': listRelatedWorks,
  'pub.chive.eprint.searchSubmissions': searchSubmissions,
  'pub.chive.eprint.updateSubmission': updateSubmission,
} as const;
