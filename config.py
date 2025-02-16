import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    TOKEN = os.getenv('DISCORD_TOKEN')
    TRIGGER_CHANNEL_ID = int(os.getenv('TRIGGER_CHANNEL_ID'))
    TEMP_CHANNEL_PREFIX = "🔊│"
    CATEGORY_ID = int(os.getenv('CATEGORY_ID', 0))  # Optional: category for temp channels
