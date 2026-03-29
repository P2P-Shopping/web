import { useState, useEffect } from 'react';
import { useParams} from 'react-router-dom';

interface Item {
  name: string;
  checked: boolean;
}

const styles = {
  inputContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  input: {
    flex: 1,
    padding: '10px',
    fontSize: '16px',
    border: '1px solid #ccc',
    borderRadius: '4px'
  },
  addBtn: {
    padding: '10px 20px',
    fontSize: '16px',
    background: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    borderBottom: '1px solid #e0e0e0'
  }
};

const ListDetail = () => {
  const { id } = useParams();

  if (!id) {
    return <div>Invalid list ID</div>;
  }

  const [newItemName, setNewItemName] = useState('');
  const [items, setItems] = useState<Item[]>(() => {
    const saved = localStorage.getItem(`list-${id}`);
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => {
    //ia permisiunile dupa clean up
    let permResult: PermissionStatus;
    const handler = () => setPermissionStatus(permResult.state);

    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        permResult = result;
        setPermissionStatus(result.state);
        result.addEventListener('change', handler);
      });
    }

    // permisiunea GPS 
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('GPS:', position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn('GPS error:', error.message);
        }
      );
    }

    return () => {
      permResult?.removeEventListener('change', handler);
    };
  }, []);

  // salvarea de itemuri dupa refresh
    useEffect(() => {
    localStorage.setItem(`list-${id}`, JSON.stringify(items));
  }, [items, id]);

  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus['state']>('prompt');
  const [showBanner, setShowBanner] = useState(true);

  const addItem = () => {
    if (newItemName.trim() === '') return;
    setItems([...items, { name: newItemName, checked: false }]);
    setNewItemName('');
  };

  //Trigger Native Bridge ; trimte ping
  const handleCheck = (index: number) => {
    const newItems = [...items];
    const isNowChecked = !newItems[index].checked;
    newItems[index].checked = isNowChecked;
    setItems(newItems);

    if (isNowChecked) {
      const payload = {
        action: 'COLLECT_P2P_DATA',
        data: {
          item: newItems[index].name,
          listId: id,   
          timestamp: Date.now(),
          context: 'Store_Shopping'
        }
      };

      if ((window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify(payload));
      } else {
        console.warn('BRIDGE_DEBUG: Ping trimis!', payload);
      }
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>

      {/*Dismissible Warning Banner */}
      {permissionStatus === 'denied' && showBanner && (
        <div style={{
          background: '#FFF5F5',
          border: '1px solid #FEB2B2',
          color: '#C53030',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>  Location is off.</span>
          <button
            onClick={() => setShowBanner(false)}
            style={{ border: 'none', background: '#5b5454', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}



      <div style={styles.inputContainer}>
        <input
          type="text"
          placeholder="Add product"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          style={styles.input}
        />
        <button onClick={addItem} style={styles.addBtn}>Add</button>
      </div>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((item, index) => (
          <li key={index} style={{
            ...styles.listItem,
            background: item.checked ? '#F7FAFC' : '#FFF'
          }}>
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => handleCheck(index)}
              style={{ width: '22px', height: '22px', cursor: 'pointer' }}
            />
            <span style={{
              fontSize: '18px',
              textDecoration: item.checked ? 'line-through' : 'none',
              color: item.checked ? '#A0AEC0' : '#111c2f'
            }}>
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};


export default ListDetail;