/**
 * Shared FlatList utility functions — avoids inline arrow re-creation.
 */

export const makeItemLayout = (height: number) =>
  (_: unknown, index: number) => ({ length: height, offset: height * index, index });

/** Standard 60px item layout for server/session lists */
export const ITEM_LAYOUT_60 = makeItemLayout(60);

/** Standard id-based key extractor */
export const keyExtractorById = (item: { id: string }) => item.id;
