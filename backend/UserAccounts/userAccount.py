import sqlite3
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# -----------------------------
# DATABASE PATH
# -----------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "db", "EventPlannerDB.db")

def _get_conn():
    return sqlite3.connect(DB_PATH)


# -----------------------------
# User Account Logic
# -----------------------------
class UserAccount:
    def create_account(self, accountID: str, accountType: str, password: str, email: str):
        """Create a new account in the database."""
        with _get_conn() as conn:
            cur = conn.cursor()
            # Check if email already exists
            cur.execute("SELECT accountID FROM accounts WHERE email = ?", (email,))
            if cur.fetchone():
                raise ValueError("Email already registered")
            cur.execute(
                "INSERT INTO accounts (accountID, accountType, password, email) VALUES (?, ?, ?, ?)",
                (accountID, accountType, password, email)
            )
            conn.commit()
            return "123456"  # You can replace with actual verification code logic

    def login(self, email: str, password: str):
        """Check login credentials against the database."""
        with _get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT accountID, accountType, password FROM accounts WHERE email = ?",
                (email,)
            )
            row = cur.fetchone()
            if not row:
                return False, "Email not found"

            accountID, accountType, stored_password = row
            if stored_password != password:
                return False, "Incorrect password"

            return True, {
                "id": accountID,
                "email": email,
                "role": accountType
            }

    def verify_code(self, accountID: str, code: str):
        """Stub for verification code."""
        return True, "Verified"

    def delete_account(self, accountID: str):
        """Delete account by ID."""
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
