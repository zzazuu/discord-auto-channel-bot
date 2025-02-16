import logging
import sys

def setup_logger():
    """Set up and return the logger instance"""
    logger = logging.getLogger('discord_bot')
    logger.setLevel(logging.INFO)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    
    # File handler
    file_handler = logging.FileHandler('discord_bot.log')
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    
    # Add handlers
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    return logger
