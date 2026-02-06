/**
 * Graph algorithm computation job.
 *
 * @remarks
 * Runs periodically (typically nightly) to compute expensive graph algorithms:
 * - Community detection (Louvain, Label Propagation)
 * - PageRank
 * - Betweenness centrality
 *
 * Results are stored in both Neo4j node properties and Redis cache.
 *
 * Scheduling: this job should be scheduled via cron or similar. Suggested
 * schedule is nightly at 02:00 UTC when traffic is lowest.
 *
 * ATProto compliance: all operations are on AppView-specific data; no writes
 * to user PDSes; data is rebuildable from indexed records.
 *
 * @example
 * ```typescript
 * const job = new GraphAlgorithmJob({
 *   algorithms,
 *   cache,
 *   logger,
 * });
 *
 * // Run the job manually
 * await job.run();
 * ```
 *
 * @packageDocumentation
 * @public
 */

import type { GraphAlgorithmCache } from '../storage/neo4j/graph-algorithm-cache.js';
import type { GraphAlgorithms } from '../storage/neo4j/graph-algorithms.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';

/**
 * Graph projections to compute algorithms on.
 */
interface GraphConfig {
  /** Unique name for the graph projection */
  name: string;
  /** Neo4j node labels to include */
  nodeLabels: string[];
  /** Relationship types to include */
  relationshipTypes: string[];
}

/**
 * Default graph projections for algorithm computation.
 */
const DEFAULT_GRAPHS: readonly GraphConfig[] = [
  {
    name: 'fields-graph',
    nodeLabels: ['Field'],
    relationshipTypes: ['RELATED_TO', 'SUBFIELD_OF'],
  },
  {
    name: 'papers-graph',
    nodeLabels: ['Eprint'],
    relationshipTypes: ['CITES'],
  },
  {
    name: 'knowledge-graph',
    nodeLabels: ['Field', 'Eprint', 'Person'],
    relationshipTypes: ['RELATED_TO', 'CLASSIFIED_AS', 'AUTHORED', 'COAUTHORED_WITH'],
  },
] as const;

/**
 * Job configuration.
 *
 * @public
 */
export interface GraphAlgorithmJobConfig {
  /** Graph algorithms service */
  algorithms: GraphAlgorithms;
  /** Cache for storing results */
  cache: GraphAlgorithmCache;
  /** Logger instance */
  logger: ILogger;
  /** Custom graph configurations (optional) */
  graphs?: GraphConfig[];
  /** Whether to compute community detection (default: true) */
  computeCommunities?: boolean;
  /** Whether to compute PageRank (default: true) */
  computePageRank?: boolean;
  /** Whether to compute betweenness centrality (default: true) */
  computeBetweenness?: boolean;
  /** Whether to store results in Neo4j nodes (default: true) */
  storeInNeo4j?: boolean;
}

/**
 * Job execution result.
 *
 * @public
 */
export interface GraphAlgorithmJobResult {
  /** Whether the job succeeded */
  success: boolean;
  /** Number of graphs processed */
  graphsProcessed: number;
  /** Algorithms computed */
  algorithmsComputed: string[];
  /** Number of nodes with updated properties */
  nodesUpdated: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Error message if failed */
  error?: string;
  /** Per-graph results */
  graphResults: {
    graphName: string;
    nodeCount: number;
    relationshipCount: number;
    algorithmsRun: string[];
  }[];
}

/**
 * Job for computing and caching graph algorithms.
 *
 * @remarks
 * This job creates temporary in-memory graph projections, runs
 * expensive algorithms, caches results to Redis, optionally stores
 * results in Neo4j node properties, then drops the projections.
 *
 * @public
 */
export class GraphAlgorithmJob {
  private readonly algorithms: GraphAlgorithms;
  private readonly cache: GraphAlgorithmCache;
  private readonly logger: ILogger;
  private readonly graphs: readonly GraphConfig[];
  private readonly computeCommunities: boolean;
  private readonly computePageRank: boolean;
  private readonly computeBetweenness: boolean;
  private readonly storeInNeo4j: boolean;

  private isRunning = false;

  /**
   * Creates a new GraphAlgorithmJob.
   *
   * @param config - Job configuration
   */
  constructor(config: GraphAlgorithmJobConfig) {
    this.algorithms = config.algorithms;
    this.cache = config.cache;
    this.logger = config.logger;
    this.graphs = config.graphs ?? DEFAULT_GRAPHS;
    this.computeCommunities = config.computeCommunities ?? true;
    this.computePageRank = config.computePageRank ?? true;
    this.computeBetweenness = config.computeBetweenness ?? true;
    this.storeInNeo4j = config.storeInNeo4j ?? true;
  }

  /**
   * Runs the graph algorithm computation job.
   *
   * @returns Execution result
   */
  async run(): Promise<GraphAlgorithmJobResult> {
    if (this.isRunning) {
      this.logger.warn('GraphAlgorithmJob already running, skipping');
      return {
        success: false,
        graphsProcessed: 0,
        algorithmsComputed: [],
        nodesUpdated: 0,
        durationMs: 0,
        error: 'Job already running',
        graphResults: [],
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const algorithmsComputed: string[] = [];
    const graphResults: GraphAlgorithmJobResult['graphResults'] = [];
    let totalNodesUpdated = 0;

    try {
      this.logger.info('Starting GraphAlgorithmJob', {
        graphs: this.graphs.map((g) => g.name),
        computeCommunities: this.computeCommunities,
        computePageRank: this.computePageRank,
        computeBetweenness: this.computeBetweenness,
        storeInNeo4j: this.storeInNeo4j,
      });

      // Process each graph configuration
      for (const graphConfig of this.graphs) {
        const graphResult = await this.processGraph(graphConfig);
        graphResults.push({
          graphName: graphResult.graphName,
          nodeCount: graphResult.nodeCount,
          relationshipCount: graphResult.relationshipCount,
          algorithmsRun: graphResult.algorithmsRun,
        });
        totalNodesUpdated += graphResult.nodesUpdated;

        for (const algo of graphResult.algorithmsRun) {
          if (!algorithmsComputed.includes(algo)) {
            algorithmsComputed.push(algo);
          }
        }
      }

      // Compute global community detection (on knowledge-graph)
      if (this.computeCommunities) {
        const communityNodesUpdated = await this.computeGlobalCommunities();
        totalNodesUpdated += communityNodesUpdated;
        if (!algorithmsComputed.includes('louvain')) {
          algorithmsComputed.push('louvain');
        }
        if (!algorithmsComputed.includes('label-propagation')) {
          algorithmsComputed.push('label-propagation');
        }
      }

      const durationMs = Date.now() - startTime;

      this.logger.info('GraphAlgorithmJob completed', {
        graphsProcessed: this.graphs.length,
        algorithmsComputed,
        nodesUpdated: totalNodesUpdated,
        durationMs,
      });

      return {
        success: true,
        graphsProcessed: this.graphs.length,
        algorithmsComputed,
        nodesUpdated: totalNodesUpdated,
        durationMs,
        graphResults,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error('GraphAlgorithmJob failed', error instanceof Error ? error : undefined, {
        durationMs,
      });

      return {
        success: false,
        graphsProcessed: graphResults.length,
        algorithmsComputed,
        nodesUpdated: totalNodesUpdated,
        durationMs,
        error: errorMessage,
        graphResults,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process a single graph configuration.
   */
  private async processGraph(graphConfig: GraphConfig): Promise<{
    graphName: string;
    nodeCount: number;
    relationshipCount: number;
    algorithmsRun: string[];
    nodesUpdated: number;
  }> {
    const { name, nodeLabels, relationshipTypes } = graphConfig;
    const algorithmsRun: string[] = [];
    let nodesUpdated = 0;

    this.logger.debug('Processing graph', { graphName: name, nodeLabels, relationshipTypes });

    try {
      // Create graph projection
      const projection = await this.algorithms.projectGraph({
        name,
        nodeLabels,
        relationshipTypes,
      });

      this.logger.debug('Created graph projection', {
        graphName: name,
        nodeCount: projection.nodeCount,
        relationshipCount: projection.relationshipCount,
      });

      // Compute PageRank
      if (this.computePageRank) {
        try {
          const pageRankResults = await this.algorithms.pageRank(name, {
            maxIterations: 20,
            dampingFactor: 0.85,
          });

          await this.cache.setPageRank(name, pageRankResults);
          algorithmsRun.push('pagerank');

          // Write to Neo4j nodes if enabled
          if (this.storeInNeo4j && pageRankResults.length > 0) {
            const updated = await this.algorithms.writePageRankToNodes(pageRankResults);
            nodesUpdated += updated;

            this.logger.debug('Wrote PageRank to Neo4j nodes', {
              graphName: name,
              nodesUpdated: updated,
            });
          }

          this.logger.debug('Computed and cached PageRank', {
            graphName: name,
            resultCount: pageRankResults.length,
          });
        } catch (error) {
          this.logger.warn('Failed to compute PageRank', {
            graphName: name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Compute betweenness centrality
      if (this.computeBetweenness) {
        try {
          const betweennessResults = await this.algorithms.betweenness(name);

          await this.cache.setBetweenness(name, betweennessResults);
          algorithmsRun.push('betweenness');

          // Write to Neo4j nodes if enabled
          if (this.storeInNeo4j && betweennessResults.length > 0) {
            const updated = await this.algorithms.writeBetweennessToNodes(betweennessResults);
            nodesUpdated += updated;

            this.logger.debug('Wrote betweenness to Neo4j nodes', {
              graphName: name,
              nodesUpdated: updated,
            });
          }

          this.logger.debug('Computed and cached betweenness centrality', {
            graphName: name,
            resultCount: betweennessResults.length,
          });
        } catch (error) {
          this.logger.warn('Failed to compute betweenness', {
            graphName: name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Drop graph projection
      await this.algorithms.dropGraph(name);

      return {
        graphName: name,
        nodeCount: projection.nodeCount,
        relationshipCount: projection.relationshipCount,
        algorithmsRun,
        nodesUpdated,
      };
    } catch (error) {
      // Ensure projection is dropped even on error
      try {
        await this.algorithms.dropGraph(name);
      } catch {
        // Ignore drop errors
      }
      throw error;
    }
  }

  /**
   * Compute and cache global community detection.
   *
   * @returns Number of nodes updated with community IDs
   */
  private async computeGlobalCommunities(): Promise<number> {
    const graphName = 'community-detection-temp';
    let nodesUpdated = 0;

    try {
      // Create projection for community detection
      await this.algorithms.projectGraph({
        name: graphName,
        nodeLabels: ['Field', 'Eprint'],
        relationshipTypes: ['RELATED_TO', 'CLASSIFIED_AS', 'CITES'],
      });

      // Louvain community detection
      try {
        const louvainResults = await this.algorithms.louvain(graphName);
        await this.cache.setCommunities('louvain', louvainResults);

        // Write community IDs to Neo4j nodes if enabled
        if (this.storeInNeo4j && louvainResults.length > 0) {
          // Transform Community[] to { uri, communityId }[]
          const memberships = louvainResults.flatMap((community) =>
            community.members.map((uri) => ({ uri, communityId: community.communityId }))
          );

          if (memberships.length > 0) {
            const updated = await this.algorithms.writeCommunityToNodes(memberships, 'louvain');
            nodesUpdated += updated;

            this.logger.debug('Wrote Louvain communities to Neo4j nodes', {
              nodesUpdated: updated,
            });
          }
        }

        this.logger.debug('Computed and cached Louvain communities', {
          communityCount: louvainResults.length,
        });
      } catch (error) {
        this.logger.warn('Failed to compute Louvain communities', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Label propagation community detection
      try {
        const lpResults = await this.algorithms.labelPropagation(graphName);
        await this.cache.setCommunities('label-propagation', lpResults);

        // Write community IDs to Neo4j nodes if enabled
        if (this.storeInNeo4j && lpResults.length > 0) {
          // Transform Community[] to { uri, communityId }[]
          const memberships = lpResults.flatMap((community) =>
            community.members.map((uri) => ({ uri, communityId: community.communityId }))
          );

          if (memberships.length > 0) {
            const updated = await this.algorithms.writeCommunityToNodes(
              memberships,
              'label-propagation'
            );
            nodesUpdated += updated;

            this.logger.debug('Wrote Label Propagation communities to Neo4j nodes', {
              nodesUpdated: updated,
            });
          }
        }

        this.logger.debug('Computed and cached Label Propagation communities', {
          communityCount: lpResults.length,
        });
      } catch (error) {
        this.logger.warn('Failed to compute Label Propagation communities', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Drop projection
      await this.algorithms.dropGraph(graphName);

      return nodesUpdated;
    } catch (error) {
      // Ensure projection is dropped even on error
      try {
        await this.algorithms.dropGraph(graphName);
      } catch {
        // Ignore drop errors
      }
      throw error;
    }
  }

  /**
   * Checks if the job is currently running.
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Creates a simple interval-based scheduler for the job.
 *
 * @param job - The job to schedule
 * @param intervalMs - Interval between runs in milliseconds
 * @returns Object with start/stop methods
 *
 * @example
 * ```typescript
 * const scheduler = createGraphAlgorithmJobScheduler(job, 24 * 60 * 60 * 1000);
 * scheduler.start();
 * // Later...
 * scheduler.stop();
 * ```
 */
export function createGraphAlgorithmJobScheduler(
  job: GraphAlgorithmJob,
  intervalMs: number
): { start: () => void; stop: () => void } {
  let intervalId: NodeJS.Timeout | null = null;

  return {
    start: () => {
      if (intervalId) return;
      // Run immediately, then on interval
      void job.run();
      intervalId = setInterval(() => void job.run(), intervalMs);
    },
    stop: () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}
