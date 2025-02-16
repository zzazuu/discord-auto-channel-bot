import discord
import logging
from config import Config

logger = logging.getLogger('discord_bot')

class ChannelManager:
    def __init__(self):
        self.temp_channels = set()
        
    async def create_temporary_channel(self, guild, member):
        """Create a temporary voice channel"""
        try:
            channel_name = f"{Config.TEMP_CHANNEL_PREFIX}{member.name}'s Channel"
            
            # Create channel in category if configured, otherwise in guild root
            if Config.CATEGORY_ID:
                category = discord.utils.get(guild.categories, id=Config.CATEGORY_ID)
                channel = await guild.create_voice_channel(
                    name=channel_name,
                    category=category
                )
            else:
                channel = await guild.create_voice_channel(name=channel_name)
            
            # Set permissions for the channel creator
            await channel.set_permissions(member, 
                connect=True,
                speak=True,
                manage_channels=True,
                move_members=True
            )
            
            self.temp_channels.add(channel.id)
            return channel
            
        except discord.errors.Forbidden:
            logger.error("Bot doesn't have permission to create channels")
            return None
        except Exception as e:
            logger.error(f"Error creating temporary channel: {str(e)}")
            return None
            
    async def delete_temporary_channel(self, channel):
        """Delete a temporary voice channel"""
        try:
            if channel.id in self.temp_channels:
                await channel.delete()
                self.temp_channels.remove(channel.id)
                return True
        except discord.errors.NotFound:
            # Channel already deleted
            self.temp_channels.remove(channel.id)
        except Exception as e:
            logger.error(f"Error deleting temporary channel: {str(e)}")
        return False
        
    async def cleanup_orphaned_channels(self, guild):
        """Clean up any temporary channels that might have been left from a previous session"""
        try:
            for channel in guild.voice_channels:
                if (channel.name.startswith(Config.TEMP_CHANNEL_PREFIX) and 
                    len(channel.members) == 0):
                    await channel.delete()
                    logger.info(f"Cleaned up orphaned channel: {channel.name}")
        except Exception as e:
            logger.error(f"Error cleaning up orphaned channels: {str(e)}")
