/**
 * Positions for a citation network.
 *
 * @remarks
 * A citation network has no natural reading order, so it is laid out by
 * simulation: nodes push each other apart, citations pull their endpoints
 * together, and the clusters that result are the thing worth seeing. The old
 * view instead stacked citing papers in a column on the left and references in
 * a column on the right, which can only ever draw a star -- it has no way to
 * show that two of a paper's citers also cite each other.
 *
 * The simulation is deterministic. Positions are seeded from a hash of each
 * paper's URI rather than from a random number generator, and the iteration
 * count is fixed, so the same network lays out the same way every time it is
 * drawn. A layout that reshuffles on reload is one a reader cannot build any
 * memory of, and it makes the view untestable besides.
 *
 * @packageDocumentation
 */

/** A node to place. */
export interface LayoutNode {
  readonly id: string;
}

/** A link that pulls two nodes together. */
export interface LayoutLink {
  readonly source: string;
  readonly target: string;
}

/** Where a node ended up. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Knobs on the simulation, all with sensible defaults. */
export interface LayoutOptions {
  /** How far apart unconnected nodes settle. */
  readonly spacing?: number;
  /** How many rounds to run. */
  readonly iterations?: number;
  /**
   * The size a node is drawn at, so the layout can stop them overlapping.
   *
   * @remarks
   * The simulation treats nodes as points, which is fine for the shape of the
   * network and useless for reading it: two papers a hundred units apart
   * overlap completely when each is drawn a hundred and eighty units wide.
   */
  readonly nodeSize?: { readonly width: number; readonly height: number };
  /**
   * A node to place at the origin.
   *
   * @remarks
   * The whole layout is translated so this paper sits at (0, 0), which is what
   * lets the view open centred on the paper the reader arrived from without
   * having to search for it first.
   */
  readonly centerOn?: string;
}

/**
 * A small deterministic hash, used to seed a node's starting position.
 *
 * @param value - The string to hash
 * @returns A non-negative 32-bit integer
 *
 * @remarks
 * FNV-1a. Not for security -- only for turning a URI into a stable number, so
 * the same paper starts in the same place on every render.
 *
 * @public
 */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Lays out a citation network.
 *
 * @param nodes - The papers to place
 * @param links - The citations between them
 * @param options - Simulation settings
 * @returns A position per node
 *
 * @remarks
 * Fruchterman-Reingold: every pair repels, every link attracts, and the
 * displacement each round is capped by a temperature that cools linearly to
 * zero. The cooling is what makes a fixed iteration count enough -- the layout
 * stops moving because it is allowed to move less, not because it converged.
 *
 * The pairwise repulsion is quadratic in the number of nodes. That is the right
 * trade at the sizes a citation network reaches here: an exact layout of a few
 * hundred papers computed once, rather than an approximate one maintained every
 * frame.
 *
 * @public
 */
export function forceLayout(
  nodes: readonly LayoutNode[],
  links: readonly LayoutLink[],
  options: LayoutOptions = {}
): Map<string, Point> {
  const count = nodes.length;
  const positions = new Map<string, Point>();
  if (count === 0) return positions;

  const spacing = options.spacing ?? 170;
  const iterations = options.iterations ?? 300;

  // One node has nowhere to go.
  if (count === 1) {
    positions.set(nodes[0].id, { x: 0, y: 0 });
    return positions;
  }

  // Seed on a circle, ordered by a hash of the id. Deterministic, and spread
  // out enough that the first round of repulsion has a direction to work with:
  // nodes started at the same point repel by nothing, since the force is along
  // a vector of length zero.
  const radius = spacing * Math.sqrt(count);
  const index = new Map<string, number>();
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);

  const seeded = nodes
    .map((node) => ({ id: node.id, key: hashString(node.id) }))
    .sort((a, b) => a.key - b.key || a.id.localeCompare(b.id));

  seeded.forEach((node, i) => {
    index.set(node.id, i);
    const angle = (2 * Math.PI * i) / count;
    // A golden-ratio radial offset keeps the seed ring from being a perfect
    // circle, which the simulation would otherwise expand symmetrically.
    const r = radius * (0.35 + 0.65 * (((node.key / 0xffffffff) * 1.618) % 1));
    xs[i] = Math.cos(angle) * r;
    ys[i] = Math.sin(angle) * r;
  });

  const edges = links
    .map((link) => ({ source: index.get(link.source), target: index.get(link.target) }))
    .filter((edge): edge is { source: number; target: number } => {
      return edge.source !== undefined && edge.target !== undefined && edge.source !== edge.target;
    });

  const k = spacing;
  const dx = new Float64Array(count);
  const dy = new Float64Array(count);

  for (let step = 0; step < iterations; step += 1) {
    dx.fill(0);
    dy.fill(0);

    // Repulsion between every pair.
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        let deltaX = xs[i] - xs[j];
        let deltaY = ys[i] - ys[j];
        let distance = Math.hypot(deltaX, deltaY);
        if (distance < 0.01) {
          // Two nodes exactly on top of each other have no direction to
          // separate along, so give them one derived from their order.
          deltaX = (i - j) * 0.01;
          deltaY = 0.01;
          distance = Math.hypot(deltaX, deltaY);
        }
        const force = (k * k) / distance;
        const fx = (deltaX / distance) * force;
        const fy = (deltaY / distance) * force;
        dx[i] += fx;
        dy[i] += fy;
        dx[j] -= fx;
        dy[j] -= fy;
      }
    }

    // Attraction along citations.
    for (const edge of edges) {
      const deltaX = xs[edge.source] - xs[edge.target];
      const deltaY = ys[edge.source] - ys[edge.target];
      const distance = Math.max(Math.hypot(deltaX, deltaY), 0.01);
      const force = (distance * distance) / k;
      const fx = (deltaX / distance) * force;
      const fy = (deltaY / distance) * force;
      dx[edge.source] -= fx;
      dy[edge.source] -= fy;
      dx[edge.target] += fx;
      dy[edge.target] += fy;
    }

    // Cool linearly, so late rounds only refine.
    const temperature = k * 2 * (1 - step / iterations);
    for (let i = 0; i < count; i += 1) {
      const displacement = Math.hypot(dx[i], dy[i]);
      if (displacement < 0.0001) continue;
      const limited = Math.min(displacement, temperature);
      xs[i] += (dx[i] / displacement) * limited;
      ys[i] += (dy[i] / displacement) * limited;
    }
  }

  if (options.nodeSize) {
    separate(xs, ys, count, options.nodeSize.width, options.nodeSize.height);
  }

  // Put the focus at the origin, or the centroid when there is none.
  let originX = 0;
  let originY = 0;
  const focusIndex = options.centerOn !== undefined ? index.get(options.centerOn) : undefined;
  if (focusIndex !== undefined) {
    originX = xs[focusIndex];
    originY = ys[focusIndex];
  } else {
    for (let i = 0; i < count; i += 1) {
      originX += xs[i];
      originY += ys[i];
    }
    originX /= count;
    originY /= count;
  }

  for (const [id, i] of index) {
    positions.set(id, { x: Math.round(xs[i] - originX), y: Math.round(ys[i] - originY) });
  }

  return positions;
}

/**
 * Pushes overlapping nodes apart.
 *
 * @param xs - Node x positions, modified in place
 * @param ys - Node y positions, modified in place
 * @param count - How many nodes there are
 * @param width - The width each node is drawn at
 * @param height - The height each node is drawn at
 *
 * @remarks
 * Run after the simulation rather than during it, so it cannot distort the
 * shape the simulation found -- it only stops the result from being unreadable.
 * Each round separates any overlapping pair along whichever axis they overlap
 * least, which moves them the shortest distance that resolves it.
 *
 * A fixed, small number of rounds. Perfect separation is not always possible in
 * a dense graph and is not worth an unbounded loop; what matters is that labels
 * stop sitting on top of each other.
 */
function separate(
  xs: Float64Array,
  ys: Float64Array,
  count: number,
  width: number,
  height: number
): void {
  // A little air, so adjacent pills read as separate rather than as touching.
  const minX = width + 12;
  const minY = height + 10;

  for (let round = 0; round < 60; round += 1) {
    let moved = false;

    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        const dx = xs[j] - xs[i];
        const dy = ys[j] - ys[i];
        const overlapX = minX - Math.abs(dx);
        const overlapY = minY - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        moved = true;
        // Separate along the axis that needs the least movement. Scaled by the
        // axis extents so a wide node is not pushed a wide node's distance
        // vertically just because the vertical overlap is numerically smaller.
        if (overlapX / minX < overlapY / minY) {
          const push = (overlapX / 2) * (dx >= 0 ? 1 : -1);
          xs[i] -= push;
          xs[j] += push;
        } else {
          const push = (overlapY / 2) * (dy >= 0 ? 1 : -1);
          ys[i] -= push;
          ys[j] += push;
        }
      }
    }

    if (!moved) break;
  }
}
