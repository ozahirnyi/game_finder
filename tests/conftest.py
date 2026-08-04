import os


os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("IGDB_CLIENT_ID", "test-igdb-client")
os.environ.setdefault("IGDB_CLIENT_SECRET", "test-igdb-secret")
