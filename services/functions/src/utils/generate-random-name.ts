const colors = ["red", "green", "blue", "yellow", "purple", "orange", "pink"];

const adjectives = ["happy", "sad", "angry", "excited", "bored", "sleepy"];

const nouns = ["dog", "cat", "bird", "fish", "horse", "rabbit", "snake"];

export function generateRandomName() {
  const color = colors[Math.floor(Math.random() * colors.length)];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${color}-${adjective}-${noun}`;
}
