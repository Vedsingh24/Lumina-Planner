import sqlite3
import json
import os

db_path = r'C:\Users\Ved Singh\AppData\Roaming\Lumina Planner\lumina.db'
if not os.path.exists(db_path):
    print("DB not found")
else:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    try:
        c.execute("SELECT key, value FROM settings")
        print("Settings:", c.fetchall())
    except Exception as e:
        print(e)
    try:
        c.execute("SELECT date, content FROM chat_history WHERE role='user' ORDER BY date DESC LIMIT 20")
        print("Past chats:")
        for row in c.fetchall():
            print(row)
    except Exception as e:
        pass
    try:
        c.execute("SELECT date, title, description FROM tasks ORDER BY date DESC LIMIT 20")
        print("\nPast tasks:")
        for row in c.fetchall():
            print(row)
    except Exception as e:
        pass
