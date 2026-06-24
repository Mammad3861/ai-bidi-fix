export interface BidiObserver {
  disconnect(): void;
  refresh(): void;
}

export function createBidiObserver(processRoot: (root: ParentNode) => void): BidiObserver {
  let frame: number | null = null;
  const pending = new Set<Node>();

  const flush = (): void => {
    frame = null;
    const roots = [...pending];
    pending.clear();
    roots.forEach((node) => {
      if (node.isConnected && (node instanceof Element || node instanceof Document)) processRoot(node);
    });
  };

  const queue = (node: Node): void => {
    pending.add(node.nodeType === Node.TEXT_NODE ? node.parentElement ?? document : node);
    if (frame === null) frame = requestAnimationFrame(flush);
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'characterData') queue(mutation.target);
      mutation.addedNodes.forEach(queue);
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  return {
    disconnect() {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      pending.clear();
    },
    refresh() {
      queue(document);
    },
  };
}
