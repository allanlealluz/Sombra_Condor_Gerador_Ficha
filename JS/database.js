const DBSystem = {
    db: null,
    SQL: null,

    async init(onCompleteCallback) {
        const config = { locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` };
        this.SQL = await initSqlJs(config);
        
        const cachedData = await CacheSystem.load();
        
        if (cachedData) {
            this.db = new this.SQL.Database(cachedData);
        } else {
            this.db = new this.SQL.Database();
            this.createTables();
        }

        this.applyAutoSaveInterceptor();
        if (onCompleteCallback) onCompleteCallback();
    },

    applyAutoSaveInterceptor() {
        const originalRun = this.db.run.bind(this.db);
        const self = this;
        this.db.run = function(...args) {
            const result = originalRun(...args);
            CacheSystem.scheduleSave(self.db); // Avisa o cache que o banco mudou
            return result;
        };
    },

    createTables() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY, parent_id INTEGER, name TEXT, type TEXT, description TEXT);
            CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY, group_id INTEGER, name TEXT, role TEXT, history TEXT, sheet TEXT, image TEXT);
            CREATE TABLE IF NOT EXISTS missions (id INTEGER PRIMARY KEY, title TEXT, status TEXT, briefing TEXT);
            CREATE TABLE IF NOT EXISTS scripts (id INTEGER PRIMARY KEY, title TEXT, content TEXT, last_updated TEXT);
            CREATE TABLE IF NOT EXISTS mission_members (mission_id INTEGER, member_id INTEGER, role_type TEXT, PRIMARY KEY(mission_id, member_id));
        `);
        
        // Migrations de segurança para bases antigas
        try { this.db.exec("ALTER TABLE mission_members ADD COLUMN role_type TEXT;"); } catch(e) {}
        try { this.db.exec("ALTER TABLE members ADD COLUMN image TEXT;"); } catch(e) {}
    },

    exec(query) { 
        return this.db.exec(query); 
    },
    
    run(query, params) { 
        return this.db.run(query, params); 
    },
    
    prepare(query) { 
        return this.db.prepare(query); 
    },

    exportDatabase() {
        return this.db.export();
    },

    loadFromArrayBuffer(buffer) {
        this.db = new this.SQL.Database(new Uint8Array(buffer));
        this.applyAutoSaveInterceptor();
        CacheSystem.save(this.db);
    }
};