const CacheSystem = {
    storeName: "sombra_condor_store",
    fileKey: "sqlite_file",
    timeout: null,

    getIDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("SombraDoCondorApp", 1);
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(this.storeName);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async save(dbInstance) {
        if (!dbInstance) return;
        const data = dbInstance.export(); 
        const idb = await this.getIDB();
        const tx = idb.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(data, this.fileKey);
    },

    async load() {
        const idb = await this.getIDB();
        const tx = idb.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).get(this.fileKey);
        return new Promise(resolve => {
            req.onsuccess = () => resolve(req.result); 
        });
    },

    scheduleSave(dbInstance) {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            this.save(dbInstance);
        }, 1000); 
    }
};