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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  Repositories,
  CodeRepository,
  DataRepository,
  Preregistration,
} from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface RepositoriesPanelProps {
  repositories?: Repositories;
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
// COMPONENTS
// =============================================================================

/**
 * Single repository card.
 */
function RepositoryCard({
  url,
  label,
  platform,
  config,
  doi,
}: {
  url?: string;
  label?: string;
  platform?: string;
  config: Record<string, PlatformConfig>;
  doi?: string;
}) {
  if (!url) return null;

  const platformConfig = config[platform ?? 'other'] ?? config.other;
  const Icon = platformConfig.icon;
  const displayLabel = label || platformConfig.label;

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

  const platformConfig =
    PREREG_PLATFORM_CONFIG[prereg.platform ?? 'other'] ?? PREREG_PLATFORM_CONFIG.other;
  const Icon = platformConfig.icon;

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
            {platformConfig.label}
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
export function RepositoriesPanel({ repositories, className }: RepositoriesPanelProps) {
  if (!repositories) return null;

  const { code, data, preregistration, protocols, materials } = repositories;

  const hasCode = code && code.length > 0;
  const hasData = data && data.length > 0;
  const hasPreregistration = preregistration?.url;
  const hasProtocols = protocols && protocols.length > 0;
  const hasMaterials = materials && materials.length > 0;

  const hasAny = hasCode || hasData || hasPreregistration || hasProtocols || hasMaterials;

  if (!hasAny) return null;

  // Count total resources
  const totalCount =
    (code?.length ?? 0) +
    (data?.length ?? 0) +
    (preregistration?.url ? 1 : 0) +
    (protocols?.length ?? 0) +
    (materials?.length ?? 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Code className="h-4 w-4" />
          Resources & Repositories
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
                  label={repo.label}
                  platform={repo.platform}
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
                  label={repo.label}
                  platform={repo.platform}
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
                  platform={protocol.platform}
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
      </CardContent>
    </Card>
  );
}
