const MessageRE = new RegExp(/^((?:&\w+\s?)+)?(?:(\w+):\s+)?(.*?)(?:\s+(?:>(E|\d+)|(?:(&\w+)\s?>(\d+):(\d+))))?$/);

export default class KNode {
    constructor(id) {
        this.id = id;
        this.messages = [];
        this.options = [];
        this.assigns = new Map();
    }

    static parseLine(line) {
        let parts = line.match(MessageRE);
        if (!parts) throw new Error(`Failed to parse line:\n${line}`);

        /* 0=full / 1=flags / 2=speaker (unused) / 3=dialogue / 4=dest / 5=ternarydest */

        parts[1] = parts[1] ? parts[1].trim().split(/\s+/) : null;

        let next = null;
        if (parts[4] === 'E') {
            next = 'END';
        }
        else if (parts[4]) {
            next = parts[4];
        }
        else if (parts[5]) {
            next = new KTest(parts[5], parts[6], parts[7] || null);
        }

        return new KMessage(parts[1], parts[3], next);
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

    doAssigns() {
        if (!this.assigns.size) return;
        for (let kv of this.assigns)
            GlobalFlags.set(kv[0], kv[1]);
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
        this.trueNode = trueNode;
        this.falseNode = falseNode;

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