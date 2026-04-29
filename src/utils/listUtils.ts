/**
 * Builds a unique key for an item to detect duplicates.
 * Normalizes name and brand to lowercase and trims whitespace.
 * @param item - The item containing name and brand.
 * @returns A string key representing the item.
 */
export const buildItemDuplicateKey = (item: {
    name?: string;
    brand?: string;
}) =>
    `${item.name?.trim().toLowerCase() ?? ""}::${item.brand?.trim().toLowerCase() ?? ""}`;
