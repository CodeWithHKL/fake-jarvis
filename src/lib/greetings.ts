/**
 * Opening lines Jarvis says when a session starts. One is picked at random.
 * They're plain text on purpose (no emojis, no markdown) because they get spoken.
 */
const GREETINGS = [
  "Yo, what's good? Jarvis here. Hold the spacebar and tell me what's up.",
  "Hey hey, Jarvis online. What are we getting into today?",
  "Okay, I'm awake. Jarvis at your service. What's the move?",
  "What's up! Jarvis here, ready to vibe and help. Hit me with it.",
  "Ayo, you're back. Jarvis is locked in. What do you need?",
  "Hey! It's Jarvis. No cap, I'm excited to chat. What's on your mind?",
  "Sup. Jarvis reporting for duty. Hold space and let's go.",
  "Heyyy, Jarvis here. Let's make today lowkey productive. What's first?",
];

export function pickGreeting(): string {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}
