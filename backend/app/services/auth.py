from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database import get_db
from app.models.users import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Tells FastAPI where a client would normally log in to get a token.
# This is what makes the "Authorize" button appear in the /docs page.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Runs on every request to a protected route. Reads the JWT sent in the
    Authorization header, decodes it, and looks up the matching user row.
    Raises 401 if the token is missing, expired, tampered with, or if the
    user in the token no longer exists.
    """
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
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    return user


def require_role(*allowed_roles: str):
    """
    RBAC guard for routes that only certain roles should reach (e.g. a
    coach's view of their candidates' sessions). Used as a dependency:

        @router.get("/api/coach/candidates")
        def list_candidates(user: User = Depends(require_role("coach", "institute_admin"))):
            ...

    Layers on top of get_current_user rather than replacing it, so a
    request still needs a valid token first - an invalid/missing token
    still 401s exactly as before; only a valid token whose user has the
    wrong role gets the new 403 here.
    """

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this",
            )
        return current_user

    return dependency


def update_user_name(db: Session, user: User, name: str) -> User:
    """Profile page: the only field a user can edit about themselves.
    UserUpdate's min_length=1 already rejects an empty string, but not a
    whitespace-only one (" " passes length validation) - checked again
    here after stripping so a blank name can't slip through either way."""
    cleaned = name.strip()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name can't be blank")
    user.name = cleaned
    db.commit()
    db.refresh(user)
    return user


def change_user_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    """
    Settings page. Requires the current password to be re-entered (not
    just an active session) before a new one is set - the standard
    "prove you're still you" guard for a sensitive account change, same
    reasoning as re-prompting for a password before changing email/2FA
    on most real services.
    """
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )
    user.password_hash = hash_password(new_password)
    db.commit()
