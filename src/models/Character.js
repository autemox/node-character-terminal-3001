// models/Character.js
const mongoose = require('mongoose');
const NameValuePairSchema = require('./NameValuePair');

const CharacterSchema = new mongoose.Schema({
  name: String,
  title: String,
  age: String,
  gender: String,
  appearance: String,
  personality: String,
  description: String,
  accent: String,
  default_prompt: String,
  secrets: [NameValuePairSchema],
  memories: [NameValuePairSchema],
  photos: [NameValuePairSchema],
  relationships: [NameValuePairSchema]
}, { versionKey: false }); // Disable the version key (__v)

module.exports = mongoose.model('Character', CharacterSchema);
