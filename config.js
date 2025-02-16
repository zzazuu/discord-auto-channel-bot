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
    }

    static setCategoryId(id) {
        this.#data.CATEGORY_ID = id;
    }
}

module.exports = Config;