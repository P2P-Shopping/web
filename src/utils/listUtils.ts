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

const QUANTITY_RE = /^(\d+(?:[.,]\d+)?)\s*([a-zA-Z\u00C0-\u024F.]+)?$/;

type QuantityUnit = "g" | "kg" | "ml" | "l" | "pcs";

type ParsedQuantity = {
    value: number;
    unit: QuantityUnit;
};

const normalizeUnit = (rawUnit?: string): QuantityUnit | null => {
    if (!rawUnit?.trim()) return "pcs";

    const normalized = rawUnit
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\./g, "");

    switch (normalized) {
        case "g":
        case "gr":
        case "gram":
        case "grame":
        case "grams":
            return "g";
        case "kg":
        case "kilo":
        case "kilogram":
        case "kilograms":
        case "kilograme":
            return "kg";
        case "ml":
        case "mililitru":
        case "mililitri":
        case "milliliter":
        case "milliliters":
            return "ml";
        case "l":
        case "litru":
        case "litri":
        case "liter":
        case "liters":
            return "l";
        case "buc":
        case "bucata":
        case "bucati":
        case "pc":
        case "pcs":
        case "piece":
        case "pieces":
            return "pcs";
        default:
            return null;
    }
};

const parseQuantity = (qty?: string): ParsedQuantity | null => {
    if (!qty?.trim()) return null;

    const match = QUANTITY_RE.exec(qty.trim());
    if (!match) return null;

    const value = Number.parseFloat(match[1].replace(",", "."));
    if (Number.isNaN(value)) return null;

    const unit = normalizeUnit(match[2]);
    if (!unit) return null;

    return { value, unit };
};

const getFamily = (unit: QuantityUnit) => {
    switch (unit) {
        case "g":
        case "kg":
            return "weight";
        case "ml":
        case "l":
            return "volume";
        default:
            return "pieces";
    }
};

const toBaseUnit = ({ value, unit }: ParsedQuantity) => {
    switch (unit) {
        case "kg":
        case "l":
            return value * 1000;
        default:
            return value;
    }
};

const formatNumber = (value: number) => String(value);

const formatMergedQuantity = (baseValue: number, family: string) => {
    if (family === "weight") {
        return baseValue >= 1000
            ? `${formatNumber(baseValue / 1000)} kg`
            : `${formatNumber(baseValue)} g`;
    }

    if (family === "volume") {
        return baseValue >= 1000
            ? `${formatNumber(baseValue / 1000)} l`
            : `${formatNumber(baseValue)} ml`;
    }

    return `${formatNumber(baseValue)} buc`;
};

export const mergeQuantities = (
    existing?: string,
    incoming?: string,
): string => {
    const existingParsed = parseQuantity(existing);
    const incomingParsed = parseQuantity(incoming);

    if (existingParsed && incomingParsed) {
        const existingFamily = getFamily(existingParsed.unit);
        const incomingFamily = getFamily(incomingParsed.unit);

        if (existingFamily !== incomingFamily) {
            return incoming?.trim() || existing?.trim() || "1";
        }

        const totalBaseValue =
            toBaseUnit(existingParsed) + toBaseUnit(incomingParsed);

        return formatMergedQuantity(totalBaseValue, existingFamily);
    }

    return incoming?.trim() || existing?.trim() || "1";
};
