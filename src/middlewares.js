// this contains middleware, software meant to protect the server not directly related to functionality of the server

const express = require('express');
const rateLimit = require("express-rate-limit");
const basicAuth = require('express-basic-auth');
const path = require('path');

// RATE LIMITATION
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 50, // limit each IP to 50 requests per windowMs
    message: "Too many requests, please try again later."
});

// PASSWORD PROTECTION
const basicAuthentication = basicAuth({
    users: { 'admin': 'Vadne123!' }, // username: 'admin', password: 'Vadne123!'
    challenge: true,
    realm: 'Imb4T3st4pp',
});

// SERVE STATIC FILES
const serveStaticFiles = express.static(path.join(__dirname, 'public'));
const setViewEngine = (app) => {
    app.set('view engine', 'ejs'); 
    app.set('views', path.join(__dirname, 'public'));
}

module.exports = {
    limiter,
    basicAuthentication,
    serveStaticFiles,
    setViewEngine
};
