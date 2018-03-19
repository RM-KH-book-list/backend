'use strict';

const dotenv = require('dotenv');
dotenv.config();

const PORT = process.env.PORT || 3000;
const ADMIN_PASSPHRASE = process.env.ADMIN_PASSPHRASE;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_API_URL = process.env.GOOGLE_API_URL;


const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const sa = require('superagent');

const app = express();

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const client = require('./db-client');

function ensureAdmin(request, response, next) {
    const token = request.get('token') || request.query.token;
    if (!token) next({ status: 401, message: 'no token found' });
    else if (token !== ADMIN_PASSPHRASE) next({ status: 403, message: 'unauthorized' });
    else next();
}

app.get('/api/v1/admin', (request, response) => {
    ensureAdmin(request, response, err => {
        response.send({ admin: !err });
    });
});

app.get('/api/v1/books/find', (request, response, next) => {
    const search = request.query.search;
    if(!search) return next({ status: 400, message: 'search query must be provided'});
                    
    sa.get(GOOGLE_API_URL)
        .query({
            q: search.trim(),
            key: GOOGLE_API_KEY
        })
        .then(res => {
            const body = res.body;

            const formatted = {
                books: body.items.map(volume => {
                    const gBook = volume.volumeInfo;
                    if (!gBook.industryIdentifiers) return null;
                    if (gBook.industryIdentifiers[0].type !== 'ISBN_10' && gBook.industryIdentifiers[0].type !== 'ISBN_13') return null;
                    return {
                        title: gBook.title,
                        author: gBook.authors ? gBook.authors[0] : 'no author listed',
                        isbn: gBook.industryIdentifiers[0].identifier,
                        image_url: gBook.imageLinks ? gBook.imageLinks.thumbnail : 'assets/book-img-placeholder.png',
                    };
                }).filter(Boolean)
            };
            response.send(formatted);
        })
        .catch(err => {
            console.error(err);
            response.sendStatus(500);
        });
});

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
    insertBook(body)
        .then(result => response.send(result))
        .catch(err => {
            console.error(err);
            response.sendStatus(500);
        });
});

function insertBook(book) {
    return client.query(`
        INSERT INTO books (title, author, image_url, isbn, description)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING book_id, title, author, image_url, isbn, description;
    `,[
        book.title,
        book.author,
        book.image_url,
        book.isbn,
        book.description
    ])
        .then(result => (result.rows[0]));
}

app.delete('/api/v1/books/:id', (request, response) => {
    const id = request.params.id;

    client.query(`
        DELETE FROM books
        WHERE book_id = $1;
    `,
    [id]
    )
        .then(result => response.send({ removed: result.rowCount !== 0 }))
        .catch(err => {
            console.error(err);
            response.sendStatus(500);
        });
});

app.put('/api/v1/books/:id', (request, response) => {
    const body = request.body;

    client.query(`
        UPDATE books
        SET title=$1,
        author=$2,
        image_url=$3,
        isbn=$4,
        description=$5
        WHERE book_id=$6
        RETURNING book_id,title,author,image_url,isbn,description;
    `,
    [body.title,
        body.author,
        body.image_url,
        body.isbn,
        body.description,
        request.params.id
    ]
    )
        .then(result => response.send(result.rows[0]))
        .catch(err => {
            console.error(err);
            response.sendStatus(500);
        });
});

app.put('/api/v1/books/import/:isbn', (request, response, next) => {
    const isbn = request.params.isbn;
    sa.get(GOOGLE_API_URL)
        .query({
            q: `isbn:${isbn}`,
            key: GOOGLE_API_KEY
        })
        .then(res => {
            const volume = res.body.items[0];
            const gBook = volume.volumeInfo;
            return insertBook({
                title: gBook.title,
                author: gBook.authors ? gBook.authors[0] : 'no author listed',
                isbn: isbn,
                image_url: gBook.imageLinks ? gBook.imageLinks.thumbnail : 'assets/book-img-placeholder.png',
                description: gBook.description || 'no description available'
            });
        })
        .then(result => response.send(result))
        .catch(next);
});

app.listen(PORT, () => {
    console.log('Server running on port', PORT);
});