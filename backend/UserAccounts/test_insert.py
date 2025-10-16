import sqlite3, bcrypt, secrets, time

accountID = "test1"
accountType = "Student"
password = "Password123!"
email = "test1@unco.edu"

hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
code = f"{secrets.randbelow(1_000_000):06d}"
expiry_epoch = int(time.time()) + 2 * 60 * 60

conn = sqlite3.connect("database.db")
cur = conn.cursor()

try:
    cur.execute("""
        INSERT INTO accounts
          (accountID, accountType, password, email, isVerified, verificationCode, verificationExpiry)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        str(accountID),
        str(accountType),
        str(hashed),
        str(email),
        int(0),
        str(code),
        int(expiry_epoch)
    ))
    conn.commit()
    print("Insert successful")
except Exception as e:
    print("ERROR:", e)
finally:
    conn.close()
