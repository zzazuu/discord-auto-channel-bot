const Config = require('./config');

class ChannelManager {
    constructor() {
        this.tempChannels = new Set();
    }

    async createTemporaryChannel(guild, member) {
        try {
            const channelName = `${Config.TEMP_CHANNEL_PREFIX}${member.user.username}'s Channel`;

            let channelOptions = {
                name: channelName,
                type: 2, // Voice channel type
                permissionOverwrites: [
                    {
                        id: member.id,
                        allow: ['Connect', 'Speak', 'ManageChannels', 'MoveMembers']
                    },
                    {
                        id: guild.id,
                        allow: ['Connect', 'Speak']
                    }
                ]
            };

            // Create in category if configured
            if (Config.CATEGORY_ID) {
                const category = guild.channels.cache.get(Config.CATEGORY_ID);
                if (category) {
                    channelOptions.parent = category.id;
                }
            }

            const channel = await guild.channels.create(channelOptions);

            this.tempChannels.add(channel.id);
            console.log(`Created temporary channel ${channel.name} for ${member.user.username}`);
            return channel;
        } catch (error) {
            console.error('Error creating temporary channel:', error);
            return null;
        }
    }

    async deleteTemporaryChannel(channel) {
        try {
            if (this.tempChannels.has(channel.id)) {
                await channel.delete();
                this.tempChannels.delete(channel.id);
                console.log(`Deleted temporary channel ${channel.name}`);
                return true;
            }
            return false;
        } catch (error) {
            if (error.code === 10003) { // Unknown Channel error
                this.tempChannels.delete(channel.id);
                return true;
            }
            console.error('Error deleting temporary channel:', error);
            return false;
        }
    }

    async cleanupOrphanedChannels(guild) {
        try {
            const channels = guild.channels.cache.filter(channel =>
                channel.type === 2 && // Voice channel
                channel.name.startsWith(Config.TEMP_CHANNEL_PREFIX) &&
                channel.members.size === 0
            );

            for (const [, channel] of channels) {
                await channel.delete();
                console.log(`Cleaned up orphaned channel: ${channel.name}`);
            }
        } catch (error) {
            console.error('Error cleaning up orphaned channels:', error);
        }
    }
}

module.exports = ChannelManager;