const { Client, GatewayIntentBits, PermissionFlagsBits, ApplicationCommandOptionType, REST, Routes, OAuth2Routes } = require('discord.js');
const Config = require('./config');
const ChannelManager = require('./channelManager');

class VoiceChannelBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages
            ]
        });

        this.channelManager = new ChannelManager();
        this.setupEventHandlers();
    }

    async checkBotPermissions(guild) {
        try {
            const botMember = await guild.members.fetch(guild.client.user.id);
            const requiredPermissions = [
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers
            ];

            const missingPermissions = requiredPermissions.filter(perm => !botMember.permissions.has(perm));
            if (missingPermissions.length > 0) {
                const missingPermsNames = missingPermissions.map(perm => 
                    Object.keys(PermissionFlagsBits).find(key => 
                        PermissionFlagsBits[key] === perm)
                ).join(', ');

                const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${this.client.user.id}&permissions=16780288&scope=bot%20applications.commands`;

                console.error(`Bot is missing required permissions in ${guild.name}: ${missingPermsNames}`);
                console.error('Please update bot permissions in server settings or use this invite link to add the bot with correct permissions:');
                console.error(inviteLink);
                return false;
            }
            return true;
        } catch (error) {
            console.error(`Error checking permissions in guild ${guild.name}:`, error);
            return false;
        }
    }

    async registerCommands() {
        const commands = [
            {
                name: 'status',
                description: 'Check bot status and temporary channel count'
            },
            {
                name: 'settrigger',
                description: 'Set the trigger channel ID (Admin only)',
                options: [{
                    name: 'channel',
                    description: 'The voice channel to use as trigger',
                    type: ApplicationCommandOptionType.Channel,
                    required: true
                }],
                defaultMemberPermissions: PermissionFlagsBits.Administrator
            },
            {
                name: 'setcategory',
                description: 'Set the category for temporary channels (Admin only)',
                options: [{
                    name: 'category',
                    description: 'The category to create temporary channels in',
                    type: ApplicationCommandOptionType.Channel,
                    required: true
                }],
                defaultMemberPermissions: PermissionFlagsBits.Administrator
            },
            {
                name: 'config',
                description: 'View current configuration (Admin only)',
                defaultMemberPermissions: PermissionFlagsBits.Administrator
            }
        ];

        try {
            console.log('Started refreshing application (/) commands.');
            const rest = new REST({ version: '10' }).setToken(Config.TOKEN);

            // Register commands globally
            await rest.put(
                Routes.applicationCommands(this.client.user.id),
                { body: commands.map(cmd => ({
                    ...cmd,
                    defaultMemberPermissions: cmd.defaultMemberPermissions?.toString()
                }))}
            );

            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error('Error registering commands:', error);
            if (error.code === 50001) {
                console.error('Bot lacks permissions to create commands. Please reinvite the bot with applications.commands scope.');
            }
        }
    }

    setupEventHandlers() {
        this.client.once('ready', async () => {
            console.log(`Logged in as ${this.client.user.tag}`);

            for (const guild of this.client.guilds.cache.values()) {
                const hasPermissions = await this.checkBotPermissions(guild);
                if (!hasPermissions) {
                    console.error(`Missing required permissions in guild: ${guild.name}`);
                    continue;
                }
                await this.channelManager.cleanupOrphanedChannels(guild);
            }

            await this.registerCommands();
        });

        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            try {
                // Ignore bot's own voice state updates
                if (oldState.member.user.bot) return;

                // Handle user joining trigger channel
                if (newState.channelId === Config.TRIGGER_CHANNEL_ID) {
                    console.log(`User ${newState.member.user.username} joined trigger channel`);
                    const tempChannel = await this.channelManager.createTemporaryChannel(
                        newState.guild,
                        newState.member
                    );
                    if (tempChannel) {
                        try {
                            await newState.member.voice.setChannel(tempChannel);
                            console.log(`Moved ${newState.member.user.username} to temporary channel ${tempChannel.name}`);
                        } catch (moveError) {
                            console.error(`Failed to move member to temporary channel:`, moveError);
                            if (moveError.code === 50013) {
                                await tempChannel.send('Failed to move user - missing permissions');
                            }
                        }
                    }
                }

                // Handle user leaving any channel
                if (oldState.channel && this.channelManager.tempChannels.has(oldState.channelId)) {
                    // Check if channel is empty
                    const channel = oldState.guild.channels.cache.get(oldState.channelId);
                    if (channel && channel.members.size === 0) {
                        try {
                            await this.channelManager.deleteTemporaryChannel(channel);
                            console.log(`Channel ${channel.name} deleted due to being empty`);
                        } catch (deleteError) {
                            console.error(`Failed to delete temporary channel:`, deleteError);
                        }
                    }
                }
            } catch (error) {
                console.error('Error in voice state update:', error);
                if (error.code === 50013) {
                    console.error('Missing permissions for voice channel operations. Please check bot permissions.');
                }
            }
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isCommand()) return;

            try {
                switch (interaction.commandName) {
                    case 'status':
                        const tempChannelCount = this.channelManager.tempChannels.size;
                        await interaction.reply(`Bot is running. Current temporary channels: ${tempChannelCount}`);
                        break;

                    case 'settrigger':
                        const channel = interaction.options.getChannel('channel');
                        if (channel.type !== 2) { // 2 is GUILD_VOICE
                            await interaction.reply({ content: 'Please select a voice channel.', ephemeral: true });
                            return;
                        }
                        Config.setTriggerChannelId(channel.id);
                        await interaction.reply(`Trigger channel set to: ${channel.name}`);
                        break;

                    case 'setcategory':
                        const category = interaction.options.getChannel('category');
                        if (category.type !== 4) { // 4 is GUILD_CATEGORY
                            await interaction.reply({ content: 'Please select a category.', ephemeral: true });
                            return;
                        }
                        Config.setCategoryId(category.id);
                        await interaction.reply(`Category set to: ${category.name}`);
                        break;

                    case 'config':
                        const triggerChannel = await interaction.guild.channels.fetch(Config.TRIGGER_CHANNEL_ID).catch(() => null);
                        const categoryChannel = Config.CATEGORY_ID ? await interaction.guild.channels.fetch(Config.CATEGORY_ID).catch(() => null) : null;

                        await interaction.reply({
                            content: `Current configuration:
                            Trigger Channel: ${triggerChannel ? triggerChannel.name : 'Not set'}
                            Category: ${categoryChannel ? categoryChannel.name : 'Not set'}`,
                            ephemeral: true
                        });
                        break;
                }
            } catch (error) {
                console.error('Error handling command:', error);
                await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
            }
        });

        this.client.on('error', error => {
            console.error('Discord client error:', error);
        });

        this.client.on('warn', warning => {
            console.warn('Discord client warning:', warning);
        });
    }

    async cleanupTemporaryChannels() {
        for (const guild of this.client.guilds.cache.values()) {
            await this.channelManager.cleanupOrphanedChannels(guild);
        }
    }

    start() {
        if (!Config.TOKEN) {
            console.error('No Discord token provided. Please set the DISCORD_TOKEN environment variable.');
            process.exit(1);
        }

        this.client.login(Config.TOKEN).catch(error => {
            console.error('Failed to login:', error.message);
            if (error.code === 'TokenInvalid') {
                console.error('The provided Discord token is invalid. Please check your configuration.');
            } else if (error.message.includes('disallowed intents')) {
                console.error('Please enable the required intents in the Discord Developer Portal');
            }
            process.exit(1);
        });
    }
}

// Start the bot
const bot = new VoiceChannelBot();
bot.start();