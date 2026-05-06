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

const parseNumericQuantity = (qty?: string): number | null => {
    if (!qty) return null;
    const trimmed = qty.trim();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const num = Number.parseFloat(match[1]);
    return Number.isNaN(num) ? null : num;
};

export const mergeQuantities = (
    existing?: string,
    incoming?: string,
): string => {
    const existingNum = parseNumericQuantity(existing);
    const incomingNum = parseNumericQuantity(incoming);

    if (existingNum !== null && incomingNum !== null) {
        return String(existingNum + incomingNum);
    }

    return incoming?.trim() || existing?.trim() || "1";
};
