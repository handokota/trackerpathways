import { DataStructure } from "@/types";

interface GraphNode {
  id: string;
  group: number;
  val: number; 
}

interface GraphLink {
  source: string;
  target: string;
}

export function transformDataToGraph(data: DataStructure) {
  const nodes: Map<string, GraphNode> = new Map();
  const links: GraphLink[] = [];

  const addNode = (id: string) => {
    if (!nodes.has(id)) {
      nodes.set(id, { id, group: 1, val: 1 });
    } else {
      const node = nodes.get(id)!;
      node.val += 0.5; 
    }
  };

  Object.entries(data.routeInfo).forEach(([source, targets]) => {
    addNode(source);

    Object.keys(targets).forEach((target) => {
      addNode(target);
      links.push({ source, target });
    });
  });

  return {
    nodes: Array.from(nodes.values()),
    links
  };
}

export function findShortestPath(
  data: DataStructure,
  startNode: string,
  endNode: string
): string[] | null {
  if (startNode === endNode) return [startNode];

  const queue: string[][] = [[startNode]];
  const visited = new Set<string>();
  visited.add(startNode);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const node = path[path.length - 1];

    const targets = data.routeInfo[node];
    if (targets) {
      for (const neighbor of Object.keys(targets)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          const newPath = [...path, neighbor];
          if (neighbor === endNode) {
            return newPath;
          }
          queue.push(newPath);
        }
      }
    }
  }

  return null;
}