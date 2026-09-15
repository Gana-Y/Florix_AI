from datetime import datetime, timedelta, timezone
import os
import jwt
import bcrypt
from pydantic import BaseModel, ConfigDict
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import SessionLocal, User, Activity
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET", "supersecretkey_for_development_only_12345")
ALGORITHM = "HS256"
# Token expiry configurable via env; defaults to 7 days
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))

# Warn loudly if using the default weak secret
if SECRET_KEY == "supersecretkey_for_development_only_12345":
    import warnings
    warnings.warn(
        "\n⚠️  SECURITY WARNING: Using default JWT_SECRET. "
        "Generate a strong secret with: python -c \"import secrets; print(secrets.token_hex(32))\" "
        "and set it in your .env file.",
        stacklevel=2
    )

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_password(plain_password, hashed_password):
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": int(expire.timestamp())})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    # Edge Case Safeguard: Check if Premium/Pro plan has expired
    if user.plan and user.plan != "free" and user.plan_expires_at:
        # Check naive UTC datetimes
        if user.plan_expires_at < datetime.utcnow():
            old_plan = user.plan
            user.plan = "free"
            user.plan_expires_at = None
            db.add(Activity(
                action="Plan Expired", 
                details=f"Subscription for '{old_plan.upper()}' expired. Auto-downgraded to Free.", 
                user_id=user.id
            ))
            db.commit()
            db.refresh(user)

    return user
