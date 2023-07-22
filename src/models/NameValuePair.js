// models/NameValuePair.js
const mongoose = require('mongoose');

const NameValuePairSchema = new mongoose.Schema({
    name: String,
    value: Number
  }, {_id: false});

module.exports = NameValuePairSchema;
