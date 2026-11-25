export function find<T extends Element>(selector: string, root: ParentNode = document): T {
  return root.querySelector<T>(selector)!;
}
