'use strict';

const dotenv = require('dotenv');
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

const PORT = process.env.PORT || 3000;

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

const app = express();

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const client = require('./db-client');

app.get('/test', (request,response) => {
    response.send('Hello Test Route');
});

app.listen(PORT, () => {
    console.log('Server running on port', PORT);
});