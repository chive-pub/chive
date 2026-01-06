import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

// Import the auto-generated API sidebar
import apiSidebar from './api-docs/sidebar';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/introduction',
        'getting-started/quick-start',
        'getting-started/installation',
      ],
    },
    {
      type: 'category',
      label: 'User Guide',
      items: [
        'user-guide/searching',
        'user-guide/submitting-preprints',
        'user-guide/peer-review',
        'user-guide/endorsements',
        'user-guide/profiles',
        'user-guide/claiming-authorship',
        'user-guide/tags-and-classification',
        'user-guide/discovery-recommendations',
        'user-guide/sharing-to-bluesky',
      ],
    },
    {
      type: 'category',
      label: 'Developer Guide',
      items: [
        'developer-guide/README',
        'developer-guide/api-layer',
        'developer-guide/authentication-authorization',
        'developer-guide/core-business-services',
        'developer-guide/frontend',
        'developer-guide/observability-monitoring',
        {
          type: 'category',
          label: 'Services',
          items: [
            'developer-guide/services/README',
            'developer-guide/services/indexing',
            'developer-guide/services/discovery',
            'developer-guide/services/claiming',
          ],
        },
        {
          type: 'category',
          label: 'Plugins',
          items: [
            'developer-guide/plugins/README',
            'developer-guide/plugins/creating-plugins',
            'developer-guide/plugins/builtin-plugins',
          ],
        },
        'developer-guide/plugin-system',
        'developer-guide/advanced-features',
        {
          type: 'category',
          label: 'Storage',
          items: [
            'developer-guide/storage/postgresql',
            'developer-guide/storage/elasticsearch',
            'developer-guide/storage/neo4j',
            'developer-guide/storage/redis',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api-reference/overview',
        'api-reference/authentication',
        'api-reference/xrpc-endpoints',
        'api-reference/rest-endpoints',
        {
          type: 'link',
          label: 'Interactive API Docs',
          href: '/api-docs/chive-api',
        },
      ],
    },
    {
      type: 'category',
      label: 'Code Reference',
      items: [
        {
          type: 'link',
          label: 'Backend API',
          href: '/code-reference/backend',
        },
        {
          type: 'link',
          label: 'Frontend API',
          href: '/code-reference/frontend',
        },
      ],
    },
    {
      type: 'category',
      label: 'Concepts',
      items: ['concepts/at-protocol', 'concepts/knowledge-graph', 'concepts/data-sovereignty'],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: ['architecture/README'],
    },
    {
      type: 'category',
      label: 'Governance',
      items: [
        'governance/overview',
        'governance/voting-system',
        'governance/proposals',
        'governance/authority-control',
        'governance/moderation',
        'governance/governance-pds',
        'governance/organization',
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      items: [
        'operations/deployment',
        'operations/monitoring',
        'operations/scaling',
        'operations/troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/lexicons',
        'reference/configuration',
        'reference/environment-variables',
        'reference/cli-commands',
      ],
    },
  ],
  // API sidebar for the interactive API docs
  api: apiSidebar,
};

export default sidebars;
