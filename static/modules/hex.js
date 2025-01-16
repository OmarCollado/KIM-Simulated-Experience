export default class Hex {
    static typingSpeedMultiplier = 5;
    static #all = new Map();
    #name;
    #username;
    #wpm;
    #dpw;

    static member(name) {
        return Hex.#all.get(name);
    }

    constructor(name, username, wpm) {
        this.#name = name;
        this.#username = username;
        this.wpm = wpm;
        Hex.#all.set(name, this);
    }

    get wpm() {
        return this.#wpm;
    }

    set wpm(wpm) {
        this.#wpm = wpm;
        this.#dpw = wpm ? 60000 / (Hex.typingSpeedMultiplier * (parseInt(wpm) || 0)) : 0;
    }

    get name() {
        return this.#name;
    }

    get username() {
        return this.#username;
    }

    getTypingDelay(wordcount) {
        return this.#dpw * wordcount;
    }
}