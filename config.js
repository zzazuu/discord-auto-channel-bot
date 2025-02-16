require('dotenv').config();

class Config {
    static #data = {
        TOKEN: process.env.DISCORD_TOKEN,
        TRIGGER_CHANNEL_ID: process.env.TRIGGER_CHANNEL_ID,
        TEMP_CHANNEL_PREFIX: "🔊│",
        CATEGORY_ID: process.env.CATEGORY_ID || null
    };

    static get TOKEN() {
        return this.#data.TOKEN;
    }

    static get TRIGGER_CHANNEL_ID() {
        return this.#data.TRIGGER_CHANNEL_ID;
    }

    static get TEMP_CHANNEL_PREFIX() {
        return this.#data.TEMP_CHANNEL_PREFIX;
    }

    static get CATEGORY_ID() {
        return this.#data.CATEGORY_ID;
    }

    static setTriggerChannelId(id) {
        this.#data.TRIGGER_CHANNEL_ID = id;
        console.log(`Trigger channel ID set to: ${id}`);
        this.checkConfiguration();
    }

    static setCategoryId(id) {
        this.#data.CATEGORY_ID = id;
        console.log(`Category ID set to: ${id}`);
        this.checkConfiguration();
    }

    static isConfigured() {
        return Boolean(this.#data.TRIGGER_CHANNEL_ID && this.#data.CATEGORY_ID);
    }

    static checkConfiguration() {
        const missing = [];
        if (!this.#data.TRIGGER_CHANNEL_ID) missing.push('Trigger Channel');
        if (!this.#data.CATEGORY_ID) missing.push('Category');

        if (missing.length > 0) {
            console.warn('=== Configuration Status ===');
            console.warn(`Bot configuration incomplete. Missing: ${missing.join(', ')}`);
            console.warn('Required actions:');
            if (!this.#data.TRIGGER_CHANNEL_ID) {
                console.warn('- Set trigger channel using /settrigger command');
            }
            if (!this.#data.CATEGORY_ID) {
                console.warn('- Set category using /setcategory command');
            }
            console.warn('========================');
            return false;
        }

        console.log('=== Configuration Status ===');
        console.log('✅ Bot configuration complete');
        console.log(`- Trigger Channel ID: ${this.#data.TRIGGER_CHANNEL_ID}`);
        console.log(`- Category ID: ${this.#data.CATEGORY_ID}`);
        console.log('Ready to create temporary channels');
        console.log('========================');
        return true;
    }
}

module.exports = Config;