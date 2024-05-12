from passlib.context import CryptContext

crypto = CryptContext(schemes=["bcrypt"], deprecated="auto")

