import GlobalFlags from "./flags.js";

const DestinationRE = new RegExp(/ *(?:&(!)?([a-zA-Z]+))?>([\d|E]+)(?::([\d|E]+))?$/);
const ConditionalRE = new RegExp(/(?:&(!)?([a-zA-Z]+) )/);

//const MessageRE = new RegExp(/^((?:&\w+\s?)+)?(?:(\w+):\s+)?(.*?)(?:\s+(?:>(E|\d+)|(?:(&\w+)\s?>([\d|E]+):([\d|E]+))))?$/);

export default class Conversation {
    static #loaded = null;

    constructor() {
        this.nodes = [];
    }

    static load(chatScript) {
        const chat = new Conversation();

        let currentNode = 0;
        chatScript.split(/\n\n/gm).forEach((chunk) => {
            chunk = chunk.trim();

            let head = chunk.match(/(?<=#)\d+/);
            if (head) {
                currentNode = head[0];
                if (chat.nodes[currentNode] !== undefined)
                    throw new Error("Attempt to redefine node " + currentNode);
                chat.nodes[currentNode] = new KNode(currentNode);
            }
            else {
                let parts = chunk.match(/^Drifter: (\[)?/);
                if (parts !== null)
                    chat.nodes[currentNode].addOptions(chunk);
                else {
                    parts = chunk.match(/^(&\w+)=(TRUE|FALSE)$/);
                    if (parts !== null)
                        chat.nodes[currentNode].addAssign(parts[1], parts[2]);
                    else
                        chat.nodes[currentNode].addMessage(chunk);
                }
            }
        });

        chat.nodes.forEach((node, idx) => {
            if (!node) console.warn("Missing in sequence: " + idx);
            else console.log(node.toString());
        });

        Conversation.#loaded = chat;
    }

    static get nodes() {
        return Conversation.#loaded.nodes;
    }

    toString() {
        return this.nodes.join("\n---");
    }
}

class KNode {
    constructor(id) {
        this.id = id;
        this.messages = [];
        this.options = [];
        this.assigns = new Map();
    }

    static parseDestination(invert, flag, dest1, dest2) {
        // e.g. [ "!", "DummyFlag", "22", "E" ]
        if (!parts.length) return null;

        if (dest1 === 'E') dest1 = 'END';
        if (dest2 === 'E') dest2 = 'END';

        // >E or >12 etc.
        if (flag === undefined)
            return parts[2];

        // &!DummyFlag>2:3 etc
        if (invert)
            [dest1, dest2] = [dest2, dest1];

        return new KTest(flag, dest1, dest2);
    }

    static parseConditional(invert, flag) {
        return invert ? () => !GlobalFlags.get(flag) : () => GlobalFlags.get(flag);
    }

    static parseLine(line) {
        let parts = line.split(DestinationRE);
        line = parts.shift();

        let next = null;
        if (parts.length)
            next = KNode.parseDestination(...parts);

        //["&DummyFlag", undefined, "DummyFlag", "&!OtherFlag", "!", "OtherFlag", "Broadsword: This is a test message."]
        parts = line.split(ConditionalRE);
        line = parts.pop();

        const tests = [];
        for (let i = 0; i < parts.length; i += 3)
            tests.push(KNode.parseConditional(parts[i + 1], parts[i + 2]));

        return new KMessage(tests, line, next);

        //let parts = line.match(MessageRE);
        //if (!parts) throw new Error(`Failed to parse line:\n${line}`);

        /* 0=full / 1=flags / 2=speaker (unused) / 3=dialogue / 4=dest / 5=ternarydest */

        //parts[1] = parts[1] ? parts[1].trim().split(/\s+/) : null;


        //return new KMessage(parts[1], parts[3], next);
    }

    addAssign(flag, value) {
        this.assigns.set(flag, value === "TRUE");
    }

    addMessage(message) {
        message.split("\n").forEach((line) => {
            this.messages.push(this.constructor.parseLine(line));
        });
    }

    addOptions(options) {
        if (this.options.length)
            throw new Error("Node " + this.id + " already has options!");

        let list = options.split(/\n\s*/);
        if (list.length === 1) {
            this.options.push(this.constructor.parseLine(list[0]));
        }
        else {
            if (list[0] !== "Drifter: [")
                throw new Error(`Malformed opts head: "${list[0]}"`);
            if (list[list.length - 1] !== "]")
                throw new Error(`Malformed opts tail: "${list[list.length - 1]}"`);

            list.slice(1, -1).forEach((line) => {
                this.options.push(this.constructor.parseLine(line));
            });
        }
    }

    toString() {
        let str = `ID: ${this.id}\nMESSAGES:\n`;
        this.messages.forEach((message) => str += message.toString().replaceAll(/^/gm, "\t") + "\n");
        str += `OPTIONS:\n`;
        this.options.forEach((option) => str += option.toString().replaceAll(/^/gm, "\t") + "\n");
        if (this.assigns.size)
            str += "ASSIGNS: " + Array.from(this.assigns).map((kv) => kv[0] + ' —> ' + kv[1]).join('; ');
        return str;
    }
}

class KMessage {
    constructor(flags, text, next) {
        this.flags = flags;
        this.text = text;
        this.next = next || null;
        this.wordcount = (this.text.match(/\b\w{2,}\b/g) || "").length

        if (flags)
            flags.forEach((flag) => {
                if (!GlobalFlags.has(flag))
                    GlobalFlags.set(flag, false);
            });
    }
    enabled() {
        return !this.flags || this.flags.every((flag) => GlobalFlags.get(flag));
    }
    toString() {
        let str = '';
        if (this.flags)
            str += "[CONDITIONAL: " + this.flags.join(" && ") + "] ";
        str += this.text;
        if (this.next) {
            str += " —> NEXT: " + this.next.toString();
        }
        return str;
    }
}

class KTest {
    constructor(flag, trueNode, falseNode) {
        this.flag = flag;
        this.trueNode = trueNode || null;
        this.falseNode = falseNode || null;

        if (!GlobalFlags.has(flag))
            GlobalFlags.set(flag, false);
    }
    enabled() {
        return true;
    }
    get next() {
        return GlobalFlags.get(this.flag) ? this.trueNode : this.falseNode;
    }
    toString() {
        let str = this.flag + " —> TRUE: " + this.trueNode.toString();
        if (this.falseNode)
            str += "; —> FALSE: " + this.falseNode.toString();
        return str;
    }
}