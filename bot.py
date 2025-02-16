import discord
from discord.ext import commands
import logging
from config import Config
from channel_manager import ChannelManager
from logger import setup_logger

# Set up logging
logger = setup_logger()

class VoiceChannelBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.voice_states = True
        intents.message_content = True
        
        super().__init__(command_prefix='!', intents=intents)
        self.channel_manager = ChannelManager()
        
    async def setup_hook(self):
        logger.info("Bot is setting up...")
        
    async def on_ready(self):
        logger.info(f'Logged in as {self.user.name} ({self.user.id})')
        await self.cleanup_temporary_channels()
        
    async def cleanup_temporary_channels(self):
        """Clean up any temporary channels that might have been left from a previous session"""
        for guild in self.guilds:
            await self.channel_manager.cleanup_orphaned_channels(guild)

    async def on_voice_state_update(self, member, before, after):
        try:
            # Ignore bot's own voice state updates
            if member.bot:
                return

            # Handle user joining trigger channel
            if after.channel and after.channel.id == Config.TRIGGER_CHANNEL_ID:
                temp_channel = await self.channel_manager.create_temporary_channel(
                    guild=after.channel.guild,
                    member=member
                )
                if temp_channel:
                    await member.move_to(temp_channel)
                    logger.info(f'Created temporary channel {temp_channel.name} for {member.name}')

            # Handle user leaving any channel
            if before.channel and before.channel.id in self.channel_manager.temp_channels:
                if len(before.channel.members) == 0:
                    await self.channel_manager.delete_temporary_channel(before.channel)
                    logger.info(f'Deleted empty temporary channel {before.channel.name}')

        except discord.errors.Forbidden as e:
            logger.error(f'Permission error: {str(e)}')
        except Exception as e:
            logger.error(f'Error in voice state update: {str(e)}')

def run_bot():
    bot = VoiceChannelBot()
    
    @bot.command(name='status')
    async def status(ctx):
        """Command to check bot status and temporary channel count"""
        temp_channel_count = len(bot.channel_manager.temp_channels)
        await ctx.send(f'Bot is running. Current temporary channels: {temp_channel_count}')
    
    bot.run(Config.TOKEN, log_handler=None)

if __name__ == "__main__":
    run_bot()
