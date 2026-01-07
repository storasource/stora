/**
 * Context Pool Query Interface
 *
 * Provides high-level query methods for the app context,
 * including path finding and screen relationships.
 */

import type { AppContext, ScreenContext, NavigationEdge, TestableElement } from './types.js';

export class ContextPoolQuery {
  private context: AppContext;

  constructor(context: AppContext) {
    this.context = context;
  }

  /**
   * Find screen by name
   */
  findScreen(name: string): ScreenContext | undefined {
    return this.context.screens.find(
      (s) =>
        s.name.toLowerCase() === name.toLowerCase() ||
        s.name.toLowerCase().replace(/\s/g, '') === name.toLowerCase().replace(/\s/g, '')
    );
  }

  /**
   * Get initial screen
   */
  getInitialScreen(): ScreenContext | undefined {
    return this.context.screens.find((s) => s.navigation.isInitial);
  }

  /**
   * Get navigation path between two screens
   */
  getNavigationPath(from: string, to: string): NavigationEdge[] {
    const path = this.findShortestPath(from, to);
    const edges: NavigationEdge[] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.context.navigationGraph.edges.find(
        (e) => e.from.toLowerCase() === path[i].toLowerCase() && e.to.toLowerCase() === path[i + 1].toLowerCase()
      );
      if (edge) {
        edges.push(edge);
      }
    }

    return edges;
  }

  /**
   * Find shortest path using Dijkstra's algorithm
   */
  findShortestPath(from: string, to: string): string[] {
    const fromScreen = this.findScreen(from);
    const toScreen = this.findScreen(to);

    if (!fromScreen || !toScreen) {
      return [];
    }

    // Build adjacency list
    const graph = new Map<string, Array<{ node: string; weight: number }>>();
    for (const edge of this.context.navigationGraph.edges) {
      if (!graph.has(edge.from)) {
        graph.set(edge.from, []);
      }
      graph.get(edge.from)!.push({ node: edge.to, weight: edge.weight });
    }

    // Dijkstra's algorithm
    const distances = new Map<string, number>();
    const previous = new Map<string, string>();
    const unvisited = new Set<string>();

    // Initialize
    for (const screen of this.context.screens) {
      distances.set(screen.name, Infinity);
      unvisited.add(screen.name);
    }
    distances.set(fromScreen.name, 0);

    while (unvisited.size > 0) {
      // Find node with minimum distance
      let current: string | null = null;
      let minDist = Infinity;
      for (const node of unvisited) {
        const dist = distances.get(node)!;
        if (dist < minDist) {
          minDist = dist;
          current = node;
        }
      }

      if (current === null || current === toScreen.name) {
        break;
      }

      unvisited.delete(current);

      // Update distances to neighbors
      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        if (!unvisited.has(neighbor.node)) continue;

        const altDist = distances.get(current)! + neighbor.weight;
        if (altDist < distances.get(neighbor.node)!) {
          distances.set(neighbor.node, altDist);
          previous.set(neighbor.node, current);
        }
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | undefined = toScreen.name;

    while (current) {
      path.unshift(current);
      current = previous.get(current);
    }

    // If path doesn't start with 'from', no path exists
    if (path[0] !== fromScreen.name) {
      return [];
    }

    return path;
  }
}
