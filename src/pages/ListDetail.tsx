import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import stompClient from "../services/socketService";

interface Item {
	id: string; // Added unique ID
	name: string;
	checked: boolean;
}

class SyncPayloadBuilder {
	private payload: Record<string, any> = {
		eventType: "ITEM_TOGGLED",
		timestamp: Date.now(),
	};

	setListId(listId: string) {
		this.payload.listId = listId;
		return this;
	}

	setItemId(itemId: string) {
		this.payload.itemId = itemId;
		return this;
	}

	setChecked(checked: boolean) {
		this.payload.checked = checked;
		return this;
	}

	build() {
		return JSON.stringify(this.payload);
	}
}

// Sanitize strings to reduce risk of storing/executing malicious payloads.
const sanitizeString = (input: unknown): string => {
	const s = String(input ?? "");

	// Remove any <script>...</script> blocks entirely
	const withoutScripts = s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");

	// Escape angle brackets and ampersands so stored values cannot be
	// interpreted as HTML if later injected into the DOM unsafely.
	return withoutScripts.replace(/[<>&]/g, (c) =>
		c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
	);
};

const sanitizeItemsForStorage = (items: Item[]): Item[] =>
	items.map((item) => ({
		id: String(item.id),
		name: sanitizeString(item.name),
		checked: Boolean(item.checked),
	}));

const readItems = (id: string | undefined): Item[] => {
	if (!id) return [];
	const saved = localStorage.getItem(`list-${id}`);
	if (!saved) return [];
	try {
		const parsed = JSON.parse(saved);
		if (!Array.isArray(parsed)) return [];
		return parsed.map((p) => ({
			id: String(p.id ?? crypto.randomUUID()),
			name: sanitizeString(p.name ?? ""),
			checked: Boolean(p.checked),
		}));
	} catch {
		// Corrupted or malicious data in storage; return empty list instead of throwing.
		return [];
	}
};

const ListDetail: React.FC = () => {
	const { id } = useParams<{ id: string }>();
	const [items, setItems] = useState<Item[]>([]);
	const [newItemName, setNewItemName] = useState("");
	const [permissionStatus, setPermissionStatus] =
		useState<PermissionState | null>(null);
	const [showBanner, setShowBanner] = useState(true);

	// Sync items when ID changes
	useEffect(() => {
		setItems(readItems(id));
	}, [id]);

	// Persist items to localStorage
	useEffect(() => {
		if (!id) return;
		// Sanitize items before writing to browser storage to avoid persisting
		// potentially malicious payloads.
		const sanitized = sanitizeItemsForStorage(items);
		localStorage.setItem(`list-${id}`, JSON.stringify(sanitized));
	}, [items, id]);

	// Safe Permission Check
	useEffect(() => {
		let isMounted = true;
		let permResult: PermissionStatus | null = null;

		const handler = () => {
			if (isMounted && permResult) setPermissionStatus(permResult.state);
		};

		if (navigator.permissions) {
			navigator.permissions
				.query({ name: "geolocation" as PermissionName })
				.then((result) => {
					if (!isMounted) return;
					permResult = result;
					setPermissionStatus(result.state);
					result.addEventListener("change", handler);
				});
		}

		return () => {
			isMounted = false;
			permResult?.removeEventListener("change", handler);
		};
	}, []);

	const addItem = (e: React.FormEvent) => {
		e.preventDefault();
		if (newItemName.trim() === "") return;
		const newItem: Item = {
			id: crypto.randomUUID(),
			name: newItemName,
			checked: false,
		};
		setItems([...items, newItem]);
		setNewItemName("");
	};

	const handleCheck = (itemId: string) => {
		// Derive the new checked state from current items (pure, synchronous)
		const currentItem = items.find((item) => item.id === itemId);
		if (!currentItem) return;
		const newChecked = !currentItem.checked;

		// Pure state update: toggle the checked state only
		setItems((prevItems) =>
			prevItems.map((item) =>
				item.id === itemId ? { ...item, checked: newChecked } : item,
			),
		);

		// Only build and publish a sync event when a valid list id exists
		if (!id) return;

		const payload = new SyncPayloadBuilder()
			.setListId(id)
			.setItemId(itemId)
			.setChecked(newChecked)
			.build();

		if (stompClient.connected) {
			stompClient.publish({
				destination: "/app/sync",
				body: payload,
			});
		}
	};

	return (
		<div className="list-detail-container">
			{showBanner && permissionStatus === "denied" && (
				<div className="location-warning-banner">
					<span>
						Location access is disabled. Some features may be limited.
					</span>
					<button
						className="close-banner-btn"
						onClick={() => setShowBanner(false)}
					>
						✕
					</button>
				</div>
			)}

			<form onSubmit={addItem} className="add-item-form">
				<input
					type="text"
					value={newItemName}
					onChange={(e) => setNewItemName(e.target.value)}
					placeholder="Add new item..."
					className="add-input"
				/>
				<button type="submit" className="add-button">
					Add
				</button>
			</form>

			<ul className="shopping-list">
				{items.map((item) => (
					<li
						key={item.id}
						className={`shopping-item ${item.checked ? "item-completed" : ""}`}
					>
						<input
							type="checkbox"
							checked={item.checked}
							onChange={() => handleCheck(item.id)}
							className="item-checkbox"
						/>
						<span className="item-text">{item.name}</span>
					</li>
				))}
			</ul>

			{items.length === 0 && <p className="empty-msg">Your list is empty!</p>}
		</div>
	);
};

export default ListDetail;
