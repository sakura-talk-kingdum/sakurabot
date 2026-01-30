import * as D from 'discord.js';

const indicators = "abcdefghijklmnopqrstuvwxyz0123456789".split("").map(letter => ({
  key: letter,
  emoji: `🇦`.codePointAt(0) + (letter.charCodeAt(0) - 97)
}));

const wait = ms => new Promise(res => setTimeout(res, ms));

