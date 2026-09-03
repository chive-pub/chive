'use client';

/**
 * Repositories panel for eprint pages.
 *
 * @remarks
 * Displays code, data, and model repositories as beautiful cards
 * with platform-specific icons and colors.
 *
 * @packageDocumentation
 */

import { ExternalLink, Github, Database, Code, Box, FlaskConical, FileText } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatasetSnippet } from '@/components/eprints/dataset-snippet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Repositories, Preregistration } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A kind of attached resource.
 *
 * @public
 */
export type RepositoryKind = 'code' | 'data' | 'preregistration' | 'protocols' | 'materials';

export interface RepositoriesPanelProps {
  repositories?: Repositories;
  /**
   * Render only these kinds.
   *
   * @remarks
   * The eprint page gives code and data their own tabs, so each needs the
   * panel to show one kind rather than all of them. Omitted, every kind
   * renders, which is what the metadata view wants.
   */
  only?: readonly RepositoryKind[];
  /** Heading for the card; defaults to naming every kind */
  title?: string;
  className?: string;
}

// =============================================================================
// PLATFORM CONFIG
// =============================================================================

interface PlatformConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

/**
 * Platform configuration for code repositories.
 */
const CODE_PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  github: {
    label: 'GitHub',
    icon: Github,
    color: 'text-gray-900 dark:text-gray-100',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  gitlab: {
    label: 'GitLab',
    icon: Code,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
  },
  bitbucket: {
    label: 'Bitbucket',
    icon: Code,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
  },
  huggingface: {
    label: 'Hugging Face',
    icon: Box,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
  },
  paperswithcode: {
    label: 'Papers With Code',
    icon: FileText,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950',
  },
  codeberg: {
    label: 'Codeberg',
    icon: Code,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
  },
  sourcehut: {
    label: 'SourceHut',
    icon: Code,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-900',
  },
  tangled: {
    label: 'Tangled',
    icon: Code,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
  },
  software_heritage: {
    label: 'Software Heritage',
    icon: Code,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
  },
  colab: {
    label: 'Google Colab',
    icon: Code,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
  },
  kaggle: {
    label: 'Kaggle',
    icon: Code,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50 dark:bg-sky-950',
  },
  other: {
    label: 'Code',
    icon: Code,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-900',
  },
};

/**
 * Platform configuration for data repositories.
 */
const DATA_PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  layers: {
    label: 'Layers',
    icon: Database,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50 dark:bg-violet-950',
  },
  huggingface: {
    label: 'Hugging Face',
    icon: Box,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
  },
  zenodo: {
    label: 'Zenodo',
    icon: Database,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
  },
  figshare: {
    label: 'Figshare',
    icon: Database,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
  },
  kaggle: {
    label: 'Kaggle',
    icon: Database,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50 dark:bg-sky-950',
  },
  dryad: {
    label: 'Dryad',
    icon: Database,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
  },
  osf: {
    label: 'OSF',
    icon: Database,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950',
  },
  dataverse: {
    label: 'Dataverse',
    icon: Database,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
  },
  mendeley_data: {
    label: 'Mendeley Data',
    icon: Database,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
  },
  wandb: {
    label: 'Weights & Biases',
    icon: Database,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
  },
  other: {
    label: 'Data',
    icon: Database,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-900',
  },
};

/**
 * Platform configuration for pre-registration.
 */
const PREREG_PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  osf: {
    label: 'OSF',
    icon: FlaskConical,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950',
  },
  aspredicted: {
    label: 'AsPredicted',
    icon: FlaskConical,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 dark:bg-teal-950',
  },
  clinicaltrials: {
    label: 'ClinicalTrials.gov',
    icon: FlaskConical,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
  },
  prospero: {
    label: 'PROSPERO',
    icon: FlaskConical,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
  },
  other: {
    label: 'Pre-registration',
    icon: FlaskConical,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-900',
  },
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Normalizes a platform slug for icon/color lookup.
 *
 * @param platformSlug - Platform slug from lexicon (e.g., "github", "huggingface")
 * @returns Normalized slug matching config keys
 */
/**
 * The Layers record types a dataset reference can name.
 *
 * @remarks
 * A dataset is addressed by AT-URI rather than by URL, and the two Layers
 * record types worth loading have different loaders in `lairs`. A collection is
 * the dataset as a whole; a corpus is one part of one.
 */
const LAYERS_COLLECTION = 'pub.layers.catalog.collection';
const LAYERS_CORPUS = 'pub.layers.corpus.corpus';

/**
 * Classifies a repository reference.
 *
 * @param url - The value stored in the entry's `url` field
 * @returns Which Layers record the reference names, `record` for any other
 * AT-URI, or `null` when it is an ordinary web URL
 *
 * @remarks
 * `repositories.data[].url` is declared as a URI and rendered as a link, but a
 * dataset published on Layers has no web address to put there -- Layers' web
 * routing is not settled and the record is the durable identifier. So an AT-URI
 * turns up in a field whose contract is "a URL a browser can open", and
 * rendering it as an anchor produces a link that cannot be followed. This tells
 * the two apart so each is rendered as what it is.
 */
function atUriKind(url: string): 'collection' | 'corpus' | 'record' | null {
  if (!url.startsWith('at://')) return null;
  if (url.includes(`/${LAYERS_COLLECTION}/`)) return 'collection';
  if (url.includes(`/${LAYERS_CORPUS}/`)) return 'corpus';
  return 'record';
}

function normalizePlatformSlug(platformSlug?: string): string {
  if (!platformSlug) return 'other';
  return platformSlug;
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Single repository card.
 */
/**
 * Reads the platform slug from a repository entry.
 *
 * @param repo - A repository from the record
 * @returns The slug, from whichever field the record uses
 *
 * @remarks
 * The lexicon names this `platformSlug`, and that is what the submission
 * wizard writes. Records created before the field was named that carry
 * `platform` instead, and they are still in people's repositories — Chive does
 * not rewrite user records. Reading both means an older eprint shows its
 * GitHub or OSF icon rather than falling back to the generic one.
 */
function platformSlugOf(repo: { platformSlug?: string; platform?: string }): string | undefined {
  return repo.platformSlug ?? repo.platform;
}

function RepositoryCard({
  url,
  recordUri,
  label,
  platformSlug,
  config,
  doi,
}: {
  url?: string;
  /** AT-URI of the record, when the resource lives in an ATProto application */
  recordUri?: string;
  label?: string;
  /** Platform slug from lexicon (e.g., "github", "huggingface") */
  platformSlug?: string;
  config: Record<string, PlatformConfig>;
  doi?: string;
}) {
  if (!url && !recordUri) return null;

  // `recordUri` is where a record reference belongs; `url` is an address a
  // browser can open. Records written before the data shape had `recordUri`
  // put at-uris in `url`, so both are read -- the dedicated field first, the
  // legacy placement after it.
  const reference = recordUri ?? url ?? '';
  const atKind = atUriKind(reference);

  // Normalize platform slug for icon/color lookup
  const normalizedSlug = atKind ? 'layers' : normalizePlatformSlug(platformSlug);
  const platformConfig = config[normalizedSlug] ?? config.other;
  const Icon = platformConfig.icon;
  // Use label if provided, otherwise platform config label
  const displayLabel = label || platformConfig.label;

  // An AT-URI is not a browser address. Rendering it as an anchor gives a link
  // that does nothing and an icon promising it opens somewhere, so the card
  // drops both and offers the way in that does work: the URI itself, and the
  // code that loads it.
  if (atKind) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
        <div className={cn('shrink-0 p-2 rounded-md', platformConfig.bgColor)}>
          <Icon className={cn('h-5 w-5', platformConfig.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{displayLabel}</span>
            <Badge variant="outline" className="text-xs shrink-0">
              {platformConfig.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground break-all mt-0.5">{reference}</p>
          {atKind === 'collection' && <DatasetSnippet catalogRef={reference} />}
          {atKind === 'corpus' && <DatasetSnippet corpusRef={reference} />}
        </div>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
    >
      <div className={cn('shrink-0 p-2 rounded-md', platformConfig.bgColor)}>
        <Icon className={cn('h-5 w-5', platformConfig.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{displayLabel}</span>
          <Badge variant="outline" className="text-xs shrink-0">
            {platformConfig.label}
          </Badge>
        </div>
        {doi && <p className="text-xs text-muted-foreground truncate mt-0.5">DOI: {doi}</p>}
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </a>
  );
}

/**
 * Pre-registration card.
 */
function PreregistrationCard({ prereg }: { prereg: Preregistration }) {
  if (!prereg.url) return null;

  // Normalize platform slug for icon/color lookup
  const normalizedSlug = normalizePlatformSlug(platformSlugOf(prereg));
  const platformConfig = PREREG_PLATFORM_CONFIG[normalizedSlug] ?? PREREG_PLATFORM_CONFIG.other;
  const Icon = platformConfig.icon;
  // Use platform config label for display
  const displayPlatform = platformConfig.label;

  return (
    <a
      href={prereg.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
    >
      <div className={cn('shrink-0 p-2 rounded-md', platformConfig.bgColor)}>
        <Icon className={cn('h-5 w-5', platformConfig.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">Pre-registration</span>
          <Badge variant="outline" className="text-xs shrink-0">
            {displayPlatform}
          </Badge>
        </div>
        {prereg.registrationDate && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Registered: {new Date(prereg.registrationDate).toLocaleDateString()}
          </p>
        )}
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </a>
  );
}

/**
 * Repositories panel component.
 *
 * @param props - Component props
 * @returns Repositories panel element
 */
export function RepositoriesPanel({
  repositories,
  only,
  title,
  className,
}: RepositoriesPanelProps) {
  if (!repositories) return null;

  const { code, data, preregistration, protocols, materials } = repositories;
  const shows = (kind: RepositoryKind): boolean => !only || only.includes(kind);

  const hasCode = shows('code') && code && code.length > 0;
  const hasData = shows('data') && data && data.length > 0;
  const hasPreregistration = shows('preregistration') && preregistration?.url;
  const hasProtocols = shows('protocols') && protocols && protocols.length > 0;
  const hasMaterials = shows('materials') && materials && materials.length > 0;

  const hasAny = hasCode || hasData || hasPreregistration || hasProtocols || hasMaterials;

  if (!hasAny) return null;

  // Count total resources
  const totalCount =
    (hasCode ? (code?.length ?? 0) : 0) +
    (hasData ? (data?.length ?? 0) : 0) +
    (hasPreregistration ? 1 : 0) +
    (hasProtocols ? (protocols?.length ?? 0) : 0) +
    (hasMaterials ? (materials?.length ?? 0) : 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Code className="h-4 w-4" />
          {title ?? 'Resources & Repositories'}
          <Badge variant="secondary" className="ml-1">
            {totalCount}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Code Repositories */}
        {hasCode && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Github className="h-4 w-4" />
              Code
            </h4>
            <div className="space-y-2">
              {code!.map((repo, index) => (
                <RepositoryCard
                  key={`code-${index}`}
                  url={repo.url}
                  recordUri={repo.recordUri}
                  label={repo.label}
                  platformSlug={platformSlugOf(repo)}
                  config={CODE_PLATFORM_CONFIG}
                />
              ))}
            </div>
          </div>
        )}

        {/* Data Repositories */}
        {hasData && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data & Models
            </h4>
            <div className="space-y-2">
              {data!.map((repo, index) => (
                <RepositoryCard
                  key={`data-${index}`}
                  url={repo.url}
                  recordUri={repo.recordUri}
                  label={repo.label}
                  platformSlug={platformSlugOf(repo)}
                  config={DATA_PLATFORM_CONFIG}
                  doi={repo.doi}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pre-registration */}
        {hasPreregistration && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Pre-registration
            </h4>
            <PreregistrationCard prereg={preregistration!} />
          </div>
        )}

        {/* Protocols */}
        {hasProtocols && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Protocols
            </h4>
            <div className="space-y-2">
              {protocols!.map((protocol, index) => (
                <RepositoryCard
                  key={`protocol-${index}`}
                  url={protocol.url}
                  label="Protocol"
                  platformSlug={platformSlugOf(protocol)}
                  config={{
                    protocols_io: {
                      label: 'protocols.io',
                      icon: FileText,
                      color: 'text-blue-600',
                      bgColor: 'bg-blue-50 dark:bg-blue-950',
                    },
                    bio_protocol: {
                      label: 'Bio-protocol',
                      icon: FileText,
                      color: 'text-green-600',
                      bgColor: 'bg-green-50 dark:bg-green-950',
                    },
                    other: {
                      label: 'Protocol',
                      icon: FileText,
                      color: 'text-gray-600',
                      bgColor: 'bg-gray-50 dark:bg-gray-900',
                    },
                  }}
                  doi={protocol.doi}
                />
              ))}
            </div>
          </div>
        )}

        {/* Materials */}
        {hasMaterials && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Box className="h-4 w-4" />
              Materials
            </h4>
            <div className="space-y-2">
              {materials!.map((material, index) => (
                <div
                  key={`material-${index}`}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Box className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{material.label || 'Material'}</p>
                      {material.rrid && (
                        <p className="break-all text-xs text-muted-foreground font-mono">
                          RRID: {material.rrid}
                        </p>
                      )}
                    </div>
                  </div>
                  {material.url && (
                    <a
                      href={material.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
