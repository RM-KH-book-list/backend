'use strict';

const dotenv = require('dotenv');
dotenv.config();

//const DATABASE_URL = process.env.DATABASE_URL;

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

app.get('/api/v1/books', (request, response) => {
    client.query(`
    SELECT book_id, title, author, image_url
    FROM books;
    `)
        .then(result => response.send(result.rows))
        .catch(err => {
            console.error(err);
            response.sendStatus(500);
        });
});

app.get('/api/v1/books/:id', (request, response) => {
    client.query(`
    SELECT book_id, title, author, image_url, isbn, description
    FROM books
    WHERE book_id = $1;
    `, [request.params.id])
        .then(result => response.send(result.rows[0]))
        .catch(err => {
            console.error(err);
            response.sendStatus(500);
        });
});


app.post('/api/v1/books', (request, response) => {
    const body = request.body;
    client.query(`
        INSERT INTO books (title, author, image_url, isbn, description)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING book_id, title, author, image_url, isbn, description;
    `,[
        body.title,
        body.author,
        body.image_url,
        body.isbn,
        body.description
    ]
    )
        .then(result => response.send(result.rows[0]))
        .catch(err => {
            console.error(err);
            response.sendStatus(500);
        });
});

app.listen(PORT, () => {
    console.log('Server running on port', PORT);
});