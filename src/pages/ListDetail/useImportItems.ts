import { useEffect, useState } from "react";
import { useListsStore } from "../../store/useListsStore";
import type { Item as GlobalItem, ShoppingList } from "../../types";
import { buildItemDuplicateKey, mergeQuantities } from "../../utils/listUtils";

interface UseImportItemsParams {
    effectiveListId: string | undefined;
    isRecipeList: boolean;
    activeList: ShoppingList | null;
    items: GlobalItem[];
    normalLists: ShoppingList[];
    setError: (error: string | null) => void;
    fetchLists: () => Promise<void>;
}

const aggregateImportItems = (
    items: GlobalItem[],
    selectedImportItemIds: Set<string>,
) => {
    const aggregated = new Map<string, GlobalItem>();
    for (const item of items) {
        if (!selectedImportItemIds.has(item.id)) continue;
        const dupKey = buildItemDuplicateKey(item);
        const existing = aggregated.get(dupKey);
        if (existing) {
            aggregated.set(dupKey, {
                ...existing,
                quantity: mergeQuantities(existing.quantity, item.quantity),
            });
        } else {
            aggregated.set(dupKey, item);
        }
    }
    return aggregated;
};

export const useImportItems = ({
    effectiveListId,
    isRecipeList,
    activeList,
    items,
    normalLists,
    setError,
    fetchLists,
}: UseImportItemsParams) => {
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedTargetListId, setSelectedTargetListId] = useState("");
    const [selectedImportItemIds, setSelectedImportItemIds] = useState<
        Set<string>
    >(new Set());
    const [isImportingItems, setIsImportingItems] = useState(false);
    const [importNewListName, setImportNewListName] = useState("");

    const openImportModal = () => {
        const refreshedLists = useListsStore.getState().lists;
        const refreshedNormalLists = refreshedLists.filter(
            (list) =>
                list.id !== effectiveListId &&
                (list.category ?? "NORMAL") === "NORMAL",
        );

        setSelectedTargetListId((currentId) => {
            if (isRecipeList) return "NEW_LIST";
            if (refreshedNormalLists.some((list) => list.id === currentId)) {
                return currentId;
            }
            return refreshedNormalLists.length > 0
                ? refreshedNormalLists[0].id
                : "NEW_LIST";
        });

        setImportNewListName(activeList?.name ? `${activeList.name}` : "");
        setSelectedImportItemIds(new Set(items.map((item) => item.id)));
        setShowImportModal(true);
    };

    const toggleImportSelection = (itemId: string) => {
        setSelectedImportItemIds((prev) => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    };

    const clearImportState = () => {
        setShowImportModal(false);
        setSelectedImportItemIds(new Set());
        setIsImportingItems(false);
        setImportNewListName("");
    };

    useEffect(() => {
        if (
            !showImportModal ||
            selectedTargetListId === "NEW_LIST" ||
            normalLists.length === 0 ||
            normalLists.some((list) => list.id === selectedTargetListId)
        ) {
            return;
        }

        setSelectedTargetListId(normalLists[0].id);
    }, [normalLists, selectedTargetListId, showImportModal]);

    const resolveTargetListId = async (): Promise<string> => {
        if (selectedTargetListId !== "NEW_LIST") {
            return selectedTargetListId;
        }

        if (!importNewListName.trim()) {
            throw new Error("Please enter a name for the new list.");
        }

        const newList = await useListsStore
            .getState()
            .addList(importNewListName.trim(), "NORMAL");

        if (!newList) {
            throw new Error("Failed to create the new list.");
        }

        setSelectedTargetListId(newList.id);
        return newList.id;
    };

    const performItemsImport = async (targetList: ShoppingList) => {
        const existingMap = new Map(
            targetList.items.map((item: GlobalItem) => [
                buildItemDuplicateKey(item),
                item,
            ]),
        );

        const aggregated = aggregateImportItems(items, selectedImportItemIds);

        for (const [dupKey, item] of aggregated) {
            const existingItem = existingMap.get(dupKey);

            if (existingItem) {
                const mergedQty = mergeQuantities(
                    existingItem.quantity,
                    item.quantity,
                );
                const updated = await useListsStore
                    .getState()
                    .updateItem(targetList.id, existingItem.id, {
                        quantity: mergedQty,
                    });
                if (!updated) {
                    throw new Error(`Failed to update ${item.name}`);
                }
            } else {
                const added = await useListsStore
                    .getState()
                    .addItem(targetList.id, {
                        name: item.name,
                        checked: false,
                        brand: item.brand,
                        quantity: item.quantity,
                        price: item.price,
                        category: item.category,
                        isRecurrent: targetList.category === "FREQUENT",
                    });

                if (!added) {
                    throw new Error(`Failed to add ${item.name}`);
                }
            }
        }
    };

    const handleImportIntoNormalList = async () => {
        if (!selectedTargetListId) return;

        setIsImportingItems(true);
        setError(null);

        try {
            const targetListId = await resolveTargetListId();
            const targetList = useListsStore
                .getState()
                .lists.find((list) => list.id === targetListId);

            if (!targetList) {
                throw new Error("Target list could not be found.");
            }

            await performItemsImport(targetList);
            await fetchLists();
            clearImportState();
        } catch (importError) {
            const errorMessage =
                importError instanceof Error
                    ? importError.message
                    : "Failed to import the selected items.";
            setError(errorMessage);
            setIsImportingItems(false);
        }
    };

    return {
        showImportModal,
        setShowImportModal,
        selectedTargetListId,
        setSelectedTargetListId,
        selectedImportItemIds,
        setSelectedImportItemIds,
        isImportingItems,
        importNewListName,
        setImportNewListName,
        openImportModal,
        toggleImportSelection,
        clearImportState,
        handleImportIntoNormalList,
    };
};
