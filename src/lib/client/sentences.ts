/**
 * Cuts a streaming reply into sentences so we can start speaking the first
 * sentence while the model is still writing the rest.
 *
 *   const s = new SentenceSplitter();
 *   s.push("Hello there. How a")  // -> ["Hello there."]   (rest is buffered)
 *   s.push("re you? Fine.")       // -> ["How are you?"]
 *   s.flush()                     // -> "Fine."            (whatever is left at the end)
 */

// Very short "sentences" ("Hi.", "Mr.") sound choppy and cost a request each, so merge them.
const MIN_LENGTH = 20;

export class SentenceSplitter {
  private buffer = "";

  /** Add new text; returns any sentences that are now complete. */
  push(text: string): string[] {
    this.buffer += text;
    const sentences: string[] = [];
    // A sentence ends with . ! or ? (plus optional closing quote) and then whitespace.
    const end = /[.!?]+["')\]]*\s+/g;
    let start = 0;
    let match: RegExpExecArray | null;
    while ((match = end.exec(this.buffer))) {
      const stop = match.index + match[0].length;
      const sentence = this.buffer.slice(start, stop).trim();
      if (sentence.length >= MIN_LENGTH) {
        sentences.push(sentence);
        start = stop;
      }
    }
    this.buffer = this.buffer.slice(start);
    return sentences;
  }

  /** Call when the reply is finished to get the last, unterminated piece. */
  flush(): string {
    const rest = this.buffer.trim();
    this.buffer = "";
    return rest;
  }
}

/** Remove markdown symbols the voice would otherwise read out ("asterisk asterisk"). */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) -> label
    .replace(/[*_#`~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
