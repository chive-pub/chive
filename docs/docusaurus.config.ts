import path from 'path';
import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Chive Documentation',
  tagline: 'Decentralized eprint service built on AT Protocol',
  favicon: 'img/logo.svg',
  url: 'https://docs.chive.pub',
  baseUrl: '/',
  organizationName: 'chive-pub',
  projectName: 'chive',
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid', 'docusaurus-theme-openapi-docs'],

  plugins: [
    // Backend API documentation
    [
      'docusaurus-plugin-typedoc',
      {
        id: 'api-backend',
        entryPoints: [
          '../src/api/index.ts',
          '../src/auth/index.ts',
          '../src/types/index.ts',
          '../src/plugins/index.ts',
          '../src/observability/index.ts',
          '../src/atproto/index.ts',
        ],
        entryPointStrategy: 'expand',
        tsconfig: '../tsconfig.json',
        out: 'code-reference/backend',
        readme: 'none',
        sanitizeComments: true,
        treatWarningsAsErrors: false,
        sidebar: {
          autoConfiguration: false,
        },
      },
    ],
    // Frontend API documentation
    [
      'docusaurus-plugin-typedoc',
      {
        id: 'api-frontend',
        entryPoints: ['../web/lib/index.ts'],
        entryPointStrategy: 'expand',
        tsconfig: '../web/tsconfig.json',
        out: 'code-reference/frontend',
        readme: 'none',
        sanitizeComments: true,
        treatWarningsAsErrors: false,
        sidebar: {
          autoConfiguration: false,
        },
      },
    ],
    // OpenAPI plugin for REST/XRPC API documentation
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'api-docs',
        docsPluginId: 'classic',
        config: {
          chiveApi: {
            specPath: 'openapi/chive-api.json',
            outputDir: './api-docs',
            sidebarOptions: {
              groupPathsBy: 'tag',
            },
          },
        },
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          path: '.',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/chive-pub/chive/tree/main/docs/',
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
          exclude: [
            '**/node_modules/**',
            'src/**',
            'static/**',
            'blog/**',
            'openapi/**',
            '**/_*.md',
          ],
          docItemComponent: '@theme/ApiItem',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    navbar: {
      title: 'Chive',
      logo: {
        alt: 'Chive Logo',
        src: 'img/logo.svg',
        href: '/getting-started/introduction',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/api-docs/chive-api',
          label: 'API',
          position: 'left',
        },
        {
          to: '/code-reference/backend',
          label: 'Code',
          position: 'left',
        },
        {
          href: 'https://github.com/chive-pub/chive',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Getting Started', to: '/getting-started/introduction' },
            { label: 'User Guide', to: '/user-guide/searching' },
            { label: 'Developer Guide', to: '/developer-guide' },
            { label: 'API Reference', to: '/api-docs/chive-api' },
          ],
        },
        {
          title: 'Code Reference',
          items: [
            { label: 'Backend API', to: '/code-reference/backend' },
            { label: 'Frontend API', to: '/code-reference/frontend' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub Discussions', href: 'https://github.com/chive-pub/chive/discussions' },
            { label: 'Bluesky', href: 'https://bsky.app/profile/chive.pub' },
          ],
        },
        {
          title: 'More',
          items: [{ label: 'GitHub', href: 'https://github.com/chive-pub/chive' }],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Chive. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'typescript', 'json', 'cypher'],
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
