# backend/UserAccounts/migrate_accounts.py
import sqlite3, time, os, shutil

DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")
BACKUP = DB_PATH + ".bak"

print("Backing up:", DB_PATH, "->", BACKUP)
if os.path.exists(DB_PATH):
    shutil.copyfile(DB_PATH, BACKUP)

con = sqlite3.connect(DB_PATH)
cur = con.cursor()
cur.execute("PRAGMA foreign_keys=off;")

# Create new table with safe types
cur.executescript("""
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS accounts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  accountID TEXT NOT NULL,
  accountType TEXT NOT NULL,
  password TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  isVerified INTEGER NOT NULL DEFAULT 0 CHECK(isVerified IN (0,1)),
  verificationCode TEXT,
  verificationExpiry INTEGER
);

-- Copy if old table exists
INSERT INTO accounts_new (id, accountID, accountType, password, email, isVerified, verificationCode, verificationExpiry)
SELECT
  id,
  CAST(accountID AS TEXT),
  CAST(accountType AS TEXT),
  CAST(password AS TEXT),
  CAST(email AS TEXT),
  CASE
    WHEN isVerified IN (1, '1', 'true', 'TRUE') THEN 1
    ELSE 0
  END,
  CAST(verificationCode AS TEXT),
  CASE
    WHEN typeof(verificationExpiry)='integer' THEN verificationExpiry
    WHEN typeof(verificationExpiry)='text' THEN strftime('%s', verificationExpiry)
    ELSE NULL
  END
FROM accounts
-- If old table doesn't exist, this SELECT will fail; ignore via savepoint
;

-- If old table existed, drop it
DROP TABLE IF EXISTS accounts;
ALTER TABLE accounts_new RENAME TO accounts;

COMMIT;
""")

cur.execute("PRAGMA foreign_keys=on;")
con.commit()
con.close()
print("Migration done.")
