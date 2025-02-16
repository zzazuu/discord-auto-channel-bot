const { Client, GatewayIntentBits, PermissionFlagsBits, ApplicationCommandOptionType, REST, Routes, Events, ChannelType } = require('discord.js');
const Config = require('./config');

class VoiceChannelBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages
            ]
        });

        this.temporaryChannels = new Map(); // Store channel IDs and their interval handlers
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
                name: 'settrigger',
                description: 'Set the trigger channel ID (Admin only)',
                options: [{
                    name: 'channel',
                    description: 'The voice channel to use as trigger',
                    type: ApplicationCommandOptionType.Channel,
                    required: true
                }],
                defaultMemberPermissions: PermissionFlagsBits.Administrator.toString()
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
                defaultMemberPermissions: PermissionFlagsBits.Administrator.toString()
            },
            {
                name: 'config',
                description: 'View current configuration (Admin only)',
                defaultMemberPermissions: PermissionFlagsBits.Administrator.toString()
            }
        ];

        try {
            console.log('Started refreshing application (/) commands.');
            const rest = new REST({ version: '10' }).setToken(Config.TOKEN);

            await rest.put(
                Routes.applicationCommands(this.client.user.id.toString()),
                { body: commands }
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
        this.client.once('ready', () => {
            console.log(`Logged in as ${this.client.user.tag}`);
            this.registerCommands();
        });

        this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
            try {
                // Ignore bot's own voice state updates
                if (oldState.member.user.bot) return;

                // Handle user joining trigger channel
                if (newState.channelId === Config.TRIGGER_CHANNEL_ID) {
                    // First check if both required settings are configured
                    if (!Config.TRIGGER_CHANNEL_ID || !Config.CATEGORY_ID) {
                        const guild = newState.guild;
                        const owner = await guild.fetchOwner();
                        try {
                            await owner.send('⚠️ Bot configuration is incomplete. Please use `/settrigger` and `/setcategory` commands to set up the bot.');
                        } catch (error) {
                            console.warn('Could not send DM to server owner about incomplete configuration');
                        }
                        console.warn('Bot is not fully configured. Both trigger channel and category must be set.');
                        return;
                    }

                    console.log(`User ${newState.member.user.username} joined trigger channel`);

                    // Check bot permissions before proceeding
                    const botMember = await newState.guild.members.fetch(this.client.user.id);
                    if (!botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
                        console.error('Bot lacks Move Members permission');
                        return;
                    }

                    // Additional check to ensure category still exists
                    const category = await newState.guild.channels.fetch(Config.CATEGORY_ID).catch(() => null);
                    if (!category) {
                        console.error('Configured category no longer exists');
                        return;
                    }

                    const tempChannel = await newState.guild.channels.create({
                        name: `${Config.TEMP_CHANNEL_PREFIX}${newState.member.user.username}`,
                        type: ChannelType.GuildVoice,
                        parent: Config.CATEGORY_ID,
                        permissionOverwrites: [
                            {
                                id: newState.member.id,
                                allow: [
                                    PermissionFlagsBits.Connect,
                                    PermissionFlagsBits.Speak,
                                    PermissionFlagsBits.ManageChannels,
                                    PermissionFlagsBits.MoveMembers
                                ]
                            },
                            {
                                id: this.client.user.id,
                                allow: [
                                    PermissionFlagsBits.Connect,
                                    PermissionFlagsBits.Speak,
                                    PermissionFlagsBits.ManageChannels,
                                    PermissionFlagsBits.MoveMembers,
                                    PermissionFlagsBits.ViewChannel
                                ]
                            },
                            {
                                id: newState.guild.id,
                                allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                            }
                        ]
                    });

                    console.log(`Created temporary channel: ${tempChannel.name}`);

                    try {
                        // Try to move the user
                        await newState.setChannel(tempChannel.id);
                        console.log(`Successfully moved user to channel: ${tempChannel.name}`);
                    } catch (moveError) {
                        console.error('Error moving user:', moveError);
                        // If we can't move the user, clean up the channel
                        await tempChannel.delete().catch(console.error);
                        return;
                    }

                    // Set up cleanup interval
                    const checkEmpty = setInterval(async () => {
                        try {
                            const channel = await newState.guild.channels.fetch(tempChannel.id).catch(() => null);
                            if (!channel || channel.members.size === 0) {
                                await channel?.delete().catch(console.error);
                                clearInterval(checkEmpty);
                                this.temporaryChannels.delete(tempChannel.id);
                                console.log(`Deleted empty channel: ${tempChannel.name}`);
                            }
                        } catch (error) {
                            console.error('Error in cleanup interval:', error);
                            clearInterval(checkEmpty);
                            this.temporaryChannels.delete(tempChannel.id);
                        }
                    }, 5000);

                    this.temporaryChannels.set(tempChannel.id, checkEmpty);
                }

            } catch (error) {
                console.error('Error in voice state update:', error);
                if (error.code === 50013) {
                    console.error('Missing permissions for voice channel operations. Required permissions: MOVE_MEMBERS, MANAGE_CHANNELS');
                }
            }
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isCommand()) return;

            try {
                switch (interaction.commandName) {
                    case 'settrigger':
                        const channel = interaction.options.getChannel('channel');
                        if (channel.type !== ChannelType.GuildVoice) {
                            await interaction.reply({ content: 'Please select a voice channel.', ephemeral: true });
                            return;
                        }
                        Config.setTriggerChannelId(channel.id);
                        const triggerResponse = Config.isConfigured()
                            ? `Trigger channel set to: ${channel.name}\nBot is now fully configured and ready to use!`
                            : `Trigger channel set to: ${channel.name}\nNote: Category still needs to be set using /setcategory`;
                        await interaction.reply(triggerResponse);
                        break;

                    case 'setcategory':
                        const category = interaction.options.getChannel('category');
                        if (category.type !== ChannelType.GuildCategory) {
                            await interaction.reply({ content: 'Please select a category.', ephemeral: true });
                            return;
                        }
                        Config.setCategoryId(category.id);
                        const categoryResponse = Config.isConfigured()
                            ? `Category set to: ${category.name}\nBot is now fully configured and ready to use!`
                            : `Category set to: ${category.name}\nNote: Trigger channel still needs to be set using /settrigger`;
                        await interaction.reply(categoryResponse);
                        break;

                    case 'config':
                        const triggerChannel = interaction.guild.channels.cache.get(Config.TRIGGER_CHANNEL_ID);
                        const categoryChannel = Config.CATEGORY_ID ?
                            interaction.guild.channels.cache.get(Config.CATEGORY_ID) : null;

                        const configStatus = Config.isConfigured() ? '✅ Bot is fully configured' : '⚠️ Bot configuration incomplete';
                        await interaction.reply({
                            content: `${configStatus}
Current configuration:
Trigger Channel: ${triggerChannel ? `${triggerChannel.name} ✅` : 'Not set ❌'}
Category: ${categoryChannel ? `${categoryChannel.name} ✅` : 'Not set ❌'}

${!Config.isConfigured() ? 'Use /settrigger and /setcategory to complete configuration.' : ''}`,
                            ephemeral: true
                        });
                        break;
                }
            } catch (error) {
                console.error('Error handling command:', error);
                await interaction.reply({
                    content: 'An error occurred while executing the command.',
                    ephemeral: true
                });
            }
        });

        this.client.on('error', error => {
            console.error('Discord client error:', error);
        });

        this.client.on('warn', warning => {
            console.warn('Discord client warning:', warning);
        });
    }


    start() {
        if (!Config.TOKEN) {
            console.error('No Discord token provided. Please set the DISCORD_TOKEN environment variable.');
            process.exit(1);
        }

        this.client.login(Config.TOKEN).catch(error => {
            console.error('Failed to login:', error);
            process.exit(1);
        });
    }
}

const bot = new VoiceChannelBot();
bot.start();