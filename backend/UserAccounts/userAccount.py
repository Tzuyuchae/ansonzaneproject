import sqlite3
import os
import smtplib
from email.message import EmailMessage
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Tuple
import bcrypt
from datetime import datetime, timedelta
import secrets

router = APIRouter()

# -----------------------------
# DATABASE PATH
# -----------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "db", "EventPlannerDB.db")

def _get_conn():
    # Return connection with row factory for dict-like access
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# -----------------------------
# Email sending
# -----------------------------
def _send_email(to_email: str, subject: str, body: str) -> None:
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    sender = os.getenv("EMAIL_FROM") or user

    if not host or not user or not password or not sender:
        # In dev we just log. Raising would block local testing.
        print(f"[EMAIL DEV] To: {to_email}\nSubject: {subject}\n\n{body}")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(user, password)
        server.send_message(msg)

# -----------------------------
# User Account Logic
# -----------------------------

class UserAccount:
    def create_account(self, accountID: str, accountType: str, password: str, email: str) -> str:
        """Create a new account, store hashed password, and generate a verification code.

        Returns the verification code (useful for tests). In prod it is emailed.
        """
        # Hash password
        print("DEBUG_DB_PATH =", os.path.abspath(DB_PATH))

        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        code = f"{secrets.randbelow(1000000):06d}"
        expiry = (datetime.utcnow() + timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")
        expiry_epoch = int(datetime.utcnow().timestamp()) + 2 * 60 * 60

        with _get_conn() as conn:
            cur = conn.cursor()
            # Check if email already exists
            cur.execute("SELECT accountID FROM accounts WHERE email = ?", (email,))
            if cur.fetchone():
                raise ValueError("Email already registered")

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

        # Email the code
        _send_email(
            to_email=email,
            subject="Verify your UNCO account",
            body=("""Hello,

Use this code to verify your account: {code}

This code expires in 2 hours.

Thanks,
UNCO Events
""").format(code=code),
        )

        return code

    def _get_account(self, email: Optional[str] = None, accountID: Optional[str] = None):
        with _get_conn() as conn:
            cur = conn.cursor()
            if email:
                cur.execute("SELECT * FROM accounts WHERE email = ?", (email,))
            else:
                cur.execute("SELECT * FROM accounts WHERE accountID = ?", (accountID,))
            row = cur.fetchone()
            return dict(row) if row else None

    def login(self, email: str, password: str) -> Tuple[bool, object]:
        """Check login credentials. Only allow verified accounts."""
        acc = self._get_account(email=email)
        if not acc:
            return False, "Email not found"

        stored_hash = acc.get("password", "")
        try:
            ok = bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
        except Exception:
            ok = stored_hash == password  # fallback for legacy data

        if not ok:
            return False, "Incorrect password"

        if not acc.get("isVerified"):
            return False, "Account not verified. Check your email for the code."

        return True, {
            "id": acc.get("accountID"),
            "email": acc.get("email"),
            "role": acc.get("accountType") or "Student",
        }

    def verify_code(self, accountID: str, code: str) -> Tuple[bool, str]:
        with _get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT verificationCode, verificationExpiry FROM accounts WHERE accountID = ?",
                (accountID,),
            )
            row = cur.fetchone()
            if not row:
                return False, "Account not found"
            ver_code, expiry = row[0], row[1]
            # Expired?
            if expiry:
                try:
                    exp_dt = datetime.strptime(expiry, "%Y-%m-%d %H:%M:%S")
                    if datetime.utcnow() > exp_dt:
                        return False, "Verification code expired"
                except Exception:
                    pass
            if code != ver_code:
                return False, "Invalid verification code"

            # Mark verified and clear code
            cur.execute(
                "UPDATE accounts SET isVerified = 1, verificationCode = NULL, verificationExpiry = NULL WHERE accountID = ?",
                (accountID,),
            )
            conn.commit()
            return True, "Verified"

    def delete_account(self, accountID: str) -> None:
        with _get_conn() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM accounts WHERE accountID = ?", (accountID,))
            conn.commit()

# -----------------------------
# Instantiate UserAccount
# -----------------------------
ua = UserAccount()

# -----------------------------
# Pydantic Models
# -----------------------------
class RegisterRequest(BaseModel):
    accountID: str
    accountType: str
    password: str
    email: str

class LoginRequest(BaseModel):
    email: str
    password: str

class VerifyRequest(BaseModel):
    accountID: str
    code: str

# -----------------------------
# FastAPI Endpoints
# -----------------------------
@router.post("/register")
def register(data: RegisterRequest):
    try:
        code = ua.create_account(data.accountID, data.accountType, data.password, data.email)
        return {"message": "Account created successfully.", "verification_code": code}
    except Exception as e:
        print("REGISTER ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login")
def login(data: LoginRequest):
    success, result = ua.login(data.email, data.password)
    if success:
        return {"user": result}
    raise HTTPException(status_code=401, detail=result)

@router.post("/verify")
def verify(data: VerifyRequest):
    success, message = ua.verify_code(data.accountID, data.code)
    if success:
        return {"message": message}
    raise HTTPException(status_code=400, detail=message)

@router.delete("/account/{accountID}")
def delete(accountID: str):
    ua.delete_account(accountID)
    return {"message": "Account deleted successfully"}
