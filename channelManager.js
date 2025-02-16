const Config = require('./config');

class ChannelManager {
    constructor() {
        this.tempChannels = new Set();
    }

    async createTemporaryChannel(guild, member) {
        try {
            // Check bot permissions first
            const botMember = await guild.members.fetch(guild.client.user.id);
            if (!botMember.permissions.has('ManageChannels')) {
                console.error('Bot lacks ManageChannels permission');
                return null;
            }

            const channelName = `channel-${member.id}`;
            console.log(`Attempting to create channel: ${channelName}`);

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
                    },
                    {
                        id: guild.client.user.id,
                        allow: ['ManageChannels', 'MoveMembers', 'Connect']
                    }
                ]
            };

            // Create in category if configured
            if (Config.CATEGORY_ID) {
                const category = guild.channels.cache.get(Config.CATEGORY_ID);
                if (category) {
                    channelOptions.parent = category.id;
                    console.log(`Using category: ${category.name}`);
                }
            }

            const channel = await guild.channels.create(channelOptions);
            this.tempChannels.add(channel.id);
            console.log(`Successfully created temporary channel ${channel.name} (${channel.id}) for ${member.user.username}`);
            return channel;

        } catch (error) {
            console.error('Error creating temporary channel:', error);
            if (error.code === 50013) {
                console.error('Bot lacks required permissions. Please check bot permissions in server settings.');
            }
            return null;
        }
    }

    async deleteTemporaryChannel(channel) {
        try {
            if (this.tempChannels.has(channel.id)) {
                console.log(`Attempting to delete temporary channel: ${channel.name} (${channel.id})`);
                await channel.delete();
                this.tempChannels.delete(channel.id);
                console.log(`Successfully deleted temporary channel ${channel.name}`);
                return true;
            }
            return false;
        } catch (error) {
            if (error.code === 10003) { // Unknown Channel error
                console.log(`Channel ${channel.id} already deleted, removing from tracking`);
                this.tempChannels.delete(channel.id);
                return true;
            }
            console.error('Error deleting temporary channel:', error);
            if (error.code === 50013) {
                console.error('Bot lacks required permissions to delete channel. Please check bot permissions.');
            }
            return false;
        }
    }

    async cleanupOrphanedChannels(guild) {
        try {
            console.log(`Starting orphaned channel cleanup for guild: ${guild.name}`);
            const channels = guild.channels.cache.filter(channel =>
                channel.type === 2 && // Voice channel
                channel.name.startsWith('channel-') &&
                channel.members.size === 0
            );

            console.log(`Found ${channels.size} potential orphaned channels`);

            for (const [, channel] of channels) {
                try {
                    await channel.delete();
                    console.log(`Cleaned up orphaned channel: ${channel.name}`);
                } catch (error) {
                    if (error.code === 50013) {
                        console.error(`Skipping channel ${channel.name} - Missing permissions`);
                        continue;
                    }
                    console.error(`Error deleting channel ${channel.name}:`, error);
                }
            }
        } catch (error) {
            console.error('Error cleaning up orphaned channels:', error);
            if (error.code === 50013) {
                console.error('Bot lacks required permissions. Please check bot permissions in server settings.');
            }
        }
    }
}

module.exports = ChannelManager;