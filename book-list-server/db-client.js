const dotenv = require('dotenv');
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

const pg = require('pg');
const Client = pg.Client;

const client = new Client(DATABASE_URL);
client.connect();

client.on('error', err => console.error(err));

module.exports = client;