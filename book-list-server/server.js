'use strict';

const dotenv = require('dotenv');
dotenv.config();

//const DATABASE_URL = process.env.DATABASE_URL;

const PORT = process.env.PORT || 3000;
const ADMIN_PASSPHRASE = process.env.ADMIN_PASSPHRASE;
// const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_API_KEY = 'AIzaSyCVlRuCB3RftI49iVl2lyu8m15AubMDl60';
// const GOOGLE_API_URL = process.env.GOOGLE_API_URL;
const GOOGLE_API_URL = 'https://www.googleapis.com/books/v1/volumes';


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
    console.log(search);
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
                    return {
                        title: volume.volumeInfo.title,
                        author: volume.volumeInfo.authors ? volume.volumeInfo.authors[0] : null,
                        isbn: volume.volumeInfo.industryIdentifiers[0].type + ' ' + volume.volumeInfo.industryIdentifiers[0].identifier,
                        image_url: volume.volumeInfo.imageLinks ? volume.volumeInfo.imageLinks.thumbnail : null,
                        description: volume.volumeInfo.description || null
                    };
                })
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

app.listen(PORT, () => {
    console.log('Server running on port', PORT);
});