const { Client, GatewayIntentBits, PermissionFlagsBits, ApplicationCommandOptionType, REST, Routes } = require('discord.js');
const Config = require('./config');
const ChannelManager = require('./channelManager');

class VoiceChannelBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates
            ]
        });

        this.channelManager = new ChannelManager();
        this.setupEventHandlers();
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
            await this.cleanupTemporaryChannels();
            await this.registerCommands();
        });

        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            try {
                // Ignore bot's own voice state updates
                if (oldState.member.user.bot) return;

                // Handle user joining trigger channel
                if (newState.channelId === Config.TRIGGER_CHANNEL_ID) {
                    const tempChannel = await this.channelManager.createTemporaryChannel(
                        newState.guild,
                        newState.member
                    );
                    if (tempChannel) {
                        await newState.setChannel(tempChannel);
                        console.log(`Created temporary channel ${tempChannel.name} for ${newState.member.user.username}`);
                    }
                }

                // Handle user leaving any channel
                if (oldState.channelId && this.channelManager.tempChannels.has(oldState.channelId)) {
                    const channel = oldState.channel;
                    if (channel && channel.members.size === 0) {
                        await this.channelManager.deleteTemporaryChannel(channel);
                        console.log(`Deleted empty temporary channel ${channel.name}`);
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

        // Error handling
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