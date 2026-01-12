## Summary

<!-- Describe your changes: what was changed, why, and how it was affected -->

## Related Issues

<!-- Link to related issues (use "Closes #" for auto-closing) -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update

## How Has This Been Tested?

<!-- Describe how you tested your changes. Include test configuration and scenarios. -->

## Screenshots

<!-- If applicable, add screenshots to demonstrate the changes. Remove this section if not needed. -->

## Checklist

### General

- [ ] I have performed a self-review of my code
- [ ] Code follows style guide (`npm run lint` passes)
- [ ] Tests added/updated for changes
- [ ] All new and existing tests pass (`npm test`)
- [ ] Documentation updated (if applicable)

### ATProto Compliance (required for data flow changes)

- [ ] Compliance tests pass (`npm run test:compliance` — 100% required)
- [ ] No writes to user PDSes
- [ ] BlobRef storage only (never blob data)
- [ ] Indexes can be rebuilt from firehose
- [ ] PDS source is tracked for staleness detection

### Breaking Changes

<!-- If this is a breaking change, describe the migration path below -->

- [ ] N/A — no breaking changes
- [ ] Migration path documented
