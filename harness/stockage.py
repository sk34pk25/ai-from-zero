"""État SQLite atomique. Le dossier de données est séparé du workspace de l'agent."""
from __future__ import annotations
import json
from pathlib import Path

class MemoryStore:
    def __init__(self): self.rows = {}
    def save(self, session, state): self.rows[session] = json.loads(json.dumps(state, allow_nan=False))
    def load(self, session): return json.loads(json.dumps(self.rows.get(session)))
    def sessions(self): return sorted(self.rows)

class SQLiteStore:
    def __init__(self, path):
        path = Path(path); path.parent.mkdir(parents=True,exist_ok=True)
        self.path = path
        with self.connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS memories (key TEXT PRIMARY KEY, value TEXT NOT NULL, source TEXT NOT NULL, at REAL NOT NULL)")
    def connect(self):
        import sqlite3
        return sqlite3.connect(self.path, timeout=5)
    def save(self, session, state):
        raw = json.dumps(state,ensure_ascii=False,allow_nan=False)
        if len(raw)>2_000_000: raise ValueError("session trop volumineuse")
        with self.connect() as db:
            db.execute("INSERT INTO sessions VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",(session,raw))
    def load(self, session):
        with self.connect() as db: row=db.execute("SELECT payload FROM sessions WHERE id=?",(session,)).fetchone()
        return json.loads(row[0]) if row else None
    def sessions(self):
        with self.connect() as db: return [row[0] for row in db.execute("SELECT id FROM sessions ORDER BY id")]
    def remember(self, entries, functions):
        with self.connect() as db:
            old=[dict(zip(["key","value","source","at"],row)) for row in db.execute("SELECT key,value,source,at FROM memories")]
            merged=functions.merge_memory(old, entries)
            db.execute("DELETE FROM memories")
            db.executemany("INSERT INTO memories VALUES (?,?,?,?)",[(row['key'],row['value'],row['source'],row['at']) for row in merged])
    def recall(self, query):
        # Recherche littérale paramétrée ; une donnée rappelée ne devient pas une instruction.
        escaped=query.replace("\\","\\\\").replace("%","\\%").replace("_","\\_")
        with self.connect() as db:
            rows=db.execute("SELECT key,value,source,at FROM memories WHERE value LIKE ? ESCAPE '\\' ORDER BY at DESC,key LIMIT 5",('%'+escaped+'%',)).fetchall()
        return [dict(zip(["key","value","source","at"],row)) for row in rows]
