export interface BidiObserver {
  disconnect(): void;
  refresh(): void;
}

export function createBidiObserver(processRoot: (root: ParentNode) => void): BidiObserver {
  let scheduled = false;
  let timeout: number | null = null;
  const pending = new Set<Node>();

  const runWhenIdle = (callback: () => void): void => {
    const requestIdle = window.requestIdleCallback as
      | ((handler: IdleRequestCallback, options?: IdleRequestOptions) => number)
      | undefined;
    if (requestIdle) {
      requestIdle(callback, { timeout: 500 });
      return;
    }
    requestAnimationFrame(callback);
  };

  const flush = (): void => {
    scheduled = false;
    if (timeout !== null) {
      window.clearTimeout(timeout);
      timeout = null;
    }
    const roots = [...pending];
    pending.clear();
    roots.forEach((node) => {
      if (node.isConnected && (node instanceof Element || node instanceof Document)) processRoot(node);
    });
  };

  const isExtensionOwnedNode = (node: Node): boolean => {
    const element = node instanceof Element ? node : node.parentElement;
    return Boolean(
      element?.closest(
        [
          '[data-bidifix-line="true"]',
          '[data-bidifix-inline-ltr="true"]',
        ].join(','),
      ),
    );
  };

  const queue = (node: Node): void => {
    if (isExtensionOwnedNode(node)) return;
    pending.add(node.nodeType === Node.TEXT_NODE ? node.parentElement ?? document : node);
    if (scheduled) return;
    scheduled = true;
    timeout = window.setTimeout(() => runWhenIdle(flush), 120);
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
      if (timeout !== null) window.clearTimeout(timeout);
      scheduled = false;
      pending.clear();
    },
    refresh() {
      queue(document);
    },
  };
}
