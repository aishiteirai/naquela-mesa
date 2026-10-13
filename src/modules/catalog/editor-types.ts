import type { MenuOptionGroup, MenuProduct } from "./menu";

export type EditorSize = { id: string; name: string; maxFlavors: number };
export type EditorProduct = MenuProduct & { categoryId: string; active: boolean };
export type EditorCategory = { id: string; name: string; active: boolean; sizes: EditorSize[]; products: EditorProduct[] };
export type CatalogEditorView = { categories: EditorCategory[]; optionGroups: MenuOptionGroup[] };
