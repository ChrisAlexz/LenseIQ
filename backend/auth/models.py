from auth.database import get_connection

def create_users_table():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    # Add name column to existing tables that were created without it
    cursor.execute("""
        ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
    """)
    # Allow password_hash to be NULL for Google-only accounts
    cursor.execute("""
        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    """)
    cursor.execute("""
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
    """)

    cursor.execute("""
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;
    """)
    cursor.execute("""
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP;
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS token_blacklist (
            id SERIAL PRIMARY KEY,
            token TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL
        );
    """)

    # Mailing list for "Pro updates" (not tied to an account)
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS pro_updates_signups (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    cursor.execute("""
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
    """)
    
    cursor.execute("""
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP;
    """)

    # Add subscription plan column with default 'free'
    cursor.execute("""
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
    """)
    # Add columns for upload limits
    cursor.execute("""
    ALTER TABLE users ADD COLUMN IF NOT EXISTS uploads_today INTEGER DEFAULT 0;
    """)
    cursor.execute("""
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_upload_date DATE DEFAULT CURRENT_DATE;
    """)
    cursor.execute("""
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_waitlist_joined_at TIMESTAMP;
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pro_waitlist (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            name TEXT,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    # Clean up expired blacklist entries on startup
    cursor.execute("DELETE FROM token_blacklist WHERE expires_at <= NOW();")
    conn.commit()
    cursor.close()
    conn.close()
