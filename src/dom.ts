export function find<T extends Element>(selector: string, root: ParentNode = document): T {
  return root.querySelector<T>(selector)!;
}

export function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  properties: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = Object.assign(document.createElement(tag), properties);
  element.append(...children);
  return element;
}
