const DATABASE = 'study-studio-materials';
const STORE = 'materials';
let connection;
function openDB() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = null; reject(request.error); };
    request.onblocked = () => { connection = null; reject(new Error('请关闭其他 study studio 标签页后重试保存。')); };
  });
  return connection;
}
async function transaction(mode, operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = operation(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error || request.error);
    tx.onabort = () => reject(tx.error || new Error('资料保存被中断。'));
  });
}
export async function listMaterials() { return transaction('readonly', store => store.getAll()); }
export async function storeMaterial(material) { return transaction('readwrite', store => store.put(material)); }
