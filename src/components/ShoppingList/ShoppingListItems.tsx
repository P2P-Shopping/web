import React from "react";

interface Item {
    id: string;
    name: string;
    checked: boolean;
    brand?: string;
    quantity?: string;
    price?: number;
    category?: string;
}

interface Props {
    items: Item[];
    onCheck: (id: string) => void;
}

const ShoppingListItems: React.FC<Props> = ({ items, onCheck }) => {
    if (items.length === 0) return <p style={{textAlign:'center', color:'#555', marginTop:'20px'}}>Your list is empty!</p>;

    return (
        <ul className="shopping-list">
            {items.map((item) => (
                <li key={item.id} style={{ 
                    display: 'flex', padding: '15px', backgroundColor: 'rgba(255,255,255,0.4)', 
                    borderRadius: '12px', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%', cursor: 'pointer' }}>
                        <input
                            type="checkbox" checked={item.checked}
                            onChange={() => onCheck(item.id)}
                            style={{ width: '18px', height: '18px', marginTop: '4px' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <span style={{ 
                                fontSize: '16px', fontWeight: 'bold', color: '#2e1a5e',
                                textDecoration: item.checked ? 'line-through' : 'none',
                                opacity: item.checked ? 0.6 : 1
                            }}>
                                {item.name}
                            </span>
                            {/* Metadata - Null Safety */}
                            <div style={{ fontSize: '12px', color: '#444', marginTop: '4px' }}>
                                {item.brand && <span>{item.brand}</span>}
                                {item.quantity && <span> • {item.quantity}</span>}
                                {item.price != null && <span> • {item.price.toFixed(2)} RON</span>}
                                {item.category && <span style={{ fontStyle: 'italic', color: '#6c4ab3' }}> [{item.category}]</span>}
                            </div>
                        </div>
                    </label>
                </li>
            ))}
        </ul>
    );
};

export default ShoppingListItems;