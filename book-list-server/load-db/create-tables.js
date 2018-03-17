'use strict';

const client = require('../db-client');

client.query(`
    CREATE TABLE IF NOT EXISTS books (
        book_id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        isbn VARCHAR(30) NOT NULL,
        image_url VARCHAR(255) NOT NULL,
        description TEXT NOT NULL
    );
`)
    .then(
        () => console.log('db task successful'),
        err => console.error(err)
    )
    .then(() => client.end());